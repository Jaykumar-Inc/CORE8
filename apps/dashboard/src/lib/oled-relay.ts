import { oledFrameSchema, type OLEDFrame } from "@core8/cpu";
type Result = { ok: boolean; url?: string; error?: string };
let next: {
  frame: OLEDFrame;
  token: string;
  report: (result: Result) => void;
} | null = null;
let busy = false,
  lastSent = 0,
  epoch = 0,
  timer: ReturnType<typeof setTimeout> | undefined,
  controller: AbortController | undefined;
export function cancelOLEDRelay() {
  epoch++;
  lastSent = 0;
  next = null;
  if (timer) clearTimeout(timer);
  controller?.abort();
}
export function queueOLEDFrame(
  frame: OLEDFrame,
  token: string,
  report: (result: Result) => void,
) {
  oledFrameSchema.parse(frame);
  next = { frame, token, report };
  schedule();
}
function schedule() {
  if (busy || !next) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(
    () => void send(),
    Math.max(0, 500 - (Date.now() - lastSent)),
  );
}
async function send() {
  if (busy || !next) return;
  const item = next;
  next = null;
  busy = true;
  const current = epoch;
  controller = new AbortController();
  const timeout = setTimeout(() => controller?.abort(), 20000);
  try {
    const response = await fetch("/api/hardware/oled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frame: item.frame, token: item.token }),
      signal: controller.signal,
    });
    if (!response.headers?.get("content-type")?.includes("application/json"))
      throw Error("OLED sync needs the local CORE8 server.");
    const result = await response.json();
    if (!response.ok || !result.ok)
      throw Error(result.error ?? "OLED sync is unavailable.");
    if (current === epoch) item.report({ ok: true, url: result.url });
  } catch (error) {
    if (current === epoch)
      item.report({ ok: false, error: (error as Error).message });
  } finally {
    clearTimeout(timeout);
    busy = false;
    lastSent = Date.now();
    schedule();
  }
}
export async function clearOLEDRelay(token: string) {
  cancelOLEDRelay();
  try {
    await fetch("/api/hardware/oled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false, token }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    /* Display is also released by any physical key or hardware command. */
  }
}
