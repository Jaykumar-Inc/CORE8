import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CPU, assemble } from "@core8/cpu";
import { useLab } from "./store";
class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 1;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(
    public url: string,
    public protocol: string,
  ) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}
const lab = () => useLab.getState();
const trace = () => {
  const c = new CPU();
  c.load(assemble("LDI 9\nOUT\nHLT").bytes);
  return c.step()!;
};
beforeEach(() => {
  useLab.setState({ oledSync: false });
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ json: async () => ({ firmware: "2.0.0" }) }),
  );
  lab().setMode("demo");
  void lab().command({ command: "reset" });
  FakeSocket.instances = [];
});
afterEach(() => {
  lab().disconnect();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("dashboard execution and recorded playback", () => {
  it("loads the selected laptop experiment before starting execution", async () => {
    await lab().load("LDI 1\nHLT");
    expect(await lab().runProgram("LDI 42\nOUT\nHLT")).toBe(true);
    vi.advanceTimersByTime(700 * 14);
    expect(lab().state?.output).toBe(42);
    expect(lab().loadedSource).toBe("LDI 42\nOUT\nHLT");
  });
  it("loads and executes the real deterministic demo engine", async () => {
    await lab().load("LDI 5\nADD 3\nSTA 20\nLDA 20\nOUT\nHLT");
    lab().runAll();
    expect(lab().state?.output).toBe(8);
    expect(lab().state?.ram[20]).toBe(8);
    expect(lab().events).toHaveLength(24);
    expect(lab().cursor).toBe(23);
  });
  it("changes only the recorded cursor on Previous", async () => {
    await lab().load("LDI 9\nOUT\nHLT");
    lab().runAll();
    const current = structuredClone(lab().state);
    lab().previous();
    expect(lab().cursor).toBe(10);
    expect(lab().state).toEqual(current);
    lab().nextInstruction();
    expect(lab().cursor).toBe(11);
    expect(lab().state).toEqual(current);
  });
  it("plays one stage at a time and stops at halt", async () => {
    await lab().load("LDI 9\nOUT\nHLT");
    lab().play();
    vi.advanceTimersByTime(700);
    expect(lab().state?.stage).toBe("fetch");
    vi.advanceTimersByTime(700 * 12);
    expect(lab().state?.status).toBe("halted");
    expect(lab().playing).toBe(false);
  });
  it("replay ends at the latest snapshot without executing again", async () => {
    await lab().load("LDI 9\nOUT\nHLT");
    lab().runAll();
    lab().replay();
    const cycles = lab().state?.cycles;
    const count = lab().events.length;
    lab().play();
    vi.advanceTimersByTime(700 * 20);
    expect(lab().events).toHaveLength(count);
    expect(lab().state?.cycles).toBe(cycles);
    expect(lab().playing).toBe(false);
  });
  it("retains only 512 stages without losing final state", async () => {
    await lab().load("LDI 150\nloop: DEC\nJZ done\nJMP loop\ndone: OUT\nHLT");
    lab().runAll();
    expect(lab().events).toHaveLength(512);
    expect(lab().state?.output).toBe(0);
    expect(lab().cursor).toBe(511);
  });
  it("reports assembler errors without replacing the loaded CPU program", async () => {
    await lab().load("LDI 7\nHLT");
    await lab().load("LDI 999");
    expect(lab().error).toContain("0–255");
    expect(lab().loadedSource).toBe("LDI 7\nHLT");
  });
});
describe("ESP32 telemetry and command integration", () => {
  it("runs the loaded program only after the ESP32 acknowledges it", async () => {
    const ws = connect();
    ws.message(trace());
    const running = lab().runProgram("LDI 8\nOUT\nHLT");
    expect(ws.sent.map((value) => JSON.parse(value).command)).toEqual(["load"]);
    ws.message({ type: "ack", id: JSON.parse(ws.sent[0]).id, ok: true });
    expect(await running).toBe(true);
    expect(ws.sent.map((value) => JSON.parse(value).command)).toEqual([
      "load",
      "run",
    ]);
  });
  function connect() {
    lab().setMode("hardware");
    useLab.setState({ host: "http://192.168.1.123" });
    lab().connect();
    const ws = FakeSocket.instances.at(-1)!;
    ws.onopen?.();
    return ws;
  }
  it("has no fabricated CPU state in hardware mode", () => {
    const ws = connect();
    expect(lab().state).toBeNull();
    expect(lab().connected).toBe(false);
    expect(String(ws.url)).toBe("ws://192.168.1.123:81/ws");
    expect(ws.protocol).toBe("arduino");
  });
  it("accepts only validated telemetry before marking live", () => {
    const ws = connect();
    ws.message({ acc: 42 });
    expect(lab().connected).toBe(false);
    expect(lab().state).toBeNull();
    ws.message(trace());
    expect(lab().connected).toBe(true);
    expect(lab().state?.ir).toBe(1);
  });
  it("stops marking stale telemetry as live and preserves its last state", () => {
    const ws = connect();
    ws.message(trace());
    const last = lab().state;
    vi.advanceTimersByTime(6001);
    lab().checkConnection();
    expect(lab().connected).toBe(false);
    expect(lab().connection).toBe("offline");
    expect(lab().state).toEqual(last);
  });
  it("does not add duplicate heartbeat snapshots to history", () => {
    const ws = connect(),
      e = trace();
    ws.message(e);
    ws.message({ ...e, state: { ...e.state, status: "paused" } });
    expect(lab().events).toHaveLength(1);
    expect(lab().state?.status).toBe("paused");
  });
  it("waits for command acknowledgement and reports rejections", async () => {
    const ws = connect();
    ws.message(trace());
    const result = lab().command({ command: "step" });
    const sent = JSON.parse(ws.sent.at(-1)!);
    expect(sent.command).toBe("step");
    ws.message({
      type: "ack",
      id: sent.id,
      ok: false,
      error: "Pause before stepping",
    });
    expect(await result).toBe(false);
    expect(lab().error).toBe("Pause before stepping");
  });
  it("does not mark a rejected program as loaded", async () => {
    const ws = connect();
    ws.message(trace());
    const load = lab().load("LDI 42\nHLT");
    const sent = JSON.parse(ws.sent.at(-1)!);
    ws.message({
      type: "ack",
      id: sent.id,
      ok: false,
      error: "Invalid control token",
    });
    await load;
    expect(lab().loadedSource).toBe("");
    expect(lab().error).toBe("Invalid control token");
  });
  it("never sends commands while reviewing recorded history", () => {
    const ws = connect(),
      e = trace();
    ws.message(e);
    ws.message({ ...e, seq: 2 });
    ws.message({ ...e, seq: 3 });
    lab().previous();
    lab().previous();
    lab().step();
    lab().nextInstruction();
    lab().replay();
    expect(ws.sent).toEqual([]);
  });
  it("reconnects without creating more than one active socket", () => {
    const ws = connect();
    ws.close();
    vi.advanceTimersByTime(2500);
    expect(FakeSocket.instances).toHaveLength(2);
    lab().disconnect();
    vi.advanceTimersByTime(10000);
    expect(FakeSocket.instances).toHaveLength(2);
  });
  it("pauses replay without pausing a running physical CPU", () => {
    const ws = connect(),
      e = trace();
    for (let seq = 1; seq <= 3; seq++)
      ws.message({ ...e, seq, state: { ...e.state, status: "running" } });
    lab().previous();
    lab().play();
    lab().pause();
    expect(ws.sent).toEqual([]);
    expect(lab().state?.status).toBe("running");
  });
  it("rejects invalid base URLs before opening a socket", () => {
    lab().setMode("hardware");
    useLab.setState({ host: "javascript:alert(1)" });
    lab().connect();
    expect(FakeSocket.instances).toHaveLength(0);
    expect(lab().error).toContain("base URL");
  });
  it("finds the current DHCP address and connects without simulated telemetry", async () => {
    lab().setMode("hardware");
    useLab.setState({ host: "http://192.168.137.52" });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        devices: [
          {
            ip: "192.168.137.166",
            url: "http://192.168.137.166",
            firmware: "2.0.2",
          },
        ],
      }),
    } as Response);
    expect(await lab().discover()).toBe(true);
    expect(lab().host).toBe("http://192.168.137.166");
    expect(String(FakeSocket.instances.at(-1)?.url)).toBe(
      "ws://192.168.137.166:81/ws",
    );
    expect(lab().state).toBeNull();
    expect(lab().connected).toBe(false);
  });
  it("automatically discovers a replacement after a stale-address socket failure", async () => {
    const ws = connect();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ devices: [{ url: "http://192.168.137.166" }] }),
    } as Response);
    ws.onerror?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(lab().host).toBe("http://192.168.137.166");
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].onerror?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.instances).toHaveLength(2);
  });
  it("does not overwrite a newer connection with an old discovery result", async () => {
    lab().setMode("hardware");
    let finish!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const searching = lab().discover();
    lab().disconnect();
    finish({
      ok: true,
      json: async () => ({ devices: [{ url: "http://192.168.137.166" }] }),
    } as Response);
    expect(await searching).toBe(false);
    expect(lab().discovering).toBe(false);
    expect(FakeSocket.instances).toHaveLength(0);
  });
  it("can discover another DHCP change after a recovered session became live", async () => {
    const ws = connect();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ devices: [{ url: "http://192.168.137.166" }] }),
    } as Response);
    ws.onerror?.();
    await vi.advanceTimersByTimeAsync(0);
    const recovered = FakeSocket.instances.at(-1)!;
    recovered.message(trace());
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ devices: [{ url: "http://192.168.137.180" }] }),
    } as Response);
    recovered.onerror?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(lab().host).toBe("http://192.168.137.180");
    expect(FakeSocket.instances).toHaveLength(3);
  });
});
