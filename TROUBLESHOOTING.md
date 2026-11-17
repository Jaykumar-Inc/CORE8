# Troubleshooting

| Symptom | Check |
| --- | --- |
| `node` / `npm` not recognized | Install Node LTS 22.12+ and reopen terminal, or use the prepared `scripts/start.ps1` helper |
| PowerShell blocks npm script | Use `npm.cmd`, without weakening machine execution policy |
| Dependency install fails | Check network/proxy access to npm; use `npm ci` with the tracked lockfile |
| `pio` not found | Use the PlatformIO extension terminal or virtual-environment executable from INSTALLATION.md |
| Build downloads fail | Check access to PlatformIO registries, GitHub and Espressif package mirrors; retry the same build |
| ESP32 COM port absent | Check USB data cable, USB bridge driver and Device Manager |
| Upload cannot connect | Verify correct board/port; hold BOOT during initial connection, release after it connects |
| Brownout/reset loops | Check 3.3 V supply capacity and grounding; inspect pull-ups and boot-pin circuitry |
| OLED 3 disrupts startup | Perform the GPIO4/5 boot test; use the documented GPIO16/17 profile on an appropriate WROOM module |
| All OLEDs blank | Check power, common ground, pin labels, 128×64 SSD1306 controller and address |
| Only one OLED blank | Check that display's separate software bus and reversed SDA/SCL; constructors take clock then data |
| Wrong/garbled OLED | Confirm SSD1306, not SH1106; confirm 128×64, address 0x3C/0x3D and short wiring |
| Keypad keys swapped | Identify row/column connector order by continuity; retain the specified GPIO mapping |
| A/B/C/D menu invisible | These keys select the OLED 1 menu page. D6 cycles context. Test OLED 1 wiring |
| Keypad operation refuses load | Pause with D2 first; running firmware rejects replacement programs |
| Final # returns to the menu without calculating | Update to firmware 2.0.1 or newer. Numeric arithmetic/logic now auto-run and keep the result screen visible; * returns to the menu |
| Calculation shows running for several seconds | Execution uses real CPU stages: about 11 seconds at 1× or 3 seconds at 4× for a four-instruction keypad program |
| Upload stops with serial noise/corruption | Retry with the configured 115200 upload baud; check the USB cable, supply and connections if it persists |
| Numeric value rejected | Use integer 0–255 and #. * clears. Negative values are represented through 8-bit arithmetic, not numeric entry |
| Wi-Fi offline | Check 2.4 GHz SSID/password, DHCP, client isolation and signal strength; empty SSID means intentional local-only mode |
| Health opens but dashboard cannot connect | Allow TCP81; use ws://IP:81/ws and arduino subprotocol; match configured origin |
| Previously working IP now times out | Windows hotspot DHCP may assign a new address. Select Real Hardware → Find ESP32; the latest verified JAY address changed from 192.168.137.52 to 192.168.137.166 |
| WebSocket closes during handshake | Update to firmware 2.0.2 or newer. Its transport heartbeat allows the software-I2C displays enough time while upgrade headers are processed; application snapshots still arrive every 2 seconds |
| Browser reports mixed content | Use local HTTP dashboard with HTTP ESP32, or configure a genuine TLS proxy; do not bypass warnings |
| Local network permission requested | The user should review browser permissions; firewall/AP isolation may still block access |
| Control rejected | Verify lab token, Pause before Load/Step, and Reset after Halt/Fault |
| Dashboard says stale | No valid telemetry arrived for six seconds. Check power/network, IP and protocol version |
| Program result differs after MOV | ALU instructions overwrite A/B latches; data loads preserve flags; confirm the documented ISA |
| JZ behaves unexpectedly | It tests the most recent ALU Zero flag. LDI does not recompute it |
| PC error | Branch target must be an even byte address inside the program; add HLT before falling off its end |
| Instruction budget error | Program exceeded 10,000 completed instructions. Fix its branch/termination and Reset |
| Previous does not change board | Expected: it selects a recorded snapshot; use Return to latest to follow current telemetry |
| Camera unavailable | Use HTTPS or localhost, allow permission yourself, close competing camera apps and verify OS/browser support |
| Camera changes device but stays blank | Device selection stops the previous stream; press Start camera for the selected camera |
| Spoken narration absent | Browser speech synthesis must be supported; enable the speaker button and check local audio settings |
| Fonts look different offline | Web fonts fall back to system fonts; simulator behavior is unchanged |

When reporting a defect, include the exact assembly program, mode, firmware version, error text and exported trace. Exclude Wi-Fi secrets and tokens. `/api/health` provides current free heap for memory diagnostics; a successful initialization call does not prove a physical display is connected.
