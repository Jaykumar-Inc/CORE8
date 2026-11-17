import { describe, expect, it, vi } from "vitest";
import {
  discoverDevices,
  probeDevice,
  validMirrorFrame,
} from "./hardware-discovery.mjs";
import { CPU, assemble, createOLEDFrame } from "@core8/cpu";
describe("Windows hotspot discovery", () => {
  it("accepts only bounded, clearly labeled demo mirror frames", () => {
    const cpu = new CPU();
    cpu.load(assemble("LDI 8\nOUT\nHLT").bytes);
    const events = cpu.run();
    const frame = createOLEDFrame(cpu.state, events);
    expect(validMirrorFrame(frame)).toBe(true);
    expect(validMirrorFrame({ ...frame, source: "hardware" })).toBe(false);
    expect(
      validMirrorFrame({
        ...frame,
        screens: [...frame.screens, { title: "extra", lines: [], emphasis: 0 }],
      }),
    ).toBe(false);
  });
  it("uses the current DHCP address and verifies candidates", async () => {
    const probe = vi.fn(async (ip) =>
      ip === "192.168.137.166"
        ? { ip, url: `http://${ip}`, firmware: "2.0.2" }
        : null,
    );
    const result = await discoverDevices({
      readClients: async () => ({
        state: "On",
        ssid: "JAY",
        candidates: ["192.168.137.166", "bad-host"],
      }),
      cachedIp: "192.168.137.52",
      probe,
    });
    expect(result.devices).toEqual([
      {
        ip: "192.168.137.166",
        url: "http://192.168.137.166",
        firmware: "2.0.2",
      },
    ]);
    expect(probe.mock.calls.map((call) => call[0])).toEqual([
      "192.168.137.166",
      "192.168.137.52",
    ]);
  });
  it("does not report cached addresses as connected without probing", async () => {
    const result = await discoverDevices({
      readClients: async () => ({ state: "Off", ssid: "JAY", candidates: [] }),
      cachedIp: "192.168.137.52",
      probe: async () => null,
    });
    expect(result.devices).toEqual([]);
    expect(result.error).toContain("hotspot is off");
  });
  it("reports discovery unavailable while preserving manual connection", async () => {
    const result = await discoverDevices({
      readClients: async () => {
        throw Error("Unsupported OS");
      },
      probe: async () => null,
    });
    expect(result.devices).toEqual([]);
    expect(result.error).toBe("Unsupported OS");
  });
  it("deduplicates addresses and never probes malformed hosts", async () => {
    const probe = vi.fn(async () => null);
    await discoverDevices({
      readClients: async () => ({
        state: "On",
        candidates: [
          "192.168.137.166",
          "192.168.137.166",
          "http://example.com",
          "999.1.1.1",
        ],
      }),
      probe,
    });
    expect(probe).toHaveBeenCalledTimes(1);
  });
  it("rejects non-IP probe targets before using the network", async () =>
    expect(await probeDevice("example.com")).toBeNull());
});
