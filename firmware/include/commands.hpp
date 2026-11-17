#pragma once
#include "cpu.hpp"
#include <ArduinoJson.h>

namespace core8 {
// Transport-independent dispatch, shared by the ESP32 endpoints and native tests.
inline const char *applyRemoteCommand(CPU &cpu, float &speed, uint32_t &nextStage, uint32_t now,
                                      JsonDocument &cmd, const char *token, void (*publish)(),
                                      void (*advance)()) {
  if (!cmd["command"].is<const char *>())
    return "command must be a string";
  if (strlen(token) && strcmp(cmd["token"] | "", token))
    return "Invalid control token";
  const char *command = cmd["command"];
  if (!strcmp(command, "pause")) {
    if (cpu.state.status == Running)
      cpu.state.status = Paused;
  } else if (!strcmp(command, "reset")) {
    cpu.reset();
    cpu.seq++;
  } else if (!strcmp(command, "run")) {
    if (cpu.state.status == Error || cpu.state.status == Halted)
      return "Reset before running a halted or faulted CPU";
    cpu.state.status = Running;
    nextStage = now;
  } else if (!strcmp(command, "step") || !strcmp(command, "instruction")) {
    if (cpu.state.status == Running)
      return "Pause before stepping";
    if (cpu.state.status == Error || cpu.state.status == Halted)
      return "Reset before stepping";
    if (!strcmp(command, "step"))
      advance();
    else
      for (int i = 0; i < 4; i++) {
        advance();
        if (cpu.state.stage == Writeback || cpu.state.status == Error || cpu.state.status == Halted)
          break;
      }
  } else if (!strcmp(command, "load")) {
    if (cpu.state.status == Running)
      return "Pause before loading a program";
    if (!cmd["program"].is<JsonArray>())
      return "program must be a byte array";
    auto program = cmd["program"].as<JsonArray>();
    if (!program.size() || program.size() > 256 || program.size() % 2)
      return "Program requires 2-256 bytes, even length";
    uint8_t bytes[256];
    size_t i = 0;
    for (auto value : program) {
      if (!value.is<int>() || value.as<int>() < 0 || value.as<int>() > 255)
        return "Invalid program byte";
      bytes[i++] = value.as<uint8_t>();
    }
    cpu.load(bytes, i);
    cpu.seq++;
  } else if (!strcmp(command, "speed")) {
    if (!cmd["speed"].is<float>())
      return "speed must be numeric";
    float value = cmd["speed"];
    if (value != .25f && value != .5f && value != 1 && value != 2 && value != 4)
      return "Speed must be 0.25, 0.5, 1, 2 or 4";
    speed = value;
  } else
    return "Unknown command";
  publish();
  return nullptr;
}
} // namespace core8
