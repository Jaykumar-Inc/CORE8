import { create } from "zustand";
import {
  CPU,
  assemble,
  commandSchema,
  ConnectionClock,
  traceSchema,
  type Command,
  type Snapshot,
  type Trace,
  type OLEDFrame,
  type OLEDPage,
  createOLEDFrame,
} from "@core8/cpu";
import {
  queueOLEDFrame,
  clearOLEDRelay,
  cancelOLEDRelay,
} from "./lib/oled-relay";
import { reference } from "./content";
const cpu = new CPU();
cpu.load(assemble(reference).bytes);
let demoSource = reference;
let hardwareRevision = 0;
type OLEDPreviewInput = {
  state: Snapshot;
  events: Trace[];
  programBytes: number;
};
let latestOLEDPreview: OLEDPreviewInput | undefined;
const clock = new ConnectionClock();
let socket: WebSocket | null = null;
let reconnect: ReturnType<typeof setTimeout> | undefined;
let connectionTimer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let commandId = 0;
const pending = new Map<
  number,
  { resolve: (ok: boolean) => void; timeout: ReturnType<typeof setTimeout> }
>();
const stopPlayback = () => {
  if (timer) clearInterval(timer);
  timer = undefined;
};
const resolvePending = () => {
  for (const item of pending.values()) {
    clearTimeout(item.timeout);
    item.resolve(false);
  }
  pending.clear();
};
const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private mode can disable storage. */
  }
};
const read = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
};
type Lab = {
  mode: "demo" | "hardware";
  state: Snapshot | null;
  events: Trace[];
  cursor: number;
  speed: number;
  playing: boolean;
  connected: boolean;
  discovering: boolean;
  connection: "offline" | "connecting" | "live";
  host: string;
  token: string;
  firmware: string;
  lastUpdate: number;
  error: string;
  source: string;
  loadedSource: string;
  programBytes: number;
  experiment: number;
  level: "beginner" | "student" | "advanced";
  page: string;
  theme: string;
  narration: boolean;
  completed: number[];
  answers: Record<number, number>;
  onboarded: boolean;
  oledPage: OLEDPage;
  oledSync: boolean;
  oledSyncStatus: "idle" | "sending" | "synced" | "offline" | "disabled";
  oledSyncError: string;
  oledDevice: string;
  display: OLEDFrame | null;
  demoDisplay: OLEDFrame | null;
  record: (event: Trace) => void;
  command: (cmd: Command) => Promise<boolean>;
  step: () => void;
  nextInstruction: () => void;
  play: () => void;
  pause: () => void;
  runAll: () => void;
  previous: () => void;
  live: () => void;
  replay: () => void;
  load: (source: string) => Promise<boolean>;
  runProgram: (source: string) => Promise<boolean>;
  syncOLED: (frame: OLEDFrame, preview?: OLEDPreviewInput) => void;
  setOLEDSync: (enabled: boolean) => void;
  setOLEDPage: (page: OLEDPage) => void;
  setMode: (mode: "demo" | "hardware") => void;
  connect: (isRecovery?: boolean) => void;
  discover: () => Promise<boolean>;
  disconnect: () => void;
  checkConnection: () => void;
  setSpeed: (speed: number) => void;
  complete: (id: number) => void;
  answer: (id: number, choice: number) => void;
  dismissOnboarding: () => void;
};
export const useLab = create<Lab>((set, get) => ({
  mode: "demo",
  state: structuredClone(cpu.state),
  events: [],
  cursor: -1,
  speed: 1,
  playing: false,
  connected: false,
  discovering: false,
  connection: "offline",
  host: read("core8-host", "http://192.168.1.100"),
  token: "",
  firmware: "",
  lastUpdate: 0,
  error: "",
  source: reference,
  loadedSource: reference,
  programBytes: assemble(reference).bytes.length,
  experiment: 0,
  level: "beginner",
  page: "Overview",
  theme: read("core8-theme", "dark"),
  narration: false,
  completed: read("core8-lessons", []),
  answers: read("core8-answers", {}),
  onboarded: read("core8-onboarded", false),
  oledPage: "learning",
  oledSync: read("core8-oled-sync", true),
  oledSyncStatus: "idle",
  oledSyncError: "",
  oledDevice: "",
  display: null,
  demoDisplay: null,
  syncOLED: (frame, preview) => {
    if (get().mode !== "demo") return;
    if (preview) latestOLEDPreview = preview;
    set({ demoDisplay: frame });
    if (!get().oledSync) return;
    set({ oledSyncStatus: "sending" });
    queueOLEDFrame(frame, get().token, (result) => {
      if (get().mode !== "demo" || !get().oledSync) return;
      set({
        oledSyncStatus: result.ok ? "synced" : "offline",
        oledSyncError: result.error ?? "",
        oledDevice: result.url ?? get().oledDevice,
      });
    });
  },
  setOLEDSync: (enabled) => {
    save("core8-oled-sync", enabled);
    set({
      oledSync: enabled,
      oledSyncStatus: enabled ? "idle" : "disabled",
      oledSyncError: "",
    });
    if (!enabled) void clearOLEDRelay(get().token);
    else if (get().demoDisplay) get().syncOLED(get().demoDisplay!);
  },
  setOLEDPage: (page) => {
    set({ oledPage: page });
    if (get().mode === "hardware")
      void get().command({ command: "oled", page });
    else {
      const preview =
        latestOLEDPreview ??
        (get().state
          ? {
              state: get().state!,
              events: get().events.slice(0, get().cursor + 1),
              programBytes: get().programBytes,
            }
          : undefined);
      if (preview)
        get().syncOLED(
          createOLEDFrame(preview.state, preview.events, {
            source: "demo",
            page,
            programBytes: preview.programBytes,
          }),
          preview,
        );
    }
  },
  runProgram: async (source) => {
    if (!(await get().load(source))) return false;
    get().live();
    get().play();
    return true;
  },
  record: (e) =>
    set((s) => {
      const events = [...s.events, e].slice(-512);
      const ended = ["halted", "error"].includes(e.state.status);
      if (ended && s.cursor === s.events.length - 1) stopPlayback();
      return {
        state: e.state,
        events,
        cursor:
          s.cursor === s.events.length - 1
            ? events.length - 1
            : Math.max(0, s.cursor - (s.events.length === 512 ? 1 : 0)),
        error: e.state.error,
        playing: ended ? false : s.playing,
        display: e.display ?? s.display,
      };
    }),
  command: async (cmd) => {
    commandSchema.parse(cmd);
    if (get().mode === "hardware") {
      if (!get().connected || !socket || socket.readyState !== WebSocket.OPEN) {
        set({ error: "ESP32 is offline. Connect before sending commands." });
        return false;
      }
      const id = ++commandId;
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          set({
            error:
              "ESP32 did not acknowledge the command. Check the connection.",
          });
          resolve(false);
        }, 5000);
        pending.set(id, { resolve, timeout });
        socket!.send(JSON.stringify({ ...cmd, id, token: get().token }));
      });
    }
    if (
      ["load", "step", "instruction"].includes(cmd.command) &&
      cpu.state.status === "running"
    ) {
      set({ error: "Pause before loading or stepping." });
      return false;
    }
    if (
      ["run", "step", "instruction"].includes(cmd.command) &&
      ["halted", "error"].includes(cpu.state.status)
    ) {
      set({ error: "Reset before running a halted or faulted CPU." });
      return false;
    }
    switch (cmd.command) {
      case "oled":
        set({ oledPage: cmd.page });
        break;
      case "reset":
        cpu.reset();
        set({
          state: structuredClone(cpu.state),
          events: [],
          cursor: -1,
          error: "",
        });
        break;
      case "load":
        cpu.load(cmd.program);
        set({
          state: structuredClone(cpu.state),
          events: [],
          cursor: -1,
          error: "",
        });
        break;
      case "step": {
        const e = cpu.step();
        if (e) get().record(e);
        break;
      }
      case "instruction":
        cpu.instruction().forEach(get().record);
        break;
      case "run":
        cpu.state.status = "running";
        set({ state: structuredClone(cpu.state) });
        break;
      case "pause":
        if (cpu.state.status === "running") cpu.state.status = "paused";
        set({ state: structuredClone(cpu.state) });
        break;
      case "speed":
        break;
    }
    return true;
  },
  step: () => {
    if (get().cursor < get().events.length - 1) {
      stopPlayback();
      set({ playing: false, cursor: get().cursor + 1 });
    } else {
      get().pause();
      void get().command({ command: "step" });
    }
  },
  nextInstruction: () => {
    if (get().cursor < get().events.length - 1) {
      stopPlayback();
      const index = get().events.findIndex(
        (e, i) => i > get().cursor && e.state.stage === "writeback",
      );
      set({
        playing: false,
        cursor: index < 0 ? get().events.length - 1 : index,
      });
    } else {
      get().pause();
      void get().command({ command: "instruction" });
    }
  },
  play: () => {
    if (get().playing) return;
    set({ playing: true });
    if (get().cursor === get().events.length - 1)
      void get().command({ command: "run" });
    timer = setInterval(() => {
      const s = get();
      if (s.cursor < s.events.length - 1) {
        set({ cursor: s.cursor + 1 });
        if (s.cursor + 1 === s.events.length - 1) {
          stopPlayback();
          set({ playing: false });
        }
        return;
      }
      if (s.mode === "demo") {
        const event = cpu.step();
        if (event) s.record(event);
        if (!event || ["halted", "error"].includes(cpu.state.status)) {
          if (timer) clearInterval(timer);
          set({ playing: false });
        }
      }
    }, 700 / get().speed);
  },
  pause: () => {
    stopPlayback();
    set({ playing: false });
    if (
      get().mode === "demo" ||
      (get().connected &&
        get().state?.status === "running" &&
        get().cursor === get().events.length - 1)
    )
      void get().command({ command: "pause" });
  },
  runAll: () => {
    get().pause();
    get().live();
    if (get().mode === "demo") {
      cpu.run().slice(-512).forEach(get().record);
    } else {
      void get().command({ command: "speed", speed: 4 });
      void get().command({ command: "run" });
    }
  },
  previous: () => {
    stopPlayback();
    set({ playing: false, cursor: Math.max(0, get().cursor - 1) });
  },
  live: () => set({ cursor: get().events.length - 1 }),
  replay: () => {
    stopPlayback();
    const s = get();
    if (!s.events.length) return;
    let end = s.events.length - 1;
    while (end > 0 && s.events[end].state.stage !== "writeback") end--;
    let start = end;
    while (start > 0 && s.events[start].state.stage !== "fetch") start--;
    set({ playing: false, cursor: start });
  },
  load: async (source) => {
    try {
      const { bytes } = assemble(source);
      get().pause();
      if (
        get().mode === "hardware" &&
        get().connected &&
        get().state?.status === "running" &&
        get().cursor < get().events.length - 1
      ) {
        if (!(await get().command({ command: "pause" }))) return false;
      }
      const ok = await get().command({ command: "load", program: bytes });
      if (ok) {
        if (get().mode === "demo") demoSource = source;
        set({
          source,
          loadedSource: source,
          programBytes: bytes.length,
          error: "",
        });
      }
      return ok;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    }
  },
  setMode: (mode) => {
    stopPlayback();
    cancelOLEDRelay();
    latestOLEDPreview = undefined;
    if (mode === "hardware" && get().oledSync) void clearOLEDRelay(get().token);
    if (cpu.state.status === "running") cpu.state.status = "paused";
    get().disconnect();
    hardwareRevision = 0;
    set({
      mode,
      state: mode === "demo" ? structuredClone(cpu.state) : null,
      source: mode === "demo" ? demoSource : get().source,
      loadedSource: mode === "demo" ? demoSource : "",
      programBytes: mode === "demo" ? cpu.program.length : 0,
      events: [],
      cursor: -1,
      error: "",
      display: null,
      demoDisplay: null,
      oledSyncStatus: "idle",
    });
  },
  discover: async () => {
    get().disconnect();
    const searchGeneration = generation;
    set({ discovering: true, error: "", connection: "connecting" });
    try {
      const response = await fetch("/api/hardware/discover", {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw Error(
          "Device discovery is unavailable. Use START_SERVER.bat and enter the ESP32 IP from Serial Monitor.",
        );
      if (
        response.headers?.get("content-type") &&
        !response.headers.get("content-type")?.includes("application/json")
      )
        throw Error(
          "Device discovery needs the local CORE8 server. Use START_SERVER.bat or enter the ESP32 IP manually.",
        );
      const result = await response.json();
      if (searchGeneration !== generation || get().mode !== "hardware")
        return false;
      const devices = Array.isArray(result.devices) ? result.devices : [];
      const device =
        devices.find((item: { url: string }) => item.url === get().host) ??
        (devices.length === 1 ? devices[0] : undefined);
      if (!device || typeof device.url !== "string")
        throw Error(
          result.error ??
            "Several boards were found. Enter the required ESP32 address manually.",
        );
      const address = new URL(device.url);
      if (
        address.protocol !== "http:" ||
        !/^\d{1,3}(\.\d{1,3}){3}$/.test(address.hostname) ||
        address.username ||
        address.password ||
        address.pathname !== "/" ||
        address.port ||
        address.search ||
        address.hash
      )
        throw Error("Discovery returned an invalid ESP32 address.");
      set({ host: address.origin, discovering: false });
      save("core8-host", address.origin);
      get().connect(true);
      return true;
    } catch (error) {
      if (searchGeneration === generation)
        set({
          discovering: false,
          connection: "offline",
          error: (error as Error).message,
        });
      return false;
    }
  },
  connect: (isRecovery = false) => {
    get().disconnect();
    const id = ++generation;
    let url: URL;
    try {
      url = new URL(get().host);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== "/"
      )
        throw Error();
    } catch {
      set({
        error: "Enter an ESP32 base URL, for example http://192.168.1.100",
      });
      return;
    }
    save("core8-host", get().host);
    set({ connection: "connecting", error: "" });
    let recoveryAllowed = !isRecovery;
    const open = () => {
      if (id !== generation || get().mode !== "hardware") return;
      const wsUrl = new URL(url);
      wsUrl.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      wsUrl.port = "81";
      wsUrl.pathname = "/ws";
      const ws = new WebSocket(wsUrl, "arduino");
      socket = ws;
      const connectionFailed = () => {
        if (id !== generation) return;
        if (connectionTimer) clearTimeout(connectionTimer);
        if (recoveryAllowed) {
          recoveryAllowed = false;
          void get().discover();
          return;
        }
        set({
          error: `Cannot connect to ${url.hostname}:81. Open the dashboard at http://127.0.0.1:5173, use Find ESP32, and check browser local-network permission.`,
        });
      };
      connectionTimer = setTimeout(connectionFailed, 15000);
      ws.onopen = () => {
        if (id !== generation) return;
        set({ error: "" });
        void fetch(new URL("/api/health", url), {
          signal: AbortSignal.timeout(3000),
        })
          .then((r) => r.json())
          .then((h) => {
            if (id === generation)
              set({ firmware: String(h.firmware ?? "unknown") });
          })
          .catch(() => {});
      };
      ws.onmessage = ({ data }) => {
        if (id !== generation) return;
        try {
          if (String(data).length > 20000) throw Error("Telemetry too large");
          const raw = JSON.parse(String(data));
          if (raw.type === "ack") {
            const item = pending.get(raw.id);
            if (item) {
              clearTimeout(item.timeout);
              item.resolve(raw.ok === true);
              pending.delete(raw.id);
            }
            if (!raw.ok) set({ error: raw.error ?? "Command rejected" });
            return;
          }
          const event = traceSchema.parse(raw);
          // A successful session may recover again if DHCP changes on a later reconnect.
          recoveryAllowed = true;
          if (connectionTimer) clearTimeout(connectionTimer);
          clock.receive(Date.now());
          set({ connected: true, connection: "live", lastUpdate: Date.now() });
          if ([0.25, 0.5, 1, 2, 4].includes(raw.speed))
            set({ speed: raw.speed });
          if (
            Number.isInteger(raw.programRevision) &&
            raw.programRevision !== hardwareRevision
          ) {
            hardwareRevision = raw.programRevision;
            set({ loadedSource: "" });
          }
          if (get().events.length && event.seq < get().events.at(-1)!.seq)
            set({ events: [], cursor: -1 });
          if (
            Number.isInteger(raw.programLength) &&
            raw.programLength >= 2 &&
            raw.programLength <= 256
          )
            set({ programBytes: raw.programLength });
          if (get().events.length && event.seq === get().events.at(-1)!.seq) {
            if (
              event.state.status !== "running" &&
              get().cursor === get().events.length - 1
            ) {
              stopPlayback();
              set({ playing: false });
            }
            set({
              state: event.state,
              display: event.display ?? get().display,
            });
            return;
          }
          get().record(event);
        } catch {
          set({
            error:
              "Received invalid telemetry. Check firmware and protocol versions.",
          });
        }
      };
      ws.onerror = connectionFailed;
      ws.onclose = () => {
        if (id !== generation) return;
        if (connectionTimer) clearTimeout(connectionTimer);
        clock.offline();
        resolvePending();
        stopPlayback();
        set({ connected: false, connection: "offline", playing: false });
        reconnect = setTimeout(open, 2500);
      };
    };
    open();
  },
  disconnect: () => {
    generation++;
    if (reconnect) clearTimeout(reconnect);
    if (connectionTimer) clearTimeout(connectionTimer);
    clock.offline();
    resolvePending();
    stopPlayback();
    if (socket) {
      socket.onclose = null;
      socket.close();
      socket = null;
    }
    set({
      connected: false,
      discovering: false,
      connection: "offline",
      playing: false,
    });
  },
  checkConnection: () => {
    if (
      get().mode === "hardware" &&
      get().connected &&
      !clock.isLive(Date.now())
    ) {
      clock.offline();
      set({
        connected: false,
        connection: "offline",
        error: "Telemetry is stale. Reconnecting…",
      });
      socket?.close();
    }
  },
  setSpeed: (speed) => {
    const playing =
      get().playing ||
      (get().mode === "hardware" && get().state?.status === "running");
    get().pause();
    set({ speed });
    if (get().mode === "demo" || get().connected)
      void get().command({
        command: "speed",
        speed: speed as 0.25 | 0.5 | 1 | 2 | 4,
      });
    if (playing) get().play();
  },
  complete: (id) => {
    const completed = [...new Set([...get().completed, id])];
    save("core8-lessons", completed);
    set({ completed });
  },
  answer: (id, choice) => {
    const answers = { ...get().answers, [id]: choice };
    save("core8-answers", answers);
    set({ answers });
  },
  dismissOnboarding: () => {
    save("core8-onboarded", true);
    set({ onboarded: true });
  },
}));
export function useVisible() {
  return useLab((s) =>
    s.cursor < s.events.length - 1
      ? (s.events[s.cursor]?.state ?? s.state)
      : s.state,
  );
}
export function useEvent() {
  return useLab((s) => s.events[s.cursor]);
}
export function setTheme(theme: string) {
  save("core8-theme", theme);
  useLab.setState({ theme });
}
