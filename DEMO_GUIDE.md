# Demonstration guide

Start with Demo Simulator, Beginner mode and 0.25× speed. In Learning Academy choose an experiment, optionally edit inputs, Load animated experiment, and use Next stage or Run program. Mark completed after discussing the knowledge check. Expected results below refer to each original program; edited inputs can change them.

| # | Experiment | Demonstration and expected observation |
| --- | --- | --- |
| 1 | Addition | LDI 5; ADD 3; OUT; HLT. Watch A=5/B=3 feed ALU, then ACC=8 at Write-back and output=8 at OUT. Ask where the result lives before OUT. |
| 2 | Subtraction | LDI 0; SUB 1. ACC wraps to 255 (11111111), B=1, C=0. Explain why an unsigned byte cannot display −1 directly. |
| 3 | Logic gates | LDI 204; AND 170 gives 136 (10001000). Open ALU Playground, compare AND/OR/XOR/NOT and inspect each bit. OR gives 238; XOR gives 102; NOT 204 gives 51. |
| 4 | Binary conversion | LDI 42; OUT gives decimal 42, hex 2A and binary 00101010. Toggle place-value switches in ALU Playground; 32 + 8 + 2 = 42. |
| 5 | Memory | Store 42 at address 20, replace ACC with 0, then LDA 20. Observe RAM retaining 42 and the highlighted transfer returning it to ACC. |
| 6 | Instruction cycle | Use Next stage four times per instruction. Explain reading, coordinating, preparing and committing. ACC changes at Write-back, not at Execute. |
| 7 | Registers | LDI 25; MOV ACC>A; LDI 9; MOV ACC>B; MOV A>ACC; OUT. A=25, B=9, output=25. Copies preserve sources. |
| 8 | Branches/loops | Load Countdown. Outputs 3,2,1,0. DEC produces Zero at 0, JZ skips JMP and reaches done. PC targets are byte addresses 2 and 10. |
| 9 | Flags | LDI 127; ADD 1 sets V=1, C=0. LDI 255; ADD 1 sets Z=1, C=1, V=0. Distinguish signed and unsigned interpretation. |
| 10 | Mini program | Run the reference: LDI 5; ADD 3; STA 20; LDA 20; OUT; HLT. Final ACC=8, RAM[20]=8, OUTPUT=8, BINARY=00001000, HEX=08. |

Then open Quiz & Challenges. Let the learner predict before selecting an answer. Revisit explanations for mistakes. Progress stays in that browser.

## Hardware demonstration

Complete WIRING.md bench checks first. Connect the real device, select Real Hardware, and verify firmware/IP. Use the same programs from the dashboard; all controls now address the board. Observe the three physical OLEDs alongside virtual displays. Optional webcam shows the board, while CPU values come exclusively from telemetry.

For a keypad-only demo: D4 loads the reference program; # steps a stage; D1 runs; D2 pauses; D6 cycles display context. A1 then `5 # 3 #` automatically runs addition and keeps its result visible on OLED 1. No extra D1 is needed for keypad calculations. Press * to return to the arithmetic menu, or # to repeat a completed calculation.

Disconnect Wi-Fi during a paused demonstration: hardware must continue locally, the browser must show Offline after six seconds, and old values must not be labeled live. Reconnect and inspect a fresh snapshot. Reviewing history must not change the board's register values. This real-network test remains a bench requirement, not a consequence of mock transport tests.
