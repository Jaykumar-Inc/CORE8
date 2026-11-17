import { z } from "zod";
const byte = z.number().int().min(0).max(255);
const flags = z.object({
  z: z.boolean(),
  c: z.boolean(),
  v: z.boolean(),
  b: z.boolean(),
});
export const snapshotSchema = z.object({
  pc: z.number().int().min(0).max(256),
  ir: byte,
  operand: byte,
  acc: byte,
  a: byte,
  b: byte,
  output: byte,
  flags,
  ram: z.array(byte).length(256),
  stage: z.enum(["ready", "fetch", "decode", "execute", "writeback"]),
  status: z.enum(["ready", "paused", "running", "halted", "error"]),
  cycles: z.number().int().nonnegative(),
  instructionAddress: byte,
  error: z.string(),
});
const component = z.enum([
  "pc",
  "program",
  "ir",
  "control",
  "a",
  "b",
  "alu",
  "acc",
  "flags",
  "ram",
  "output",
]);
export const oledFrameSchema = z.object({
  source: z.enum(["hardware", "demo"]),
  controller: z.enum(["device", "keypad", "laptop"]),
  page: z.enum(["learning", "binary", "network", "menu"]),
  stage: z.enum(["ready", "fetch", "decode", "execute", "writeback"]),
  screens: z
    .array(
      z.object({
        title: z
          .string()
          .max(25)
          .regex(/^[\x20-\x7e]*$/),
        lines: z
          .array(
            z
              .string()
              .max(25)
              .regex(/^[\x20-\x7e]*$/),
          )
          .length(5),
        emphasis: z.number().int().min(0).max(4),
      }),
    )
    .length(3),
});
export const traceSchema = z.object({
  version: z.literal(1),
  seq: z.number().int().nonnegative(),
  timestamp: z.number().nonnegative(),
  instruction: z.string(),
  state: snapshotSchema,
  before: snapshotSchema,
  transfers: z
    .array(
      z.object({
        from: component,
        to: component,
        value: z.number().int().min(0).max(256),
        bus: z.enum(["address", "data", "control"]),
      }),
    )
    .max(8),
  explanation: z.string(),
  display: oledFrameSchema.optional(),
  alu: z
    .object({
      operation: z.string(),
      left: byte,
      right: byte,
      result: byte,
      flags,
    })
    .nullable(),
  memory: z
    .object({
      address: byte,
      before: byte,
      after: byte,
      kind: z.enum(["read", "write"]),
    })
    .nullable(),
});
export const commandSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("oled"),
    page: z.enum(["learning", "binary", "network"]),
  }),
  z.object({
    command: z.literal("load"),
    program: z
      .array(byte)
      .min(2)
      .max(256)
      .refine((v) => v.length % 2 === 0),
  }),
  z.object({
    command: z.literal("speed"),
    speed: z.union([
      z.literal(0.25),
      z.literal(0.5),
      z.literal(1),
      z.literal(2),
      z.literal(4),
    ]),
  }),
  z.object({
    command: z.enum(["run", "pause", "reset", "step", "instruction"]),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export class ConnectionClock {
  last = 0;
  connected = false;
  receive(now: number) {
    this.last = now;
    this.connected = true;
  }
  offline() {
    this.connected = false;
  }
  isLive(now: number) {
    return this.connected && now - this.last < 6000;
  }
}
