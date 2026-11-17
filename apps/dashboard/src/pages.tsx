import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  Expand,
  FlaskConical,
  Lightbulb,
  Play,
  Search,
  Square,
  Wifi,
  WifiOff,
} from "lucide-react";
import { assemble, binary, CPU, hex, ISA, createOLEDFrame } from "@core8/cpu";
import { components, examples, experiments, quiz } from "./content";
import { useEvent, useLab, useVisible } from "./store";
import { Architecture } from "./components/Architecture";
import {
  Controls,
  Narration,
  OLEDs,
  Registers,
  StageStrip,
} from "./components/LabPanels";
import { Button } from "./components/ui/button";

export function ProgramPanel({ full = false }: { full?: boolean }) {
  const lab = useLab(),
    s = useVisible();
  const [example, setExample] = useState("First addition");
  const [copyStatus, setCopyStatus] = useState("Copy");
  const parsed = useMemo(() => {
    try {
      return { ...assemble(lab.source), error: "" };
    } catch (e) {
      return { bytes: [], lines: [], error: (e as Error).message };
    }
  }, [lab.source]);
  return (
    <section className={`panel program-panel ${full ? "full-editor" : ""}`}>
      <div className="panel-title">
        <span>
          <Code2 size={16} /> Program {full ? "Builder" : ""}
        </span>
        <span className="tag">ASSEMBLY</span>
      </div>
      <div className="program-toolbar">
        <select
          aria-label="Example program"
          value={example}
          onChange={(e) => {
            setExample(e.target.value);
            useLab.setState({ source: examples[e.target.value] });
          }}
        >
          {Object.keys(examples).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <button
          className="icon-button"
          aria-label={copyStatus}
          title={copyStatus}
          onClick={() => {
            void navigator.clipboard
              .writeText(lab.source)
              .then(() => setCopyStatus("Copied"))
              .catch(() => setCopyStatus("Copy unavailable"));
          }}
        >
          {copyStatus === "Copied" ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div className="editor-wrap">
        <div className="line-numbers" aria-hidden="true">
          {lab.source.split("\n").map((_, i) => (
            <div
              className={
                parsed.lines.some(
                  (l) =>
                    l.line === i + 1 &&
                    l.address === s?.instructionAddress &&
                    lab.source === lab.loadedSource,
                )
                  ? "active-line"
                  : ""
              }
              key={i}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
          ))}
        </div>
        <div className="editor">
          <pre aria-hidden="true">
            {lab.source.split("\n").map((line, i) => (
              <div
                key={i}
                className={
                  parsed.lines.some(
                    (l) =>
                      l.line === i + 1 &&
                      l.address === s?.instructionAddress &&
                      lab.source === lab.loadedSource,
                  )
                    ? "code-current"
                    : ""
                }
              >
                {line.split(/(\b[A-Z]{2,3}\b|\b\d+\b|;.*)/g).map((part, j) => (
                  <span
                    className={
                      part in ISA
                        ? "syntax-op"
                        : /^\d+$/.test(part)
                          ? "syntax-number"
                          : part.startsWith(";")
                            ? "syntax-comment"
                            : ""
                    }
                    key={j}
                  >
                    {part}
                  </span>
                ))}
                {"\n"}
              </div>
            ))}
          </pre>
          <textarea
            aria-label="Assembly program editor"
            spellCheck={false}
            value={lab.source}
            onChange={(e) => useLab.setState({ source: e.target.value })}
          />
        </div>
      </div>
      {full && (
        <div className="autocomplete">
          <label>
            Insert instruction
            <select
              aria-label="Insert instruction"
              value=""
              onChange={(e) => {
                useLab.setState({
                  source:
                    lab.source +
                    (lab.source.endsWith("\n") ? "" : "\n") +
                    e.target.value,
                });
              }}
            >
              <option value="" disabled>
                Choose opcode…
              </option>
              {Object.keys(ISA).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <p>
            Operands: decimal, 0x hex, 0b binary. Use labels for branches. MOV:
            ACC&gt;A, ACC&gt;B, A&gt;ACC, B&gt;ACC.
          </p>
        </div>
      )}
      <div className={`validation ${parsed.error ? "invalid" : ""}`}>
        {parsed.error || (
          <>
            <CheckCircle2 size={13} /> {parsed.bytes.length / 2} instructions ·{" "}
            {parsed.bytes.length} bytes · Valid program
          </>
        )}
      </div>
      <div className="program-actions">
        <Button
          variant="default"
          disabled={
            !!parsed.error || (lab.mode === "hardware" && !lab.connected)
          }
          onClick={() => void lab.load(lab.source)}
        >
          <Cpu size={14} /> Load into CPU
        </Button>
        {full && (
          <Button onClick={lab.nextInstruction}>
            <Play size={14} /> Step instruction
          </Button>
        )}
      </div>
      {lab.source !== lab.loadedSource && (
        <p className="editor-note">
          Editor has changes. Load to execute this version.
        </p>
      )}
      {full && (
        <div className="byte-preview">
          <span className="section-label">ENCODED PROGRAM</span>
          <code>
            {parsed.bytes.map(hex).join(" ") || "Fix the error to assemble."}
          </code>
        </div>
      )}
    </section>
  );
}
export function Overview() {
  const s = useVisible(),
    lab = useLab();
  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            <span /> YOUR PROCESSOR, UNDER THE MICROSCOPE
          </div>
          <h1>
            Small CPU. Big discoveries<span>.</span>
          </h1>
          <p>See every instruction. Understand every operation.</p>
        </div>
        <div className="architecture-badge">
          <Cpu size={30} />
          <div>
            <strong>8-bit architecture</strong>
            <span>256 bytes RAM · 21 instructions</span>
          </div>
        </div>
      </div>
      <div className="stats-grid">
        {[
          {
            label: "CPU STATUS",
            value: s?.status ?? "Offline",
            sub:
              lab.mode === "demo"
                ? "Deterministic local simulator"
                : lab.connected
                  ? "Connected to ESP32"
                  : "Awaiting connection",
            status: true,
          },
          {
            label: "PROGRAM COUNTER",
            value: s ? `0x${hex(s.pc)}` : "—",
            sub: "Address of next instruction",
          },
          {
            label: "ACCUMULATOR",
            value: s ? String(s.acc) : "—",
            sub: s ? binary(s.acc) : "No telemetry",
          },
          {
            label: "FLAGS",
            value: s ? `Z ${+s.flags.z}   C ${+s.flags.c}` : "—",
            sub: s
              ? `Overflow ${+s.flags.v} · Borrow ${+s.flags.b}`
              : "No telemetry",
          },
        ].map((stat) => (
          <div className="stat" key={stat.label}>
            <div className="section-label">
              {stat.label}
              <span className="stat-mark">
                {stat.status ? (
                  <span
                    className={`status-dot ${s?.status === "error" ? "red" : ""}`}
                  />
                ) : (
                  <Cpu size={13} />
                )}
              </span>
            </div>
            <strong className={stat.status ? "status-value" : ""}>
              {stat.value}
            </strong>
            <small>{stat.sub}</small>
          </div>
        ))}
      </div>
      <div className="workspace-grid">
        <section className="panel processor-panel">
          <div className="panel-title">
            <span>
              <Cpu size={17} /> Inside the processor
            </span>
            <span className="tag tag-blue">
              {lab.mode === "demo"
                ? "DEMO SIMULATOR"
                : lab.connected
                  ? "LIVE HARDWARE"
                  : "OFFLINE"}
            </span>
          </div>
          <StageStrip />
          <Architecture />
          <Controls />
        </section>
        <div className="right-stack">
          <ProgramPanel />
          <Narration />
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h2>Three displays. One CPU.</h2>
          <p>The same state, seen from three perspectives.</p>
        </div>
        <button
          className="text-button"
          onClick={() => useLab.setState({ page: "Live Hardware Lab" })}
        >
          Open hardware lab <ArrowRight size={14} />
        </button>
      </div>
      <OLEDs />
      <div className="section-heading">
        <div>
          <h2>Make your first discovery</h2>
          <p>A few instructions are all it takes to start understanding.</p>
        </div>
        <button
          className="text-button"
          onClick={() => useLab.setState({ page: "Learning Academy" })}
        >
          Explore all experiments <ArrowRight size={14} />
        </button>
      </div>
      <div className="quick-lessons">
        {[0, 4, 7].map((id, i) => (
          <button
            key={id}
            onClick={() => {
              void lab.load(experiments[id].program);
              useLab.setState({ experiment: id, page: "Learning Academy" });
            }}
          >
            <div className={`lesson-icon color-${i}`}>
              {i === 0 ? (
                <FlaskConical size={20} />
              ) : i === 1 ? (
                <Cpu size={20} />
              ) : (
                <Code2 size={20} />
              )}
            </div>
            <div>
              <small>EXPERIMENT {String(id + 1).padStart(2, "0")}</small>
              <strong>{experiments[id].title}</strong>
              <p>{experiments[id].objective}</p>
            </div>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
    </>
  );
}
export function Explorer() {
  return (
    <>
      <PageHeading
        kicker="THE ARCHITECTURE"
        title="Get to know your processor"
        description="Follow the pathways. Click a component. See how the pieces work together."
      />
      <section className="panel">
        <StageStrip />
        <Architecture />
        <Controls />
      </section>
      <div className="two-columns">
        <Narration />
        <section className="panel padded">
          <h3>Follow the data</h3>
          <p>
            Each highlighted connection is a transfer recorded by the execution
            engine. Blue carries data, violet selects an address, and amber
            signals a control decision.
          </p>
          <p>
            Registers A and B feed the ALU. ACC stores its result. Separate
            program memory holds instructions, while RAM holds data.
          </p>
        </section>
      </div>
    </>
  );
}
export function Studio() {
  const lab = useLab();
  return (
    <>
      <PageHeading
        kicker="EXECUTION STUDIO"
        title="One instruction. Every detail."
        description="Slow down time and watch Fetch → Decode → Execute → Write-back."
      />
      <section className="panel">
        <StageStrip />
        <Architecture />
        <Controls />
      </section>
      <div className="two-columns">
        <Narration />
        <section className="panel padded">
          <div className="panel-title plain">
            <span>Recorded stages</span>
            <Button
              size="sm"
              onClick={lab.replay}
              disabled={!lab.events.length}
            >
              Replay last instruction
            </Button>
          </div>
          <div className="timeline">
            {lab.events.slice(-32).map((e, i) => (
              <button
                className={
                  lab.events.indexOf(e) === lab.cursor ? "selected" : ""
                }
                key={`${e.seq}-${i}`}
                onClick={() =>
                  useLab.setState({ cursor: lab.events.indexOf(e) })
                }
              >
                <span>{e.state.stage}</span>
                <code>{e.instruction}</code>
                <small>
                  ACC {e.before.acc} → {e.state.acc}
                </small>
              </button>
            ))}
          </div>
          {!lab.events.length && (
            <p>Run or step your program to record its first stage.</p>
          )}
        </section>
      </div>
      <Registers />
    </>
  );
}
export function PageHeading({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div className="eyebrow">{kicker}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
export function ALU() {
  const [a, setA] = useState(204),
    [b, setB] = useState(170),
    [op, setOp] = useState("AND");
  const lab = useLab();
  const unary = ["NOT", "SHL", "SHR", "INC", "DEC"].includes(op);
  const source = `LDI ${a}\n${op}${unary ? "" : ` ${b}`}\nOUT\nHLT`;
  const preview = useMemo(() => {
    const c = new CPU();
    c.load(assemble(source).bytes);
    const events = c.run();
    return { state: c.state, events };
  }, [source]);
  const calculation = preview.state;
  useEffect(() => {
    if (lab.mode === "demo")
      lab.syncOLED(
        createOLEDFrame(preview.state, preview.events, {
          source: "demo",
          page: lab.oledPage,
          programBytes: assemble(source).bytes.length,
        }),
        {
          state: preview.state,
          events: preview.events,
          programBytes: assemble(source).bytes.length,
        },
      );
  }, [preview, lab.mode, source]);
  const [convert, setConvert] = useState(42);
  const convertValue = (value: number) => {
    setConvert(value);
    if (lab.mode === "demo") {
      const cpu = new CPU();
      cpu.load(assemble(`LDI ${value}\nOUT\nHLT`).bytes);
      const events = cpu.run();
      lab.syncOLED(
        createOLEDFrame(cpu.state, events, {
          source: "demo",
          page: "binary",
          programBytes: 6,
        }),
        { state: cpu.state, events, programBytes: 6 },
      );
    }
  };
  return (
    <>
      <PageHeading
        kicker="ALU PLAYGROUND"
        title="A little logic goes a long way."
        description="Change the inputs, inspect each bit, then trace the operation through your CPU."
      />
      <div className="two-columns">
        <section className="panel padded">
          <div className="section-label">
            OPERATION SANDBOX · LOCAL CPU PREVIEW
          </div>
          <div className="alu-inputs">
            <label>
              Input A
              <input
                type="number"
                min="0"
                max="255"
                value={a}
                onChange={(e) => setA(clamp(e.target.value))}
              />
            </label>
            <label>
              Operation
              <select value={op} onChange={(e) => setOp(e.target.value)}>
                {[
                  "ADD",
                  "SUB",
                  "MUL",
                  "DIV",
                  "INC",
                  "DEC",
                  "AND",
                  "OR",
                  "XOR",
                  "NOT",
                  "SHL",
                  "SHR",
                ].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Input B
              <input
                disabled={unary}
                type="number"
                min="0"
                max="255"
                value={b}
                onChange={(e) => setB(clamp(e.target.value))}
              />
            </label>
          </div>
          <div className="binary-calculation">
            <BitRow label="A" value={a} />
            {!unary && <BitRow label={op} value={b} />}
            <div className="binary-rule" />
            <BitRow label="=" value={calculation.acc} result />
          </div>
          <div className="alu-result">
            <span>
              RESULT{" "}
              <strong>
                {calculation.status === "error" ? "Fault" : calculation.acc}
              </strong>
            </span>
            <code>0x{hex(calculation.acc)}</code>
            <span>
              {Object.entries(calculation.flags)
                .map(([k, v]) => `${k.toUpperCase()} ${+v}`)
                .join(" · ")}
            </span>
          </div>
          {calculation.error && (
            <p className="error-inline">{calculation.error}</p>
          )}
          <Button
            variant="default"
            onClick={() => {
              void lab.runProgram(source);
              useLab.setState({ page: "CPU Explorer" });
            }}
          >
            <Play size={14} />{" "}
            {lab.mode === "hardware"
              ? "Run on ESP32 + OLEDs"
              : "Run demo + OLEDs"}
          </Button>
        </section>
        <section className="panel padded">
          <h3>
            {["AND", "OR", "XOR", "NOT"].includes(op)
              ? "Why each bit changes"
              : "Inside the calculation"}
          </h3>
          <p>
            {op === "ADD"
              ? "Addition starts at the rightmost bit. A carry moves one position left when the total is 2 or 3."
              : op === "SUB"
                ? "Subtraction may borrow from the next position. A negative unsigned result wraps modulo 256."
                : op === "AND"
                  ? "A bit is 1 only when both input bits are 1."
                  : op === "OR"
                    ? "A bit is 1 when at least one input is 1."
                    : op === "XOR"
                      ? "A bit is 1 when the inputs are different."
                      : op === "NOT"
                        ? "NOT flips every bit: 0 becomes 1 and 1 becomes 0."
                        : op === "SHL"
                          ? "Bits move left by one position. Bit 7 moves into Carry; zero enters bit 0."
                          : op === "SHR"
                            ? "Bits move right by one position. Bit 0 moves into Carry; zero enters bit 7."
                            : "The result keeps its lowest eight bits. Flags describe range and zero."}
          </p>
          <div className="bit-reasoning">
            {Array.from({ length: 8 }, (_, i) => 7 - i).map((bit) => {
              const av = (a >> bit) & 1,
                bv = (b >> bit) & 1,
                out = (calculation.acc >> bit) & 1;
              const carryIn =
                bit === 0
                  ? 0
                  : (((a & ((1 << bit) - 1)) + (b & ((1 << bit) - 1))) >> bit) &
                    1;
              const reason =
                op === "ADD"
                  ? `${av} + ${bv} + carry ${carryIn} = ${av + bv + carryIn} → ${out}, carry ${(av + bv + carryIn) >> 1}`
                  : op === "NOT"
                    ? `${av} flips to ${out}`
                    : ["AND", "OR", "XOR"].includes(op)
                      ? `${av} ${op} ${bv} → ${out}`
                      : `Result bit ${bit} = ${out}`;
              return (
                <div
                  key={bit}
                  style={{ animationDelay: `${(7 - bit) * 0.06}s` }}
                >
                  <span>BIT {bit}</span>
                  <code>{reason}</code>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="panel padded converter">
        <div>
          <h2>Every bit has a place.</h2>
          <p>
            Toggle a bit or enter a number. Add the lit place values to get
            decimal.
          </p>
        </div>
        <label>
          Decimal
          <input
            aria-label="Decimal conversion"
            type="number"
            min="0"
            max="255"
            value={convert}
            onChange={(e) => convertValue(clamp(e.target.value))}
          />
        </label>
        <div className="place-values">
          {Array.from({ length: 8 }, (_, i) => 7 - i).map((bit) => (
            <button
              key={bit}
              className={convert & (1 << bit) ? "on" : ""}
              aria-label={`Toggle bit ${bit}, value ${1 << bit}`}
              aria-pressed={!!(convert & (1 << bit))}
              onClick={() => convertValue(convert ^ (1 << bit))}
            >
              <small>
                2<sup>{bit}</sup>
              </small>
              <strong>{(convert >> bit) & 1}</strong>
              <span>{1 << bit}</span>
            </button>
          ))}
        </div>
        <code>
          {convert} decimal = {binary(convert)} binary = 0x{hex(convert)}{" "}
          hexadecimal
        </code>
        <Button onClick={() => void lab.runProgram(`LDI ${convert}\nOUT\nHLT`)}>
          <Play size={14} />
          Run conversion on{" "}
          {lab.mode === "hardware" ? "ESP32 + OLEDs" : "demo + OLEDs"}
        </Button>
      </section>
      <div className="section-heading">
        <h2>Live OLED display</h2>
        <span className="tag">
          {lab.mode === "hardware" ? "REAL CPU" : "DEMO MIRROR"}
        </span>
      </div>
      <OLEDs />
    </>
  );
}
const clamp = (value: string) =>
  Math.max(0, Math.min(255, Math.trunc(Number(value) || 0)));
function BitRow({
  label,
  value,
  result = false,
}: {
  label: string;
  value: number;
  result?: boolean;
}) {
  return (
    <div className={`bit-row ${result ? "result" : ""}`}>
      <span>{label}</span>
      {binary(value)
        .split("")
        .map((bit, i) => (
          <span className={bit === "1" ? "on" : ""} key={i}>
            {bit}
          </span>
        ))}
      <small>{value}</small>
    </div>
  );
}
export function Memory() {
  const s = useVisible(),
    event = useEvent();
  const [address, setAddress] = useState(20);
  return (
    <>
      <PageHeading
        kicker="MEMORY EXPLORER"
        title="A place for every byte."
        description="256 numbered drawers. Select an address to inspect its contents."
      />
      <div className="memory-layout">
        <section className="panel padded">
          <div className="memory-grid">
            <span className="memory-head">HEX</span>
            {Array.from({ length: 16 }, (_, i) => (
              <span className="memory-head" key={`h${i}`}>
                {i.toString(16).toUpperCase()}
              </span>
            ))}
            {Array.from({ length: 16 }, (_, row) => (
              <div className="memory-row" key={row}>
                <span className="memory-head">{hex(row * 16)}</span>
                {Array.from({ length: 16 }, (_, col) => {
                  const addr = row * 16 + col;
                  return (
                    <button
                      key={addr}
                      title={`RAM[${addr}] = ${s?.ram[addr] ?? "offline"}`}
                      aria-label={`RAM address ${addr}, value ${s?.ram[addr] ?? "offline"}`}
                      className={`${addr === address ? "selected" : ""} ${event?.memory?.address === addr ? "memory-access" : ""} ${s?.ram[addr] ? "nonzero" : ""}`}
                      onClick={() => setAddress(addr)}
                    >
                      {s ? hex(s.ram[addr]) : "—"}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="memory-caption">
            Rows + columns form each hexadecimal address. Highlighted cells show
            the current memory access.
          </p>
        </section>
        <section className="panel padded address-detail">
          <div className="section-label">SELECTED ADDRESS</div>
          <h2>RAM[0x{hex(address)}]</h2>
          <p>Drawer {address} of 256</p>
          <strong className="large-number">{s?.ram[address] ?? "—"}</strong>
          <code>
            {s ? binary(s.ram[address]) : "No data"}
            <br />
            0x{s ? hex(s.ram[address]) : "—"}
          </code>
          {event?.memory && (
            <div className="memory-event">
              <span className="tag">{event.memory.kind.toUpperCase()}</span>
              <p>Address {event.memory.address}</p>
              <strong>
                {event.memory.before} → {event.memory.after}
              </strong>
            </div>
          )}
          <p>
            STA copies ACC into RAM. LDA copies RAM into ACC. Neither
            instruction changes the flags.
          </p>
        </section>
      </div>
      <Controls />
    </>
  );
}
export function Academy() {
  const lab = useLab();
  const [answer, setAnswer] = useState(false);
  const [draft, setDraft] = useState(experiments[lab.experiment].program);
  const [search, setSearch] = useState("");
  const lesson = experiments[lab.experiment];
  const select = (id: number) => {
    useLab.setState({ experiment: id });
    setDraft(experiments[id].program);
    setAnswer(false);
  };
  return (
    <>
      <PageHeading
        kicker="LEARNING ACADEMY"
        title="Curiosity is your only prerequisite."
        description="Ten guided experiments. Start with a number. Leave understanding a processor."
      />
      <div className="academy-layout">
        <div className="lesson-list">
          {experiments.map((ex, i) => (
            <button
              key={ex.title}
              className={lab.experiment === i ? "selected" : ""}
              onClick={() => select(i)}
            >
              <span
                className={lab.completed.includes(i) ? "lesson-complete" : ""}
              >
                {lab.completed.includes(i) ? (
                  <Check size={16} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <div>
                <small>{ex.category}</small>
                <strong>{ex.title}</strong>
              </div>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
        <section className="panel padded lesson-detail">
          <span className="tag tag-blue">
            EXPERIMENT {String(lab.experiment + 1).padStart(2, "0")}
          </span>
          <h2>{lesson.title}</h2>
          <p className="lesson-objective">
            <Lightbulb size={18} />
            {lesson.objective}
          </p>
          <p>{lesson.explanation}</p>
          <label className="lesson-program-label">
            Try your own inputs — edit the program
            <textarea
              aria-label="Experiment program"
              value={draft}
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <div className="experiment-results">
            <div>
              <span className="section-label">EXPECTED · ORIGINAL PROGRAM</span>
              <p>{lesson.expected}</p>
            </div>
            <div>
              <span className="section-label">ACTUAL · CURRENT CPU</span>
              <p>
                {lab.state
                  ? `ACC ${lab.state.acc} · OUT ${lab.state.output} · Z ${+lab.state.flags.z} C ${+lab.state.flags.c} V ${+lab.state.flags.v} B ${+lab.state.flags.b}`
                  : "Connect hardware to see actual values."}
              </p>
            </div>
          </div>
          <div className="button-row">
            <Button
              variant="default"
              onClick={() => {
                void lab.load(draft);
                useLab.setState({ page: "Execution Studio" });
              }}
            >
              <Play size={14} /> Load animated experiment
            </Button>
            <Button
              onClick={() => {
                void lab.load(draft);
              }}
            >
              Load & stay here
            </Button>
            <Button onClick={() => void lab.runProgram(draft)}>
              Run experiment + OLEDs
            </Button>
          </div>
          <Narration />
          <div className="knowledge-check">
            <span className="section-label">QUICK KNOWLEDGE CHECK</span>
            <h3>{lesson.question}</h3>
            <Button size="sm" onClick={() => setAnswer(!answer)}>
              {answer ? "Hide answer" : "Reveal answer"}
            </Button>
            {answer && <p>{lesson.answer}</p>}
          </div>
          <Button onClick={() => lab.complete(lab.experiment)}>
            <CheckCircle2 size={15} />
            {lab.completed.includes(lab.experiment)
              ? "Experiment completed"
              : "Mark as completed"}
          </Button>
        </section>
      </div>
      <section className="panel padded glossary">
        <div className="section-heading">
          <h2>Your CPU glossary</h2>
          <label className="search-field">
            <Search size={15} />
            <input
              placeholder="Find a concept…"
              aria-label="Search CPU glossary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="glossary-grid">
          {Object.values(components)
            .filter((c) =>
              (c.name + c.analogy + c.technical)
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((c) => (
              <article key={c.name}>
                <h3>{c.name}</h3>
                <p>{c.analogy}</p>
                <small>{c.technical}</small>
              </article>
            ))}
          {!Object.values(components).some((c) =>
            (c.name + c.analogy + c.technical)
              .toLowerCase()
              .includes(search.toLowerCase()),
          ) && <p>No matching concept. Try “memory” or “flag”.</p>}
        </div>
      </section>
    </>
  );
}
export function Quiz() {
  const lab = useLab();
  const correct = quiz.filter((q, i) => lab.answers[i] === q.answer).length;
  return (
    <>
      <PageHeading
        kicker="QUIZ & CHALLENGES"
        title="Put your understanding to work."
        description="Make a prediction. Get an explanation. Build your confidence."
      />
      <div className="progress-banner">
        <BookOpen size={24} />
        <div>
          <strong>
            {correct} / {quiz.length} questions mastered
          </strong>
          <p>
            {lab.completed.length} / 10 experiments completed · Progress stays
            in this browser.
          </p>
        </div>
        <progress max={quiz.length} value={correct} />
      </div>
      <div className="quiz-grid">
        {quiz.map((q, i) => (
          <section className="panel padded" key={q.q}>
            <span className="section-label">
              CHALLENGE {String(i + 1).padStart(2, "0")}
            </span>
            <h3>{q.q}</h3>
            <div className="quiz-options">
              {q.options.map((option, j) => (
                <button
                  key={option}
                  className={
                    lab.answers[i] === j
                      ? j === q.answer
                        ? "correct"
                        : "incorrect"
                      : ""
                  }
                  onClick={() => lab.answer(i, j)}
                >
                  <span>{String.fromCharCode(65 + j)}</span>
                  {option}
                  {lab.answers[i] === j && j === q.answer && (
                    <Check size={16} />
                  )}
                </button>
              ))}
            </div>
            {lab.answers[i] !== undefined && (
              <p className={lab.answers[i] === q.answer ? "text-green" : ""}>
                {lab.answers[i] === q.answer ? "Exactly. " : "Try again. "}
                {q.why}
              </p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
export function History() {
  const lab = useLab();
  return (
    <>
      <PageHeading
        kicker="EXECUTION HISTORY"
        title="Every change has a story."
        description="Review recorded snapshots without sending a command to the CPU. The latest 512 stages are retained."
      />
      <div className="button-row">
        <Button disabled={!lab.events.length} onClick={lab.live}>
          Return to latest state
        </Button>
        <Button
          disabled={!lab.events.length}
          onClick={() => {
            const blob = new Blob([JSON.stringify(lab.events, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "core8-trace.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Export trace JSON
        </Button>
      </div>
      <section className="panel history-table">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Instruction</th>
              <th>Stage</th>
              <th>PC</th>
              <th>ACC</th>
              <th>Memory</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {lab.events.map((e, i) => (
              <tr
                className={lab.cursor === i ? "selected" : ""}
                key={`${e.seq}-${i}`}
              >
                <td>#{e.seq}</td>
                <td>
                  <code>{e.instruction}</code>
                </td>
                <td>{e.state.stage}</td>
                <td>
                  {e.before.pc} → {e.state.pc}
                </td>
                <td>
                  {e.before.acc} → {e.state.acc}
                </td>
                <td>
                  {e.memory
                    ? `[${e.memory.address}] ${e.memory.before} → ${e.memory.after}`
                    : "—"}
                </td>
                <td>
                  <Button
                    size="sm"
                    onClick={() => {
                      useLab.setState({ cursor: i, page: "Execution Studio" });
                    }}
                  >
                    Inspect <ArrowRight size={12} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!lab.events.length && (
          <div className="empty-state">
            <Cpu size={32} />
            <h3>A clean slate.</h3>
            <p>
              Load a program and step through it. Its story will appear here.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
export function Hardware() {
  const lab = useLab();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(""),
    [error, setError] = useState(""),
    [active, setActive] = useState(false),
    [fit, setFit] = useState<"contain" | "cover">("contain");
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    frame = useRef<HTMLDivElement>(null),
    request = useRef(0);
  const stop = () => {
    request.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setActive(false);
  };
  useEffect(
    () => () => {
      request.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  const start = async () => {
    stop();
    const id = ++request.current;
    setError("");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices)
        throw Error(
          "Camera access requires HTTPS or localhost. Open this dashboard on http://localhost:5173.",
        );
      const next = await navigator.mediaDevices.getUserMedia({
        video: device ? { deviceId: { exact: device } } : true,
        audio: false,
      });
      if (id !== request.current) {
        next.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = next;
      if (video.current) {
        video.current.srcObject = next;
        await video.current.play();
      }
      setActive(true);
      setDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "videoinput",
        ),
      );
    } catch (e) {
      stop();
      setError((e as Error).message);
    }
  };
  return (
    <>
      <PageHeading
        kicker="LIVE HARDWARE LAB"
        title="From silicon to screen."
        description="Connect your ESP32, synchronize the OLEDs, and bring the physical lab into view."
      />
      <div className="two-columns">
        <section className="panel padded">
          <div className="panel-title plain">
            <span>
              {lab.connected ? <Wifi size={18} /> : <WifiOff size={18} />} ESP32
              connection
            </span>
            <span className={`tag ${lab.connected ? "tag-green" : ""}`}>
              {lab.mode === "demo" ? "DEMO MODE" : lab.connection.toUpperCase()}
            </span>
          </div>
          <label>
            ESP32 HTTP address
            <input
              placeholder="http://192.168.1.100"
              value={lab.host}
              onChange={(e) => useLab.setState({ host: e.target.value })}
            />
          </label>
          <label>
            Control token (if configured)
            <input
              type="password"
              autoComplete="off"
              value={lab.token}
              onChange={(e) => useLab.setState({ token: e.target.value })}
            />
          </label>
          <div className="button-row">
            <Button
              variant="default"
              onClick={() => {
                if (lab.mode !== "hardware") lab.setMode("hardware");
                lab.connect();
              }}
              disabled={lab.discovering}
            >
              <Wifi size={14} /> Connect hardware
            </Button>
            <Button
              disabled={lab.discovering}
              onClick={() => {
                if (lab.mode !== "hardware") lab.setMode("hardware");
                void lab.discover();
              }}
            >
              <Search size={14} />
              {lab.discovering ? "Finding ESP32…" : "Find ESP32"}
            </Button>
            <Button
              disabled={
                !lab.connected &&
                !lab.discovering &&
                lab.connection !== "connecting"
              }
              onClick={lab.disconnect}
            >
              Disconnect
            </Button>
          </div>
          <p>
            Hotspot addresses can change after reconnecting. Find ESP32 reads
            the laptop’s connected devices, checks the firmware, and connects to
            the current address.
          </p>
          <div className="diagnostics">
            <div>
              <span>Firmware</span>
              <code>{lab.firmware || "Awaiting health response"}</code>
            </div>
            <div>
              <span>Latest packet</span>
              <code>
                {lab.lastUpdate
                  ? new Date(lab.lastUpdate).toLocaleTimeString()
                  : "No telemetry received"}
              </code>
            </div>
            <div>
              <span>Transport</span>
              <code>WebSocket :81/ws · HTTP :80</code>
            </div>
            <div>
              <span>Data source</span>
              <code>
                {lab.mode === "demo" ? "Local demo engine" : "Physical ESP32"}
              </code>
            </div>
          </div>
          <details>
            <summary>Connection troubleshooting</summary>
            <ol>
              <li>
                Upload firmware and read the IP address in Serial Monitor at
                115200 baud.
              </li>
              <li>
                Use the same Wi-Fi network. Confirm GET /api/health opens in
                your browser.
              </li>
              <li>
                Allow local network access if your browser asks. Use the local
                dashboard over HTTP for an ESP32 without TLS.
              </li>
              <li>
                Allow ports 80 and 81. Check the configured origin and control
                token.
              </li>
            </ol>
          </details>
        </section>
        <section className="panel padded">
          <div className="panel-title plain">
            <span>
              <Camera size={18} /> Physical project camera
            </span>
            <span className="tag">LOCAL ONLY</span>
          </div>
          <div className="camera-frame" ref={frame}>
            <video
              ref={video}
              muted
              playsInline
              style={{ objectFit: fit }}
              aria-label="Live physical hardware camera"
            />
            {!active && (
              <div>
                <Camera size={32} />
                <strong>A window into your hardware</strong>
                <p>
                  Video stays in your browser.
                  <br />
                  CPU values always come from telemetry.
                </p>
              </div>
            )}
          </div>
          <div className="camera-controls">
            <select
              aria-label="Select camera"
              value={device}
              onChange={(e) => {
                setDevice(e.target.value);
                stop();
              }}
            >
              <option value="">Default camera</option>
              {devices.map((d, i) => (
                <option value={d.deviceId} key={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
            <select
              aria-label="Camera image fitting"
              value={fit}
              onChange={(e) => setFit(e.target.value as "contain" | "cover")}
            >
              <option value="contain">Fit</option>
              <option value="cover">Fill</option>
            </select>
            <Button
              size="icon"
              aria-label="Expand camera"
              onClick={() => {
                void frame.current
                  ?.requestFullscreen()
                  .catch((e) => setError(e.message));
              }}
            >
              <Expand size={15} />
            </Button>
          </div>
          <div className="button-row">
            <Button onClick={() => void start()} disabled={active}>
              <Camera size={14} /> Start camera
            </Button>
            <Button onClick={stop} disabled={!active}>
              <Square size={12} /> Stop
            </Button>
          </div>
          {error && (
            <p role="alert" className="error-inline">
              {error}
            </p>
          )}
        </section>
      </div>
      <div className="section-heading">
        <h2>Synchronized virtual OLED displays</h2>
        <span className="tag">
          {lab.mode === "demo"
            ? "DEMO SIMULATOR"
            : lab.connected
              ? "ESP32 TELEMETRY"
              : "LAST RECEIVED / OFFLINE"}
        </span>
      </div>
      <OLEDs />
      <section className="panel padded wiring-summary">
        <h3>One ESP32. Three independent I²C buses.</h3>
        <div>
          {[
            "OLED 1 · SDA 21 / SCL 22",
            "OLED 2 · SDA 13 / SCL 14",
            "OLED 3 · SDA 4 / SCL 5",
            "Keypad rows · 26, 27, 32, 33",
            "Keypad columns · 18, 19, 23, 25",
          ].map((x) => (
            <code key={x}>{x}</code>
          ))}
        </div>
        <p>
          Use 3.3 V logic and a common ground. GPIO5 is a strapping pin on
          classic ESP32; test startup with display pull-ups. A documented
          alternative uses GPIO16/17 for OLED 3. See WIRING.md.
        </p>
      </section>
    </>
  );
}
