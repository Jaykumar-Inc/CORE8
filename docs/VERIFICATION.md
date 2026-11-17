# Verification record

Software validation performed **17 November 2026** in the Windows workspace. This record distinguishes executable checks from tests requiring a physical board or a real browser/camera session.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run lint` | Pass: ESLint across application, CPU package and scripts |
| `npm test` | Pass: 121 tests across CPU/protocol, state/transport, discovery and rendered interactions |
| `npm run build` | Pass: TypeScript and Vite production output |
| `npm run test:parity` | Pass: 210 programs, 4,374 matching C++/TypeScript stage snapshots |
| Native firmware assertions (included in parity script) | Pass: reference program, wraparound, reset, division-by-zero, loop budget, actual command dispatcher, keypad numeric-entry/result controller, OLED formatting and validated demo overlays |
| PlatformIO `esp32dev` | Pass: pinned framework and libraries compile/link |
| PlatformIO `oled-safe-pins` | Pass: alternate OLED 3 pins compile/link |
| npm dependency audit | No known vulnerabilities after updating Vitest and Zod; see lockfile for resolved versions |

Parity compares **all registers, flags, stage/status, completed instruction count, instruction address, 256 RAM cells, transfer endpoints/data/bus types, actual ALU result/flags, memory access events, and the learning/binary OLED frame texts** for every recorded stage. Edge operands include 0, 1, 127, 128 and 255 for every arithmetic/logical operation, unary instructions, all MOV directions, reference memory operations, branches, bad encodings and a full 256-byte program. Infinite-loop limits are covered separately by both engine/native regressions.

Frontend tests exercise actual rendering and navigation through all eleven pages in a DOM test environment, hardware-offline views, completed-program output, binary toggles and quiz feedback. OLED tests cover retained calculations, pending flags, bounded ASCII text, latest-frame relay coalescing, offline handling and release. Transport tests use controlled WebSocket/fetch doubles to verify malformed telemetry, freshness, deduplication, disconnection/reconnection, acknowledgements, rejected loads and history isolation. They do not establish behavior on an actual radio network.

The production build splits application, React, motion and validation bundles. Rollup reports two non-fatal annotation-placement warnings in the upstream Zod package; it removes the comments and completes the build. No application type or lint errors remain.

Firmware build output is under `firmware/.pio/build/<environment>/`. Compiled static RAM usage is approximately 51 KB (15.6% of 320 KB); flash is approximately 846 KB (64.6% of the default app partition). These linker figures exclude runtime heap allocation and are not a substitute for a heap soak test.

## Verification limits

Browser automation could not inspect Chrome because the Computer Use environment could not reliably determine the current browser URL. No screenshot-based desktop/mobile visual review is claimed. Responsive CSS, themes and reduced motion are implemented; DOM tests establish functional rendering, not visual fidelity, contrast measurements or animation smoothness on a real student laptop.

The standard `esp32dev` firmware was uploaded over COM5 to the connected ESP32-D0WD-V3 (revision 3.1), initially as 2.0.0 and subsequently as **2.0.2** with the keypad result-flow and WebSocket handshake fixes. Esptool verified written flash hashes. The normal stub uploader encountered serial stream errors; the ROM loader at 115200 baud with uncompressed writes succeeded. Logs are retained locally under `artifacts/hardware/`.

The laptop hotspot **JAY** was enabled at 2.4 GHz. Serial output confirmed CORE8 2.0.2 joined at **192.168.137.52**, and `/api/health` reported Wi-Fi connected and approximately 245 KB free heap. The real HTTP reference test and the final WebSocket reference test both produced ACC=8, RAM[20]=8 and OUTPUT=8. The final WebSocket test validated **38 snapshots**, real program-to-IR transfers, command acknowledgements and reset back to Ready. This also confirmed the corrected handshake timeout: the library checks ping deadlines during upgrade-header processing, so transport heartbeat timeouts now allow 15 seconds while application snapshots remain at two-second intervals.

The portable keypad controller regression drives actual key sequences such as `A15#3#`, confirms auto-run, persistent results, repeat/back, range validation, logic, division-by-zero and memory preservation. This is a software regression; physical key scanning and OLED readability have not been observed. Wi-Fi soak/recovery, power/pull-up reliability and webcam checks remain unperformed. Arduino IDE setup is documented but not application-tested.

After a later reconnect, Windows DHCP changed the same board's address from **192.168.137.52** to **192.168.137.166**. The former address timed out while the new address returned healthy firmware 2.0.2 and live WebSocket packets for both `http://localhost:5173` and `http://127.0.0.1:5173` origins. The dashboard now provides Find ESP32 and a bounded discovery attempt after connection failure. The actual running local discovery endpoint returned HTTP 200 and the verified address 192.168.137.166. Automated regressions cover stale-address recovery, later DHCP changes, unavailable discovery, invalid targets and cancellation of outdated search results. No additional ESP32 flashing was needed for this dashboard fix.

## Enhanced OLED hardware verification (2.1.0)

Firmware **2.1.0** was installed on COM5 using fourteen verified ROM-loader blocks after intermittent USB/serial errors interrupted full-image writes. A final verification matched the entire 853,008-byte application image against flash. Serial output confirmed startup; after JAY was re-enabled at 2.4 GHz, discovery found **192.168.137.157** and health reported OLED protocol 2.

Actual laptop HTTP commands ran the reference program to ACC=8, RAM[20]=8 and OUTPUT=8. The ESP32's `/api/oled` frame retained `ADD 5+3 = 8`, the memory access and output bits `00001000` after HLT. Selecting the binary view updated the firmware's display frame. A separate laptop demo calculation (99+1) was relayed through the running local server: the board returned three DEMO-labeled screens and OUTPUT=100, while the real CPU state before/after was identical. A running hardware program correctly rejected a demo overlay with HTTP 409. Two subsequent real WebSocket snapshots included schema-valid detailed display frames. The board was reset to Ready afterward.

These results are recorded locally in `artifacts/hardware/oled-2.1.0-verification.json`. They verify the firmware frame used by the OLED renderer and the laptop-to-board relay. The physical pixels/readability, keypad scanning and electrical reliability remain unobserved. Fast demo playback intentionally coalesces frames to a maximum of two HTTP sends per second; slower playback helps inspect stages.

## Required bench log

Fill in observed results before claiming final hardware acceptance. See WIRING.md for the procedure.

| Test | Expected result | Observed result |
| --- | --- | --- |
| Identify module/USB bridge and regulator | Correct DevKit/3.3 V logic; stable supply | Not performed |
| OLED 1 on 21/22 | Readable PC, IR, instruction and stage | Not performed |
| OLED 2 on 13/14 | Correct A, B, ACC, operation and flags | Not performed |
| OLED 3 on 4/5 | Correct RAM and output in all bases | Not performed |
| Shared-address independent software buses | Three displays operate together without mux | Not performed |
| Cold boot with pull-ups (20 trials) | 20 successful starts; record failures | Not performed |
| EN reset with pull-ups (20 trials) | 20 successful starts; record failures | Not performed |
| Bootloader/upload with OLEDs attached | Reliable entry and exit | Not performed |
| Alternative OLED 3 wiring on 16/17 | Reliable startup on appropriate WROOM board | Not performed |
| Every keypad key | Correct row/column identity and debounce | Not performed |
| Numeric entry/back/reset confirmation | Bounds and hold confirmation work correctly | Not performed |
| Keypad STA followed by LDA | RAM/register contents preserved | Not performed |
| Wi-Fi disabled at boot | Local CPU, menu and screens still work | Not performed |
| Wi-Fi loss/reconnection | Board continues; browser marks Offline after 6 s | Not performed |
| LAN API and WS on 80/81 | Real snapshots/events and command acknowledgements | Passed over JAY; 38 schema-valid WS snapshots, genuine transfers and acknowledgements |
| Enhanced OLED data and demo mirror | Detailed real frames; labeled demo; CPU unchanged | Passed via actual ESP32 HTTP and WS; physical pixels not observed |
| Keypad + dashboard command interleaving | Serialized changes; running-load conflicts rejected | Not performed |
| Physical reference program | ACC=8, RAM[20]=8, OUT=8, bin=00001000, hex=08 | Passed on real ESP32 via HTTP/WS telemetry; physical OLED appearance not observed |
| Physical 0.25× stage demonstration | All four stages observable and explained | Not performed |
| One-hour heap/network soak | No watchdog resets, unbounded heap loss or dropped controls | Not performed |
| Camera permission/device/stop/fullscreen | Local feed; tracks stop on Stop/page leave | Not performed |
| Desktop/mobile/light/reduced-motion review | Readable layout, keyboard access, sensible animation | Not performed |

## Acceptance mapping

All requested software areas have implementations: CPU/ISA/flags, firmware, exact keypad pins, three separate software-I²C screens, network API, demo engine, eleven pages, trace-based diagram, playback/replay, assembly builder, experiments, quizzes, progress, narration, glossary, themes, camera and documentation. Breakpoints were optional and are not implemented; instruction/stage stepping is available. Final electrical, display-readability and prolonged network acceptance remains conditional on the bench log above.
