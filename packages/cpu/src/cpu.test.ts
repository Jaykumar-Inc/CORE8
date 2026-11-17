import { describe, expect, it } from "vitest";
import {
  assemble,
  binary,
  commandSchema,
  ConnectionClock,
  CPU,
  ISA,
  traceSchema,
} from "./index";
const execute = (source: string) => {
  const cpu = new CPU();
  cpu.load(assemble(source).bytes);
  const events = cpu.run();
  return { s: cpu.state, events, cpu };
};
describe("deterministic CORE8 CPU", () => {
  it("executes the acceptance reference program", () => {
    const { s, events } = execute("LDI 5\nADD 3\nSTA 20\nLDA 20\nOUT\nHLT");
    expect(s).toMatchObject({
      acc: 8,
      output: 8,
      pc: 12,
      status: "halted",
      cycles: 6,
    });
    expect(s.ram[20]).toBe(8);
    expect(binary(s.output)).toBe("00001000");
    expect(events).toHaveLength(24);
    events.forEach((e) => expect(traceSchema.safeParse(e).success).toBe(true));
  });
  it.each([
    ["ADD", 255, 1, 0, { z: true, c: true, v: false, b: false }],
    ["ADD", 127, 1, 128, { z: false, c: false, v: true, b: false }],
    ["ADD", 128, 128, 0, { z: true, c: true, v: true, b: false }],
    ["SUB", 0, 1, 255, { z: false, c: false, v: false, b: true }],
    ["SUB", 128, 1, 127, { z: false, c: false, v: true, b: false }],
    ["MUL", 16, 16, 0, { z: true, c: true, v: true, b: false }],
    ["MUL", 255, 2, 254, { z: false, c: true, v: false, b: false }],
    ["DIV", 17, 3, 5, { z: false, c: false, v: false, b: false }],
    ["AND", 204, 170, 136, { z: false, c: false, v: false, b: false }],
    ["OR", 204, 170, 238, { z: false, c: false, v: false, b: false }],
    ["XOR", 204, 170, 102, { z: false, c: false, v: false, b: false }],
  ])("%s %d,%d computes flags", (op, a, b, result, flags) => {
    const { s } = execute(`LDI ${a}\n${op} ${b}\nHLT`);
    expect(s.acc).toBe(result);
    expect(s.flags).toEqual(flags);
  });
  it.each([
    ["INC", 255, 0, true, false],
    ["DEC", 0, 255, false, true],
    ["NOT", 170, 85, false, false],
    ["SHL", 128, 0, true, false],
    ["SHR", 1, 0, true, false],
  ])("%s unary", (op, a, result, c, b) => {
    const { s } = execute(`LDI ${a}\n${op}\nHLT`);
    expect(s.acc).toBe(result);
    expect(s.flags.c).toBe(c);
    expect(s.flags.b).toBe(b);
  });
  it("commits results only at write-back", () => {
    const cpu = new CPU();
    cpu.load(assemble("LDI 5\nADD 3\nHLT").bytes);
    cpu.instruction();
    expect(cpu.state.acc).toBe(5);
    expect(cpu.step()?.state.stage).toBe("fetch");
    expect(cpu.state.pc).toBe(4);
    cpu.step();
    cpu.step();
    expect(cpu.state.acc).toBe(5);
    expect(cpu.state.a).toBe(5);
    expect(cpu.state.b).toBe(3);
    expect(cpu.step()?.state.acc).toBe(8);
  });
  it("retains snapshots independently of current state", () => {
    const { cpu, events } = execute("LDI 9\nSTA 255\nHLT");
    cpu.reset();
    expect(events[7].state.ram[255]).toBe(9);
    expect(events[7].before.ram[255]).toBe(0);
    expect(cpu.state.ram[255]).toBe(0);
  });
  it("preserves flags on data and control instructions", () => {
    const { s } = execute(
      "LDI 255\nADD 1\nLDI 9\nSTA 0\nLDA 0\nMOV ACC>A\nOUT\nNOP\nHLT",
    );
    expect(s.flags).toEqual({ z: true, c: true, v: false, b: false });
    expect(s.a).toBe(9);
  });
  it("supports every MOV direction", () => {
    const { s } = execute(
      "LDI 25\nMOV ACC>A\nLDI 9\nMOV ACC>B\nMOV A>ACC\nOUT\nMOV B>ACC\nHLT",
    );
    expect(s).toMatchObject({ a: 25, b: 9, acc: 9, output: 25 });
  });
  it("takes JZ and JMP using byte addresses", () => {
    const { s, events } = execute(
      "LDI 3\nloop: OUT\nDEC\nJZ done\nJMP loop\ndone: OUT\nHLT",
    );
    expect(s.output).toBe(0);
    expect(
      events
        .filter((e) => e.instruction === "OUT" && e.state.stage === "writeback")
        .map((e) => e.state.output),
    ).toEqual([3, 2, 1, 0]);
  });
  it("faults on division by zero without committing a result", () => {
    const { s } = execute("LDI 9\nDIV 0\nHLT");
    expect(s.status).toBe("error");
    expect(s.acc).toBe(9);
    expect(s.stage).toBe("execute");
    expect(s.error).toContain("zero");
  });
  it("bounds infinite loops", () => {
    const { s } = execute("JMP 0");
    expect(s.status).toBe("error");
    expect(s.cycles).toBe(10000);
  });
  it("halts and resets without discarding the program", () => {
    const { cpu } = execute("LDI 2\nOUT\nHLT");
    expect(cpu.step()).toBeNull();
    const program = [...cpu.program];
    cpu.reset();
    expect(cpu.state).toMatchObject({
      acc: 0,
      pc: 0,
      stage: "ready",
      status: "ready",
      cycles: 0,
      output: 0,
    });
    expect(cpu.program).toEqual(program);
    expect(cpu.step()?.state.stage).toBe("fetch");
  });
  it.each([
    [0x99, 0],
    [ISA.NOP, 1],
    [ISA.MOV, 4],
    [ISA.JMP, 1],
    [ISA.JZ, 250],
  ])("rejects invalid instruction bytes %j", (...bytes) => {
    const cpu = new CPU();
    cpu.load(bytes);
    cpu.run();
    expect(cpu.state.status).toBe("error");
    expect(cpu.state.cycles).toBe(0);
  });
  it("faults on falling outside program memory", () => {
    expect(execute("NOP").s.error).toContain("Program Counter");
  });
  it("supports all 256 bytes and end sentinel PC=256", () => {
    const { s } = execute(Array(127).fill("NOP").concat("HLT").join("\n"));
    expect(s.pc).toBe(256);
    expect(s.cycles).toBe(128);
  });
  it.each([
    { bytes: [] },
    { bytes: [1] },
    { bytes: [1, 256] },
    { bytes: [1, -1] },
    { bytes: [1, 1.5] },
  ])("rejects invalid program $bytes", ({ bytes }) => {
    expect(() => new CPU().load(bytes)).toThrow();
  });
});
describe("assembler and protocol", () => {
  it("supports comments, hex, binary, labels and MOV aliases", () => {
    expect(
      assemble("start: LDI 0x05 ; comment\nADD 0b11\nMOV ACC>A\nJMP start")
        .bytes,
    ).toEqual([1, 5, 16, 3, 4, 0, 48, 0]);
  });
  it.each([
    "",
    "LDI 256",
    "LDI -1",
    "LDI 1e2",
    "ADD",
    "NOPE",
    "NOP 1",
    "MOV 4",
    "JMP 1",
    "JMP 200",
    "a: NOP\na: HLT",
    "LDI 0xGG",
    "JZ missing",
    "OUT 1",
  ])("rejects %s", (source) => expect(() => assemble(source)).toThrow());
  it("validates actual trace shape and rejects corrupted telemetry", () => {
    const { events } = execute("HLT");
    const good = events[0];
    expect(traceSchema.parse(good)).toEqual(good);
    expect(traceSchema.safeParse({ ...good, version: 2 }).success).toBe(false);
    expect(
      traceSchema.safeParse({ ...good, state: { ...good.state, ram: [] } })
        .success,
    ).toBe(false);
    expect(
      traceSchema.safeParse({ ...good, state: { ...good.state, acc: 999 } })
        .success,
    ).toBe(false);
  });
  it.each([
    { command: "load", program: [1, 5, 255, 0] },
    { command: "step" },
    { command: "instruction" },
    { command: "run" },
    { command: "pause" },
    { command: "reset" },
    { command: "speed", speed: 0.25 },
  ])("accepts validated remote command %j", (command) =>
    expect(commandSchema.safeParse(command).success).toBe(true),
  );
  it.each([
    { command: "load", program: [1] },
    { command: "load", program: [1, 256] },
    { command: "speed", speed: 100 },
    { command: "erase" },
    { command: "run", program: [] },
  ])("rejects invalid commands where appropriate %j", (command) => {
    if (command.command === "run")
      expect(commandSchema.parse(command)).toEqual({ command: "run" });
    else expect(commandSchema.safeParse(command).success).toBe(false);
  });
  it("marks disconnected or stale telemetry as offline", () => {
    const c = new ConnectionClock();
    expect(c.isLive(0)).toBe(false);
    c.receive(100);
    expect(c.isLive(200)).toBe(true);
    expect(c.isLive(6100)).toBe(false);
    c.receive(7000);
    c.offline();
    expect(c.isLive(7001)).toBe(false);
  });
});
