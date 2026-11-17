import type { Snapshot, Stage, Trace, ALURecord } from "./engine";
import { binary, hex, hasOperand, names } from "./isa";
export type OLEDPage = "learning" | "binary" | "network";
export type OLEDScreen = { title: string; lines: string[]; emphasis: number };
export type OLEDFrame = {
  source: "hardware" | "demo";
  controller: "device" | "keypad" | "laptop";
  page: OLEDPage | "menu";
  stage: Stage;
  screens: OLEDScreen[];
};
const line = (text: string) => text.replace(/[^\x20-\x7e]/g, "?").slice(0, 25);
const dec = (n: number) => String(n).padStart(3, "0");
export function stageGuide(s: Snapshot) {
  return s.status === "error"
    ? "ERROR: reset to continue"
    : s.status === "halted"
      ? "HALTED: result is saved"
      : {
          ready: "Load a program to begin",
          fetch: "Fetch: read opcode + data",
          decode: "Decode: choose operation",
          execute: "Execute: calculate / move",
          writeback: "Write-back: save result",
        }[s.stage];
}
function equation(a: ALURecord) {
  const symbol: Record<string, string> = {
    ADD: "+",
    SUB: "-",
    MUL: "*",
    DIV: "/",
    INC: "+",
    DEC: "-",
    AND: "&",
    OR: "|",
    XOR: "^",
  };
  return a.operation === "NOT"
    ? `NOT ~${a.left} = ${a.result}`
    : a.operation === "SHL" || a.operation === "SHR"
      ? `${a.operation} ${a.left}${a.operation === "SHL" ? "<<" : ">>"}1 = ${a.result}`
      : `${a.operation} ${a.left}${symbol[a.operation] ?? "?"}${a.right} = ${a.result}`;
}
export function createOLEDFrame(
  s: Snapshot,
  events: Trace[] = [],
  options: {
    source?: OLEDFrame["source"];
    page?: OLEDPage;
    programBytes?: number;
    controller?: OLEDFrame["controller"];
  } = {},
): OLEDFrame {
  const source = options.source ?? "demo",
    page = options.page ?? "learning",
    controller = options.controller ?? "laptop";
  const origin =
    source === "demo"
      ? "DEMO"
      : controller === "laptop"
        ? "LAPTOP"
        : controller === "keypad"
          ? "KEYPAD"
          : "ESP32";
  const last = events.at(-1);
  let alu: ALURecord | null = null,
    memory: Trace["memory"] = null,
    previousAcc = 0,
    previousOut = 0,
    pending = false;
  if (s.stage !== "ready")
    for (const event of events) {
      if (event.alu) {
        alu = event.alu;
        pending = event.state.stage === "execute";
      }
      if (event.memory) memory = event.memory;
      if (event.state.acc !== event.before.acc) previousAcc = event.before.acc;
      if (event.state.output !== event.before.output)
        previousOut = event.before.output;
    }
  const flags = `Z:${+s.flags.z} C:${+s.flags.c} V:${+s.flags.v} B:${+s.flags.b}`;
  const screen = (
    title: string,
    lines: string[],
    emphasis = 0,
  ): OLEDScreen => ({ title: line(title), lines: lines.map(line), emphasis });
  let screens: OLEDScreen[];
  if (page === "network")
    screens = [
      screen(
        `CONTROL | ${origin}`,
        [
          "SOURCE: LAPTOP DEMO",
          "Local simulator",
          "OLED mirror via Wi-Fi",
          "CPU state stays separate",
          "D6: next OLED page",
        ],
        2,
      ),
      screen(`ALU/REG | ${origin}`, [
        `PROGRAM ${options.programBytes ?? 0}B / ${(options.programBytes ?? 0) / 2} INS`,
        "RAM 256 x 8 bits",
        `DONE ${s.cycles} instructions`,
        flags,
        "OWNER: LAPTOP",
      ]),
      screen(`RAM/OUT | ${origin}`, [
        "Play / Pause / Stage",
        "Load program to restart",
        "* on keypad: leave mirror",
        "Demo mirror = display only",
        "Same ISA as ESP32",
      ]),
    ];
  else if (page === "binary") {
    const address = memory?.address ?? s.operand;
    screens = [
      screen(`CONTROL | ${origin}`, [
        `PC ${dec(s.pc)} [${binary(s.pc)}]`,
        `IR ${hex(s.ir)} ${binary(s.ir)}`,
        `OP ${hex(s.operand)} ${binary(s.operand)}`,
        `CODE ${hex(s.ir)} ${hex(s.operand)} (2 bytes)`,
        stageGuide(s),
      ]),
      screen(
        `ALU/REG | ${origin}`,
        [
          `A:${binary(s.a)} (${s.a})`,
          `B:${binary(s.b)} (${s.b})`,
          `R:${binary(alu?.result ?? s.acc)} (${alu?.result ?? s.acc})${pending ? " P" : ""}`,
          `ACC ${binary(s.acc)} H:${hex(s.acc)}`,
          flags,
        ],
        2,
      ),
      screen(
        `RAM/OUT | ${origin}`,
        [
          `ADR ${binary(address)} [${address}]`,
          `RAM ${binary(s.ram[address])} [${s.ram[address]}]`,
          `OUT ${binary(s.output)} [${s.output}]`,
          `HEX OUT:${hex(s.output)} RAM:${hex(s.ram[address])}`,
          memory
            ? `${memory.kind === "write" ? "WRITE" : "READ"} [${address}] ${memory.before}>${memory.after}`
            : "RAM and code are separate",
        ],
        2,
      ),
    ];
  } else {
    const component: Record<string, string> = {
      program: "PM",
      control: "CU",
      flags: "FLAGS",
      output: "OUT",
      pc: "PC",
      ir: "IR",
      ram: "RAM",
      acc: "ACC",
      alu: "ALU",
      a: "A",
      b: "B",
    };
    const t = last?.transfers.at(-1);
    screens = [
      screen(
        `CONTROL | ${origin}`,
        [
          `${s.status.toUpperCase()} | ${s.stage.toUpperCase()}`,
          `PC ${dec(last?.before.pc ?? s.pc)}>${dec(s.pc)} IR:${hex(s.ir)} OP:${hex(s.operand)}`,
          s.stage === "ready"
            ? `PROGRAM ${options.programBytes ?? 0}B / ${(options.programBytes ?? 0) / 2} INS`
            : `@${dec(s.instructionAddress)} ${names[s.ir] ?? "INVALID"}${hasOperand.has(names[s.ir]) ? " " + s.operand : ""} CYC:${s.cycles}`,
          stageGuide(s),
          t && s.stage !== "ready"
            ? `${t.bus === "address" ? "ADR" : t.bus === "control" ? "CTL" : "DATA"} ${component[t.from]}>${component[t.to]} ${binary(t.value)}`
            : "BUS idle | PC = bookmark",
        ],
        2,
      ),
      screen(`ALU/REG | ${origin}`, [
        alu ? equation(alu) : `A:${dec(s.a)} B:${dec(s.b)} ACC:${dec(s.acc)}`,
        `ACC ${dec(previousAcc)}>${dec(s.acc)} HEX:${hex(s.acc)}`,
        `ACC BIN ${binary(s.acc)}`,
        flags,
        pending && alu
          ? `PENDING Z${+alu.flags.z} C${+alu.flags.c} V${+alu.flags.v} B${+alu.flags.b}`
          : "Z:zero C:carry V:ov B:br",
      ]),
      screen(
        `RAM/OUT | ${origin}`,
        [
          memory
            ? `RAM[${dec(memory.address)}] ${memory.kind === "write" ? "W" : "R"} ${dec(memory.before)}>${dec(memory.after)}`
            : "RAM: no transfer yet",
          `OUT ${dec(s.output)} | HEX ${hex(s.output)}`,
          `BIN ${binary(s.output)}`,
          `ACC ${dec(previousAcc)}>${dec(s.acc)} OUT ${dec(previousOut)}>${dec(s.output)}`,
          s.status === "error"
            ? `FAULT: ${s.error}`
            : memory
              ? `RAM ADR ${binary(memory.address)}`
              : "256 bytes | RAM != CODE",
        ],
        1,
      ),
    ];
  }
  return { source, controller, page, stage: s.stage, screens };
}
