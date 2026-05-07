/*
 * Smart Locker — ESP8266 / ESP32 Firmware
 *
 * Hardware:
 *   - ESP8266 (NodeMCU) or ESP32
 *   - 5V relay module on RELAY_PIN (controls solenoid lock / servo)
 *   - Optional door sensor (magnetic reed switch) on DOOR_PIN
 *
 * Libraries required (install via Arduino Library Manager):
 *   - ESP8266WiFi (built-in for ESP8266) / WiFi (built-in for ESP32)
 *   - ESP8266HTTPClient / HTTPClient
 *   - ArduinoJson
 */

#include <Arduino.h>

// ---- For ESP8266 ----
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>

// ---- For ESP32 (uncomment and comment out ESP8266 lines above) ----
// #include <WiFi.h>
// #include <HTTPClient.h>
// #include <WiFiClientSecure.h>

#include <ArduinoJson.h>

// ============================================================
// CONFIG — change these before flashing
// ============================================================
const char* WIFI_SSID     = "YourWiFiSSID";
const char* WIFI_PASS     = "YourWiFiPassword";
const char* SERVER_URL    = "https://your-app.vercel.app";
const char* LOCKER_ID     = "L001";          // must match DB
const char* ESP_SECRET    = "esp_shared_secret_key";  // must match .env

const int   RELAY_PIN     = D1;   // GPIO5 on NodeMCU (active LOW relay)
const int   DOOR_PIN      = D2;   // GPIO4 — reed switch (optional)
const int   POLL_INTERVAL = 5000; // ms between unlock checks
const int   UNLOCK_HOLD   = 5000; // ms to hold relay open
// ============================================================

unsigned long lastPoll = 0;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // relay off (active LOW)

  if (DOOR_PIN > 0) pinMode(DOOR_PIN, INPUT_PULLUP);

  connectWifi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost — reconnecting...");
    connectWifi();
    return;
  }

  if (millis() - lastPoll >= POLL_INTERVAL) {
    lastPoll = millis();
    checkUnlock();
  }
}

void connectWifi() {
  Serial.printf("Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nConnected — IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nFailed to connect. Retrying in 10s.");
    delay(10000);
  }
}

void checkUnlock() {
  // ESP8266 with HTTPS (skip cert verification for dev)
  BearSSL::WiFiClientSecure client;
  client.setInsecure(); // TODO: use a proper cert fingerprint in production

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/locker/unlock?locker_id=" + LOCKER_ID;

  if (!http.begin(client, url)) {
    Serial.println("HTTP begin failed");
    return;
  }

  http.addHeader("x-esp-secret", ESP_SECRET);

  int code = http.GET();
  if (code != 200) {
    Serial.printf("Poll failed — HTTP %d\n", code);
    http.end();
    return;
  }

  String body = http.getString();
  http.end();

  StaticJsonDocument<128> doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("JSON parse error: %s\n", err.c_str());
    return;
  }

  bool unlock = doc["unlock"] | false;
  Serial.printf("Poll → unlock: %s\n", unlock ? "YES" : "no");

  if (unlock) {
    triggerUnlock();
  }
}

void triggerUnlock() {
  Serial.println(">>> UNLOCKING <<<");
  digitalWrite(RELAY_PIN, LOW);   // energise relay — lock opens
  delay(UNLOCK_HOLD);
  digitalWrite(RELAY_PIN, HIGH);  // de-energise relay — lock closes
  Serial.println(">>> LOCKED <<<");
}
