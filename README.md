# CORE8 CPU Simulator

An educational **8-bit CPU simulation** with ESP32 firmware and an interactive React/TypeScript dashboard. Follow a program through Fetch, Decode, Execute and Write-back, inspect registers and RAM, and view execution state on three OLED displays.

The simulated machine has its own instruction set and byte-wide data path. The ESP32 runs the C++ model; Demo mode runs a separate TypeScript model in the browser. The displays and dashboard are interfaces for observing those models.

[Installation](#installation) | [Wiring](#wiring) | [Usage](#usage) | [Screenshots](#screenshots) | [Instruction set](INSTRUCTION_SET.md) | [MIT license](LICENSE)

## GitHub repository details

**Recommended repository description**

> Educational 8-bit CPU simulator with ESP32, three OLED displays, a 4x4 keypad and a React/TypeScript Wi-Fi dashboard. Includes a 21-instruction ISA, execution traces, replay and matching C++/TypeScript CPU models.

**Recommended topics**

`esp32` `cpu-simulator` `computer-architecture` `computer-organization` `8-bit` `education` `embedded-systems` `arduino` `platformio` `react` `typescript` `vite` `websocket` `oled` `ssd1306` `keypad` `assembly` `learning-tools` `mit-license`

## Features

- **Defined CPU architecture:** 21 instructions, two-byte encoding, byte registers, separate program memory and 256-byte RAM, branches and an output register.
- **Inspectable execution:** four stages, before/after snapshots, actual bus transfers, pending ALU results and Zero, Carry, Overflow and Borrow flags.
- **Interactive dashboard:** CPU diagram, register/memory inspectors, assembly editor, execution timeline, stepping, replay and JSON trace export.
- **Learning tools:** binary/ALU playgrounds, ten experiments, quizzes, saved local progress and plain-language explanations.
- **ESP32 integration:** keypad controls, three independent software-I2C OLED buses, HTTP control and validated WebSocket telemetry.
- **Detailed OLED views:** retained calculations and RAM accesses, binary/hex output, connection information and a labeled Demo mirror that leaves the hardware CPU-model state unchanged.
- **Connection handling:** command acknowledgements, stale-data detection, reconnection and Windows laptop-hotspot discovery.
- **Local operation:** the browser demo needs no electronics. The ESP32 supports local keypad/display operation without Wi-Fi. Optional webcam, themes, reduced motion and narration support demonstrations.

## Hardware requirements

| Component | Quantity | Purpose |
| --- | --- | --- |
| ESP32 DevKit V1 | 1 | Runs the C++ CPU model and display/network services |
| SSD1306 OLED | 3 | 0.96-inch, 128x64, four-pin I2C, 3.3 V-compatible modules |
| Passive membrane keypad | 1 | 4x4 matrix with eight signal wires |
| Breadboard and jumper wires | As needed | Connections and shared ground |
| USB data cable | 1 | Power, programming and serial monitoring |
| Wi-Fi-enabled laptop | 1 | Dashboard, development tools and optional hotspot |

A compatible phone can view the dashboard when it is served on a reachable LAN address. The laptop and ESP32 must share a network for hardware operation.

## Wiring

| Device | Signal | ESP32 GPIO |
| --- | --- | --- |
| OLED 1: Control | SDA / SCL | 21 / 22 |
| OLED 2: ALU and registers | SDA / SCL | 13 / 14 |
| OLED 3: RAM and output | SDA / SCL | 4 / 5 |
| Keypad | Rows R1, R2, R3, R4 | 26, 27, 32, 33 |
| Keypad | Columns C1, C2, C3, C4 | 18, 19, 23, 25 |
| All OLEDs | VCC / GND | 3V3 / common GND |

Each OLED uses its **own software-I2C bus**, allowing three modules with address `0x3C` without a multiplexer. Keep their SDA/SCL pairs separate. U8g2 constructors take clock before data. Check module labels, power compatibility and pull-ups before connecting power.

On the classic ESP32, GPIO5 is a strapping pin; GPIO4 is not in its strapping-pin list. Validate the complete GPIO4/5 display connection during startup and reset. An alternate `oled-safe-pins` profile uses OLED 3 on SDA16/SCL17 for suitable WROOM boards with those pins free.

The passive keypad normally needs no external 10 kOhm series resistors because scanning uses internal row pull-ups. Verify the membrane connector's row/column order. See [WIRING.md](WIRING.md) for electrical precautions and bench tests.

## Installation

### Dashboard and browser demo

Requirements: Git and Node.js 22.12 or newer, including npm.

```sh
git clone https://github.com/Jaykumar-Inc/CORE8.git
cd CORE8
npm ci
npm run dev
```

Open **http://localhost:5173**. If PowerShell blocks `npm.ps1`, use `npm.cmd`. The demo works without an ESP32 or cloud account.

On Windows, **START_SERVER.bat** installs dependencies if needed and starts the dashboard in the background. **STOP_SERVER.bat** stops the server started by that launcher. Logs and process state stay in the ignored `artifacts/server/` directory.

```sh
npm run build
npm run preview -w apps/dashboard
```

Preview normally uses port 4173. For hardware access, configure the firmware's allowed dashboard origin to match. Mobile/LAN access also needs the correct bind address and firmware origin; see [WIFI_SETUP.md](WIFI_SETUP.md).

### ESP32 firmware

Install PlatformIO Core or the PlatformIO IDE extension for VS Code. Before your first configuration, copy the safe template **only if your local credentials file does not already exist**:

```powershell
if (-not (Test-Path firmware/include/secrets.h)) {
    Copy-Item firmware/include/secrets.example.h firmware/include/secrets.h
}
```

Edit `firmware/include/secrets.h` locally. Set the SSID and password for your 2.4 GHz network or laptop hotspot, and set `DASHBOARD_ORIGIN` to the exact dashboard origin with its port and no trailing slash. Optionally set a local control token. Leave the SSID empty for local keypad/display operation without Wi-Fi.

The real header is ignored by Git. Keep `secrets.example.h` free of credentials.

```sh
pio run -d firmware -e esp32dev
pio device list
pio run -d firmware -e esp32dev -t upload --upload-port YOUR_PORT
pio device monitor -p YOUR_PORT -b 115200
```

Replace `YOUR_PORT` with the detected device, such as `COM5` on Windows or `/dev/ttyUSB0` on Linux. Use `oled-safe-pins` only after physically rewiring OLED 3 to its documented alternate pins.

PlatformIO is the verified build route. [INSTALLATION.md](INSTALLATION.md) also documents an Arduino IDE alternative and native compiler setup.

## Usage

### Browser simulation

1. Select **Demo Simulator** and finish or skip the introduction.
2. Use **Next stage** to inspect a transfer, or **Run program** to play execution.
3. Inspect registers, ALU, RAM and the timeline. Replay reviews recorded snapshots.
4. Try the Program Builder, ALU Playground or Learning Academy experiments.

The reference program is:

```asm
LDI 5
ADD 3
STA 20
LDA 20
OUT
HLT
```

Its expected final state is `ACC = 8`, `RAM[20] = 8` and `OUTPUT = 8`, represented as binary `00001000` and hexadecimal `08`.

### ESP32 connection

1. Connect the board and laptop to the same 2.4 GHz network.
2. Select **Real Hardware**, then open **Live Hardware Lab**.
3. Enter the IP printed in Serial Monitor. With the local Windows server and laptop hotspot, **Find ESP32** can discover and verify the current address.
4. Connect, load a program and step or run it. Hardware mode displays validated ESP32 telemetry.

HTTP uses port **80**. WebSocket uses **81**, path **`/ws`**, with the `arduino` subprotocol. DHCP can change the board's IP address.

In Demo mode, **Mirror laptop demo to physical OLEDs** sends labeled DEMO display frames through the local server. It does not run the demo on the hardware CPU model. Hardware execution takes priority. See [OLED_GUIDE.md](OLED_GUIDE.md) for detail views and synchronization controls.

### Keypad

Choose an arithmetic or logic operation, enter an operand and press `#`, then enter the second operand when required and press `#` again. Final confirmation starts the CPU program and keeps its result visible. Press `*` to return to the menu. Press `D`, then `6` repeatedly to cycle display pages. See [USER_GUIDE.md](USER_GUIDE.md) for all menus and reset confirmation.

## Screenshots

Verified application captures and physical hardware photographs have not yet been bundled in this repository. Add original images under `docs/screenshots/`; do not present conceptual diagrams or generated component illustrations as hardware evidence.

| Suggested capture | Suggested filename | What to show |
| --- | --- | --- |
| Dashboard overview | `dashboard-overview.png` | Visible execution source and controls |
| CPU execution | `cpu-execution.png` | A stage with actual transfer highlights |
| Registers and RAM | `registers-memory.png` | Reference result and RAM address 20 |
| Three OLEDs | `oled-displays.jpg` | Readable control, ALU and output screens |
| Hardware assembly | `hardware-assembly.jpg` | ESP32, displays, keypad and wiring |

## Validation and current limits

The verification record dated **17 November 2026** reports:

- 121 automated tests, ESLint and the production build passing.
- C++/TypeScript agreement across 210 programs and 4,374 stage snapshots, including OLED text.
- Successful builds for both PlatformIO pin profiles.
- Firmware 2.1.0 installed and actual ESP32 HTTP/WebSocket checks producing the reference result of 8.
- Demo display mirroring with the hardware CPU-model state unchanged.

These checks do not establish physical screen readability, every-key scanning, startup/pull-up reliability, extended network/heap behavior or webcam behavior. Those observations remain on the [bench checklist](docs/VERIFICATION.md).

```sh
npm run check
npm run test:parity
```

The parity check needs a C++17 compiler and a first PlatformIO build to resolve ArduinoJson. It uses `CXX`, `g++` on PATH or an optional local Zig installation. See [INSTALLATION.md](INSTALLATION.md).

## Project structure

```text
apps/dashboard/       React application, hardware bridge and UI tests
packages/cpu/         TypeScript ISA, assembler, CPU and protocol schemas
firmware/include/     Portable C++ CPU, keypad controller and OLED model
firmware/src/         ESP32 display, input and networking integration
firmware/test/        Native C++ regression tests
scripts/             Server launchers, discovery and parity runner
docs/                Protocol and verification records
```

## Documentation

| Guide | Contents |
| --- | --- |
| [Installation](INSTALLATION.md) | Toolchains, firmware upload and native tests |
| [Wiring](WIRING.md) | Exact pins, power and startup precautions |
| [CPU architecture](CPU_ARCHITECTURE.md) | Data path, stages, scheduling and replay |
| [Instruction set](INSTRUCTION_SET.md) | Opcodes, encoding, flags and fault rules |
| [User guide](USER_GUIDE.md) | Dashboard and keypad controls |
| [OLED guide](OLED_GUIDE.md) | Detailed frames, pages and Demo mirroring |
| [Wi-Fi setup](WIFI_SETUP.md) | Network, origins, discovery and API access |
| [Demo guide](DEMO_GUIDE.md) | Learning experiments |
| [Troubleshooting](TROUBLESHOOTING.md) | Build, display and connection problems |
| [Protocol](docs/PROTOCOL.md) | Telemetry and command contracts |
| [Verification](docs/VERIFICATION.md) | Recorded results and remaining checks |

## Configuration and publishing

Keep Wi-Fi credentials in the ignored `firmware/include/secrets.h`. Dependencies, local toolchains, build outputs, logs, device-discovery records and generated reports/presentations are excluded by `.gitignore`. Only the blank credentials template belongs in Git.

Use the API on a trusted local network. The optional token and origin checks do not encrypt HTTP/WebSocket traffic. Review `git diff --cached` before publishing configuration changes.

## License

Copyright (c) 2026 JAY KUMAR. CORE8 source code is available under the [MIT License](LICENSE). Third-party libraries retain their own licenses.
