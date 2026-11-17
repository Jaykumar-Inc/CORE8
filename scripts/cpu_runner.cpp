#include "../firmware/include/cpu.hpp"
#include "../firmware/include/oled_view.hpp"
#include <iostream>
#include <sstream>
#include <string>
int main() {
  std::string line;
  while (std::getline(std::cin, line)) {
    core8::CPU cpu;
    std::istringstream in(line);
    int byte;
    uint8_t bytes[256];
    size_t n = 0;
    while (in >> byte) {
      if (n >= 256 || byte < 0 || byte > 255)
        return 2;
      bytes[n++] = byte;
    }
    if (!cpu.load(bytes, n))
      return 3;
    core8::OLEDContext displayContext;
    while (cpu.step()) {
      displayContext.observe(cpu);
      const auto &s = cpu.state;
      std::cout << s.pc << ',' << +s.ir << ',' << +s.operand << ',' << +s.acc << ',' << +s.a << ','
                << +s.b << ',' << +s.output << ',' << s.flags.z << ',' << s.flags.c << ','
                << s.flags.v << ',' << s.flags.b << ',' << s.stage << ',' << s.status << ','
                << s.cycles << ',' << +s.instructionAddress;
      for (auto value : s.ram)
        std::cout << ',' << +value;
      const auto &e = cpu.event;
      std::cout << '|' << +e.count;
      for (uint8_t i = 0; i < e.count; i++) {
        const auto &t = e.transfers[i];
        std::cout << ',' << t.from << ',' << t.to << ',' << t.value << ',' << t.bus;
      }
      std::cout << '|' << e.aluValid;
      if (e.aluValid)
        std::cout << ',' << core8::mnemonic(s.ir) << ',' << +s.a << ',' << +s.b << ','
                  << +e.aluResult << ',' << e.aluFlags.z << ',' << e.aluFlags.c << ','
                  << e.aluFlags.v << ',' << e.aluFlags.b;
      std::cout << '|' << e.memory;
      if (e.memory)
        std::cout << ',' << +e.address << ',' << +e.oldValue << ',' << +e.newValue << ',' << e.kind;
      if (s.status != core8::Error)
        for (const char *page : {"learning", "binary"}) {
          core8::OLEDEnvironment env;
          env.page = page;
          core8::OLEDFrame frame;
          core8::buildOLEDFrame(cpu, displayContext, env, frame);
          std::cout << "|OLED~" << page;
          for (const auto &screen : frame.screens) {
            std::cout << '~' << screen.title;
            for (const auto &line : screen.lines)
              std::cout << '~' << line;
            std::cout << '~' << +screen.emphasis;
          }
        }
      std::cout << ';';
    }
    std::cout << '\n';
  }
  return 0;
}
