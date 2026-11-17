#include "commands.hpp"
#include "cpu.hpp"
#include "keypad_ui.hpp"
#include "oled_protocol.hpp"
#include <assert.h>
core8::CPU remoteCpu;
core8::CPU keypadCpu;
void keypadAdvance() {
  keypadCpu.step();
}
void keypadRun() {
  keypadCpu.state.status = core8::Running;
}
void publish() {}
void advance() {
  remoteCpu.step();
}
int main() {
  core8::CPU cpu;
  const uint8_t program[] = {1, 5, 16, 3, 3, 20, 2, 20, 5, 0, 255, 0};
  assert(cpu.load(program, sizeof(program)));
  while (cpu.step()) {
  }
  assert(cpu.state.acc == 8);
  assert(cpu.state.ram[20] == 8);
  assert(cpu.state.output == 8);
  assert(cpu.state.cycles == 6);
  cpu.reset();
  assert(cpu.state.acc == 0);
  assert(cpu.state.ram[20] == 0);
  const uint8_t wrap[] = {1, 255, 16, 1, 255, 0};
  cpu.load(wrap, sizeof(wrap));
  while (cpu.step()) {
  }
  assert(cpu.state.acc == 0 && cpu.state.flags.c && cpu.state.flags.z);
  const uint8_t div[] = {1, 9, 19, 0, 255, 0};
  cpu.load(div, sizeof(div));
  while (cpu.step()) {
  }
  assert(cpu.state.status == core8::Error && cpu.state.acc == 9);
  const uint8_t loop[] = {48, 0};
  cpu.load(loop, sizeof(loop));
  while (cpu.step()) {
  }
  assert(cpu.state.cycles == 10000 && cpu.state.status == core8::Error);
  float speed = 1;
  uint32_t next = 0;
  auto command = [&](const char *json) {
    JsonDocument doc;
    assert(!deserializeJson(doc, json));
    return core8::applyRemoteCommand(remoteCpu, speed, next, 123, doc, "lab", publish, advance);
  };
  assert(command("{\"command\":\"step\"}") != nullptr);
  assert(command("{\"command\":\"load\",\"token\":\"lab\",\"program\":[1,9,5,0,255,0]}") ==
         nullptr);
  assert(command("{\"command\":\"run\",\"token\":\"lab\"}") == nullptr);
  assert(next == 123);
  assert(command("{\"command\":\"load\",\"token\":\"lab\",\"program\":[255,0]}") != nullptr);
  assert(command("{\"command\":\"step\",\"token\":\"lab\"}") != nullptr);
  assert(command("{\"command\":\"pause\",\"token\":\"lab\"}") == nullptr);
  assert(command("{\"command\":\"instruction\",\"token\":\"lab\"}") == nullptr);
  assert(remoteCpu.state.acc == 9);
  assert(command("{\"command\":\"step\",\"token\":\"lab\"}") == nullptr);
  assert(remoteCpu.state.stage == core8::Fetch);
  assert(command("{\"command\":\"speed\",\"token\":\"lab\",\"speed\":0.25}") == nullptr);
  assert(speed == .25f);
  assert(command("{\"command\":\"speed\",\"token\":\"lab\",\"speed\":100}") != nullptr);
  assert(command("{\"command\":\"speed\",\"token\":\"lab\",\"speed\":\"1\"}") != nullptr);
  assert(command("{\"command\":\"load\",\"token\":\"lab\",\"program\":[1,-1]}") != nullptr);
  assert(command("{\"command\":\"load\",\"token\":\"lab\",\"program\":[1,256]}") != nullptr);
  assert(command("{\"command\":\"load\",\"token\":\"lab\",\"program\":[1,1.5]}") != nullptr);
  assert(command("{\"command\":\"load\",\"token\":\"lab\",\"program\":[1]}") != nullptr);
  assert(command("{\"command\":\"erase\",\"token\":\"lab\"}") != nullptr);
  assert(command("{\"command\":\"reset\",\"token\":\"lab\"}") == nullptr);
  assert(remoteCpu.state.acc == 0);
  core8::KeypadUI ui(keypadCpu, publish, keypadAdvance, keypadRun);
  auto keys = [&](const char *value) {
    while (*value)
      ui.key(*value++);
  };
  auto finish = [&] {
    while (keypadCpu.step()) {
    }
  };
  keys("A15#3#");
  assert(ui.inputPhase == 0 && ui.showingCalculation());
  assert(keypadCpu.state.status == core8::Running);
  finish();
  assert(keypadCpu.state.output == 8 && ui.showingCalculation());
  ui.key('7');
  assert(ui.showingCalculation() && keypadCpu.state.output == 8);
  ui.key('#');
  assert(keypadCpu.state.status == core8::Running);
  finish();
  assert(keypadCpu.state.output == 8 && ui.showingCalculation());
  ui.key('*');
  assert(!ui.showingCalculation() && ui.detailPage == 1);
  keys("A212#5#");
  finish();
  assert(keypadCpu.state.output == 7);
  keys("B1204#170#");
  finish();
  assert(keypadCpu.state.output == 136);
  keys("A49#0#");
  finish();
  assert(keypadCpu.state.status == core8::Error && ui.showingCalculation());
  keys("A50#");
  finish();
  assert(keypadCpu.state.output == 1 && ui.showingCalculation());
  keys("A1256#");
  assert(ui.inputPhase == 1 && !ui.showingCalculation());
  assert(strstr(ui.notice, "0-255") != nullptr);
  keys("5#3#");
  finish();
  assert(keypadCpu.state.output == 8);
  keypadCpu.state.acc = 42;
  keys("C520#");
  finish();
  assert(keypadCpu.state.ram[20] == 42);
  keypadCpu.state.acc = 0;
  keys("C620#");
  finish();
  assert(keypadCpu.state.acc == 42 && keypadCpu.state.output == 42);
  ui.holdReset();
  ui.key('#');
  assert(keypadCpu.state.acc == 0 && !ui.showingCalculation());
  core8::CPU viewCpu;
  viewCpu.load(program, sizeof(program));
  core8::OLEDContext context;
  while (viewCpu.step())
    context.observe(viewCpu);
  core8::OLEDEnvironment env;
  env.controller = "laptop";
  core8::OLEDFrame frame;
  core8::buildOLEDFrame(viewCpu, context, env, frame);
  assert(!strcmp(frame.screens[1].lines[0], "ADD 5+3 = 8"));
  assert(!strcmp(frame.screens[2].lines[0], "RAM[020] R 008>008"));
  JsonDocument mirror;
  core8::serializeOLEDFrame(mirror.to<JsonObject>(), frame);
  mirror["source"] = "demo";
  mirror["screens"][0]["title"] = "FAKE HARDWARE LABEL";
  core8::OLEDFrame parsed;
  assert(core8::parseDemoOLED(mirror.as<JsonVariantConst>(), parsed) == nullptr);
  assert(!strcmp(parsed.source, "demo") && strstr(parsed.screens[0].title, "DEMO"));
  assert(viewCpu.state.acc == 8 && viewCpu.state.output == 8);
  mirror["source"] = "hardware";
  assert(core8::parseDemoOLED(mirror.as<JsonVariantConst>(), parsed) != nullptr);
  mirror["source"] = "demo";
  mirror["screens"][0]["lines"][0] = "abcdefghijklmnopqrstuvwxyz";
  assert(core8::parseDemoOLED(mirror.as<JsonVariantConst>(), parsed) != nullptr);
  return 0;
}
