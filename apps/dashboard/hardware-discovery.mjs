import { execFile } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { isIPv4 } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let activeDiscovery;
let verifiedDevice,
  verifiedAt = 0;

export async function readHotspotClients() {
  if (process.platform !== "win32")
    throw Error(
      "Automatic hotspot discovery is available on Windows. Enter the ESP32 address manually.",
    );
  const { stdout } = await execute(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve(root, "scripts/discover-device.ps1"),
    ],
    { windowsHide: true, timeout: 10000, maxBuffer: 256 * 1024 },
  );
  return JSON.parse(stdout.replace(/^\uFEFF/, ""));
}
export async function probeDevice(ip) {
  if (!isIPv4(ip)) return null;
  try {
    const response = await fetch(`http://${ip}/api/health`, {
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return null;
    const health = await response.json();
    if (
      health.ok !== true ||
      health.protocol !== 1 ||
      health.wifi !== true ||
      typeof health.firmware !== "string"
    )
      return null;
    return { ip, url: `http://${ip}`, firmware: health.firmware };
  } catch {
    return null;
  }
}
export async function discoverDevices({
  readClients = readHotspotClients,
  probe = probeDevice,
  cachedIp,
} = {}) {
  let hotspot, error;
  try {
    hotspot = await readClients();
  } catch (e) {
    error = e.message;
  }
  const candidates = [
    ...new Set(
      [...(hotspot?.candidates ?? []), cachedIp].filter(
        (ip) => typeof ip === "string" && isIPv4(ip),
      ),
    ),
  ].slice(0, 8);
  const devices = (await Promise.all(candidates.map(probe))).filter(Boolean);
  return {
    devices,
    hotspot: hotspot ? { state: hotspot.state, ssid: hotspot.ssid } : null,
    error: devices.length
      ? undefined
      : (error ??
        (hotspot?.state === "Off"
          ? "The laptop hotspot is off. Enable it and try again."
          : "No connected CORE8 ESP32 was found. Check hotspot power and Serial Monitor.")),
  };
}
async function findDevices() {
  if (activeDiscovery) return activeDiscovery;
  activeDiscovery = (async () => {
    let cachedIp;
    try {
      cachedIp = JSON.parse(
        await readFile(resolve(root, "artifacts/hardware/device.json"), "utf8"),
      ).ip;
    } catch {
      /* First connection has no cached address. */
    }
    const result = await discoverDevices({ cachedIp });
    if (result.devices.length === 1) {
      verifiedDevice = result.devices[0];
      verifiedAt = Date.now();
      await mkdir(resolve(root, "artifacts/hardware"), { recursive: true });
      await writeFile(
        resolve(root, "artifacts/hardware/device.json"),
        JSON.stringify(
          { ...result.devices[0], ssid: result.hotspot?.ssid },
          null,
          2,
        ),
      );
    }
    return result;
  })();
  try {
    return await activeDiscovery;
  } finally {
    activeDiscovery = undefined;
  }
}
function installDiscovery(server) {
  server.middlewares.use("/api/hardware/oled", async (req, res, next) => {
    if (req.url !== "/" && req.url !== "") return next();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST" && req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Use GET or POST" }));
      return;
    }
    try {
      let payload;
      if (req.method === "POST") {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4096) throw Error("OLED frame is too large.");
          chunks.push(chunk);
        }
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (payload.enabled !== false && !validMirrorFrame(payload.frame))
          throw Error(
            "A labeled demo frame with three OLED screens is required.",
          );
      }
      if (!verifiedDevice || Date.now() - verifiedAt > 30000) {
        const found = await findDevices();
        if (found.devices.length !== 1)
          throw Error(found.error ?? "Select one connected CORE8 ESP32.");
      }
      let response;
      try {
        response = await fetch(`${verifiedDevice.url}/api/oled`, {
          method: req.method,
          headers:
            req.method === "POST"
              ? { "Content-Type": "application/json" }
              : undefined,
          body: payload ? JSON.stringify(payload) : undefined,
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        verifiedDevice = undefined;
        throw Error(
          "ESP32 disconnected. Use Find ESP32 to refresh its address.",
        );
      }
      if (response.status === 404)
        throw Error("Update ESP32 firmware to 2.1.0 for enhanced OLED sync.");
      const value = await response.json();
      res.statusCode = response.status;
      res.end(
        JSON.stringify(
          req.method === "GET"
            ? { ...value, url: verifiedDevice.url }
            : { ...value, url: verifiedDevice.url },
        ),
      );
    } catch (error) {
      res.statusCode = 503;
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
  });
  server.middlewares.use("/api/hardware/discover", async (req, res, next) => {
    if (req.url !== "/" && req.url !== "") return next();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Use GET" }));
      return;
    }
    try {
      res.end(JSON.stringify(await findDevices()));
    } catch (error) {
      res.statusCode = 503;
      res.end(JSON.stringify({ devices: [], error: error.message }));
    }
  });
}
export function validMirrorFrame(frame) {
  const text = (value) =>
    typeof value === "string" &&
    value.length <= 25 &&
    /^[\x20-\x7e]*$/.test(value);
  return (
    frame?.source === "demo" &&
    ["learning", "binary", "network"].includes(frame.page) &&
    ["ready", "fetch", "decode", "execute", "writeback"].includes(
      frame.stage,
    ) &&
    Array.isArray(frame.screens) &&
    frame.screens.length === 3 &&
    frame.screens.every(
      (s) =>
        text(s.title) &&
        Array.isArray(s.lines) &&
        s.lines.length === 5 &&
        s.lines.every(text) &&
        Number.isInteger(s.emphasis) &&
        s.emphasis >= 0 &&
        s.emphasis <= 4,
    )
  );
}
export function hardwareDiscovery() {
  return {
    name: "core8-hardware-discovery",
    configureServer: installDiscovery,
    configurePreviewServer: installDiscovery,
  };
}
