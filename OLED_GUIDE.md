# Enhanced OLED displays and laptop synchronization

Firmware **2.1.0** adds detailed display frames shared with the dashboard. The GPIO wiring stays unchanged. Each 128×64 display has a title, five bounded text rows, an emphasized value and a small instruction-stage indicator where the title leaves room.

## What the displays show

| Screen | Learning view |
| --- | --- |
| OLED 1 — Control | Controller (LAPTOP/KEYPAD/ESP32), CPU status, stage, PC before/after, IR and operand hex, current instruction, instruction count, a plain-English stage explanation and the active bus transfer |
| OLED 2 — ALU/registers | Calculation such as `ADD 5+3 = 8`, previous/current ACC, hexadecimal and binary, all four flags, plus proposed flags explicitly marked PENDING before Write-back |
| OLED 3 — RAM/output | Last RAM address and read/write before/after values, output decimal/hex/binary, previous/current ACC and output, memory address bits or a fault explanation |

The last ALU calculation and memory transfer stay visible after OUT and HLT, rather than disappearing when IR changes. Reset/loading a program clears old calculation details. The values come from the real execution context; a pending ALU result is not confused with committed ACC/flags.

The **Binary & buses** page shows opcode/operand bits, the two-byte instruction encoding, register/result bits, flags, RAM address/data and output. The **System & connection** page shows Wi-Fi, IP, firmware, free heap, program size and keypad help. In Demo mode this page describes the laptop simulation instead of inventing ESP32 diagnostics.

On the keypad, press **D**, then press **6 repeatedly** to cycle through binary, network, learning and the keypad menu. On the laptop, choose **OLED detail** above the three virtual screens. A physical key releases a laptop demo mirror and returns control to the keypad.

## Laptop execution on the actual ESP32

1. Start the dashboard with START_SERVER.bat.
2. Select **Real Hardware**, open Live Hardware Lab and click **Find ESP32**.
3. Run a program, ALU operation or experiment from the laptop. The ESP32 executes the instructions and updates all three screens. Laptop CPU commands leave a keypad menu/input screen so the CPU data becomes visible.
4. ALU Playground's **Run on ESP32 + OLEDs**, binary conversion's Run button and Learning Academy's **Run experiment + OLEDs** load the selected inputs before starting execution.

The virtual displays use the firmware's own detailed display frame when available. Reviewing hardware history shows its saved frame and does not reverse the real board.

## Demo simulator on the physical OLEDs

The **Mirror laptop demo to physical OLEDs** checkbox is enabled by default and saved in this browser. With the laptop's hotspot active and the board connected, Demo mode sends its actual simulated display frames through the local server to the ESP32. Every physical header includes **DEMO**. This changes only the display overlay; it does not load instructions into the hardware CPU or alter its registers/RAM.

Run/step/replay the demo, change ALU preview inputs, or toggle binary-conversion bits to update the mirror. **Sync now** sends the currently shown frame again. The relay keeps only the newest pending frame and spaces requests to avoid building an unbounded animation queue. Fast playback can skip intermediate physical frames; the final value is still delivered. Use slow playback to inspect individual stages.

Hardware execution takes priority: mirroring is rejected while the real CPU is running. Pause the hardware program before mirroring a demo. Any physical key, hardware command or new hardware WebSocket session releases the demo overlay. Disable the checkbox for laptop-only simulation. An unavailable ESP32 produces an OLED sync message while the demo continues normally.

## API and verification

`GET /api/oled` on the ESP32 returns exactly the three screen texts and their source/page. `POST /api/oled` accepts a validated, explicitly labeled demo frame or `{ "enabled": false }` to release it. `oled` control commands choose learning/binary/network pages. Credentials and control tokens follow the existing local-lab setup.

The native C++ and TypeScript display models are compared stage by stage for learning/binary views. Line widths are limited to 25 ASCII characters. These checks establish data/layout bounds; physical readability, contrast and wiring still need observation on the actual OLED modules.
