/*
 * HACCP 온도센서 펌웨어 v1.0.0
 *
 * 기능:
 * - WiFi Manager로 쉬운 WiFi 설정
 * - DHT22 온습도 센서 지원
 * - 자동 서버 연동
 * - LED 상태 표시
 *
 * 필요한 라이브러리:
 * - WiFiManager by tzapu
 * - DHT sensor library by Adafruit
 * - ArduinoJson by Benoit Blanchon
 * - Adafruit Unified Sensor
 *
 * 배선:
 * - DHT22 DATA -> GPIO4
 * - DHT22 VCC -> 3.3V
 * - DHT22 GND -> GND
 * - (선택) LED -> GPIO2 (내장 LED)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiManager.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ===== 기기별 고유 설정 (플래싱 시 수정) =====
#define DEVICE_CODE "ABC-123-XYZ"                    // 기기 등록 코드
#define API_KEY "dev_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"   // API Key
#define SERVER_URL "https://your-domain.vercel.app"  // 서버 URL
// =============================================

// 하드웨어 설정
#define DHT_PIN 4
#define DHT_TYPE DHT22
#define LED_PIN 2
#define RESET_BUTTON_PIN 0  // BOOT 버튼

// 동작 설정
#define REPORT_INTERVAL 60000      // 데이터 전송 간격 (60초)
#define RETRY_INTERVAL 10000       // 재시도 간격 (10초)
#define WIFI_TIMEOUT 180           // WiFi 설정 타임아웃 (3분)
#define RESET_HOLD_TIME 5000       // 리셋 버튼 누르는 시간 (5초)

// 펌웨어 버전
#define FIRMWARE_VERSION "1.0.0"

// 전역 변수
DHT dht(DHT_PIN, DHT_TYPE);
WiFiManager wifiManager;
Preferences preferences;

unsigned long lastReportTime = 0;
unsigned long buttonPressTime = 0;
bool buttonPressed = false;
int failCount = 0;

// LED 패턴
void ledBlink(int count, int onTime = 200, int offTime = 200) {
  for (int i = 0; i < count; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(onTime);
    digitalWrite(LED_PIN, LOW);
    if (i < count - 1) delay(offTime);
  }
}

void ledOn() { digitalWrite(LED_PIN, HIGH); }
void ledOff() { digitalWrite(LED_PIN, LOW); }

// WiFi 설정 모드 콜백
void configModeCallback(WiFiManager *myWiFiManager) {
  Serial.println("\n=== WiFi 설정 모드 ===");
  Serial.println("AP 이름: " + myWiFiManager->getConfigPortalSSID());
  Serial.println("설정 주소: 192.168.4.1");

  // LED 빠르게 깜빡임 (설정 모드)
  while (WiFi.status() != WL_CONNECTED) {
    ledBlink(1, 100, 100);
    wifiManager.process();
  }
}

// WiFi 저장 콜백
void saveConfigCallback() {
  Serial.println("WiFi 설정 저장됨!");
  ledBlink(3, 500, 200);
}

// WiFi 초기화 (설정 삭제)
void resetWiFiSettings() {
  Serial.println("\n!!! WiFi 설정 초기화 !!!");
  ledBlink(10, 100, 100);
  wifiManager.resetSettings();
  preferences.clear();
  ESP.restart();
}

// 서버에 데이터 전송
bool sendData(float temperature, float humidity) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi 연결 안됨");
    return false;
  }

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/devices/data";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);
  http.setTimeout(10000);

  // JSON 생성
  StaticJsonDocument<256> doc;
  doc["temperature"] = round(temperature * 10) / 10.0;
  doc["humidity"] = round(humidity * 10) / 10.0;
  doc["wifi_ssid"] = WiFi.SSID();
  doc["wifi_signal"] = WiFi.RSSI();
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["ip_address"] = WiFi.localIP().toString();

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.print("전송: ");
  Serial.println(jsonString);

  int httpCode = http.POST(jsonString);
  String response = http.getString();
  http.end();

  Serial.printf("응답 코드: %d\n", httpCode);

  if (httpCode == 200) {
    Serial.println("전송 성공!");

    // 응답 파싱
    StaticJsonDocument<256> resDoc;
    if (deserializeJson(resDoc, response) == DeserializationError::Ok) {
      bool withinRange = resDoc["within_range"] | true;
      if (!withinRange) {
        Serial.println("⚠️ 온도 범위 이탈!");
        ledBlink(5, 100, 100);  // 경고 LED
      }
    }

    failCount = 0;
    return true;
  } else {
    Serial.printf("전송 실패: %s\n", response.c_str());
    failCount++;
    return false;
  }
}

// 센서 읽기
bool readSensor(float &temperature, float &humidity) {
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("센서 읽기 실패!");
    return false;
  }

  Serial.printf("온도: %.1f°C, 습도: %.1f%%\n", temperature, humidity);
  return true;
}

// 리셋 버튼 체크
void checkResetButton() {
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    if (!buttonPressed) {
      buttonPressed = true;
      buttonPressTime = millis();
    } else if (millis() - buttonPressTime > RESET_HOLD_TIME) {
      resetWiFiSettings();
    }
  } else {
    buttonPressed = false;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=============================");
  Serial.println("  HACCP 온도센서 시작");
  Serial.printf("  기기 코드: %s\n", DEVICE_CODE);
  Serial.printf("  펌웨어: v%s\n", FIRMWARE_VERSION);
  Serial.println("=============================\n");

  // 핀 설정
  pinMode(LED_PIN, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  ledOff();

  // DHT 센서 초기화
  dht.begin();

  // Preferences 초기화
  preferences.begin("haccp", false);

  // WiFi Manager 설정
  String apName = "HACCP-센서-" + String(DEVICE_CODE).substring(0, 3);

  wifiManager.setAPCallback(configModeCallback);
  wifiManager.setSaveConfigCallback(saveConfigCallback);
  wifiManager.setConfigPortalTimeout(WIFI_TIMEOUT);
  wifiManager.setConnectTimeout(30);

  // 커스텀 HTML
  wifiManager.setCustomHeadElement(
    "<style>"
    "body{font-family:'Noto Sans KR',sans-serif;}"
    ".c{text-align:center;}"
    "h1{color:#2563eb;}"
    "</style>"
  );
  wifiManager.setTitle("HACCP 센서 WiFi 설정");

  Serial.println("WiFi 연결 시도...");
  ledBlink(2, 300, 200);

  // WiFi 연결 (저장된 정보 또는 AP 모드)
  if (!wifiManager.autoConnect(apName.c_str())) {
    Serial.println("WiFi 연결 실패, 재시작...");
    delay(3000);
    ESP.restart();
  }

  Serial.println("\n✓ WiFi 연결됨!");
  Serial.print("IP 주소: ");
  Serial.println(WiFi.localIP());
  Serial.print("신호 강도: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");

  // 연결 성공 LED
  ledBlink(3, 500, 200);
  ledOn();

  // 즉시 첫 데이터 전송
  delay(2000);
  float temp, hum;
  if (readSensor(temp, hum)) {
    sendData(temp, hum);
  }
  lastReportTime = millis();
}

void loop() {
  // 리셋 버튼 체크
  checkResetButton();

  // WiFi 연결 확인
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi 끊김, 재연결 시도...");
    ledOff();

    WiFi.reconnect();
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
      ledBlink(1, 100, 400);
      attempts++;
    }

    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("재연결 실패, WiFi 설정 모드로 전환");
      wifiManager.startConfigPortal(("HACCP-센서-" + String(DEVICE_CODE).substring(0, 3)).c_str());
    } else {
      Serial.println("재연결 성공!");
      ledOn();
    }
    return;
  }

  // 주기적 데이터 전송
  unsigned long interval = (failCount > 3) ? RETRY_INTERVAL : REPORT_INTERVAL;

  if (millis() - lastReportTime >= interval) {
    ledBlink(1, 100, 0);  // 전송 시작 표시

    float temperature, humidity;
    if (readSensor(temperature, humidity)) {
      if (sendData(temperature, humidity)) {
        ledOn();  // 성공
      } else {
        ledBlink(2, 200, 200);  // 실패
      }
    } else {
      ledBlink(5, 50, 50);  // 센서 오류
    }

    lastReportTime = millis();
  }

  delay(100);
}
