import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronsRight,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  StepForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { binary, hex, createOLEDFrame, type OLEDPage } from "@core8/cpu";
import { Button } from "./ui/button";
import { useEvent, useLab, useVisible } from "../store";
export function Controls() {
  const lab = useLab(),
    s = useVisible();
  const reviewing = lab.cursor < lab.events.length - 1;
  const unavailable = lab.mode === "hardware" && !lab.connected;
  const running =
    lab.mode === "hardware" && !reviewing
      ? lab.state?.status === "running"
      : lab.playing;
  return (
    <div className="playback">
      <div className="playback-main">
        <Button
          size="icon"
          aria-label="Restart CPU"
          title="Restart CPU"
          disabled={unavailable}
          onClick={() => {
            lab.pause();
            void lab.command({ command: "reset" });
          }}
        >
          <RotateCcw size={16} />
        </Button>
        <Button
          size="icon"
          aria-label="Previous recorded stage"
          title="Previous recorded stage"
          disabled={lab.cursor <= 0}
          onClick={lab.previous}
        >
          <SkipBack size={16} />
        </Button>
        <Button
          variant="default"
          onClick={running ? lab.pause : lab.play}
          disabled={
            (unavailable && !reviewing) ||
            (!reviewing && ["halted", "error"].includes(s?.status ?? ""))
          }
        >
          {running ? (
            <Pause size={15} />
          ) : (
            <Play size={15} fill="currentColor" />
          )}
          {running
            ? reviewing
              ? "Pause replay"
              : "Pause"
            : reviewing
              ? "Play replay"
              : "Run program"}
        </Button>
        <Button
          onClick={lab.step}
          disabled={
            (unavailable && !reviewing) ||
            (!reviewing && ["halted", "error"].includes(s?.status ?? ""))
          }
        >
          <StepForward size={16} />
          <span>Next stage</span>
        </Button>
        <Button
          size="icon"
          title="Next instruction"
          aria-label="Next instruction"
          onClick={lab.nextInstruction}
          disabled={unavailable && !reviewing}
        >
          <SkipForward size={16} />
        </Button>
        <Button
          size="icon"
          title="Run to completion (hardware runs at 4×)"
          aria-label="Run to completion"
          onClick={lab.runAll}
          disabled={unavailable}
        >
          <FastForward size={16} />
        </Button>
        <span className="control-divider" />
        <label className="speed-label">
          Speed
          <select
            aria-label="Execution speed"
            value={lab.speed}
            onChange={(e) => lab.setSpeed(Number(e.target.value))}
          >
            {[0.25, 0.5, 1, 2, 4].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <span className="playback-meta">
        {reviewing ? (
          <button onClick={lab.live}>
            Recorded snapshot · Return to latest <ChevronsRight size={12} />
          </button>
        ) : (
          <>
            <span className="status-dot" />{" "}
            {lab.mode === "demo" ? "Local simulator" : "ESP32"} ·{" "}
            {s?.cycles ?? "—"} instructions
          </>
        )}
      </span>
    </div>
  );
}
export function StageStrip() {
  const s = useVisible();
  return (
    <div className="stage-strip">
      {["fetch", "decode", "execute", "writeback"].map((stage, i) => (
        <div key={stage} className={s?.stage === stage ? "current" : ""}>
          <span>{String(i + 1).padStart(2, "0")}</span>
          <strong>
            {stage === "writeback"
              ? "Write-back"
              : stage[0].toUpperCase() + stage.slice(1)}
          </strong>
          {i < 3 && <ArrowRight size={14} />}
        </div>
      ))}
    </div>
  );
}
export function Narration() {
  const event = useEvent(),
    s = useVisible(),
    lab = useLab();
  const [prediction, setPrediction] = useState("");
  const [reveal, setReveal] = useState(false);
  const advanced = event
    ? event.transfers
        .map(
          (t) =>
            `${t.to.toUpperCase()} ← ${t.from.toUpperCase()} (${hex(t.value)})`,
        )
        .join(" · ")
    : "";
  return (
    <div className="narration-panel">
      <div className="section-label">
        <span className="tiny-icon">✦</span> INSIDE THIS INSTRUCTION{" "}
        <button
          className="icon-button push-right"
          title={lab.narration ? "Disable narration" : "Enable narration"}
          aria-label="Toggle spoken narration"
          onClick={() => {
            if (!("speechSynthesis" in window)) {
              useLab.setState({
                error: "Spoken narration is unavailable in this browser.",
              });
              return;
            }
            useLab.setState({ narration: !lab.narration });
            if (lab.narration) speechSynthesis.cancel();
          }}
        >
          {lab.narration ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
      </div>
      <h3>
        {s?.error
          ? "The CPU needs your attention"
          : !event
            ? "Your CPU is ready. Let’s give it a job."
            : `${event.instruction} · ${s?.stage === "writeback" ? "Write-back" : s?.stage}`}
      </h3>
      <p>
        {event?.explanation ??
          "Press Run program to watch the instruction travel through the processor. Or take it one stage at a time."}
      </p>
      {event?.alu && (
        <div className="actual-alu" key={event.seq}>
          <code>
            {event.alu.left}{" "}
            {
              (
                {
                  ADD: "+",
                  SUB: "−",
                  MUL: "×",
                  DIV: "÷",
                  AND: "AND",
                  OR: "OR",
                  XOR: "XOR",
                  NOT: "NOT",
                  INC: "+ 1",
                  DEC: "− 1",
                  SHL: "<< 1",
                  SHR: ">> 1",
                } as Record<string, string>
              )[event.alu.operation]
            }{" "}
            {["INC", "DEC", "NOT", "SHL", "SHR"].includes(event.alu.operation)
              ? ""
              : event.alu.right}{" "}
            = {event.alu.result}
          </code>
          <span>
            {s?.stage === "execute"
              ? "Pending result · commits at Write-back"
              : "Committed to ACC"}
          </span>
          {event.alu.operation === "ADD" && (
            <div
              className="carry-animation"
              aria-label="Actual addition bits and carry propagation"
            >
              {Array.from({ length: 8 }, (_, i) => i).map((bit) => {
                const a = (event.alu!.left >> bit) & 1,
                  b = (event.alu!.right >> bit) & 1;
                const carry =
                  bit === 0
                    ? 0
                    : ((event.alu!.left & ((1 << bit) - 1)) +
                        (event.alu!.right & ((1 << bit) - 1))) >>
                      bit;
                return (
                  <div
                    key={bit}
                    style={{ animationDelay: `${(bit * 0.1) / lab.speed}s` }}
                  >
                    <small>b{bit}</small>
                    <b>{(event.alu!.result >> bit) & 1}</b>
                    <span>
                      {a}+{b}+{carry} → c{(a + b + carry) >> 1}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {lab.level === "advanced" && (
        <code className="microcode">
          {advanced || "No register transfer in this stage."}
        </code>
      )}
      {event && (
        <div className="register-delta">
          <span>
            ACC <b>{event.before.acc}</b>
            <ArrowRight size={12} />
            <b className={event.before.acc !== s?.acc ? "text-amber" : ""}>
              {s?.acc}
            </b>
          </span>
          <span>
            PC <b>{event.before.pc}</b>
            <ArrowRight size={12} />
            <b>{s?.pc}</b>
          </span>
          <span>
            OUT <b>{s?.output}</b>
          </span>
        </div>
      )}
      {s?.stage === "decode" && (
        <details className="prediction">
          <summary>Make a prediction before you execute</summary>
          <label>
            What will ACC contain after this instruction?
            <input
              type="number"
              min="0"
              max="255"
              value={prediction}
              onChange={(e) => {
                setPrediction(e.target.value);
                setReveal(false);
              }}
              placeholder="Your prediction"
            />
          </label>
          <Button size="sm" onClick={() => setReveal(true)}>
            Save prediction
          </Button>
          {reveal && (
            <p>
              Prediction saved: {prediction || "—"}. Press Next stage twice and
              compare with ACC at Write-back.
            </p>
          )}
        </details>
      )}
    </div>
  );
}
export function OLEDs() {
  const state = useVisible(),
    lab = useLab();
  const reviewing = lab.cursor < lab.events.length - 1;
  const recorded = lab.events[lab.cursor]?.display;
  const fallback = state
    ? createOLEDFrame(state, lab.events.slice(0, lab.cursor + 1), {
        source: lab.mode === "demo" ? "demo" : "hardware",
        page: lab.oledPage,
        programBytes: lab.programBytes,
      })
    : null;
  const frame =
    lab.mode === "demo"
      ? (lab.demoDisplay ?? fallback)
      : reviewing
        ? (recorded ?? fallback)
        : (lab.display ?? fallback);
  const screens =
    frame?.screens ??
    ["CONTROL", "ALU / REGISTERS", "MEMORY / OUTPUT"].map((title) => ({
      title,
      lines: ["OFFLINE", "Awaiting ESP32", "No live telemetry", "", ""],
      emphasis: 0,
    }));
  const caption = reviewing
    ? "Recorded display snapshot"
    : lab.mode === "demo"
      ? lab.oledSyncStatus === "synced"
        ? `Demo sent to ${lab.oledDevice.replace("http://", "")}`
        : lab.oledSync
          ? "Demo preview - OLED " + lab.oledSyncStatus
          : "Local demo only"
      : lab.connected
        ? `${frame?.controller ?? "device"} - synchronized with ESP32`
        : "Last received - Offline";
  return (
    <>
      <div className="oled-options">
        <label>
          OLED detail
          <select
            aria-label="OLED detail page"
            value={
              frame?.page === "menu"
                ? lab.oledPage
                : (frame?.page ?? lab.oledPage)
            }
            onChange={(e) => lab.setOLEDPage(e.target.value as OLEDPage)}
          >
            <option value="learning">Learning view</option>
            <option value="binary">Binary & buses</option>
            <option value="network">System & connection</option>
          </select>
        </label>
        {lab.mode === "demo" && (
          <label className="oled-sync-toggle">
            <input
              type="checkbox"
              checked={lab.oledSync}
              onChange={(e) => lab.setOLEDSync(e.target.checked)}
            />
            Mirror laptop demo to physical OLEDs
          </label>
        )}
        {lab.mode === "demo" && lab.oledSync && frame && (
          <Button size="sm" variant="ghost" onClick={() => lab.syncOLED(frame)}>
            Sync now
          </Button>
        )}
        <span className="tag">
          {lab.mode === "hardware" ? "ESP32 CPU" : "LAPTOP DEMO"}
        </span>
      </div>
      <div className="oled-grid">
        {screens.map((screen, index) => (
          <div className="oled-card" key={index}>
            <div className="oled-label">
              <span>OLED {String(index + 1).padStart(2, "0")}</span>
              <span>{screen.title}</span>
            </div>
            <div className="oled-screen">
              {screen.lines.map((line, row) => (
                <div
                  className={row === screen.emphasis ? "oled-emphasis" : ""}
                  key={row}
                >
                  {line || " "}
                </div>
              ))}
            </div>
            <div className="oled-foot">
              <span
                className={`status-dot ${lab.mode === "hardware" ? (lab.connected ? "" : "muted") : lab.oledSyncStatus === "synced" ? "blue" : "muted"}`}
              />
              {caption}
            </div>
          </div>
        ))}
      </div>
      {lab.mode === "demo" && lab.oledSyncError && (
        <p className="oled-sync-note" role="status">
          OLED mirror: {lab.oledSyncError} Demo simulation is still available.
        </p>
      )}
    </>
  );
}
export function Registers() {
  const s = useVisible(),
    event = useEvent();
  return (
    <div className="register-grid">
      {(["acc", "a", "b", "pc", "ir", "output"] as const).map((key) => (
        <div
          className={`register-card ${event && event.before[key] !== s?.[key] ? "changed-register" : ""}`}
          key={key}
        >
          <div className="section-label">
            {key === "output" ? "OUTPUT" : key.toUpperCase()}{" "}
            <span>{key === "pc" ? "9-bit position" : "8-bit register"}</span>
          </div>
          <strong>{s?.[key] ?? "—"}</strong>
          <code>
            0x{s ? hex(s[key]) : "—"}
            <span>{s ? binary(s[key]) : "—"}</span>
          </code>
          {event && event.before[key] !== s?.[key] && (
            <small>
              {event.before[key]} → {s?.[key]} <Check size={12} />
            </small>
          )}
        </div>
      ))}
      <div className="flags-card">
        <div className="section-label">FLAGS REGISTER</div>
        <div>
          {(["z", "c", "v", "b"] as const).map((f, i) => (
            <span className={s?.flags[f] ? "flag-set" : ""} key={f}>
              <b>{s ? +s.flags[f] : "—"}</b>
              {["Zero", "Carry", "Overflow", "Borrow"][i]}
            </span>
          ))}
        </div>
        <p>
          ALU instructions update all four flags. Data transfers and branches
          preserve them.
        </p>
      </div>
    </div>
  );
}
