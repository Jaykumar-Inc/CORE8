import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { CPU, assemble, createOLEDFrame } from "@core8/cpu";
import { cancelOLEDRelay, clearOLEDRelay, queueOLEDFrame } from "./oled-relay";
const frame = (value: number) => {
  const cpu = new CPU();
  cpu.load(assemble(`LDI ${value}\nOUT\nHLT`).bytes);
  const events = cpu.run();
  return createOLEDFrame(cpu.state, events);
};
const response = () =>
  new Response(JSON.stringify({ ok: true, url: "http://192.168.137.166" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => response()),
  );
  cancelOLEDRelay();
});
afterEach(() => {
  cancelOLEDRelay();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("laptop-to-OLED display relay", () => {
  it("sends labeled demo display data without a CPU execution command", async () => {
    const report = vi.fn();
    queueOLEDFrame(frame(8), "lab-token", report);
    await vi.advanceTimersByTimeAsync(1000);
    const options = vi.mocked(fetch).mock.calls[0][1]!;
    const payload = JSON.parse(String(options.body));
    expect(payload.frame.source).toBe("demo");
    expect(payload.token).toBe("lab-token");
    expect(payload.command).toBeUndefined();
    expect(report).toHaveBeenCalledWith({
      ok: true,
      url: "http://192.168.137.166",
    });
  });
  it("coalesces pending animation stages and still delivers the final result", async () => {
    let complete!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    queueOLEDFrame(frame(1), "", vi.fn());
    await vi.advanceTimersByTimeAsync(1000);
    queueOLEDFrame(frame(2), "", vi.fn());
    queueOLEDFrame(frame(8), "", vi.fn());
    expect(fetch).toHaveBeenCalledTimes(1);
    complete(response());
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]!.body));
    expect(payload.frame.screens[2].lines[1]).toContain("OUT 008");
  });
  it("reports an offline mirror without blocking the local simulator", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(Error("Device offline"));
    const report = vi.fn();
    queueOLEDFrame(frame(42), "", report);
    await vi.advanceTimersByTimeAsync(1000);
    expect(report).toHaveBeenCalledWith({ ok: false, error: "Device offline" });
    expect(frame(42).screens[2].lines[1]).toContain("042");
  });
  it("releases the display when mirroring is disabled", async () => {
    await clearOLEDRelay("lab");
    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body));
    expect(payload).toEqual({ enabled: false, token: "lab" });
  });
});
