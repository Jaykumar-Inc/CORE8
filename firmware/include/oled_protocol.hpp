#pragma once
#include "oled_view.hpp"
#include <ArduinoJson.h>
namespace core8 {
inline void serializeOLEDFrame(JsonObject out, const OLEDFrame &frame) {
  out["source"] = frame.source;
  out["controller"] = frame.controller;
  out["page"] = frame.page;
  out["stage"] = stageName(frame.stage);
  auto screens = out["screens"].to<JsonArray>();
  for (const auto &screen : frame.screens) {
    auto item = screens.add<JsonObject>();
    item["title"] = screen.title;
    item["emphasis"] = screen.emphasis;
    auto lines = item["lines"].to<JsonArray>();
    for (const auto &line : screen.lines)
      lines.add(line);
  }
}
inline bool oledText(JsonVariantConst value) {
  if (!value.is<const char *>())
    return false;
  const char *text = value.as<const char *>();
  if (strlen(text) > 25)
    return false;
  for (const char *p = text; *p; p++)
    if (*p < 32 || *p > 126)
      return false;
  return true;
}
inline const char *parseDemoOLED(JsonVariantConst input, OLEDFrame &out) {
  if (strcmp(input["source"] | "", "demo"))
    return "OLED mirror must be labeled demo";
  auto screens = input["screens"].as<JsonArrayConst>();
  if (screens.size() != 3)
    return "Three OLED screens are required";
  OLEDFrame next;
  next.source = "demo";
  next.controller = "laptop";
  const char *page = input["page"] | "";
  if (!strcmp(page, "learning"))
    next.page = "learning";
  else if (!strcmp(page, "binary"))
    next.page = "binary";
  else if (!strcmp(page, "network"))
    next.page = "network";
  else
    return "Invalid OLED page";
  const char *stage = input["stage"] | "";
  bool matched = false;
  for (int i = Ready; i <= Writeback; i++)
    if (!strcmp(stage, stageName(Stage(i)))) {
      next.stage = Stage(i);
      matched = true;
      break;
    }
  if (!matched)
    return "Invalid OLED stage";
  const char *titles[] = {"CONTROL | DEMO", "ALU/REG | DEMO", "RAM/OUT | DEMO"};
  for (int i = 0; i < 3; i++) {
    auto screen = screens[i];
    auto lines = screen["lines"].as<JsonArrayConst>();
    if (lines.size() != 5 || !screen["emphasis"].is<int>() || screen["emphasis"].as<int>() < 0 ||
        screen["emphasis"].as<int>() > 4)
      return "Each OLED needs five lines and a valid emphasis row";
    next.screens[i].heading(titles[i]);
    next.screens[i].emphasis = screen["emphasis"].as<uint8_t>();
    for (int row = 0; row < 5; row++) {
      if (!oledText(lines[row]))
        return "OLED text must be ASCII, up to 25 characters";
      next.screens[i].line(row, "%s", lines[row].as<const char *>());
    }
  }
  out = next;
  return nullptr;
}
} // namespace core8
