# Installation

## Windows and VS Code

1. Install a supported Node.js LTS release, version 22.12 or newer. Reopen the VS Code terminal after installation. Verify `node --version` and `npm --version`.
2. Open the repository root, not only `apps/dashboard`, in VS Code.
3. Run `npm ci`, then `npm run dev`. Use http://localhost:5173. Vite prints an alternative port if 5173 is busy; update the firmware origin accordingly.
4. Run `npm run check` for lint, tests and a production build. Built files are in `apps/dashboard/dist`.
5. Run `npm run preview -w apps/dashboard` to serve a build. Preview normally uses port 4173; set the matching origin in firmware for hardware access.

If PowerShell blocks `npm.ps1`, use `npm.cmd`; no execution-policy change is necessary. If the prepared workspace-local runtime exists, `& .\scripts\start.ps1` finds it automatically. `.tools` is ignored and is not required in source distributions.

External Google Fonts are optional. The UI falls back to system sans-serif and monospace fonts when offline. Application and CPU behavior require no cloud account.

## PlatformIO firmware build

Install the official PlatformIO IDE extension from the VS Code marketplace, or install PlatformIO Core in a Python virtual environment:

```powershell
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install platformio
& .\.venv\Scripts\pio.exe run -d firmware -e esp32dev
```

The firmware pins platform `espressif32@6.10.0`, Arduino ESP32 2.0.17 through that platform, and board `esp32doit-devkit-v1`. PlatformIO resolves these pinned libraries:

| Library | Version |
| --- | --- |
| U8g2 by olikraus | 2.36.18 |
| Keypad by Mark Stanley / Alexander Brevig (`chris--a/Keypad`) | 3.1.1 |
| WebSockets by Markus Sattler (`links2004/WebSockets`) | 2.6.1 |
| ArduinoJson by Benoit Blanchon | 7.4.2 |

WiFi and WebServer come with the Arduino ESP32 framework. Do not install unrelated libraries with the same names. Software I²C is implemented by U8g2, independently for all three screens.

Copy the credentials template and edit the copy:

```powershell
Copy-Item firmware/include/secrets.example.h firmware/include/secrets.h
```

Leave an empty SSID for a fully local keypad/display lab. The copy is git-ignored. Never put real credentials in the example header or commits.

Connect USB, select the actual serial port, and upload:

```powershell
pio device list
pio run -d firmware -e esp32dev -t upload --upload-port COM5
pio device monitor -p COM5 -b 115200
```

Replace COM5 with the port detected on your machine. If automatic bootloader entry fails, hold BOOT while the uploader begins connecting, release after connection, then press EN after upload. Some boards need their vendor's CP210x or CH340 USB driver. Use a data-capable cable.

For OLED 3 on GPIO16/17, physically rewire only that display and build/upload environment `oled-safe-pins`. This profile assumes a classic WROOM DevKit with GPIO16/17 free; see WIRING.md. The keypad mapping remains unchanged.

## Arduino IDE alternative

1. In Boards Manager add Espressif's official ESP32 package; select version **2.0.17**, DOIT ESP32 DEVKIT V1, 4 MB flash, 115200 serial monitor. Use the official board URL from [Espressif Arduino installation](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html).
2. In Library Manager install U8g2 2.36.18, Keypad 3.1.1, WebSockets 2.6.1 and ArduinoJson 7.4.2.
3. Make a folder named `CORE8`, copy `firmware/src/main.cpp` into it as `CORE8.ino`, and copy `cpu.hpp`, `commands.hpp`, `keypad_ui.hpp`, `oled_view.hpp`, `oled_protocol.hpp`, `secrets.example.h` and your local `secrets.h` from `firmware/include` into that folder.
4. Compile and upload. For the alternate wiring, put `#define OLED3_SDA 16` and `#define OLED3_SCL 17` before the includes in the sketch.

The PlatformIO build is the verified build path. Arduino IDE instructions are provided as an alternative; that application workflow has not been exercised on physical hardware here.

## Native parity checks

Install a C++17 compiler and build the default firmware once to resolve ArduinoJson. From a terminal where `g++` is available, run `npm run test:parity`. Alternatively set `CXX` to a compatible compiler executable; the script also recognizes `.tools/zig-x86_64-windows-0.14.1/zig.exe`. First compilation can take longer while the compiler prepares its runtime. The script also builds and executes the portable regression under `firmware/test`, including the actual remote-command dispatcher and ArduinoJson validation.
