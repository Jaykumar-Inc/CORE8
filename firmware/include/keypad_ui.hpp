#pragma once
#include "cpu.hpp"
#include <stdlib.h>

namespace core8 {
inline constexpr uint8_t referenceProgram[] = {1, 5, 0x10, 3, 3, 20, 2, 20, 5, 0, 0xff, 0};
inline constexpr uint8_t countdownProgram[] = {1,  3,    5, 0, 0x15, 0,    0x31,
                                               10, 0x30, 2, 5, 0,    0xff, 0};

// The real keypad and native regression tests drive this same controller.
class KeypadUI {
  CPU &cpu;
  void (*publish)();
  void (*advance)();
  void (*run)();

  void clearEntry() {
    entry[0] = '\0';
  }
  bool localProgram(const uint8_t *bytes, size_t length, bool preserve = false) {
    if (cpu.state.status == Running) {
      snprintf(notice, sizeof(notice), "Pause first: D then 2");
      return false;
    }
    const State previous = cpu.state;
    cpu.load(bytes, length);
    if (preserve) {
      cpu.state.acc = previous.acc;
      cpu.state.a = previous.a;
      cpu.state.b = previous.b;
      cpu.state.output = previous.output;
      cpu.state.flags = previous.flags;
      memcpy(cpu.state.ram, previous.ram, 256);
    }
    calculation.active = false;
    cpu.seq++;
    publish();
    snprintf(notice, sizeof(notice), "Loaded. # stage | D1 run");
    return true;
  }
  void calculate(uint8_t op, uint8_t left, uint8_t right) {
    const uint8_t program[] = {1, left, op, right, 5, 0, 0xff, 0};
    if (!localProgram(program, sizeof(program)))
      return;
    calculation = {true, op, left, right, cpu.programRevision};
    inputPhase = 0;
    clearEntry();
    run();
  }

public:
  char menu = 'D';
  uint8_t detailPage = 0, inputPhase = 0, selected = 0, firstInput = 0;
  char entry[5] = {};
  bool resetConfirmation = false;
  char notice[32] = "D programs | # next";
  struct Calculation {
    bool active = false;
    uint8_t op = 0, left = 0, right = 0;
    uint32_t revision = 0;
  } calculation;

  KeypadUI(CPU &machine, void (*onPublish)(), void (*onAdvance)(), void (*onRun)())
      : cpu(machine), publish(onPublish), advance(onAdvance), run(onRun) {}
  bool showingCalculation() const {
    return calculation.active && calculation.revision == cpu.programRevision;
  }
  void remoteAction() {
    calculation.active = false;
    inputPhase = selected = 0;
    clearEntry();
    resetConfirmation = false;
    if (detailPage == 1)
      detailPage = 0;
    snprintf(notice, sizeof(notice), "Laptop controls active");
  }
  void holdReset() {
    resetConfirmation = true;
    snprintf(notice, sizeof(notice), "RESET? # yes; other no");
  }
  void key(char key) {
    if (resetConfirmation) {
      if (key == '#') {
        cpu.reset();
        cpu.seq++;
        calculation.active = false;
        inputPhase = selected = 0;
        clearEntry();
        publish();
        snprintf(notice, sizeof(notice), "CPU reset");
      } else
        snprintf(notice, sizeof(notice), "Reset cancelled");
      resetConfirmation = false;
      return;
    }
    if (key >= 'A' && key <= 'D') {
      menu = key;
      detailPage = 1;
      inputPhase = selected = 0;
      calculation.active = false;
      clearEntry();
      snprintf(notice, sizeof(notice), "Choose option; * back");
      return;
    }
    if (key == '*') {
      if (showingCalculation() && cpu.state.status == Running) {
        cpu.state.status = Paused;
        publish();
      }
      calculation.active = false;
      detailPage = 1;
      inputPhase = selected = 0;
      clearEntry();
      snprintf(notice, sizeof(notice), "Cleared | hold * reset");
      return;
    }
    if (showingCalculation()) {
      if (key == '#' && (cpu.state.status == Halted || cpu.state.status == Error)) {
        calculate(calculation.op, calculation.left, calculation.right);
      } else if (key == '#' && cpu.state.status == Paused) {
        run();
      }
      // Keep the result visible until an explicit menu/back key, including stray digits/#.
      return;
    }
    if (key == '#') {
      if (!inputPhase) {
        if (cpu.state.status != Running)
          advance();
        else
          snprintf(notice, sizeof(notice), "Running; D2 pauses");
        return;
      }
      if (!entry[0]) {
        snprintf(notice, sizeof(notice), "Enter 0-255 then #");
        return;
      }
      const int value = atoi(entry);
      if (value > 255) {
        clearEntry();
        snprintf(notice, sizeof(notice), "Range is 0-255");
        return;
      }
      if (inputPhase == 1) {
        firstInput = value;
        clearEntry();
        if (menu == 'C') {
          const uint8_t program[] = {uint8_t(selected == 5 ? 3 : 2), firstInput, 5, 0, 0xff, 0};
          if (localProgram(program, sizeof(program), true)) {
            inputPhase = 0;
            run();
          }
        } else if ((menu == 'A' && selected >= 5) || (menu == 'B' && selected >= 4)) {
          const uint8_t op = menu == 'A' ? (selected == 5 ? 0x14 : 0x15)
                                         : (selected == 4   ? 0x23
                                            : selected == 5 ? 0x24
                                                            : 0x25);
          calculate(op, firstInput, 0);
        } else {
          inputPhase = 2;
          snprintf(notice, sizeof(notice), "Second number then #");
        }
      } else {
        static constexpr uint8_t arithmetic[] = {0, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15};
        static constexpr uint8_t logic[] = {0, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25};
        calculate(menu == 'A' ? arithmetic[selected] : logic[selected], firstInput, uint8_t(value));
      }
      return;
    }
    if (key < '0' || key > '9')
      return;
    if (inputPhase) {
      const size_t n = strlen(entry);
      if (n < 3) {
        entry[n] = key;
        entry[n + 1] = 0;
      }
      return;
    }
    selected = key - '0';
    if (selected < 1 || selected > 7)
      return;
    if (menu == 'D') {
      if (selected == 1 && cpu.state.status != Halted && cpu.state.status != Error)
        run();
      if (selected == 2) {
        if (cpu.state.status == Running)
          cpu.state.status = Paused;
        publish();
      }
      if (selected == 3 && cpu.state.status != Running)
        advance();
      if (selected == 4)
        localProgram(referenceProgram, sizeof(referenceProgram));
      if (selected == 5)
        localProgram(countdownProgram, sizeof(countdownProgram));
      if (selected == 6)
        detailPage = (detailPage + 1) % 4;
      if (selected == 7 && cpu.state.status != Running)
        for (int i = 0; i < 4; i++) {
          advance();
          if (cpu.state.stage == Writeback || cpu.state.status == Error ||
              cpu.state.status == Halted)
            break;
        }
    } else if (menu == 'C' && selected <= 4) {
      const uint8_t program[] = {4, uint8_t(selected - 1), 5, 0, 0xff, 0};
      localProgram(program, sizeof(program), true);
    } else if (selected <= 6) {
      inputPhase = 1;
      clearEntry();
      snprintf(notice, sizeof(notice), menu == 'C' ? "RAM address then #" : "First number then #");
    }
  }
};
} // namespace core8
