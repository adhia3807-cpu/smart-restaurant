import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Cpu, RotateCcw, AlertTriangle, Send, Trash2, CheckCircle, Clock, Lock } from 'lucide-react';

interface ESP32SimulatorProps {
  activeTableAlert: number | null;
  mqttLog: any[];
  onHardwareReset: (table: number) => Promise<any>;
  onSignOut?: () => void;
}

export default function ESP32Simulator({
  activeTableAlert,
  mqttLog,
  onHardwareReset,
  onSignOut
}: ESP32SimulatorProps) {
  const [serialLogs, setSerialLogs] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [baudRate, setBaudRate] = useState('115200');
  const [autoscroll, setAutoscroll] = useState(true);
  const [showTimestamp, setShowTimestamp] = useState(true);
  const [copied, setCopied] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [uptime, setUptime] = useState(0);
  const [publicUrl, setPublicUrl] = useState<string>('');

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Uptime tracker
  useEffect(() => {
    const timer = setInterval(() => {
      setUptime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Fetch dynamic public URL config from server
  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const res = await fetch('/api/system-info');
        if (res.ok) {
          const data = await res.json();
          setPublicUrl(data.publicUrl);
        } else {
          setPublicUrl(window.location.origin);
        }
      } catch (e) {
        setPublicUrl(window.location.origin);
      }
    };
    fetchSystemInfo();
  }, []);

  // Arduino firmware code
  const arduinoCode = useMemo(() => {
    const base = publicUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return `#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// Wi-Fi Credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Your Live Cloud Server URL
const char* serverUrl = "${base}/api/esp32/active-table";

void setup() {
  Serial.begin(115200);
  delay(10);
  
  Serial.println();
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("Wi-Fi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); // ESSENTIAL: Bypasses SSL validation checks for the HTTPS Cloud Run URL to avoid HTTP Error Code -1
    
    HTTPClient http;
    http.begin(client, serverUrl);
    
    int httpResponseCode = http.GET();
    
    if (httpResponseCode > 0) {
      String payload = http.getString();
      Serial.print("HTTP Code: ");
      Serial.print(httpResponseCode);
      Serial.print(" | Active Table Alert: ");
      Serial.println(payload);
      
      int tableNum = payload.toInt();
      if (tableNum > 0) {
        Serial.print(">>> ALERT: Table ");
        Serial.print(tableNum);
        Serial.println(" is ready for delivery! <<<");
      } else {
        Serial.println("Standby - No active ready tables.");
      }
    } else {
      Serial.print("HTTP Get Request Failed. Error code: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
  } else {
    Serial.println("WiFi Disconnected!");
  }
  
  delay(3000); // Check every 3 seconds
}`;
  }, [publicUrl]);

  // Initialize with hardware boot logs
  useEffect(() => {
    const base = publicUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    const bootLogs = [
      "--- ESP32 NodeMCU-32S Boot Sequence Started ---",
      "Initializing flash chip... OK",
      "XTAL frequency: 40 MHz",
      "CPU 0 / CPU 1 core clock initialized to 240 MHz",
      "Internal memory diagnostics: 520 KB SRAM | 4MB external SPI flash",
      "Baud rate configured to " + baudRate + " bps.",
      "[HARDWARE] GPIO 2 (Built-in Blue LED) initialized as OUTPUT",
      "[HARDWARE] GPIO 15 (Piezo Buzzer) initialized as OUTPUT",
      "[WIFI] Initializing wireless transceiver...",
      "[WIFI] Connecting to SSID: BiteExpress_Restaurant_Local",
      "[WIFI] Loading network credentials from non-volatile storage...",
      "[WIFI] ....................",
      "[WIFI] Connection successful! DHCP leased successfully.",
      `[WIFI] Local IP Assigned: 192.168.1.182 | Gateway: 192.168.1.1`,
      "[WIFI] Signal strength (RSSI): -52 dBm (Excellent)",
      "[HTTPClient] Initializing secure client...",
      "[HTTPClient] SSL certificate verification overridden via client.setInsecure()",
      `[HTTPClient] Configured server destination: ${base}/api/esp32/active-table`,
      "----------------------------------------------------------------",
      "ESP32 Microcontroller is now standing by... Polling every 3000ms."
    ];
    
    setSerialLogs(bootLogs);
  }, [publicUrl]);

  // Poll the database via local endpoint to output actual live serial lines
  useEffect(() => {
    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch('/api/esp32/active-table');
        if (res.ok) {
          const payloadStr = await res.text();
          const tableNum = parseInt(payloadStr);
          const timestamp = new Date().toLocaleTimeString();
          
          let pollLine = `[POLL] HTTP GET request to /api/esp32/active-table | Response: 200 OK | Active Table Alert: ${payloadStr}`;
          let alertLine = null;
          
          if (tableNum > 0) {
            pollLine = `[POLL] HTTP GET request -> 200 OK | Payload: ${tableNum}`;
            alertLine = `>>> ALERT: Table ${tableNum} dish is READY! Flash GPIO 2 High. Ring GPIO 15 Buzzer. <<<`;
          }
          
          setSerialLogs(prev => {
            const current = [...prev, pollLine];
            if (alertLine) {
              // Only insert alert warning if not already flooded
              if (prev[prev.length - 1] !== alertLine) {
                current.push(alertLine);
              }
            }
            return current.slice(-150); // Keep buffer capped at 150 items
          });
        }
      } catch (err) {
        setSerialLogs(prev => [...prev, `[POLL ERROR] Connection to cloud endpoint failed.`].slice(-150));
      }
    }, 3000);

    return () => clearInterval(pollTimer);
  }, []);

  // Handle auto-scroll
  useEffect(() => {
    if (autoscroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [serialLogs, autoscroll]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(arduinoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const command = inputValue.trim().toUpperCase();
    const timestamp = new Date().toLocaleTimeString();
    
    setSerialLogs(prev => [...prev, `> ${inputValue}`]);
    setInputValue('');

    if (command === 'RST' || command === 'RESET') {
      if (activeTableAlert !== null) {
        setSerialLogs(prev => [...prev, `[SERIAL] Received: RESET. Issuing cloud reset for table alert ${activeTableAlert}...`]);
        try {
          const success = await onHardwareReset(activeTableAlert);
          setSerialLogs(prev => [...prev, `[SERIAL] Server reset confirmed. Silenced GPIO alert pinout and stopped buzzer.`]);
        } catch (e) {
          setSerialLogs(prev => [...prev, `[SERIAL ERROR] Failed to send reset API request.`]);
        }
      } else {
        setSerialLogs(prev => [...prev, `[SERIAL] Received: RESET. Standby mode active. No ready alert to clear.`]);
      }
    } else if (command === 'HELP') {
      setSerialLogs(prev => [
        ...prev,
        "--- Supported ESP32 Serial Input Commands ---",
        "  HELP   - Lists all valid serial interface operations",
        "  RST    - Silences current table alert and resets state",
        "  STATUS - Displays connection metrics and device health",
        "  IP     - Prints assigned WiFi configuration",
        "  CLEAR  - Empties the serial monitor buffer",
        "----------------------------------------------"
      ]);
    } else if (command === 'STATUS') {
      setSerialLogs(prev => [
        ...prev,
        `[STATUS] WiFi Network: BiteExpress_Restaurant_Local`,
        `[STATUS] Signal: -52 dBm | Frequency: 2.4 GHz`,
        `[STATUS] Hardware: NodeMCU ESP32 (V1.0)`,
        `[STATUS] CPU Temp: 38.4°C`,
        `[STATUS] Free Heap RAM: 284 KB`,
        `[STATUS] Uptime: ${formatUptime(uptime)}`,
        `[STATUS] Current Alert State: ${activeTableAlert ? `Active Table ${activeTableAlert}` : "No Alerts"}`
      ]);
    } else if (command === 'IP') {
      setSerialLogs(prev => [
        ...prev,
        `[IP CONFIG] Assigned IP: 192.168.1.182`,
        `[IP CONFIG] Subnet Mask: 255.255.255.0`,
        `[IP CONFIG] Gateway: 192.168.1.1`,
        `[IP CONFIG] Primary DNS: 8.8.8.8`
      ]);
    } else if (command === 'CLEAR') {
      setSerialLogs([]);
    } else {
      setSerialLogs(prev => [...prev, `[SERIAL ERROR] Unknown command: "${command}". Type HELP for guidelines.`]);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!filterText) return serialLogs;
    return serialLogs.filter(log => log.toLowerCase().includes(filterText.toLowerCase()));
  }, [serialLogs, filterText]);

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 p-4 md:p-6 pb-24" id="esp32-serial-root">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Cpu className="w-5 h-5" />
            </span>
            <h1 className="text-lg md:text-xl font-black tracking-tight text-slate-950">
              ESP32 Microcontroller Serial Console
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Real-time serial feedback emitted by the simulated restaurant table alert node. No visual interface is rendered, replicating true embedded hardware behavior.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-bold rounded-lg border border-transparent hover:border-rose-100 transition-all cursor-pointer"
              title="Lock and Secure Admin Portal"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Admin</span>
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ESP32 ACTIVE
          </span>
          <span className="inline-flex items-center gap-1 bg-slate-100 px-3 py-1 text-slate-600 text-xs font-mono rounded-lg">
            Uptime: {formatUptime(uptime)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="esp32-panel-layout">
        
        {/* LEFT COLUMN: Highly Authentic Arduino IDE Serial Monitor (8 columns) */}
        <div className="lg:col-span-8 flex flex-col bg-[#f0f0f0] border border-slate-300 rounded-xl overflow-hidden shadow-sm" id="arduino-serial-monitor">
          
          {/* Serial Monitor Header */}
          <div className="bg-[#e1e1e1] border-b border-slate-300 px-4 py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 font-mono">
              <span className="w-2.5 h-2.5 bg-indigo-600 rounded-sm"></span>
              <span>COM4 - Serial Monitor</span>
            </div>
            
            {/* Filter Input & Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Filter output..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 w-full sm:w-36 outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => setSerialLogs([])}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 p-1 rounded cursor-pointer"
                title="Clear Logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Console Output Screen */}
          <div className="bg-black p-4 h-[420px] overflow-y-auto font-mono text-xs flex flex-col space-y-1 select-text scrollbar-thin">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-600 italic text-center py-20">[Serial Monitor Empty - Send a command or wait for polling logs]</div>
            ) : (
              filteredLogs.map((log, index) => {
                const isAlert = log.includes('>>> ALERT');
                const isInput = log.startsWith('>');
                const isError = log.includes('[ERROR]') || log.includes('[POLL ERROR]');
                const currentSec = showTimestamp ? `[${new Date().toLocaleTimeString()}] ` : '';

                let textColor = 'text-[#ffffff]'; // default white
                if (isAlert) textColor = 'text-amber-400 font-bold';
                else if (isInput) textColor = 'text-emerald-400';
                else if (isError) textColor = 'text-rose-400 font-bold';
                else if (log.includes('[POLL]')) textColor = 'text-slate-400';
                else if (log.includes('[STATUS]')) textColor = 'text-sky-400';

                return (
                  <div key={index} className={`whitespace-pre-wrap leading-relaxed ${textColor}`}>
                    {!isInput && showTimestamp && <span className="text-slate-600 select-none">{currentSec}</span>}
                    {log}
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>

          {/* Serial Send Command Input Area */}
          <div className="bg-[#e1e1e1] border-t border-slate-300 p-3 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
            <form onSubmit={handleSendSerial} className="flex gap-2 w-full sm:flex-1">
              <input
                type="text"
                placeholder="Type command (e.g. HELP, STATUS, IP, RST)..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 font-mono w-full outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-1.5 rounded cursor-pointer transition-all flex items-center gap-1 shrink-0 shadow-sm"
              >
                <Send className="w-3 h-3" />
                <span>Send</span>
              </button>
            </form>

            <div className="flex items-center gap-4 text-xs text-slate-600 font-mono w-full sm:w-auto justify-end">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoscroll}
                  onChange={(e) => setAutoscroll(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Autoscroll</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showTimestamp}
                  onChange={(e) => setShowTimestamp(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Show Timestamp</span>
              </label>

              <select
                value={baudRate}
                onChange={(e) => setBaudRate(e.target.value)}
                className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono outline-none text-slate-700 cursor-pointer"
              >
                <option value="9600">9600 baud</option>
                <option value="57600">57600 baud</option>
                <option value="115200">115200 baud</option>
              </select>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Quick Guide and manual tester (4 columns) */}
        <div className="lg:col-span-4 flex flex-col gap-6" id="serial-monitor-sidebar">
          
          {/* Active Alert Widget */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-black text-slate-950 uppercase tracking-widest mb-3 flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
              Hardware Alert status
            </h3>

            {activeTableAlert !== null ? (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto animate-bounce" />
                <div>
                  <h4 className="text-sm font-black text-rose-950">Table {activeTableAlert} Dishes Ready</h4>
                  <p className="text-[11px] text-rose-700/80 mt-0.5">Physical buzzer pins would be emitting 2500Hz pulses.</p>
                </div>
                <button
                  onClick={() => onHardwareReset(activeTableAlert)}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black text-xs py-2 rounded-xl cursor-pointer transition-all"
                >
                  Click Physical Reset (RST)
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-500">
                <p className="text-xs">No active food ready triggers.</p>
                <p className="text-[10px] text-slate-400 mt-1">When kitchen completes a dish, the alert will activate and light up here.</p>
              </div>
            )}
          </div>

          {/* Quick Guide and Commands card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-black text-slate-950 uppercase tracking-widest mb-2.5">
              Available Serial Commands
            </h3>
            <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
              Interact directly with the ESP32 chip by typing these custom serial commands into the Send input:
            </p>

            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between items-start border-b border-slate-100 pb-1.5">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-bold">HELP</span>
                <span className="text-slate-500 text-[11px] text-right">Lists instructions</span>
              </div>
              <div className="flex justify-between items-start border-b border-slate-100 pb-1.5">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-bold">RST</span>
                <span className="text-slate-500 text-[11px] text-right">Silences/clears table alert</span>
              </div>
              <div className="flex justify-between items-start border-b border-slate-100 pb-1.5">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-bold">STATUS</span>
                <span className="text-slate-500 text-[11px] text-right">Prints hardware diagnostics</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-bold">IP</span>
                <span className="text-slate-500 text-[11px] text-right">Prints local DHCP lease</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Dynamic Arduino Code for Physical ESP32 Hardware */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm mt-6" id="arduino-firmware-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <Cpu className="w-5 h-5" />
              </span>
              <h2 className="text-md font-black text-slate-950">
                Arduino C++ Sketch for Physical ESP32
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload this code to your physical ESP32. It connects to your Wi-Fi network, queries your secure Cloud Run server, and prints the table numbers in real-time to your laptop's <strong>Serial Monitor</strong>.
            </p>
          </div>
          
          <button
            onClick={handleCopyCode}
            className={`flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-xl font-black transition-all cursor-pointer shadow-sm shrink-0 ${
              copied
                ? 'bg-emerald-600 text-white shadow-emerald-100'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-100'
            }`}
          >
            {copied ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Copied Code!</span>
              </>
            ) : (
              <>
                <Cpu className="w-3.5 h-3.5" />
                <span>Copy Arduino C++ Code</span>
              </>
            )}
          </button>
        </div>

        <div className="relative">
          <div className="absolute top-3 right-3 text-[10px] font-mono text-slate-500 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
            C++ (Arduino IDE)
          </div>
          <pre className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-[320px] shadow-inner text-left">
            <code>{arduinoCode}</code>
          </pre>
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 space-y-1">
            <p className="font-extrabold text-slate-900">Why was your ESP32 returning HTTP Error Code: -1?</p>
            <p className="leading-relaxed">
              When querying an <strong>HTTPS (secure)</strong> URL like your Google Cloud Run instance, the standard <code>WiFiClient</code> fails. 
              The ESP32 requires SSL handshakes. In the code above, we use <code>WiFiClientSecure</code> and call <code>client.setInsecure()</code>. 
              This tells the ESP32 to trust the Cloud Run server's secure endpoint directly and resolves the <strong>-1 error code</strong> completely!
            </p>
          </div>
        </div>
      </div>

      {/* Real-time Ecosystem Link Router */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl py-2.5 px-4 flex flex-wrap md:flex-nowrap items-center justify-center gap-3 md:gap-5 z-40 max-w-[95%] w-max text-slate-800" id="ecosystem-router">
        <div className="flex items-center gap-1.5 shrink-0 border-r border-slate-200 pr-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-500">Live Server Ecosystem</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1 md:gap-2 text-[10px] md:text-xs font-bold">
          <a href="/" className="text-slate-600 hover:text-indigo-600 hover:bg-slate-50 px-2.5 py-1 rounded-lg transition-all">
            📱 Customer Website (/)
          </a>
        </div>
      </div>
    </div>
  );
}
