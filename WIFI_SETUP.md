# Wi-Fi and dashboard integration

## Current laptop setup

The local ESP32 firmware is configured for the **JAY** laptop hotspot at **2.4 GHz**. Firmware 2.1.0 was last verified at **192.168.137.157**. DHCP can change its address after reconnecting. In Live Hardware Lab select Real Hardware and click **Find ESP32**. The local Windows server reads the hotspot's ESP32 clients, verifies `/api/health`, fills in the current address and connects. A failed connection also attempts discovery once; after a successful session, another later address change can be recovered again. No subnet scan or hotspot setting changes are performed by discovery.

For manual connection, the last verified address is `http://192.168.137.157`. Leave the optional control token blank for the current local configuration. DHCP can change the address again; use Find ESP32, Serial Monitor or the OLED network page. The password is kept in ignored `firmware/include/secrets.h`, not in this guide. Discovery requires the local Vite development or preview server on the Windows laptop; a static deployment can still connect using a manually entered address.

## Fresh setup

1. Copy `firmware/include/secrets.example.h` to `secrets.h` in the same folder.
2. Enter a 2.4 GHz SSID and password. The classic ESP32 DevKit V1 does not join a 5 GHz-only network.
3. Set `DASHBOARD_ORIGIN` to the exact browser origin, e.g. `http://localhost:5173`. No trailing slash. The default local configuration accepts both localhost and 127.0.0.1 on port 5173. Other origins must match the configured origin exactly.
4. Optionally set `CONTROL_TOKEN` to a lab token. Enter the same token in Live Hardware Lab. It is kept in session memory, not persisted in localStorage. Wi-Fi credentials never reach the browser.
5. Build/upload and open Serial Monitor at 115200 baud. Wait for `CORE8 dashboard API: http://... | WebSocket :81/ws`. Press D, then press 6 repeatedly until the System & connection page shows the IP address.
6. Keep the ESP32 and dashboard computer on the same LAN. Open `http://<ESP32-IP>/api/health`. Then select Real Hardware, enter that base URL and connect.

HTTP uses **80**, and the WebSocket server uses **81**, path **/ws**, subprotocol **arduino**. Port 81 must be accessible. The protocol is not a WebSocket upgrade on HTTP port 80. Firmware validates WebSocket Origin headers and HTTP control origins; command tokens are additionally checked when configured. With an empty token, only operate on a trusted isolated lab LAN. This firmware does not provide internet-facing authentication or TLS.

An established socket alone is insufficient to mark CPU telemetry live. Valid schema-version-1 data must arrive. Last received data remains visible with an Offline banner after connection loss. Demo mode is always labeled separately and never fills in missing hardware values.

## API

| Method/path | Response/action |
| --- | --- |
| GET /api/health | Firmware/protocol, Wi-Fi state, IP, uptime, free heap, OLED 3 pin configuration |
| GET /api/state | Complete versioned CPU event/snapshot envelope |
| GET /api/memory | `{ "ram": [256 bytes] }` |
| GET /api/program | Program bytes and `instructionBytes: 2` |
| GET /api/config | Speed, execution budget, stream port/path |
| POST /api/control | Validated command JSON; `{ok,error?}` acknowledgement |
| WS :81/ws | State envelopes and commands; `{type:"ack",id,ok,error?}` responses |

Example PowerShell commands (use your device IP and token):

```powershell
Invoke-RestMethod http://192.168.1.100/api/health
Invoke-RestMethod http://192.168.1.100/api/control -Method Post -ContentType application/json -Body '{"command":"step","token":"your-lab-token"}'
```

Run, pause, reset, step, instruction, load and speed commands are documented in `docs/PROTOCOL.md`. Every command handler runs serially with keypad input. Loading and stepping while running are rejected; pause first. The dashboard orders Pause before Load and waits for a matching acknowledgement before claiming a program was loaded.

## Mobile / another computer

Start the development server with `npm run dev --workspace apps/dashboard -- --host 0.0.0.0`. Browse to the laptop's LAN IP on port 5173 and set that exact origin in firmware. Only expose the dev server to a trusted LAN and configure the local firewall deliberately. Webcam access on a plain HTTP LAN address is normally unavailable; use localhost on the camera laptop or a properly configured HTTPS origin. Do not bypass browser security warnings.

For an ESP32 without TLS, use the local HTTP dashboard for hardware access. An HTTPS-hosted dashboard may block unencrypted `ws://` as mixed content, and some browsers additionally request local-network permission. No cloud relay or streaming account is required.

If Wi-Fi is unavailable, local OLED/keypad operation continues. An empty SSID intentionally disables association attempts. Reconnect logic and heap stability still need real-device soak testing.
