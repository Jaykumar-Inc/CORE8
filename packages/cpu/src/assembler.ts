import { hasOperand, ISA, type Mnemonic } from "./isa";
export type SourceLine = {
  address: number;
  line: number;
  text: string;
  bytes: number[];
};
export function assemble(source: string): {
  bytes: number[];
  lines: SourceLine[];
} {
  const labels = new Map<string, number>();
  const parsed: { line: number; text: string; address: number }[] = [];
  let address = 0;
  source.split(/\r?\n/).forEach((raw, i) => {
    let text = raw.split(";")[0].trim();
    if (!text) return;
    const match = text.match(/^([a-z_]\w*):\s*(.*)$/i);
    if (match) {
      const key = match[1].toUpperCase();
      if (labels.has(key)) throw Error(`Line ${i + 1}: duplicate label ${key}`);
      labels.set(key, address);
      text = match[2].trim();
    }
    if (text) {
      parsed.push({ line: i + 1, text, address });
      address += 2;
    }
  });
  if (address === 0 || address > 256)
    throw Error("Programs must contain 1–128 instructions (2–256 bytes).");
  const lines = parsed.map(({ line, text, address }) => {
    const parts = text.toUpperCase().split(/[\s,]+/);
    const op = parts[0] as Mnemonic;
    if (!(op in ISA)) throw Error(`Line ${line}: unknown instruction ${op}`);
    const needs = hasOperand.has(op);
    if (parts.length !== (needs ? 2 : 1))
      throw Error(
        `Line ${line}: ${op} requires ${needs ? "one operand" : "no operand"}`,
      );
    let operand = 0;
    if (needs) {
      const value = parts[1];
      const mov: Record<string, number> = {
        "ACC>A": 0,
        "ACC>B": 1,
        "A>ACC": 2,
        "B>ACC": 3,
      };
      if (op === "MOV" && value in mov) operand = mov[value];
      else if ((op === "JMP" || op === "JZ") && labels.has(value))
        operand = labels.get(value)!;
      else {
        if (!/^(?:\d+|0X[\dA-F]+|0B[01]+)$/.test(value))
          throw Error(`Line ${line}: invalid byte ${value}`);
        operand = Number(value);
      }
      if (!Number.isInteger(operand) || operand < 0 || operand > 255)
        throw Error(`Line ${line}: operand must be 0–255`);
      if (op === "MOV" && operand > 3)
        throw Error(`Line ${line}: MOV selector must be 0–3`);
      if (
        (op === "JMP" || op === "JZ") &&
        (operand % 2 !== 0 || operand >= parsed.length * 2)
      )
        throw Error(
          `Line ${line}: branch must target an instruction in this program`,
        );
    }
    return { address, line, text, bytes: [ISA[op], operand] };
  });
  return { bytes: lines.flatMap((x) => x.bytes), lines };
}
