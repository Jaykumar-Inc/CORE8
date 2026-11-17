# User guide

## First instruction

Start in Demo Simulator. The first-run introduction explains CPU, registers, instructions, keypad and experiments. You can reopen it with Getting started in the sidebar. Select Beginner, Student or Advanced at any time; CPU state is preserved.

The default program starts with `LDI 5`. Click Next stage four times: Fetch reads opcode 01 and operand 05; Decode selects LDI; Execute prepares 5; Write-back changes ACC to 5. The next ADD instruction uses 5 and 3 and commits 8. OUT copies ACC into the output register. HLT stops.

## Playback

- Run program starts stage-paced execution. Pause stops actual execution. Run resumes from the next stage. A halted/faulted CPU needs Restart or Load.
- Next stage performs one stage, or moves one recorded stage forward when reviewing history.
- Next instruction advances through Write-back, or the next recorded instruction boundary.
- Previous recorded stage and Replay last instruction select saved snapshots. They never reverse or pause physical CPU state.
- Run to completion finishes immediately in demo mode, retaining the last 512 stages. On hardware it starts a 4× run, bounded by the firmware instruction budget; the board keeps emitting intermediate events.
- Speed choices are 0.25×, 0.5×, 1×, 2× and 4×. Use 0.25× for guided slow motion.
- Return to latest exits historical review. Explicit Pause is separate from review.

## Dashboard pages

| Page | How to use it |
| --- | --- |
| Overview | CPU state, large architecture view, source editor, current explanation, three virtual displays and quick lessons |
| CPU Explorer | Click or keyboard-activate a component for its role and current value; follow real transfer packets |
| Execution Studio | Inspect stage strip, recent timeline, ALU details and before/after register changes |
| ALU Playground | Change inputs and operation; inspect local CPU preview, each bit, carry reasoning and conversion switches; Load & trace transfers the program to the selected CPU |
| Memory Explorer | Select a RAM cell; inspect decimal/hex/binary and current memory read/write |
| Registers Inspector | See ACC/A/B/PC/IR/OUTPUT in decimal/hex/binary and all four flags |
| Program Builder | Edit highlighted assembly; select an example, insert an opcode, inspect errors/bytes, load, step or run |
| Learning Academy | Choose one of ten experiments, edit its inputs/program, compare expected and actual behavior, check understanding and mark completed |
| Quiz & Challenges | Choose answers, read explanations and retry; local progress persists |
| Live Hardware Lab | Connect ESP32, inspect transport/firmware status, displays and an optional local camera |
| Execution History | Select any retained stage without mutating hardware; export the trace as JSON |

Editor changes do not become CPU instructions until Load into CPU succeeds. An invalid program leaves the existing program intact. The editor is a local draft; after switching to hardware it is not represented as the device's loaded source until you load it successfully. Numeric addresses and branches use bytes, not source-line numbers. Breakpoints are not implemented; use stage/instruction stepping.

## Keypad

Press A, B, C or D to open the menu on OLED 1. Digits select an option. # confirms a number or advances one stage. * clears numeric entry or returns from an entry. Hold * for 1.5 seconds, release, then # to confirm reset; any other key cancels.

| Menu | Choices |
| --- | --- |
| A — Arithmetic | 1 ADD, 2 SUB, 3 MUL, 4 DIV, 5 INC, 6 DEC |
| B — Logic | 1 AND, 2 OR, 3 XOR, 4 NOT, 5 SHL, 6 SHR |
| C — Registers/memory | 1 ACC→A, 2 ACC→B, 3 A→ACC, 4 B→ACC, 5 STA, 6 LDA |
| D — Programs | 1 Run, 2 Pause, 3 Next stage, 4 Reference program, 5 Countdown, 6 Display page, 7 Next instruction |

For arithmetic/logic, enter the first number then #, followed by the second and # when needed. The final # now automatically runs `LDI first; OP second; OUT; HLT` through the real CPU stages. OLED 1 shows progress, then keeps the operation and result visible; it does not silently return to the menu. At 1× speed this four-instruction calculation takes about 11 seconds; at 4× it takes about 3 seconds. The other displays and dashboard follow the same execution. Press * or A/B/C/D to leave the result screen; # repeats the calculation after completion, or resumes it when paused. Unary operations ask for only one number. For STA/LDA enter a RAM address and # to execute. C-menu operations retain current registers/RAM, allowing a saved value to be loaded later. Pause before loading a new program. Numeric entry is limited to 0–255; keypad reset always requires confirmation.

## Learning and accessibility

The level selector changes explanation depth without resetting execution. Beginner uses analogies; Student shows named registers, stages, buses and flags; Advanced adds register transfers and opcode-level values. Hover titles and clickable components provide more context.

The speaker button opts into browser text-to-speech for the current recorded event; toggle it off to stop. No audio service is required. System reduced-motion preference turns off movement while retaining values/highlights. Theme switching preserves a local preference. Progress uses localStorage; restricted/private browsing may make it temporary. No account synchronization is implied.

## Detailed physical OLEDs

See [OLED_GUIDE.md](OLED_GUIDE.md) for learning/binary/system pages, laptop hardware execution, and the optional Demo-to-OLED mirror. Use **OLED detail** above the virtual displays. Demo mirroring is enabled by default and visibly labeled DEMO on the board; hardware runs display the ESP32's actual execution. **Run on ESP32 + OLEDs** and **Run experiment + OLEDs** load the selected inputs and start them. Keypad D followed by repeated 6 cycles the physical views.

## Camera

In Live Hardware Lab, choose Start camera, grant permission yourself, and point it at the board. Select another device, fit/fill, or expand the video. Selecting another device stops the old feed; Start camera opens the selected one. Stop camera or leaving the hardware page releases all acquired tracks. Camera access requires HTTPS or localhost and a supported browser. Video is not uploaded and is never used to infer CPU values.
