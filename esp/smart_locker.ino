/*
 * Smart Locker — ESP8266 Firmware
 * Control method: MQTT (primary, instant) + HTTP polling (fallback every 30s)
 *
 * Libraries — install via Arduino IDE Library Manager:
 *   1. ESP8266WiFi       (comes with ESP8266 board package)
 *   2. PubSubClient      by Nick O'Leary
 *   3. ESP8266HTTPClient (comes with ESP8266 board package)
 *   4. ArduinoJson       by Benoit Blanchon
 *
 * Board setup:
 *   File → Preferences → Additional Boards URL:
 *   http://arduino.esp8266.com/stable/package_esp8266com_index.json
 *   Then: Tools → Board → ESP8266 Boards → NodeMCU 1.0
 */

#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <ArduinoJson.h>

// ============================================================
// CONFIG — edit these before flashing
// ============================================================
const char* WIFI_SSID      = "YOUR_WIFI_SSID";
const char* WIFI_PASS      = "YOUR_WIFI_PASSWORD";

// Your deployed Next.js URL (no trailing slash)
const char* SERVER_URL     = "https://your-app.vercel.app";

// Must match ESP_SECRET in your .env.local
const char* ESP_SECRET     = "esp_shared_secret_key";

// Must match locker_id in MongoDB and MQTT_TOPIC_PREFIX in .env.local
const char* LOCKER_ID      = "L001";
const char* TOPIC_PREFIX   = "smartlocker_proj"; // must match MQTT_TOPIC_PREFIX in .env

// Hardware
const int   RELAY_PIN      = D1;   // GPIO5 — connect relay IN pin here
const int   STATUS_LED     = D4;   // GPIO2 — built-in LED (active LOW on NodeMCU)

// Timing
const long  POLL_INTERVAL  = 30000; // HTTP fallback poll every 30s (MQTT handles instant)
const int   UNLOCK_HOLD_MS = 5000;  // relay stays open for 5 seconds
// ============================================================

// MQTT — free public HiveMQ broker, no account needed
const char* MQTT_BROKER  = "broker.hivemq.com";
const int   MQTT_PORT    = 1883;

WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastHttpPoll = 0;
bool          unlockPending = false;

// ── topic helpers ─────────────────────────────────────────
String cmdTopic() {
  return String(TOPIC_PREFIX) + "/" + LOCKER_ID + "/unlock";
}

// ── MQTT callback ─────────────────────────────────────────
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  Serial.print("[MQTT] Message on: ");
  Serial.println(topic);

  // Parse JSON payload: {"cmd":"unlock","ts":...}
  StaticJsonDocument<128> doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.print("[MQTT] JSON error: ");
    Serial.println(err.c_str());
    return;
  }

  const char* cmd = doc["cmd"] | "";
  if (strcmp(cmd, "unlock") == 0) {
    Serial.println("[MQTT] Unlock command received!");
    unlockPending = true;
  }
}

// ── WiFi ──────────────────────────────────────────────────
void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("\nConnecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWiFi connected — IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi failed. Will retry.");
  }
}

// ── MQTT connect ──────────────────────────────────────────
void connectMQTT() {
  if (mqttClient.connected()) return;

  String clientId = String("SmartLocker_") + LOCKER_ID + "_" + String(ESP.getChipId(), HEX);

  Serial.printf("[MQTT] Connecting as %s ...\n", clientId.c_str());

  if (mqttClient.connect(clientId.c_str())) {
    Serial.println("[MQTT] Connected to broker.hivemq.com");
    mqttClient.subscribe(cmdTopic().c_str(), 1); // QoS 1
    Serial.printf("[MQTT] Subscribed to: %s\n", cmdTopic().c_str());
  } else {
    Serial.printf("[MQTT] Failed, rc=%d — will retry in 5s\n", mqttClient.state());
  }
}

// ── HTTP fallback poll ────────────────────────────────────
void httpPoll() {
  BearSSL::WiFiClientSecure secClient;
  secClient.setInsecure(); // OK for dev; use cert fingerprint in production

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/locker/unlock?locker_id=" + LOCKER_ID;

  if (!http.begin(secClient, url)) return;
  http.addHeader("x-esp-secret", ESP_SECRET);

  int code = http.GET();
  if (code == 200) {
    StaticJsonDocument<128> doc;
    deserializeJson(doc, http.getString());
    if (doc["unlock"] | false) {
      Serial.println("[HTTP] Unlock flag set — triggering");
      unlockPending = true;
    }
  } else {
    Serial.printf("[HTTP] Poll failed: %d\n", code);
  }
  http.end();
}

// ── Relay trigger ─────────────────────────────────────────
void triggerUnlock() {
  Serial.println(">>> UNLOCKING LOCKER <<<");

  // Flash status LED while unlocked
  digitalWrite(STATUS_LED, LOW);    // LED on (active LOW)
  digitalWrite(RELAY_PIN, LOW);     // Energise relay (active LOW) — lock opens

  delay(UNLOCK_HOLD_MS);

  digitalWrite(RELAY_PIN, HIGH);    // De-energise — lock closes
  digitalWrite(STATUS_LED, HIGH);   // LED off

  Serial.println(">>> LOCKER CLOSED <<<");
}

// ── Setup ─────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(100);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);  // relay off
  digitalWrite(STATUS_LED, HIGH); // LED off

  connectWifi();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  connectMQTT();
}

// ── Loop ──────────────────────────────────────────────────
void loop() {
  // Keep WiFi alive
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    return;
  }

  // Keep MQTT alive — reconnects automatically if dropped
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop(); // process incoming messages

  // HTTP fallback poll every 30s (catches anything MQTT missed)
  if (millis() - lastHttpPoll >= POLL_INTERVAL) {
    lastHttpPoll = millis();
    httpPoll();
  }

  // Execute unlock if flagged (from MQTT or HTTP)
  if (unlockPending) {
    unlockPending = false;
    triggerUnlock();
  }
}
