import { describe, it, expect } from "vitest";
import { CPU, assemble, createOLEDFrame, oledFrameSchema } from "./index";
const run = (source: string) => {
  const cpu = new CPU();
  cpu.load(assemble(source).bytes);
  const events = cpu.run();
  return { cpu, events };
};
describe("detailed OLED display model", () => {
  it("retains the equation, last RAM access, and previous register values after HLT", () => {
    const { cpu, events } = run("LDI 5\nADD 3\nSTA 20\nLDA 20\nOUT\nHLT");
    const frame = createOLEDFrame(cpu.state, events, { programBytes: 12 });
    expect(frame.screens[1].lines[0]).toBe("ADD 5+3 = 8");
    expect(frame.screens[1].lines[1]).toBe("ACC 005>008 HEX:08");
    expect(frame.screens[2].lines[0]).toBe("RAM[020] R 008>008");
    expect(frame.screens[2].lines[1]).toBe("OUT 008 | HEX 08");
    expect(frame.screens[2].lines[3]).toContain("OUT 000>008");
    expect(oledFrameSchema.safeParse(frame).success).toBe(true);
  });
  it("marks proposed ALU flags as pending without replacing architectural flags", () => {
    const { events } = run("LDI 255\nADD 1\nHLT");
    const partial = events.slice(0, 7);
    const frame = createOLEDFrame(partial.at(-1)!.state, partial);
    expect(frame.screens[1].lines[0]).toBe("ADD 255+1 = 0");
    expect(frame.screens[1].lines[3]).toBe("Z:0 C:0 V:0 B:0");
    expect(frame.screens[1].lines[4]).toBe("PENDING Z1 C1 V0 B0");
  });
  it.each(["learning", "binary", "network"] as const)(
    "bounds every %s line to the 128x64 display",
    (page) => {
      const { cpu, events } = run("LDI 255\nMUL 255\nSTA 255\nOUT\nHLT");
      const frame = createOLEDFrame(cpu.state, events, { page });
      expect(oledFrameSchema.safeParse(frame).success).toBe(true);
      for (const s of frame.screens) {
        expect(s.lines).toHaveLength(5);
        expect(s.title.length).toBeLessThanOrEqual(25);
        s.lines.forEach((line) => expect(line.length).toBeLessThanOrEqual(25));
      }
    },
  );
  it("clears old results on reset", () => {
    const { cpu, events } = run("LDI 5\nADD 3\nHLT");
    cpu.reset();
    const frame = createOLEDFrame(cpu.state, events);
    expect(frame.screens[1].lines[0]).toBe("A:000 B:000 ACC:000");
    expect(frame.screens[2].lines[0]).toContain("no transfer");
  });
  it("labels all demo screens visibly", () => {
    const { cpu, events } = run("LDI 42\nOUT\nHLT");
    const frame = createOLEDFrame(cpu.state, events, { page: "binary" });
    expect(frame.source).toBe("demo");
    expect(frame.screens.every((screen) => screen.title.includes("DEMO"))).toBe(
      true,
    );
  });
  it("rejects forged hardware mirror labels and oversized rows", () => {
    const { cpu, events } = run("HLT");
    const frame = createOLEDFrame(cpu.state, events);
    expect(
      oledFrameSchema.safeParse({
        ...frame,
        screens: [
          { ...frame.screens[0], lines: ["x".repeat(26), "", "", "", ""] },
          ...frame.screens.slice(1),
        ],
      }).success,
    ).toBe(false);
  });
});
