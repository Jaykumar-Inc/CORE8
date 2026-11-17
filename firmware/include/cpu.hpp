#pragma once
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

namespace core8 {
enum Stage { Ready, Fetch, Decode, Execute, Writeback };
enum Status { Idle, Paused, Running, Halted, Error };
inline const char *stageName(Stage x) {
  static const char *values[] = {"ready", "fetch", "decode", "execute", "writeback"};
  return values[x];
}
inline const char *statusName(Status x) {
  static const char *values[] = {"ready", "paused", "running", "halted", "error"};
  return values[x];
}
struct Flags {
  bool z = false, c = false, v = false, b = false;
};
struct State {
  uint16_t pc = 0;
  uint8_t ir = 0, operand = 0, acc = 0, a = 0, b = 0, output = 0;
  Flags flags;
  uint8_t ram[256] = {};
  Stage stage = Ready;
  Status status = Idle;
  uint32_t cycles = 0;
  uint8_t instructionAddress = 0;
  char error[110] = {};
};
struct Transfer {
  const char *from;
  const char *to;
  uint16_t value;
  const char *bus;
};
struct Event {
  State before;
  Transfer transfers[8];
  uint8_t count = 0;
  char explanation[250] = {};
  bool memory = false;
  uint8_t address = 0, oldValue = 0, newValue = 0;
  const char *kind = "read";
  bool aluValid = false;
  uint8_t aluResult = 0;
  Flags aluFlags;
};
inline const char *mnemonic(uint8_t op) {
  switch (op) {
  case 0x00:
    return "NOP";
  case 0x01:
    return "LDI";
  case 0x02:
    return "LDA";
  case 0x03:
    return "STA";
  case 0x04:
    return "MOV";
  case 0x05:
    return "OUT";
  case 0x10:
    return "ADD";
  case 0x11:
    return "SUB";
  case 0x12:
    return "MUL";
  case 0x13:
    return "DIV";
  case 0x14:
    return "INC";
  case 0x15:
    return "DEC";
  case 0x20:
    return "AND";
  case 0x21:
    return "OR";
  case 0x22:
    return "XOR";
  case 0x23:
    return "NOT";
  case 0x24:
    return "SHL";
  case 0x25:
    return "SHR";
  case 0x30:
    return "JMP";
  case 0x31:
    return "JZ";
  case 0xff:
    return "HLT";
  default:
    return "INVALID";
  }
}
inline bool alu(uint8_t op) {
  return (op >= 0x10 && op <= 0x15) || (op >= 0x20 && op <= 0x25);
}
inline bool operandOp(uint8_t op) {
  return (op >= 1 && op <= 4) || (op >= 0x10 && op <= 0x13) || (op >= 0x20 && op <= 0x22) ||
         op == 0x30 || op == 0x31;
}
class CPU {
  uint8_t pending = 0;
  Flags pendingFlags;
  void move(const char *from, const char *to, uint16_t value, const char *bus = "data") {
    if (event.count < 8)
      event.transfers[event.count++] = {from, to, value, bus};
  }
  void fail(const char *why) {
    state.status = Error;
    snprintf(state.error, sizeof(state.error), "%s", why);
  }

public:
  State state;
  Event event;
  uint8_t program[256] = {};
  uint16_t length = 0;
  uint32_t seq = 0, programRevision = 0;
  bool load(const uint8_t *bytes, size_t n) {
    if (!n || n > 256 || n % 2)
      return false;
    memcpy(program, bytes, n);
    length = n;
    programRevision++;
    reset();
    return true;
  }
  void reset() {
    state = State{};
    pending = 0;
    event = Event{};
  }
  bool step() {
    auto &s = state;
    if (s.status == Halted || s.status == Error)
      return false;
    event = Event{};
    event.before = s;
    const uint8_t op = s.ir;
    if (s.stage == Ready || s.stage == Writeback) {
      if (s.cycles >= 10000)
        fail("Instruction budget exceeded (10,000). Reset to run again.");
      else if (s.pc % 2 || s.pc + 1 >= length)
        fail("Program Counter is outside an instruction. Add HLT or fix the branch.");
      else {
        s.instructionAddress = s.pc;
        move("pc", "program", s.pc, "address");
        s.ir = program[s.pc];
        s.operand = program[s.pc + 1];
        move("program", "ir", s.ir);
        s.pc += 2;
        s.stage = Fetch;
        snprintf(event.explanation, sizeof(event.explanation),
                 "Fetch byte %u: opcode %u and operand %u enter IR. The bookmark PC advances by 2.",
                 s.instructionAddress, s.ir, s.operand);
      }
    } else if (s.stage == Fetch) {
      s.stage = Decode;
      move("ir", "control", s.ir, "control");
      if (strcmp(mnemonic(op), "INVALID") == 0)
        fail("Invalid opcode.");
      else if (!operandOp(op) && s.operand)
        fail("Reserved operand byte must be zero.");
      else if (op == 4 && s.operand > 3)
        fail("Invalid MOV selector.");
      else if ((op == 0x30 || op == 0x31) && (s.operand % 2 || s.operand >= length))
        fail("Branch target is not an instruction address.");
      else
        snprintf(
            event.explanation, sizeof(event.explanation),
            "The control unit decodes %s. It selects the data paths needed for this instruction.",
            mnemonic(op));
    } else if (s.stage == Decode) {
      s.stage = Execute;
      pending = s.acc;
      pendingFlags = s.flags;
      if (alu(op)) {
        s.a = s.acc;
        s.b = (op == 0x14 || op == 0x15) ? 1 : (op >= 0x23 && op <= 0x25) ? 0 : s.operand;
        move("acc", "a", s.a);
        if (s.b == s.operand)
          move("ir", "b", s.b);
        move("a", "alu", s.a);
        if (op < 0x23)
          move("b", "alu", s.b);
        int raw = s.a, signedResult = 0;
        const int sa = s.a < 128 ? s.a : int(s.a) - 256, sb = s.b < 128 ? s.b : int(s.b) - 256;
        bool c = false, v = false, b = false;
        switch (op) {
        case 0x10:
        case 0x14:
          raw = s.a + s.b;
          signedResult = sa + sb;
          c = raw > 255;
          v = signedResult > 127 || signedResult < -128;
          break;
        case 0x11:
        case 0x15:
          raw = int(s.a) - s.b;
          signedResult = sa - sb;
          b = raw < 0;
          v = signedResult > 127 || signedResult < -128;
          break;
        case 0x12:
          raw = int(s.a) * s.b;
          signedResult = sa * sb;
          c = raw > 255;
          v = signedResult > 127 || signedResult < -128;
          break;
        case 0x13:
          if (!s.b)
            fail("Division by zero. Reset to continue.");
          else
            raw = s.a / s.b;
          break;
        case 0x20:
          raw = s.a & s.b;
          break;
        case 0x21:
          raw = s.a | s.b;
          break;
        case 0x22:
          raw = s.a ^ s.b;
          break;
        case 0x23:
          raw = ~s.a;
          break;
        case 0x24:
          raw = s.a << 1;
          c = (s.a & 128) != 0;
          v = ((s.a ^ raw) & 128) != 0;
          break;
        case 0x25:
          raw = s.a >> 1;
          c = (s.a & 1) != 0;
          break;
        }
        pending = uint8_t(raw & 255);
        pendingFlags = {pending == 0, c, v, b};
        event.aluValid = s.status != Error;
        event.aluResult = pending;
        event.aluFlags = pendingFlags;
        snprintf(
            event.explanation, sizeof(event.explanation),
            "The ALU computes %s with A=%u and B=%u. The 8-bit result %u is ready for write-back.",
            mnemonic(op), s.a, s.b, pending);
      } else if (op == 1) {
        pending = s.operand;
        move("ir", "control", s.operand);
        snprintf(event.explanation, sizeof(event.explanation),
                 "Prepare immediate value %u for ACC.", pending);
      } else if (op == 2) {
        pending = s.ram[s.operand];
        move("ir", "ram", s.operand, "address");
        move("ram", "control", pending);
        event.memory = true;
        event.address = s.operand;
        event.oldValue = event.newValue = pending;
        snprintf(event.explanation, sizeof(event.explanation),
                 "Read RAM[%u]: the stored value is %u.", s.operand, pending);
      } else if (op == 4) {
        pending = s.operand == 2 ? s.a : s.operand == 3 ? s.b : s.acc;
        snprintf(event.explanation, sizeof(event.explanation),
                 "MOV selects a register transfer with value %u.", pending);
      } else if (op == 3) {
        move("ir", "ram", s.operand, "address");
        snprintf(event.explanation, sizeof(event.explanation), "Select RAM[%u] to receive ACC=%u.",
                 s.operand, s.acc);
      } else if (op == 0x30 || op == 0x31) {
        const uint16_t target = op == 0x30 || s.flags.z ? s.operand : s.pc;
        move("control", "pc", target, "control");
        snprintf(event.explanation, sizeof(event.explanation), "Branch %s; next PC=%u.",
                 op == 0x30 || s.flags.z ? "taken" : "skipped", target);
      } else
        snprintf(event.explanation, sizeof(event.explanation),
                 "Prepare %s. ACC currently contains %u.", mnemonic(op), s.acc);
    } else {
      s.stage = Writeback;
      s.cycles++;
      if (alu(op)) {
        s.acc = pending;
        s.flags = pendingFlags;
        event.aluValid = true;
        event.aluResult = pending;
        event.aluFlags = pendingFlags;
        move("alu", "acc", s.acc);
        move("alu", "flags", s.flags.z | (s.flags.c << 1) | (s.flags.v << 2) | (s.flags.b << 3));
      } else if (op == 1 || op == 2) {
        s.acc = pending;
        move(op == 1 ? "ir" : "ram", "acc", s.acc);
      } else if (op == 3) {
        event.memory = true;
        event.kind = "write";
        event.address = s.operand;
        event.oldValue = s.ram[s.operand];
        event.newValue = s.acc;
        s.ram[s.operand] = s.acc;
        move("acc", "ram", s.acc);
      } else if (op == 4) {
        const char *src = s.operand == 2 ? "a" : s.operand == 3 ? "b" : "acc";
        const char *dest = s.operand == 0 ? "a" : s.operand == 1 ? "b" : "acc";
        if (s.operand == 0)
          s.a = pending;
        else if (s.operand == 1)
          s.b = pending;
        else
          s.acc = pending;
        move(src, dest, pending);
      } else if (op == 5) {
        s.output = s.acc;
        move("acc", "output", s.acc);
      } else if (op == 0x30 || (op == 0x31 && s.flags.z)) {
        s.pc = s.operand;
        move("control", "pc", s.pc, "address");
      } else if (op == 0xff)
        s.status = Halted;
      snprintf(event.explanation, sizeof(event.explanation),
               "%s completed. ACC %u -> %u. Output=%u. Z=%u C=%u V=%u B=%u.", mnemonic(op),
               event.before.acc, s.acc, s.output, s.flags.z, s.flags.c, s.flags.v, s.flags.b);
    }
    if (s.status != Running && s.status != Halted && s.status != Error)
      s.status = Paused;
    if (s.status == Error)
      snprintf(event.explanation, sizeof(event.explanation), "%s", s.error);
    seq++;
    return true;
  }
};
} // namespace core8
