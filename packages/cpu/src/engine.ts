import { aluOps, hasOperand, names } from "./isa";
import type { OLEDFrame } from "./oled";
export type Stage = "ready" | "fetch" | "decode" | "execute" | "writeback";
export type Status = "ready" | "paused" | "running" | "halted" | "error";
export type Flags = { z: boolean; c: boolean; v: boolean; b: boolean };
export type Snapshot = {
  pc: number;
  ir: number;
  operand: number;
  acc: number;
  a: number;
  b: number;
  output: number;
  flags: Flags;
  ram: number[];
  stage: Stage;
  status: Status;
  cycles: number;
  instructionAddress: number;
  error: string;
};
export type Component =
  | "pc"
  | "program"
  | "ir"
  | "control"
  | "a"
  | "b"
  | "alu"
  | "acc"
  | "flags"
  | "ram"
  | "output";
export type Transfer = {
  from: Component;
  to: Component;
  value: number;
  bus: "address" | "data" | "control";
};
export type ALURecord = {
  operation: string;
  left: number;
  right: number;
  result: number;
  flags: Flags;
};
export type Trace = {
  version: 1;
  seq: number;
  timestamp: number;
  instruction: string;
  state: Snapshot;
  before: Snapshot;
  transfers: Transfer[];
  explanation: string;
  alu: ALURecord | null;
  memory: {
    address: number;
    before: number;
    after: number;
    kind: "read" | "write";
  } | null;
  display?: OLEDFrame;
};
const initial = (): Snapshot => ({
  pc: 0,
  ir: 0,
  operand: 0,
  acc: 0,
  a: 0,
  b: 0,
  output: 0,
  flags: { z: false, c: false, v: false, b: false },
  ram: Array(256).fill(0),
  stage: "ready",
  status: "ready",
  cycles: 0,
  instructionAddress: 0,
  error: "",
});
export class CPU {
  state = initial();
  program: number[] = [];
  seq = 0;
  private pending = 0;
  private pendingFlags: Flags = { z: false, c: false, v: false, b: false };
  load(bytes: number[]) {
    if (
      !bytes.length ||
      bytes.length > 256 ||
      bytes.length % 2 ||
      bytes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
    )
      throw Error("Program must be an even array of 2–256 bytes.");
    this.program = [...bytes];
    this.reset();
  }
  reset() {
    this.state = initial();
    this.pending = 0;
  }
  private fail(message: string) {
    this.state.error = message;
    this.state.status = "error";
  }
  step(): Trace | null {
    const s = this.state;
    if (s.status === "halted" || s.status === "error") return null;
    const before = structuredClone(s);
    const transfers: Transfer[] = [];
    let explanation = "";
    let memory: Trace["memory"] = null;
    let alu: ALURecord | null = null;
    const move = (
      from: Component,
      to: Component,
      value: number,
      bus: Transfer["bus"] = "data",
    ) => transfers.push({ from, to, value, bus });
    const op = names[s.ir];
    if (s.stage === "ready" || s.stage === "writeback") {
      if (s.cycles >= 10000)
        this.fail("Instruction budget exceeded (10,000). Reset to run again.");
      else if (s.pc % 2 || s.pc + 1 >= this.program.length)
        this.fail(
          "Program Counter is outside an instruction. Add HLT or fix the branch.",
        );
      else {
        s.instructionAddress = s.pc;
        move("pc", "program", s.pc, "address");
        s.ir = this.program[s.pc];
        s.operand = this.program[s.pc + 1];
        move("program", "ir", s.ir);
        s.pc += 2;
        s.stage = "fetch";
        explanation = `The bookmark points to byte ${s.instructionAddress}. Program memory sends opcode ${s.ir} and operand ${s.operand} to the instruction register. PC advances by 2.`;
      }
    } else if (s.stage === "fetch") {
      s.stage = "decode";
      move("ir", "control", s.ir, "control");
      if (!op) this.fail(`Invalid opcode ${s.ir}.`);
      else if (!hasOperand.has(op) && s.operand !== 0)
        this.fail(`${op} requires a zero reserved operand byte.`);
      else if (op === "MOV" && s.operand > 3)
        this.fail("Invalid MOV selector.");
      else if (
        (op === "JMP" || op === "JZ") &&
        (s.operand % 2 || s.operand >= this.program.length)
      )
        this.fail("Branch target is not an instruction address.");
      else
        explanation = `The coordinator decodes ${op}${hasOperand.has(op) ? ` ${s.operand}` : ""}. ${aluOps.has(op) ? "It prepares the ALU to calculate with the accumulator." : "It selects the registers or memory needed for this instruction."}`;
    } else if (s.stage === "decode") {
      s.stage = "execute";
      this.pending = s.acc;
      this.pendingFlags = { ...s.flags };
      if (aluOps.has(op)) {
        s.a = s.acc;
        s.b =
          op === "INC" || op === "DEC"
            ? 1
            : op === "NOT" || op === "SHL" || op === "SHR"
              ? 0
              : s.operand;
        move("acc", "a", s.a);
        if (s.b === s.operand) move("ir", "b", s.b);
        move("a", "alu", s.a);
        if (!["NOT", "SHL", "SHR"].includes(op)) move("b", "alu", s.b);
        let raw = s.a;
        let signed = 0;
        const sa = s.a < 128 ? s.a : s.a - 256;
        const sb = s.b < 128 ? s.b : s.b - 256;
        let c = false,
          v = false,
          b = false;
        switch (op) {
          case "ADD":
          case "INC":
            raw = s.a + s.b;
            signed = sa + sb;
            c = raw > 255;
            v = signed > 127 || signed < -128;
            break;
          case "SUB":
          case "DEC":
            raw = s.a - s.b;
            signed = sa - sb;
            b = raw < 0;
            v = signed > 127 || signed < -128;
            break;
          case "MUL":
            raw = s.a * s.b;
            signed = sa * sb;
            c = raw > 255;
            v = signed > 127 || signed < -128;
            break;
          case "DIV":
            if (!s.b) this.fail("Division by zero. Reset to continue.");
            else raw = Math.floor(s.a / s.b);
            break;
          case "AND":
            raw = s.a & s.b;
            break;
          case "OR":
            raw = s.a | s.b;
            break;
          case "XOR":
            raw = s.a ^ s.b;
            break;
          case "NOT":
            raw = ~s.a;
            break;
          case "SHL":
            raw = s.a << 1;
            c = !!(s.a & 128);
            v = !!((s.a ^ raw) & 128);
            break;
          case "SHR":
            raw = s.a >>> 1;
            c = !!(s.a & 1);
            break;
        }
        this.pending = raw & 255;
        this.pendingFlags = { z: this.pending === 0, c, v, b };
        if (!s.error)
          alu = {
            operation: op,
            left: s.a,
            right: s.b,
            result: this.pending,
            flags: { ...this.pendingFlags },
          };
        explanation = `The ALU computes ${op}: input A = ${s.a}${["NOT", "SHL", "SHR"].includes(op) ? "" : `, input B = ${s.b}`}. Result = ${this.pending}. ${b ? "A borrow wraps the negative result into 8 bits." : c ? "A bit carries beyond the 8-bit result." : "The result is ready to be stored."}`;
      } else if (op === "LDI") {
        this.pending = s.operand;
        move("ir", "control", s.operand);
        explanation = `Prepare the number ${s.operand} for the accumulator.`;
      } else if (op === "LDA") {
        this.pending = s.ram[s.operand];
        move("ir", "ram", s.operand, "address");
        move("ram", "control", this.pending);
        memory = {
          address: s.operand,
          before: this.pending,
          after: this.pending,
          kind: "read",
        };
        explanation = `Read RAM address ${s.operand}: it contains ${this.pending}.`;
      } else if (op === "STA") {
        move("ir", "ram", s.operand, "address");
        explanation = `Select RAM address ${s.operand} to receive the accumulator's value ${s.acc}.`;
      } else if (op === "MOV") {
        this.pending = s.operand === 2 ? s.a : s.operand === 3 ? s.b : s.acc;
        explanation = `Select ${["ACC → A", "ACC → B", "A → ACC", "B → ACC"][s.operand]} (${this.pending}).`;
      } else if (op === "JMP" || op === "JZ") {
        explanation = `${op === "JMP" || s.flags.z ? "The branch is taken" : "Zero is clear, so the branch is skipped"}. Next PC will be ${op === "JMP" || s.flags.z ? s.operand : s.pc}.`;
        move(
          "control",
          "pc",
          op === "JMP" || s.flags.z ? s.operand : s.pc,
          "control",
        );
      } else
        explanation =
          op === "OUT"
            ? `Prepare to copy ${s.acc} from ACC into the output register.`
            : op === "HLT"
              ? "The CPU prepares to stop."
              : "No operation: the registers keep their values.";
    } else {
      s.stage = "writeback";
      s.cycles++;
      if (aluOps.has(op)) {
        s.acc = this.pending;
        s.flags = { ...this.pendingFlags };
        alu = {
          operation: op,
          left: s.a,
          right: s.b,
          result: s.acc,
          flags: { ...s.flags },
        };
        move("alu", "acc", s.acc);
        move(
          "alu",
          "flags",
          Number(s.flags.z) |
            (Number(s.flags.c) << 1) |
            (Number(s.flags.v) << 2) |
            (Number(s.flags.b) << 3),
        );
      } else if (op === "LDI" || op === "LDA") {
        s.acc = this.pending;
        move(op === "LDI" ? "ir" : "ram", "acc", s.acc);
      } else if (op === "STA") {
        const old = s.ram[s.operand];
        s.ram[s.operand] = s.acc;
        memory = {
          address: s.operand,
          before: old,
          after: s.acc,
          kind: "write",
        };
        move("acc", "ram", s.acc);
      } else if (op === "MOV") {
        const dest = s.operand === 0 ? "a" : s.operand === 1 ? "b" : "acc";
        const src = s.operand === 2 ? "a" : s.operand === 3 ? "b" : "acc";
        s[dest] = this.pending;
        move(src, dest, this.pending);
      } else if (op === "OUT") {
        s.output = s.acc;
        move("acc", "output", s.acc);
      } else if (op === "JMP" || (op === "JZ" && s.flags.z)) {
        s.pc = s.operand;
        move("control", "pc", s.pc, "address");
      } else if (op === "HLT") s.status = "halted";
      explanation = `${op} completed. ${s.acc !== before.acc ? `ACC changed from ${before.acc} to ${s.acc}.` : op === "OUT" ? `The output now shows ${s.output}.` : op === "STA" ? `RAM[${s.operand}] now stores ${s.acc}.` : op === "HLT" ? "The CPU is halted. Reset to begin again." : `PC is ${s.pc}.`} ${aluOps.has(op) ? `Flags: Zero ${+s.flags.z}, Carry ${+s.flags.c}, Overflow ${+s.flags.v}, Borrow ${+s.flags.b}.` : ""}`;
    }
    if (!["halted", "error", "running"].includes(s.status)) s.status = "paused";
    return {
      version: 1,
      seq: ++this.seq,
      timestamp: Date.now(),
      instruction: `${names[s.ir] ?? "INVALID"}${hasOperand.has(names[s.ir]) ? " " + s.operand : ""}`,
      state: structuredClone(s),
      before,
      transfers,
      explanation: s.error || explanation,
      alu,
      memory,
    };
  }
  instruction(): Trace[] {
    const events: Trace[] = [];
    for (let i = 0; i < 4; i++) {
      const e = this.step();
      if (!e) break;
      events.push(e);
      if (e.state.stage === "writeback" || e.state.status === "error") break;
    }
    return events;
  }
  run(): Trace[] {
    const events: Trace[] = [];
    while (!["halted", "error"].includes(this.state.status)) {
      const e = this.step();
      if (e) events.push(e);
    }
    return events;
  }
}
