# Wiring and hardware validation

Disconnect power before wiring. Use an ESP32 DevKit V1 with 3.3 V-compatible SSD1306 128×64 four-pin I²C modules. Connect **all grounds together**. This design needs no Arduino Uno and no I²C multiplexer.

| Device | Signal | ESP32 GPIO |
| --- | --- | --- |
| OLED 1: Control Unit | SDA / SCL | 21 / 22 |
| OLED 2: ALU and Registers | SDA / SCL | 13 / 14 |
| OLED 3: Memory and Output | SDA / SCL | 4 / 5 |
| Keypad | Rows R1, R2, R3, R4 | 26, 27, 32, 33 |
| Keypad | Columns C1, C2, C3, C4 | 18, 19, 23, 25 |
| All OLEDs | VCC / GND | 3V3 / GND |

U8g2 constructors take **clock first, data second**. The firmware therefore uses `(22,21)`, `(14,13)` and `(5,4)`. These are three independent software buses. All screens may share address 0x3C without collision; do not join their SDA or SCL wires. Default U8g2 SSD1306 address is 0x3C. If a module is actually 0x3D, configure `setI2CAddress(0x3D * 2)` before its `begin()` call: U8g2 expects a shifted 8-bit address.

Check each module's pin labels; physical order varies. Do not power pull-ups from 5 V. Keep wiring short. Verify the board regulator can supply the combined displays and ESP32 Wi-Fi peaks without brownouts. Do not connect multiple independent powered supplies together through their 3V3 outputs.

## Keypad connector verification

The intended key matrix is:

```text
1 2 3 A
4 5 6 B
7 8 9 C
* 0 # D
```

Membrane connector order is not universal. Identify R1–R4 and C1–C4 by continuity testing before connecting them to the exact GPIO assignments above. No changes to the established keypad mapping are needed or made by either build profile.

### Does the keypad need 10 kΩ resistors?

No external resistor is normally required for this passive 4×4 membrane keypad with the selected ESP32 pins. Connect its eight matrix wires directly to the mapped GPIOs. The Keypad library scans the columns and configures the row inputs with `INPUT_PULLUP`, using the ESP32's internal pull-ups. Do not add a 10 kΩ resistor in series with every keypad wire, or attach keypad wires directly to a 5 V supply. The keypad matrix itself does not have a VCC/GND connection.

For unusually long/noisy wiring, optional external pull-ups can be considered on the **row input pins only**, each from GPIO26/27/32/33 to **3.3 V**, after investigating wiring and grounding. They are not needed to fix the former firmware behavior where final # only loaded a program without running it.

Sources: [Keypad scanning implementation](https://github.com/Chris--A/Keypad/blob/master/src/Keypad.cpp) and [Espressif GPIO pull-up documentation](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/gpio.html). OLED I²C pull-ups and ESP32 EN/BOOT circuitry are separate from keypad scanning.

## Boot pin reliability: required bench test

For the classic ESP32, Espressif lists GPIO0, GPIO2, GPIO5, GPIO12 and GPIO15 as strapping pins. **GPIO5 is a strap pin; GPIO4 is not in that classic ESP32 strap list.** Nevertheless, test the complete GPIO4/5 display connection, pull-ups, power sequencing and your exact DevKit module rather than assuming it will boot reliably. Related ESP32 families and clone boards can differ.

Source: [Espressif ESP32 schematic checklist](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/schematic-checklist.html) and [ESP32 datasheet, Boot Configurations](https://documentation.espressif.com/esp32_datasheet_en.html).

Perform and record these checks with the final connected display modules:

1. Boot with OLED 3 disconnected and capture the serial boot message.
2. Connect all three OLEDs. Perform at least 20 USB cold starts and 20 EN resets. Record boot success, screen response and any brownout/reset messages.
3. Repeat upload entry with the pull-ups connected. Check reliable transition into and out of the bootloader.
4. Measure idle SDA/SCL voltage and regulator voltage during Wi-Fi traffic. Inspect the module's pull-up resistor values and power-off backfeeding.
5. Test Wi-Fi unavailable, then reconnect; keypad and CPU operation must continue.

These measurements have **not** been performed in software-only validation. Fill in the bench log in `docs/VERIFICATION.md` before claiming reliable hardware operation.

## Documented alternative configuration

If GPIO4/5 wiring affects startup, move **OLED 3 only** to **SDA GPIO16 and SCL GPIO17**. Use a WROOM DevKit V1 where those pins are available; some PSRAM/WROVER configurations reserve them. Verify your module before rewiring.

```powershell
pio run -d firmware -e oled-safe-pins
pio run -d firmware -e oled-safe-pins -t upload
```

This profile defines `OLED3_SDA=16` and `OLED3_SCL=17`. OLED 1, OLED 2 and every keypad pin stay as specified. Both firmware profiles are build-tested; neither profile's electrical reliability is inferred from compilation.

## First display and keypad checks

- At boot, OLED 1 should show CONTROL UNIT, PC/IR and READY; OLED 2 shows A/B/ACC and flags; OLED 3 shows RAM and output. A blank display is not declared healthy by software.
- Press A/B/C/D. OLED 1 switches to the corresponding menu. D then 6 cycles control/menu/network pages. Test every row and column with digits and confirm entry using #; * clears or backs out.
- Load the default program with D then 4. Press # four times: LDI 5 should reach Write-back with ACC = 5. Continue or D then 1 to run. Final OLED 3 output should be decimal 8, hex 08, binary 00001000.
- Hold * for 1.5 seconds, release, then press # to confirm reset. Any other key cancels. Verify no accidental reset happens on a short * press.
