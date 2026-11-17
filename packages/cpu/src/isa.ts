export const ISA = {
  NOP: 0x00,
  LDI: 0x01,
  LDA: 0x02,
  STA: 0x03,
  MOV: 0x04,
  OUT: 0x05,
  ADD: 0x10,
  SUB: 0x11,
  MUL: 0x12,
  DIV: 0x13,
  INC: 0x14,
  DEC: 0x15,
  AND: 0x20,
  OR: 0x21,
  XOR: 0x22,
  NOT: 0x23,
  SHL: 0x24,
  SHR: 0x25,
  JMP: 0x30,
  JZ: 0x31,
  HLT: 0xff,
} as const;
export type Mnemonic = keyof typeof ISA;
export const names = Object.fromEntries(
  Object.entries(ISA).map(([k, v]) => [v, k]),
) as Record<number, Mnemonic>;
export const hasOperand = new Set<Mnemonic>([
  "LDI",
  "LDA",
  "STA",
  "MOV",
  "ADD",
  "SUB",
  "MUL",
  "DIV",
  "AND",
  "OR",
  "XOR",
  "JMP",
  "JZ",
]);
export const aluOps = new Set<Mnemonic>([
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
]);
export const binary = (n: number) => n.toString(2).padStart(8, "0");
export const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
