# CORE8 instruction set, version 1

Every instruction is **two bytes**: `[opcode, operand]`. Instructions without an argument require a zero reserved operand byte. Programs contain 1–128 instructions, occupying 2–256 bytes. Program memory is separate from 256 bytes of data RAM. Byte values are unsigned 0–255; data arithmetic wraps modulo 256. PC is a 9-bit position (0–256), with 256 serving as an end sentinel.

At Fetch, the CPU reads both bytes into IR/operand latches, saves the instruction address, then advances PC by **2**. Decode validates the instruction. Execute prepares the operation; Write-back commits its result. Branches replace the already-advanced PC at Write-back. All instructions, including NOP, branches and HLT, have four stages when successful.

| Mnemonic | Opcode hex | Operand | Semantics at Write-back |
| --- | --- | --- | --- |
| NOP | 00 | reserved 00 | No register or flag changes |
| LDI n | 01 | immediate byte | ACC ← n |
| LDA addr | 02 | RAM address | ACC ← RAM[addr], read sampled at Execute |
| STA addr | 03 | RAM address | RAM[addr] ← ACC |
| MOV selector | 04 | 0–3 | 0: ACC→A; 1: ACC→B; 2: A→ACC; 3: B→ACC |
| OUT | 05 | reserved 00 | OUTPUT ← ACC |
| ADD n | 10 | immediate byte | ACC ← (ACC + n) mod 256 |
| SUB n | 11 | immediate byte | ACC ← (ACC − n) mod 256 |
| MUL n | 12 | immediate byte | ACC ← (ACC × n) mod 256 |
| DIV n | 13 | immediate byte | ACC ← floor(ACC / n); n=0 faults |
| INC | 14 | reserved 00 | ACC ← (ACC + 1) mod 256 |
| DEC | 15 | reserved 00 | ACC ← (ACC − 1) mod 256 |
| AND n | 20 | immediate byte | ACC ← ACC bitwise AND n |
| OR n | 21 | immediate byte | ACC ← ACC bitwise OR n |
| XOR n | 22 | immediate byte | ACC ← ACC bitwise XOR n |
| NOT | 23 | reserved 00 | ACC ← bitwise complement within 8 bits |
| SHL | 24 | reserved 00 | Logical left shift by exactly one; zero enters bit 0 |
| SHR | 25 | reserved 00 | Logical right shift by exactly one; zero enters bit 7 |
| JMP addr | 30 | program byte address | PC ← addr |
| JZ addr | 31 | program byte address | PC ← addr only if Zero is set |
| HLT | FF | reserved 00 | Halt, preserving registers, RAM and output |

Arithmetic and logic operations use ACC as their first input and immediate n as their second. During Execute, A captures ACC and B captures n; INC/DEC use B=1 and unary NOT/SHL/SHR use B=0. These latches are observable and overwrite earlier values of A/B. MOV copies between registers without invoking the ALU.

## Exact flag rules

All ALU instructions replace **all four** flags at Write-back. Other instructions preserve all flags, including LDI/LDA/MOV. Therefore JZ tests the last ALU result, not simply the current ACC value.

| Flag | Rule |
| --- | --- |
| Z — Zero | Set iff the final 8-bit result is zero, for every ALU operation |
| C — Carry | ADD/INC/MUL: unsigned raw result exceeds 255. SHL: original bit 7. SHR: original bit 0. Cleared for SUB/DEC/DIV and bitwise operations |
| V — Overflow | ADD/INC/SUB/DEC/MUL: signed mathematical result is outside −128…127, interpreting each operand as two's-complement 8-bit. SHL: sign bit changes. Cleared for DIV/SHR/bitwise operations |
| B — Borrow | SUB/DEC: unsigned left input is smaller than the right input. Cleared for all other ALU operations |

Division is **unsigned** and truncates toward zero. V is cleared for successful DIV. Carry and Borrow are independent; SUB sets B on underflow and clears C. Multiplication's C and V describe unsigned and signed products respectively: `255 × 2` gives 254 with C=1, V=0 because signed −1 × 2 = −2.

## Assembly syntax

Mnemonics and labels are case-insensitive. Use decimal, `0x` hexadecimal or `0b` binary integer literals. Negative, fractional and scientific-notation operands are rejected. Semicolons introduce comments. Labels start with a letter or underscore and resolve to even byte addresses. Branch targets must point to an existing instruction; this is validated even for an untaken JZ.

MOV accepts 0–3 or `ACC>A`, `ACC>B`, `A>ACC`, `B>ACC`. It is a single selector operand, not two encoded register operands. Other MOV formats are rejected.

```asm
LDI 3
loop: OUT
DEC
JZ done
JMP loop
done: OUT
HLT
```

Output sequence is 3, 2, 1, 0. The label `loop` is address 2; `done` is address 10.

## Faults, reset and limits

Invalid opcodes, nonzero reserved operands, bad MOV selectors and invalid branch addresses fault at Decode without a Write-back. Division by zero faults at Execute; ACC and flags remain unchanged, though A/B input latches have already captured their inputs. Fetch outside the loaded program faults. PC does not wrap from 256 to zero.

Each successful Write-back increments the instruction counter. A Fetch after 10,000 completed instructions faults, protecting against infinite loops. HLT at the 10,000th instruction is allowed. Faults and Halt require reset or program loading before execution resumes. Reset clears all registers, flags, RAM, pending result, stage and instruction count; it preserves loaded program bytes. Loading a program validates length/bytes and resets CPU state. Keypad C-menu single-operation programs deliberately preserve data registers/RAM while resetting only execution context, so memory can be inspected and reused locally.
