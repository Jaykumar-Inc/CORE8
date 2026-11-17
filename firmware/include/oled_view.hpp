#pragma once
#include "cpu.hpp"
#include <stdarg.h>

namespace core8 {
constexpr size_t OLED_COLUMNS = 25;
struct OLEDScreen {
  char title[26] = {};
  char lines[5][26] = {};
  uint8_t emphasis = 0;
  void heading(const char *value) {
    snprintf(title, sizeof(title), "%s", value);
    for (char *p = title; *p; p++)
      if (*p < 32 || *p > 126)
        *p = '?';
  }
  void line(uint8_t row, const char *format, ...) {
    va_list args;
    va_start(args, format);
    vsnprintf(lines[row], sizeof(lines[row]), format, args);
    for (char *p = lines[row]; *p; p++)
      if (*p < 32 || *p > 126)
        *p = '?';
    va_end(args);
  }
};
struct OLEDFrame {
  OLEDScreen screens[3];
  Stage stage = Ready;
  const char *source = "hardware";
  const char *controller = "device";
  const char *page = "learning";
};
struct OLEDContext {
  uint32_t revision = 0;
  bool hasAlu = false, pending = false, hasMemory = false;
  uint8_t op = 0, left = 0, right = 0, result = 0;
  Flags proposed;
  uint8_t address = 0, memoryBefore = 0, memoryAfter = 0;
  bool memoryWrite = false;
  uint8_t previousAcc = 0, previousOutput = 0;
  void reset(uint32_t version) {
    *this = OLEDContext{};
    revision = version;
  }
  void observe(const CPU &cpu) {
    if (revision != cpu.programRevision || cpu.state.stage == Ready)
      reset(cpu.programRevision);
    const auto &s = cpu.state;
    const auto &e = cpu.event;
    if (s.acc != e.before.acc)
      previousAcc = e.before.acc;
    if (s.output != e.before.output)
      previousOutput = e.before.output;
    if (e.aluValid) {
      hasAlu = true;
      pending = s.stage == Execute;
      op = s.ir;
      left = s.a;
      right = s.b;
      result = e.aluResult;
      proposed = e.aluFlags;
    }
    if (e.memory) {
      hasMemory = true;
      address = e.address;
      memoryBefore = e.oldValue;
      memoryAfter = e.newValue;
      memoryWrite = !strcmp(e.kind, "write");
    }
  }
};
struct OLEDEnvironment {
  const char *controller = "device";
  const char *page = "learning";
  const char *ip = "offline", *ssid = "offline", *firmware = "";
  bool wifi = false;
  uint32_t heap = 0;
};
inline void byteBits(uint16_t value, char *out) {
  const int width = value > 255 ? 9 : 8;
  for (int i = 0; i < width; i++)
    out[i] = (value & (1 << (width - i - 1))) ? '1' : '0';
  out[width] = 0;
}
inline const char *stageGuide(const State &s) {
  if (s.status == Error)
    return "ERROR: reset to continue";
  if (s.status == Halted)
    return "HALTED: result is saved";
  switch (s.stage) {
  case Fetch:
    return "Fetch: read opcode + data";
  case Decode:
    return "Decode: choose operation";
  case Execute:
    return "Execute: calculate / move";
  case Writeback:
    return "Write-back: save result";
  default:
    return "Load a program to begin";
  }
}
inline const char *shortComponent(const char *name) {
  if (!strcmp(name, "program"))
    return "PM";
  if (!strcmp(name, "control"))
    return "CU";
  if (!strcmp(name, "flags"))
    return "FLAGS";
  if (!strcmp(name, "output"))
    return "OUT";
  if (!strcmp(name, "pc"))
    return "PC";
  if (!strcmp(name, "ir"))
    return "IR";
  if (!strcmp(name, "ram"))
    return "RAM";
  if (!strcmp(name, "acc"))
    return "ACC";
  if (!strcmp(name, "alu"))
    return "ALU";
  return !strcmp(name, "a") ? "A" : "B";
}
inline void aluEquation(char *out, size_t size, const OLEDContext &c) {
  const char *symbol = c.op == 0x10 || c.op == 0x14   ? "+"
                       : c.op == 0x11 || c.op == 0x15 ? "-"
                       : c.op == 0x12                 ? "*"
                       : c.op == 0x13                 ? "/"
                       : c.op == 0x20                 ? "&"
                       : c.op == 0x21                 ? "|"
                                                      : "^";
  if (c.op == 0x23)
    snprintf(out, size, "NOT ~%u = %u", c.left, c.result);
  else if (c.op == 0x24 || c.op == 0x25)
    snprintf(out, size, "%s %u%s1 = %u", mnemonic(c.op), c.left, c.op == 0x24 ? "<<" : ">>",
             c.result);
  else
    snprintf(out, size, "%s %u%s%u = %u", mnemonic(c.op), c.left, symbol, c.right, c.result);
}
inline void buildOLEDFrame(const CPU &cpu, const OLEDContext &c, const OLEDEnvironment &env,
                           OLEDFrame &frame) {
  frame = OLEDFrame{};
  frame.stage = cpu.state.stage;
  frame.controller = env.controller;
  frame.page = env.page;
  auto &cu = frame.screens[0];
  auto &alu = frame.screens[1];
  auto &mem = frame.screens[2];
  const auto &s = cpu.state;
  const char *origin = !strcmp(env.controller, "laptop")   ? "LAPTOP"
                       : !strcmp(env.controller, "keypad") ? "KEYPAD"
                                                           : "ESP32";
  snprintf(cu.title, sizeof(cu.title), "CONTROL | %s", origin);
  snprintf(alu.title, sizeof(alu.title), "ALU/REG | %s", origin);
  snprintf(mem.title, sizeof(mem.title), "RAM/OUT | %s", origin);
  char bits[10], bitsB[10];
  if (!strcmp(env.page, "network")) {
    cu.heading("NETWORK | ESP32");
    cu.line(0, "WIFI: %s", env.wifi ? "CONNECTED" : "OFFLINE");
    cu.line(1, "SSID: %s", env.ssid);
    cu.line(2, "IP %s", env.ip);
    cu.line(3, "FW %s | WS :81", env.firmware);
    cu.line(4, "D6: next OLED page");
    cu.emphasis = 2;
    alu.heading("SYSTEM | ESP32");
    alu.line(0, "HEAP %lu bytes", (unsigned long)env.heap);
    alu.line(1, "PROGRAM %uB / %u INS", cpu.length, cpu.length / 2);
    alu.line(2, "RAM 256 x 8 bits");
    alu.line(3, "DONE %lu instructions", (unsigned long)s.cycles);
    alu.line(4, "OWNER: %s", origin);
    mem.heading("KEYPAD / WIFI CONTROLS");
    mem.line(0, "A ARITH B LOGIC C MEMORY");
    mem.line(1, "D PROGRAMS | # NEXT/OK");
    mem.line(2, "* BACK | HOLD * RESET");
    mem.line(3, "HTTP :80 | WS :81/ws");
    mem.line(4, "Same CPU: keys + laptop");
    return;
  }
  if (!strcmp(env.page, "binary")) {
    byteBits(s.pc, bits);
    cu.line(0, "PC %03u [%s]", s.pc, bits);
    byteBits(s.ir, bits);
    cu.line(1, "IR %02X %s", s.ir, bits);
    byteBits(s.operand, bits);
    cu.line(2, "OP %02X %s", s.operand, bits);
    cu.line(3, "CODE %02X %02X (2 bytes)", s.ir, s.operand);
    cu.line(4, "%s", stageGuide(s));
    byteBits(s.a, bits);
    alu.line(0, "A:%s (%u)", bits, s.a);
    byteBits(s.b, bits);
    alu.line(1, "B:%s (%u)", bits, s.b);
    byteBits(c.hasAlu ? c.result : s.acc, bits);
    alu.line(2, "R:%s (%u)%s", bits, c.hasAlu ? c.result : s.acc, c.pending ? " P" : "");
    byteBits(s.acc, bits);
    alu.line(3, "ACC %s H:%02X", bits, s.acc);
    alu.line(4, "Z:%u C:%u V:%u B:%u", s.flags.z, s.flags.c, s.flags.v, s.flags.b);
    alu.emphasis = 2;
    const uint8_t address = c.hasMemory ? c.address : s.operand;
    byteBits(address, bits);
    mem.line(0, "ADR %s [%u]", bits, address);
    byteBits(s.ram[address], bits);
    mem.line(1, "RAM %s [%u]", bits, s.ram[address]);
    byteBits(s.output, bits);
    mem.line(2, "OUT %s [%u]", bits, s.output);
    mem.line(3, "HEX OUT:%02X RAM:%02X", s.output, s.ram[address]);
    if (c.hasMemory)
      mem.line(4, "%s [%u] %u>%u", c.memoryWrite ? "WRITE" : "READ", address, c.memoryBefore,
               c.memoryAfter);
    else
      mem.line(4, "RAM and code are separate");
    mem.emphasis = 2;
    return;
  }
  char status[12] = {}, stage[12] = {};
  snprintf(status, sizeof(status), "%s", statusName(s.status));
  snprintf(stage, sizeof(stage), "%s", stageName(s.stage));
  for (auto &ch : status)
    if (ch >= 'a' && ch <= 'z')
      ch -= 32;
  for (auto &ch : stage)
    if (ch >= 'a' && ch <= 'z')
      ch -= 32;
  cu.line(0, "%s | %s", status, stage);
  cu.line(1, "PC %03u>%03u IR:%02X OP:%02X", cpu.event.before.pc, s.pc, s.ir, s.operand);
  if (s.stage == Ready)
    cu.line(2, "PROGRAM %uB / %u INS", cpu.length, cpu.length / 2);
  else if (operandOp(s.ir))
    cu.line(2, "@%03u %s %u CYC:%lu", s.instructionAddress, mnemonic(s.ir), s.operand,
            (unsigned long)s.cycles);
  else
    cu.line(2, "@%03u %s CYC:%lu", s.instructionAddress, mnemonic(s.ir), (unsigned long)s.cycles);
  cu.line(3, "%s", stageGuide(s));
  cu.emphasis = 2;
  if (cpu.event.count && s.stage != Ready) {
    const auto &t = cpu.event.transfers[cpu.event.count - 1];
    byteBits(t.value, bits);
    cu.line(4, "%s %s>%s %s",
            !strcmp(t.bus, "address")   ? "ADR"
            : !strcmp(t.bus, "control") ? "CTL"
                                        : "DATA",
            shortComponent(t.from), shortComponent(t.to), bits);
  } else
    cu.line(4, "BUS idle | PC = bookmark");
  if (c.hasAlu)
    aluEquation(alu.lines[0], sizeof(alu.lines[0]), c);
  else
    alu.line(0, "A:%03u B:%03u ACC:%03u", s.a, s.b, s.acc);
  alu.line(1, "ACC %03u>%03u HEX:%02X", c.previousAcc, s.acc, s.acc);
  byteBits(s.acc, bits);
  alu.line(2, "ACC BIN %s", bits);
  alu.line(3, "Z:%u C:%u V:%u B:%u", s.flags.z, s.flags.c, s.flags.v, s.flags.b);
  if (c.pending)
    alu.line(4, "PENDING Z%u C%u V%u B%u", c.proposed.z, c.proposed.c, c.proposed.v, c.proposed.b);
  else
    alu.line(4, "Z:zero C:carry V:ov B:br");
  if (c.hasMemory)
    mem.line(0, "RAM[%03u] %s %03u>%03u", c.address, c.memoryWrite ? "W" : "R", c.memoryBefore,
             c.memoryAfter);
  else
    mem.line(0, "RAM: no transfer yet");
  mem.line(1, "OUT %03u | HEX %02X", s.output, s.output);
  byteBits(s.output, bits);
  mem.line(2, "BIN %s", bits);
  mem.line(3, "ACC %03u>%03u OUT %03u>%03u", c.previousAcc, s.acc, c.previousOutput, s.output);
  if (s.status == Error)
    mem.line(4, "FAULT: %s", s.error);
  else if (c.hasMemory) {
    byteBits(c.address, bitsB);
    mem.line(4, "RAM ADR %s", bitsB);
  } else
    mem.line(4, "256 bytes | RAM != CODE");
  mem.emphasis = 1;
}
} // namespace core8
