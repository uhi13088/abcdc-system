/**
 * HACCP IoT 센서 펌웨어
 * ESP32 온도 센서 예제
 *
 * 필요 라이브러리:
 * - WiFi (내장)
 * - HTTPClient (내장)
 * - ArduinoJson (6.x)
 * - OneWire (DS18B20용)
 * - DallasTemperature (DS18B20용)
 *
 * 하드웨어:
 * - ESP32 (ESP32-WROOM-32 권장)
 * - DS18B20 온도 센서 (또는 DHT22 온습도 센서)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ============================================
// 설정값 - 배포 시 수정 필요
// ============================================
// API 서버 주소 (배포 환경에 맞게 변경)
const char* API_BASE_URL = "https://your-haccp-server.com";

// 기기 인증 정보 (펌웨어 플래싱 시 설정)
const char* DEVICE_SERIAL = "";  // 예: ESP32-TEMP-000001
const char* API_KEY = "";        // 기기 등록 시 발급된 API 키

// 센서 설정
const int SENSOR_PIN = 4;        // DS18B20 데이터 핀
const int LED_PIN = 2;           // 상태 LED 핀

// ============================================
// 전역 변수
// ============================================
Preferences preferences;
String wifiSSID = "";
String wifiPassword = "";
int readingInterval = 60;  // 초 단위, 서버에서 설정 가져옴

// WiFi 재연결 타이머
unsigned long lastWiFiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 30000;  // 30초

// 데이터 전송 타이머
unsigned long lastDataSend = 0;

// 설정 가져오기 타이머
unsigned long lastConfigFetch = 0;
const unsigned long CONFIG_FETCH_INTERVAL = 300000;  // 5분

// ============================================
// 센서 (DS18B20 예제)
// ============================================
#include <OneWire.h>
#include <DallasTemperature.h>

OneWire oneWire(SENSOR_PIN);
DallasTemperature sensors(&oneWire);

// ============================================
// 초기화
// ============================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== HACCP IoT Sensor ===");
  Serial.println("Firmware Version: 1.0.0");

  // LED 초기화
  pinMode(LED_PIN, OUTPUT);
  blinkLED(3, 200);  // 부팅 신호

  // Preferences 초기화 (WiFi 정보 저장용)
  preferences.begin("haccp", false);

  // 저장된 WiFi 정보 로드
  loadWiFiCredentials();

  // 센서 초기화
  sensors.begin();
  Serial.println("Sensor initialized");

  // WiFi 연결
  if (wifiSSID.length() > 0) {
    connectToWiFi();
  } else {
    Serial.println("No WiFi credentials. Starting AP mode...");
    startAPMode();
  }

  // 서버에서 설정 가져오기
  if (WiFi.status() == WL_CONNECTED) {
    fetchConfig();
  }
}

// ============================================
// 메인 루프
// ============================================
void loop() {
  unsigned long currentMillis = millis();

  // WiFi 연결 확인
  if (currentMillis - lastWiFiCheck >= WIFI_CHECK_INTERVAL) {
    lastWiFiCheck = currentMillis;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected. Reconnecting...");
      connectToWiFi();
    }
  }

  // 설정 주기적 업데이트
  if (currentMillis - lastConfigFetch >= CONFIG_FETCH_INTERVAL) {
    lastConfigFetch = currentMillis;
    if (WiFi.status() == WL_CONNECTED) {
      fetchConfig();
    }
  }

  // 데이터 전송
  unsigned long sendInterval = readingInterval * 1000UL;
  if (currentMillis - lastDataSend >= sendInterval) {
    lastDataSend = currentMillis;

    if (WiFi.status() == WL_CONNECTED) {
      float temperature = readTemperature();
      if (!isnan(temperature)) {
        sendSensorData(temperature);
      }
    }
  }

  delay(100);
}

// ============================================
// WiFi 함수
// ============================================
void loadWiFiCredentials() {
  wifiSSID = preferences.getString("ssid", "");
  wifiPassword = preferences.getString("password", "");
  Serial.println("Loaded WiFi SSID: " + wifiSSID);
}

void saveWiFiCredentials(String ssid, String password) {
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  wifiSSID = ssid;
  wifiPassword = password;
  Serial.println("Saved WiFi credentials");
}

void connectToWiFi() {
  Serial.println("Connecting to WiFi: " + wifiSSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    blinkLED(1, 100);
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.println("IP: " + WiFi.localIP().toString());
    Serial.println("Signal: " + String(WiFi.RSSI()) + " dBm");
    digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.println("\nWiFi connection failed!");
    digitalWrite(LED_PIN, LOW);
  }
}

void startAPMode() {
  // AP 모드로 WiFi 설정 웹 서버 시작
  // 구현 생략 - 실제 제품에서는 캡티브 포털 구현 필요
  String apSSID = "HACCP-" + String(DEVICE_SERIAL);
  WiFi.softAP(apSSID.c_str(), "haccp1234");
  Serial.println("AP Mode started: " + apSSID);
  Serial.println("Connect to this network and configure WiFi");
}

// ============================================
// 센서 함수
// ============================================
float readTemperature() {
  sensors.requestTemperatures();
  float temp = sensors.getTempCByIndex(0);

  if (temp == DEVICE_DISCONNECTED_C) {
    Serial.println("Error: Sensor disconnected");
    return NAN;
  }

  Serial.println("Temperature: " + String(temp) + "°C");
  return temp;
}

// ============================================
// API 함수
// ============================================
void fetchConfig() {
  Serial.println("Fetching config from server...");

  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/iot/config";

  http.begin(url);
  http.addHeader("X-API-Key", API_KEY);
  http.addHeader("X-Device-Serial", DEVICE_SERIAL);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();

    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      bool registered = doc["registered"];

      if (registered) {
        readingInterval = doc["reading_interval_seconds"] | 60;
        Serial.println("Config updated - Interval: " + String(readingInterval) + "s");

        // 센서 설정 (임계값 등)
        if (doc.containsKey("sensor")) {
          JsonObject sensor = doc["sensor"];
          float minValue = sensor["min_value"] | -999;
          float maxValue = sensor["max_value"] | 999;
          Serial.println("Thresholds: " + String(minValue) + " ~ " + String(maxValue));
        }
      } else {
        Serial.println("Device not registered yet");
      }
    }
  } else {
    Serial.println("Config fetch failed: " + String(httpCode));
  }

  http.end();
}

void sendSensorData(float value) {
  Serial.println("Sending data to server...");

  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/iot/data";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);
  http.addHeader("X-Device-Serial", DEVICE_SERIAL);

  // JSON 페이로드 생성
  DynamicJsonDocument doc(512);
  doc["value"] = value;
  doc["unit"] = "°C";
  doc["wifi_ssid"] = WiFi.SSID();
  doc["wifi_signal"] = WiFi.RSSI();
  doc["firmware_version"] = "1.0.0";

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    String response = http.getString();

    DynamicJsonDocument resDoc(512);
    deserializeJson(resDoc, response);

    bool success = resDoc["success"];
    bool isWithinRange = resDoc["is_within_range"];
    bool isAlert = resDoc["is_alert"];

    if (success) {
      Serial.println("Data sent successfully");
      blinkLED(1, 100);

      if (isAlert) {
        Serial.println("ALERT: Value out of range!");
        blinkLED(5, 100);  // 경고 신호
      }
    }
  } else {
    Serial.println("Data send failed: " + String(httpCode));
    blinkLED(3, 500);  // 오류 신호
  }

  http.end();
}

// ============================================
// 유틸리티 함수
// ============================================
void blinkLED(int times, int duration) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(duration);
    digitalWrite(LED_PIN, LOW);
    if (i < times - 1) delay(duration);
  }
}
