#pragma once
// Copy to secrets.h (git-ignored). Empty SSID keeps the local lab operational.
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
// Exact dashboard origin; no trailing slash. For another laptop, use its LAN URL.
#define DASHBOARD_ORIGIN "http://localhost:5173"
// Optional shared lab control token. Empty = trusted, isolated LAN only.
#define CONTROL_TOKEN ""
