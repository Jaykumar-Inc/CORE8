import { memo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Binary, CircuitBoard, Info, X } from "lucide-react";
import { binary, hex, type Component } from "@core8/cpu";
import { components } from "../content";
import { useEvent, useLab, useVisible } from "../store";
const positions: Record<Component, [number, number]> = {
  program: [25, 45],
  pc: [25, 190],
  ir: [220, 45],
  control: [420, 45],
  a: [220, 190],
  b: [420, 190],
  alu: [320, 330],
  acc: [540, 330],
  flags: [540, 190],
  ram: [25, 330],
  output: [745, 330],
};
const sizes: Record<string, number> = {
  program: 155,
  control: 175,
  alu: 150,
  acc: 155,
  ram: 150,
  output: 155,
};
const links: [Component, Component][] = [
  ["pc", "program"],
  ["program", "ir"],
  ["ir", "control"],
  ["control", "pc"],
  ["acc", "a"],
  ["ir", "b"],
  ["a", "alu"],
  ["b", "alu"],
  ["alu", "acc"],
  ["alu", "flags"],
  ["ir", "ram"],
  ["ram", "control"],
  ["ram", "acc"],
  ["acc", "ram"],
  ["acc", "output"],
  ["acc", "b"],
  ["a", "acc"],
  ["b", "acc"],
  ["ir", "acc"],
];
function path(from: Component, to: Component) {
  const [x1, y1] = positions[from],
    [x2, y2] = positions[to],
    w1 = sizes[from] ?? 150,
    w2 = sizes[to] ?? 150;
  if (y1 === y2) {
    const right = x2 > x1;
    return `M ${right ? x1 + w1 : x1} ${y1 + 43} L ${right ? x2 : x2 + w2} ${y2 + 43}`;
  }
  const down = y2 > y1;
  const ax = x1 + w1 / 2,
    ay = down ? y1 + 86 : y1,
    bx = x2 + w2 / 2,
    by = down ? y2 : y2 + 86;
  return `M ${ax} ${ay} L ${ax} ${(ay + by) / 2} L ${bx} ${(ay + by) / 2} L ${bx} ${by}`;
}
export const Architecture = memo(function Architecture() {
  const s = useVisible(),
    event = useEvent(),
    level = useLab((x) => x.level),
    speed = useLab((x) => x.speed),
    reduced = useReducedMotion();
  const [selected, setSelected] = useState<Component | null>(null);
  const value = (id: Component) => {
    if (!s) return "—";
    if (id === "program")
      return `${useLab.getState().programBytes / 2} instructions`;
    if (id === "control")
      return s.stage === "ready" ? "READY" : s.stage.toUpperCase();
    if (id === "alu")
      return event?.alu
        ? `${event.alu.operation} → ${event.alu.result}`
        : "8-BIT ALU";
    if (id === "flags")
      return `Z ${+s.flags.z}   C ${+s.flags.c}   V ${+s.flags.v}   B ${+s.flags.b}`;
    if (id === "ram")
      return event?.memory
        ? `[${hex(event.memory.address)}] = ${event.memory.after}`
        : "256 × 8 bits";
    return String(s[id as "pc" | "ir" | "a" | "b" | "acc" | "output"]);
  };
  return (
    <div className="architecture-wrap">
      <div className="diagram-heading">
        <span>
          <CircuitBoard size={15} /> PROCESSOR ARCHITECTURE
        </span>
        <span className="diagram-hint">
          <span className="status-dot" /> Event-driven data flow{" "}
          <Info size={13} />
        </span>
      </div>
      <div className="architecture-scroll">
        <svg
          className="architecture"
          viewBox="0 0 935 475"
          role="img"
          aria-label="Interactive CPU architecture. Click a component to learn its purpose."
        >
          <defs>
            <pattern
              id="dots"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".7" className="diagram-dot" />
            </pattern>
            <marker
              id="arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" />
            </marker>
          </defs>
          <rect width="935" height="475" fill="url(#dots)" />
          {links.map(([from, to]) => (
            <path
              key={from + to}
              d={path(from, to)}
              className="wire"
              markerEnd="url(#arrow)"
            />
          ))}
          {event?.transfers.map((t, i) => (
            <g key={`${event.seq}-${i}`} className={`transfer ${t.bus}`}>
              <motion.path
                d={path(t.from, t.to)}
                fill="none"
                strokeWidth="2"
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.48 / speed }}
                markerEnd="url(#arrow)"
              />
              {!reduced && (
                <circle r="4">
                  <animateMotion
                    dur={`${0.7 / speed}s`}
                    path={path(t.from, t.to)}
                    fill="freeze"
                  />
                </circle>
              )}
              <text
                x={(positions[t.from][0] + positions[t.to][0]) / 2 + 75}
                y={(positions[t.from][1] + positions[t.to][1]) / 2 + 40}
                className="packet-label"
              >
                {level === "beginner" ? t.value : binary(t.value)}
              </text>
            </g>
          ))}
          {(Object.keys(positions) as Component[]).map((id) => {
            const [x, y] = positions[id],
              w = sizes[id] ?? 150;
            const active = event?.transfers.some(
              (t) => t.from === id || t.to === id,
            );
            const changed =
              s &&
              event &&
              ["acc", "pc", "ir", "a", "b", "output"].includes(id) &&
              event.before[id as "acc"] !== s[id as "acc"];
            return (
              <g
                key={id}
                transform={`translate(${x} ${y})`}
                className={`cpu-node ${id} ${active ? "active" : ""} ${selected === id ? "selected" : ""}`}
                tabIndex={0}
                role="button"
                aria-label={`${components[id].name}: ${value(id)}. Learn more`}
                onClick={() => setSelected(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(id);
                  }
                }}
              >
                <rect width={w} height="86" rx="9" />
                <text className="node-label" x="13" y="24">
                  {components[id].short}
                </text>
                <text
                  className={`node-value ${id === "flags" || id === "program" || id === "control" || id === "ram" || id === "alu" ? "small" : ""}`}
                  x="13"
                  y="55"
                >
                  {value(id)}
                </text>
                {s && ["a", "b", "acc", "output", "ir"].includes(id) && (
                  <text className="node-binary" x="13" y="73">
                    {binary(s[id as "acc"])}{" "}
                    <tspan className="changed">
                      {changed ? "↑ UPDATED" : ""}
                    </tspan>
                  </text>
                )}
                <text x={w - 19} y="23" className="node-plus">
                  ↗
                </text>
              </g>
            );
          })}
          <text x="30" y="25" className="lane-label">
            INSTRUCTION PATH
          </text>
          <text x="220" y="168" className="lane-label">
            INPUT REGISTERS
          </text>
          <text x="30" y="452" className="lane-label">
            HARVARD ARCHITECTURE · 8-BIT DATA · SEPARATE PROGRAM & DATA MEMORY
          </text>
        </svg>
      </div>
      <div className="diagram-legend">
        <span>
          <i className="cyan" /> Data bus
        </span>
        <span>
          <i className="violet" /> Address bus
        </span>
        <span>
          <i className="amber" /> Control signals
        </span>
        <span className="push-right">
          Click any component to explore <ArrowUpRight size={12} />
        </span>
      </div>
      {selected && (
        <div className="component-detail">
          <div className="detail-icon">
            <Binary size={22} />
          </div>
          <div>
            <strong>{components[selected].name}</strong>
            <p>
              {level === "beginner"
                ? components[selected].analogy
                : components[selected].technical}
            </p>
            <code>Current value: {value(selected)}</code>
          </div>
          <button
            className="icon-button push-right"
            aria-label="Close component explanation"
            onClick={() => setSelected(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
});
