#include "commands.hpp"
#include "cpu.hpp"
#include "keypad_ui.hpp"
#include "oled_protocol.hpp"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <Keypad.h>
#include <U8g2lib.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <WiFi.h>
#if __has_include("secrets.h")
#include "secrets.h"
#else
#include "secrets.example.h"
#endif
#ifndef OLED3_SDA
#define OLED3_SDA 4
#endif
#ifndef OLED3_SCL
#define OLED3_SCL 5
#endif
using namespace core8;
constexpr const char *VERSION = "2.1.0";
CPU cpu;
U8G2_SSD1306_128X64_NONAME_F_SW_I2C oled1(U8G2_R0, 22, 21, U8X8_PIN_NONE);
U8G2_SSD1306_128X64_NONAME_F_SW_I2C oled2(U8G2_R0, 14, 13, U8X8_PIN_NONE);
U8G2_SSD1306_128X64_NONAME_F_SW_I2C oled3(U8G2_R0, OLED3_SCL, OLED3_SDA, U8X8_PIN_NONE);
U8G2 *displays[] = {&oled1, &oled2, &oled3};
char keys[4][4] = {
    {'1', '2', '3', 'A'}, {'4', '5', '6', 'B'}, {'7', '8', '9', 'C'}, {'*', '0', '#', 'D'}};
byte rows[] = {26, 27, 32, 33};
byte columns[] = {18, 19, 23, 25};
Keypad keypad = Keypad(makeKeymap(keys), rows, columns, 4, 4);
WebServer http(80);
WebSocketsServer ws(81, DASHBOARD_ORIGIN, "arduino");
JsonDocument doc;
String packet;
float speed = 1;
uint32_t nextStage = 0, lastOled = 0, lastHeartbeat = 0, lastWifi = 0;
uint8_t screen = 0;
bool networkStarted = false;
OLEDContext oledContext;
OLEDFrame mirroredFrame;
bool mirrorActive = false;
const char *oledController = "device";
void composeOLEDFrame(OLEDFrame &frame);

void snapshot(JsonObject out, const State &s) {
  out["pc"] = s.pc;
  out["ir"] = s.ir;
  out["operand"] = s.operand;
  out["acc"] = s.acc;
  out["a"] = s.a;
  out["b"] = s.b;
  out["output"] = s.output;
  auto f = out["flags"].to<JsonObject>();
  f["z"] = s.flags.z;
  f["c"] = s.flags.c;
  f["v"] = s.flags.v;
  f["b"] = s.flags.b;
  auto ram = out["ram"].to<JsonArray>();
  for (auto value : s.ram)
    ram.add(value);
  out["stage"] = stageName(s.stage);
  out["status"] = statusName(s.status);
  out["cycles"] = s.cycles;
  out["instructionAddress"] = s.instructionAddress;
  out["error"] = s.error;
}
void telemetry(bool changed = false) {
  doc.clear();
  doc["version"] = 1;
  doc["seq"] = cpu.seq;
  doc["timestamp"] = millis();
  doc["programLength"] = cpu.length;
  doc["programRevision"] = cpu.programRevision;
  doc["speed"] = speed;
  char instruction[24];
  if (operandOp(cpu.state.ir))
    snprintf(instruction, sizeof(instruction), "%s %u", mnemonic(cpu.state.ir), cpu.state.operand);
  else
    snprintf(instruction, sizeof(instruction), "%s", mnemonic(cpu.state.ir));
  doc["instruction"] = instruction;
  snapshot(doc["state"].to<JsonObject>(), cpu.state);
  snapshot(doc["before"].to<JsonObject>(), changed ? cpu.event.before : cpu.state);
  auto transfers = doc["transfers"].to<JsonArray>();
  if (changed)
    for (uint8_t i = 0; i < cpu.event.count; i++) {
      const auto &t = cpu.event.transfers[i];
      auto o = transfers.add<JsonObject>();
      o["from"] = t.from;
      o["to"] = t.to;
      o["value"] = t.value;
      o["bus"] = t.bus;
    }
  doc["explanation"] = changed ? cpu.event.explanation
                               : "Snapshot of the current CPU. Step to follow its next transfer.";
  if (changed && cpu.event.aluValid) {
    auto a = doc["alu"].to<JsonObject>();
    a["operation"] = mnemonic(cpu.state.ir);
    a["left"] = cpu.state.a;
    a["right"] = cpu.state.b;
    a["result"] = cpu.event.aluResult;
    auto f = a["flags"].to<JsonObject>();
    f["z"] = cpu.event.aluFlags.z;
    f["c"] = cpu.event.aluFlags.c;
    f["v"] = cpu.event.aluFlags.v;
    f["b"] = cpu.event.aluFlags.b;
  } else
    doc["alu"] = nullptr;
  if (changed && cpu.event.memory) {
    auto m = doc["memory"].to<JsonObject>();
    m["address"] = cpu.event.address;
    m["before"] = cpu.event.oldValue;
    m["after"] = cpu.event.newValue;
    m["kind"] = cpu.event.kind;
  } else
    doc["memory"] = nullptr;
  OLEDFrame frame;
  composeOLEDFrame(frame);
  serializeOLEDFrame(doc["display"].to<JsonObject>(), frame);
  auto oled = doc["oled"].to<JsonObject>();
  oled["control"] = stageName(cpu.state.stage);
  oled["acc"] = cpu.state.acc;
  oled["output"] = cpu.state.output;
  packet = "";
  serializeJson(doc, packet);
}
void publish(bool changed = false) {
  if (networkStarted) {
    telemetry(changed);
    ws.broadcastTXT(packet);
  }
}
void advance() {
  if (cpu.step()) {
    oledContext.observe(cpu);
    publish(true);
  }
}
void runLocalProgram() {
  cpu.state.status = Running;
  nextStage = millis();
  publish();
}
KeypadUI keypadUI(cpu, [] { publish(); }, advance, runLocalProgram);
void remoteDisplay() {
  mirrorActive = false;
  oledController = "laptop";
  keypadUI.remoteAction();
  if (oledContext.revision != cpu.programRevision || cpu.state.stage == Ready)
    oledContext.reset(cpu.programRevision);
}
void remotePublish() {
  remoteDisplay();
  publish();
}
void remoteAdvance() {
  remoteDisplay();
  advance();
}
const char *applyCommand(JsonDocument &cmd) {
  if (!strcmp(cmd["command"] | "", "oled")) {
    if (strlen(CONTROL_TOKEN) && strcmp(cmd["token"] | "", CONTROL_TOKEN))
      return "Invalid control token";
    const char *page = cmd["page"] | "";
    const uint8_t selection = !strcmp(page, "learning")  ? 0
                              : !strcmp(page, "binary")  ? 2
                              : !strcmp(page, "network") ? 3
                                                         : 255;
    if (selection == 255)
      return "Invalid OLED page";
    remoteDisplay();
    keypadUI.detailPage = selection;
    publish();
    return nullptr;
  }
  return applyRemoteCommand(cpu, speed, nextStage, millis(), cmd, CONTROL_TOKEN, remotePublish,
                            remoteAdvance);
}
bool allowedOrigin(const String &origin) {
  if (origin == DASHBOARD_ORIGIN)
    return true;
  const String configured = DASHBOARD_ORIGIN;
  return (configured == "http://localhost:5173" || configured == "http://127.0.0.1:5173") &&
         (origin == "http://localhost:5173" || origin == "http://127.0.0.1:5173");
}
void cors() {
  const String origin = http.header("Origin");
  http.sendHeader("Access-Control-Allow-Origin",
                  allowedOrigin(origin) ? origin : String(DASHBOARD_ORIGIN));
  http.sendHeader("Vary", "Origin");
  http.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  http.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  http.sendHeader("Cache-Control", "no-store");
}
void sendJson() {
  packet = "";
  serializeJson(doc, packet);
  cors();
  http.send(200, "application/json", packet);
}
void startNetwork() {
  if (networkStarted)
    return;
  http.on("/api/health", HTTP_GET, [] {
    doc.clear();
    doc["ok"] = true;
    doc["firmware"] = VERSION;
    doc["protocol"] = 1;
    doc["oledProtocol"] = 2;
    doc["oledMirror"] = mirrorActive;
    doc["freeHeap"] = ESP.getFreeHeap();
    doc["wifi"] = WiFi.status() == WL_CONNECTED;
    doc["ip"] = WiFi.localIP().toString();
    doc["uptime"] = millis();
    doc["oled3Sda"] = OLED3_SDA;
    doc["oled3Scl"] = OLED3_SCL;
    sendJson();
  });
  http.on("/api/state", HTTP_GET, [] {
    telemetry();
    cors();
    http.send(200, "application/json", packet);
  });
  http.on("/api/memory", HTTP_GET, [] {
    doc.clear();
    auto a = doc["ram"].to<JsonArray>();
    for (auto v : cpu.state.ram)
      a.add(v);
    sendJson();
  });
  http.on("/api/program", HTTP_GET, [] {
    doc.clear();
    auto a = doc["program"].to<JsonArray>();
    for (size_t i = 0; i < cpu.length; i++)
      a.add(cpu.program[i]);
    doc["instructionBytes"] = 2;
    sendJson();
  });
  http.on("/api/oled", HTTP_GET, [] {
    doc.clear();
    OLEDFrame frame;
    composeOLEDFrame(frame);
    serializeOLEDFrame(doc.to<JsonObject>(), frame);
    sendJson();
  });
  http.on("/api/oled", HTTP_OPTIONS, [] {
    cors();
    http.send(204);
  });
  http.on("/api/oled", HTTP_POST, [] {
    if (http.header("Origin").length() && !allowedOrigin(http.header("Origin"))) {
      cors();
      http.send(403, "application/json", "{\"ok\":false,\"error\":\"Origin not allowed\"}");
      return;
    }
    if (http.arg("plain").length() > 4096) {
      cors();
      http.send(413, "application/json", "{\"ok\":false,\"error\":\"OLED frame too large\"}");
      return;
    }
    JsonDocument input;
    const char *error = nullptr;
    int status = 400;
    if (deserializeJson(input, http.arg("plain")))
      error = "Invalid OLED JSON";
    else if (strlen(CONTROL_TOKEN) && strcmp(input["token"] | "", CONTROL_TOKEN))
      error = "Invalid control token";
    else if (input["enabled"].is<bool>() && !input["enabled"].as<bool>()) {
      mirrorActive = false;
    } else if (cpu.state.status == Running) {
      error = "ESP32 is running a hardware program. Pause it before mirroring a demo.";
      status = 409;
    } else {
      error = parseDemoOLED(input["frame"], mirroredFrame);
      if (!error)
        mirrorActive = true;
    }
    doc.clear();
    doc["ok"] = !error;
    if (error)
      doc["error"] = error;
    packet = "";
    serializeJson(doc, packet);
    cors();
    http.send(error ? status : 200, "application/json", packet);
  });
  http.on("/api/config", HTTP_GET, [] {
    doc.clear();
    doc["speed"] = speed;
    doc["maxInstructions"] = 10000;
    doc["streamPort"] = 81;
    doc["streamPath"] = "/ws";
    sendJson();
  });
  http.on("/api/control", HTTP_OPTIONS, [] {
    cors();
    http.send(204);
  });
  http.on("/api/control", HTTP_POST, [] {
    if (http.header("Origin").length() && !allowedOrigin(http.header("Origin"))) {
      cors();
      http.send(403, "application/json", "{\"ok\":false,\"error\":\"Origin not allowed\"}");
      return;
    }
    if (http.arg("plain").length() > 4096) {
      cors();
      http.send(413, "application/json", "{\"ok\":false,\"error\":\"Command too large\"}");
      return;
    }
    JsonDocument cmd;
    auto parse = deserializeJson(cmd, http.arg("plain"));
    const char *error = parse ? "Invalid JSON" : applyCommand(cmd);
    doc.clear();
    doc["ok"] = !error;
    if (error)
      doc["error"] = error;
    packet = "";
    serializeJson(doc, packet);
    cors();
    http.send(error ? 400 : 200, "application/json", packet);
  });
  const char *headers[] = {"Origin"};
  http.collectHeaders(headers, 1);
  http.onNotFound([] {
    cors();
    http.send(404, "application/json", "{\"error\":\"Not found\"}");
  });
  http.begin();
  ws.onEvent([](uint8_t client, WStype_t type, uint8_t *payload, size_t length) {
    if (type == WStype_CONNECTED) {
      mirrorActive = false;
      telemetry();
      ws.sendTXT(client, packet);
    }
    if (type == WStype_TEXT) {
      JsonDocument cmd;
      const char *error = nullptr;
      if (length > 4096)
        error = "Command too large";
      else if (deserializeJson(cmd, payload, length))
        error = "Invalid JSON";
      else
        error = applyCommand(cmd);
      JsonDocument ack;
      ack["type"] = "ack";
      ack["id"] = cmd["id"].as<uint32_t>();
      ack["ok"] = !error;
      if (error)
        ack["error"] = error;
      String response;
      serializeJson(ack, response);
      ws.sendTXT(client, response);
    }
  });
  static const char *mandatoryHeaders[] = {"Origin"};
  ws.onValidateHttpHeader(
      [](String name, String value) {
        return !name.equalsIgnoreCase("Origin") || allowedOrigin(value);
      },
      mandatoryHeaders, 1);
  ws.begin();
  // This library checks heartbeat timeouts during the HTTP upgrade as well.
  // Leave time for the software-I2C displays while the upgrade headers arrive.
  // Application snapshots still publish every 2 s for dashboard freshness.
  ws.enableHeartbeat(15000, 15000, 2);
  networkStarted = true;
  Serial.printf("CORE8 dashboard API: http://%s | WebSocket :81/ws\n",
                WiFi.localIP().toString().c_str());
}
void keypadEvent(KeypadEvent key) {
  if (keypad.getState() == PRESSED || keypad.getState() == HOLD) {
    mirrorActive = false;
    oledController = "keypad";
  }
  if (keypad.getState() == PRESSED)
    keypadUI.key(key);
  if (keypad.getState() == HOLD && key == '*')
    keypadUI.holdReset();
  publish();
}
void composeOLEDFrame(OLEDFrame &frame) {
  if (mirrorActive) {
    frame = mirroredFrame;
    return;
  }
  if (oledContext.revision != cpu.programRevision || cpu.state.stage == Ready)
    oledContext.reset(cpu.programRevision);
  OLEDEnvironment env;
  env.controller = oledController;
  env.page = keypadUI.detailPage == 2   ? "binary"
             : keypadUI.detailPage == 3 ? "network"
                                        : "learning";
  String ip = WiFi.localIP().toString(), ssid = WiFi.SSID();
  env.ip = ip.c_str();
  env.ssid = ssid.c_str();
  env.wifi = WiFi.status() == WL_CONNECTED;
  env.firmware = VERSION;
  env.heap = ESP.getFreeHeap();
  buildOLEDFrame(cpu, oledContext, env, frame);
  auto &screen = frame.screens[0];
  if (keypadUI.inputPhase) {
    frame.page = "menu";
    screen.heading("NUMBER INPUT | KEYPAD");
    screen.line(0, "%s NUMBER THEN #", keypadUI.inputPhase == 2 ? "SECOND" : "FIRST / ADDRESS");
    screen.line(1, "FIRST: %u", keypadUI.firstInput);
    screen.line(2, "> %s_", keypadUI.entry);
    screen.line(3, "0-255 | # OK | * BACK");
    screen.line(4, "%s", keypadUI.notice);
    screen.emphasis = 2;
  } else if (keypadUI.showingCalculation()) {
    if (oledContext.hasAlu)
      aluEquation(screen.lines[0], sizeof(screen.lines[0]), oledContext);
    else
      screen.line(0, "%s %u %u", mnemonic(keypadUI.calculation.op), keypadUI.calculation.left,
                  keypadUI.calculation.right);
    if (cpu.state.status == Halted)
      screen.line(2, "RESULT: %u  HEX:%02X", cpu.state.output, cpu.state.output);
    if (cpu.state.status == Error)
      screen.line(2, "FAULT: DIVISION BY ZERO");
    screen.line(4, "* MENU | # REPEAT/RESUME");
  } else if (keypadUI.detailPage == 1) {
    frame.page = "menu";
    screen.line(0, "CHOOSE MENU %c", keypadUI.menu);
    screen.heading("KEYPAD CONTROLS");
    if (keypadUI.menu == 'A') {
      screen.line(1, "1 ADD 2 SUB 3 MUL");
      screen.line(2, "4 DIV 5 INC 6 DEC");
    } else if (keypadUI.menu == 'B') {
      screen.line(1, "1 AND 2 OR 3 XOR");
      screen.line(2, "4 NOT 5 SHL 6 SHR");
    } else if (keypadUI.menu == 'C') {
      screen.line(1, "1 ACC>A 2 ACC>B");
      screen.line(2, "3 A>ACC 4 B>ACC");
      screen.line(3, "5 STORE 6 LOAD");
    } else {
      screen.line(1, "1 RUN 2 PAUSE 3 STAGE");
      screen.line(2, "4 ADD 5 LOOP 6 OLED PAGE");
      screen.line(3, "7 NEXT INSTRUCTION");
    }
    if (keypadUI.menu == 'A' || keypadUI.menu == 'B')
      screen.line(3, "Enter first # second #");
    screen.line(4, "* BACK | HOLD * RESET");
    screen.emphasis = 0;
  }
  if (keypadUI.resetConfirmation) {
    frame.page = "menu";
    screen.heading("CONFIRM CPU RESET");
    screen.line(0, "CLEAR REGISTERS AND RAM?");
    screen.line(1, "# CONFIRM RESET");
    screen.line(2, "ANY OTHER KEY CANCELS");
    screen.line(3, "Program stays loaded");
    screen.line(4, "Wi-Fi stays connected");
  }
}
void drawDisplay(uint8_t index) {
  OLEDFrame frame;
  composeOLEDFrame(frame);
  const auto &view = frame.screens[index];
  auto &d = *displays[index];
  d.clearBuffer();
  d.setFont(u8g2_font_5x8_tf);
  d.drawStr(1, 9, view.title);
  d.drawHLine(0, 12, 128);
  for (int stage = 0; stage < 4 && d.getStrWidth(view.title) < 100; stage++) {
    if (frame.stage != Ready && stage <= int(frame.stage) - 1)
      d.drawBox(103 + stage * 6, 2, 4, 5);
    else
      d.drawFrame(103 + stage * 6, 2, 4, 5);
  }
  for (int row = 0; row < 5; row++) {
    d.setFont(row == view.emphasis && row < 4 ? u8g2_font_6x10_tf : u8g2_font_5x8_tf);
    if (d.getStrWidth(view.lines[row]) > 126)
      d.setFont(u8g2_font_5x8_tf);
    d.drawStr(1, 22 + row * 10, view.lines[row]);
  }
  d.sendBuffer();
}
void setup() {
  Serial.begin(115200);
  packet.reserve(7000);
  cpu.load(referenceProgram, sizeof(referenceProgram));
  for (auto display : displays) {
    display->begin();
    display->setContrast(160);
  }
  keypad.setHoldTime(1500);
  keypad.setDebounceTime(30);
  keypad.addEventListener(keypadEvent);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  if (strlen(WIFI_SSID)) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.println("Connecting to Wi-Fi without blocking the local CPU...");
  } else
    Serial.println("No Wi-Fi credentials: local keypad + OLED mode.");
  Serial.println("CORE8 v2.1.0 | A arithmetic B logic C registers/RAM D programs | D6 menu pages");
}
void loop() {
  const uint32_t now = millis();
  keypad.getKeys();
  if (WiFi.status() == WL_CONNECTED) {
    startNetwork();
    http.handleClient();
    ws.loop();
  } else if (strlen(WIFI_SSID) && uint32_t(now - lastWifi) > 15000) {
    lastWifi = now;
    WiFi.reconnect();
  }
  if (cpu.state.status == Running && int32_t(now - nextStage) >= 0) {
    nextStage = now + uint32_t(700 / speed);
    advance();
  }
  if (uint32_t(now - lastOled) >= 80) {
    lastOled = now;
    drawDisplay(screen);
    screen = (screen + 1) % 3;
  }
  if (networkStarted && uint32_t(now - lastHeartbeat) >= 2000) {
    lastHeartbeat = now;
    publish();
  }
  yield();
}
