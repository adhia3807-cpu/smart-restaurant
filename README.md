# 🚀 BiteExpress Smart Restaurant Ecosystem Installation Guide

Welcome to the **BiteExpress** ecosystem! This system consists of three interconnected, specialized layers designed to modernize restaurant operations:

1. **🌐 Customer Website / Frontend**: A responsive, modern web interface for customers to browse the menu, select items, and place digital orders mapped to their specific table.
2. **🍳 Kitchen Dashboard**: A dedicated, real-time control console for chefs to view incoming orders, track cooking times, and toggle dish readiness.
3. **📟 ESP32 Microcontroller Nodes**: Standalone, screen-free embedded hardware placed on tables. It polls the server, rings a piezo buzzer (GPIO 15), and flashes a blue status LED (GPIO 2) when dishes are ready, with support for complete serial monitor overrides (command inputs like `RST`, `STATUS`, `IP`).

---

## 📋 Architectural Overview & Standalone Access

To keep the components completely independent while sharing real-time status updates:
- **Server Hub**: A full-stack Node.js/Express server acts as the central coordinator and exposes direct API endpoints.
- **Frontend Routing**: The application features built-in path-based routing that lets you access any interface as a dedicated, standalone app:
  - **Customer Website**: `http://localhost:3000/` or `https://your-domain.com/`
  - **Kitchen App**: `http://localhost:3000/kitchen` or `https://your-domain.com/kitchen`
  - **ESP32 Serial Monitor**: `http://localhost:3000/esp32` or `https://your-domain.com/esp32`
  - **Unified Sandbox (combined view)**: `http://localhost:3000/sandbox`

---

## 🛠️ Step 1: Deploying the Cloud Backend & Website

The website and backend API run together as a single full-stack app. You can deploy it to any cloud container service (such as **Render**, **Railway**, **Fly.io**, or **AWS**).

### A. Local Setup & Testing
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/adhia3807-cpu/smart-restaurant.git
   cd smart-restaurant
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run in Development Mode**:
   ```bash
   npm run dev
   ```
   This boots the backend and hosts Vite on port `3000`. Open `http://localhost:3000` to access the website.

4. **Build & Run in Production Mode**:
   ```bash
   npm run build
   npm start
   ```

### B. Deployment to Cloud Servers (e.g., Render)
Render is the easiest platform for deploying full-stack Node.js apps.
1. Sign up at [Render.com](https://render.com) and click **New > Web Service**.
2. Connect your GitHub repository (`smart-restaurant`).
3. Configure the following service settings:
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`
   - **Port**: `3000` (The Express server will automatically bind to port `3000`)
4. Add an Environment Variable (Optional):
   - `NODE_ENV=production`
5. Click **Deploy Web Service**. Once deployed, Render will provide a public URL (e.g., `https://bite-express.onrender.com`).

---

## 🍳 Step 2: Deploying the Kitchen App Only

To install or run the **Kitchen Dashboard** as a standalone application for kitchen tablets or screens:

### A. Dedicated Web Mode
Simply navigate your kitchen tablet's browser directly to:
```
https://your-deployed-domain.com/kitchen
```
*Note: This route completely hides the customer navigation and shopping options, showing only the order queues, prep status checkboxes, and analytics panel.*

### B. Install as a Progressive Web App (PWA) / Home Screen Shortcut
Because the app is fully responsive, you can add it to any tablet as if it were a native app:
1. Open Chrome/Safari on your kitchen tablet.
2. Go to `https://your-deployed-domain.com/kitchen`.
3. Tap the browser menu (three dots or Share button) and select **"Add to Home Screen"**.
4. The Kitchen Dashboard will install as a standalone icon, hiding browser toolbars to provide a clean app experience.

---

## 📟 Step 3: Setting Up & Flashing the ESP32 Hardware

The simulated ESP32 NodeMCU hardware is screenless and operates strictly through physical pins and a Serial Monitor console at **115200 Baud**.

### A. Physical Pinout Map
Connect the following components to your physical ESP32 board:
- **Built-in LED**: Pre-routed to **GPIO 2** (Flashes when a dish is ready).
- **Active Piezo Buzzer**: Connect the positive lead to **GPIO 15** and negative lead to **GND** (Sounds alerts).
- **Physical Reset Switch (Optional)**: Connect a momentary push button between **EN** (Reset) or **GPIO 12** and **GND** to trigger a physical hardware-level silence.

### B. Configuring the C++ Firmware
Copy the production-ready C++ code below and load it in your **Arduino IDE**:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Target Server URL (replace with your cloud server or local machine IP)
const char* serverUrl = "https://your-deployed-domain.com/api/esp32/active-table";
const char* resetUrl = "https://your-deployed-domain.com/api/mqtt/reset";

const int ledPin = 2;       // GPIO 2 (Built-in Blue LED)
const int buzzerPin = 15;   // GPIO 15 (Piezo Buzzer)

int activeTableAlert = 0;

void setup() {
  Serial.begin(115200);
  pinMode(ledPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  
  digitalWrite(ledPin, LOW);
  digitalWrite(buzzerPin, LOW);

  // Connect to Wi-Fi
  Serial.println("");
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi Connected successfully!");
  Serial.print("Local IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    
    int httpResponseCode = http.GET();
    
    if (httpResponseCode == 200) {
      String payload = http.getString();
      int receivedTable = payload.toInt();
      
      if (receivedTable > 0) {
        activeTableAlert = receivedTable;
        Serial.print("[ALERT] Food is ready for Table: ");
        Serial.println(activeTableAlert);
        
        // Trigger alerts
        digitalWrite(ledPin, HIGH);
        // Beep Buzzer
        for (int i = 0; i < 3; i++) {
          digitalWrite(buzzerPin, HIGH);
          delay(150);
          digitalWrite(buzzerPin, LOW);
          delay(100);
        }
      } else {
        // No active alerts, turn off pins
        digitalWrite(ledPin, LOW);
        digitalWrite(buzzerPin, LOW);
        if (activeTableAlert != 0) {
          Serial.println("[SYSTEM] Alert Cleared.");
          activeTableAlert = 0;
        }
      }
    } else {
      Serial.print("Error on HTTP request: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
  } else {
    Serial.println("WiFi Disconnected. Reconnecting...");
    WiFi.begin(ssid, password);
  }

  // Poll server every 3 seconds
  delay(3000); 
}
```

### C. Reading/Controlling via Serial Monitor (Command Console)
Connect the ESP32 to your computer using a micro-USB/USB-C cable and open your preferred serial terminal (such as the **Arduino IDE Serial Monitor** or Web Serial Tool):
1. Select the correct **COM Port**.
2. Configure the baud rate to **115200 baud**.
3. **Serial Terminal Commands**:
   - Type **`STATUS`**: Output complete connection metrics, RSSI, free RAM heap, and core temperatures.
   - Type **`IP`**: Display active DHCP credentials and Gateway assignment.
   - Type **`RST`**: Send a secure POST request to the server at `/api/mqtt/reset` to dismiss the active alert, automatically silences the LED, stops the buzzer, and moves the order to delivered.
   - Type **`HELP`**: Prints the diagnostic help menu with all supported inputs.

---

## 📊 Summary of System API Endpoints

If you wish to integrate third-party hardware or custom dashboards:
- `GET /api/esp32/active-table` - Returns plain text table number of the active ready alert (e.g. `3` or `0` if empty).
- `POST /api/mqtt/reset` - Silences alerts. Payload: `{ "table": 3 }`.
- `GET /api/orders/stream` - Server-Sent Events (SSE) feed for client UIs to receive instant order updates.
