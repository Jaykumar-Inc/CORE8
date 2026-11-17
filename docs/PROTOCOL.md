# Telemetry and commands — schema version 1

The executable frontend contract lives in `packages/cpu/src/protocol.ts`. `GET /api/state` and WebSocket state packets use the same envelope:

```typescript
{
  version: 1,
  seq: number,               // monotonic event/revision sequence within a boot
  timestamp: number,         // ESP32 millis() or demo Unix milliseconds
  programLength: number,    // firmware program byte length
  programRevision: number,  // changes on program load, including keypad loads
  speed: number,            // actual firmware stage speed
  instruction: string,
  state: Snapshot,
  before: Snapshot,
  transfers: Array<{from: Component, to: Component, value: number,
                    bus: 'address' | 'data' | 'control'}>,
  explanation: string,
  alu: null | {operation: string, left: byte, right: byte, result: byte,
               flags: {z: boolean, c: boolean, v: boolean, b: boolean}},
  memory: null | {address: byte, before: byte, after: byte,
                  kind: 'read' | 'write'},
  oled: {control: string, acc: byte, output: byte} // firmware summary
  display?: {source:'hardware'|'demo', controller:'device'|'keypad'|'laptop',
             page:'learning'|'binary'|'network'|'menu', stage: Stage,
             screens: Array<{title:string,lines:string[],emphasis:number}>}
}
```

Snapshot fields: `pc` (0–256); `ir`, `operand`, `acc`, `a`, `b`, `output`, `instructionAddress` (bytes); `flags` (Z/C/V/B booleans); `ram` (exactly 256 bytes); `stage` (ready/fetch/decode/execute/writeback); `status` (ready/paused/running/halted/error); `cycles` (completed instructions); `error` (string).

Component IDs are pc, program, ir, control, a, b, alu, acc, flags, ram and output. Transfers contain actual values. `alu` at Execute is the pending calculation; at Write-back it is the committed calculation. Faulting DIV has no valid ALU result. Empty transfer arrays are meaningful for snapshots or no-op stages.

Heartbeat packets reuse the current sequence and have `before=state`, empty transfers and null memory/ALU. They update current status without extending history. Hardware sequence increments on stages, reset and load; uptime restarts at reboot. A lower sequence after reconnect clears the previous boot's history. Program revisions invalidate the editor's loaded-source association when a keypad or another client loads new bytes. Browser freshness uses packet receipt time, not cross-device wall clocks. The browser rejects malformed snapshots and does not mark the hardware live merely because a socket opened. Payloads larger than 20 KB are rejected before JSON parsing in the dashboard.

## Commands

```json
{"id":1,"command":"load","program":[1,5,16,3,5,0,255,0],"token":"optional"}
{"id":2,"command":"step","token":"optional"}
{"id":3,"command":"instruction","token":"optional"}
{"id":4,"command":"run","token":"optional"}
{"id":5,"command":"pause","token":"optional"}
{"id":6,"command":"reset","token":"optional"}
{"id":7,"command":"speed","speed":0.25,"token":"optional"}
{"id":8,"command":"oled","page":"binary","token":"optional"}
```

Allowed speeds: 0.25, 0.5, 1, 2, 4. Load requires an even array of 2–256 integer bytes. Instructions are validated during Decode; the frontend assembler additionally rejects source errors before sending. Unknown commands, invalid bytes/speed/token, oversized command payloads and load/step while running are rejected. JSON command payloads are limited to 4096 bytes in application handlers. The transport library also has its own allocation limits.

Successful WS command response: `{"type":"ack","id":2,"ok":true}`. Rejection adds `"error":"..."`. HTTP returns `{ok,error?}` with 200 or 400; invalid origin is 403 and oversized command is 413. Commands publish the resulting current state; actual Step events are emitted individually before the acknowledgement. Dashboard command timeout is five seconds. Program loading is only declared successful after its matching acknowledgement.

Transport: `ws://<device>:81/ws`, subprotocol `arduino`. The configured dashboard Origin is required by the handshake. Localhost and 127.0.0.1:5173 are paired exceptions only when one of them is the configured default. Telemetry is visible to allowed-origin lab clients; control token is optional and does not provide transport encryption. Use an isolated trusted network.

## Local dashboard discovery helper

The Windows laptop's Vite development/preview server additionally provides `GET /api/hardware/discover` on the **dashboard origin** (e.g. localhost:5173), not the ESP32. It reads the existing mobile-hotspot client list, selects ESP32/CORE8 hostnames, and checks the candidates' actual firmware health responses. Cached addresses are also probed; they are never represented as connected without verification. The helper does not scan a subnet or change Windows hotspot settings.

The response contains `{devices:[{ip,url,firmware}],hotspot:{state,ssid},error?}`. Find ESP32 uses a single matching device to update the saved address and connect. Ambiguous results require manual address selection. Initial socket failure or a 15-second connection timeout attempts discovery once; a successful session enables future recovery after another DHCP change. All CPU values still come from validated device telemetry. Static deployments without this local helper retain manual connection.

## OLED protocol 2 (firmware 2.1.0)

The optional `display` field records the actual three-screen frame. Each screen has one title (≤25 printable ASCII characters), exactly five text rows (each ≤25 characters), and emphasis row 0–4. The source is explicit: hardware or demo. Legacy `oled` summaries remain available. Snapshot schema version remains 1 for compatible CPU telemetry.

On the ESP32, `GET /api/oled` returns the current frame. `POST /api/oled` accepts `{frame: OLEDFrame, token?:string}` only for a frame with source `demo`. The firmware forces visible DEMO titles and leaves CPU state untouched. `{enabled:false,token?:string}` releases the overlay. Commands/physical keys/hardware connection also release it. A running hardware program rejects mirroring with HTTP 409. Other validation errors use 400, invalid Origin 403 and a payload above 4096 bytes 413.

The local dashboard server proxies GET/POST `/api/hardware/oled` to its verified discovered device. It accepts only bounded demo frames, limits request size and does not accept an arbitrary upstream host. This relay enables laptop demo display updates while preserving the real-hardware/demo distinction. The browser coalesces pending updates and limits request frequency; its simulator remains independent of relay availability.
