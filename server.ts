import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Enable CORS for cross-device or cross-origin connections
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Disable caching for all API endpoints to guarantee real-time data accuracy across all devices
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// --- Core Shared State (Simulated database) ---
let categories = [
  { id: "cat-1", name: "Starters & Appetizers", slug: "starters" },
  { id: "cat-2", name: "Main Course", slug: "mains" },
  { id: "cat-3", name: "Desserts & Sweets", slug: "desserts" },
  { id: "cat-4", name: "Beverages & Mocktails", slug: "beverages" },
];

let foods = [
  {
    id: "food-1",
    name: "Tandoori Paneer Tikka",
    category: "starters",
    price: 280,
    isVeg: true,
    isAvailable: true,
    image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=500&auto=format&fit=crop&q=60",
    description: "Cottage cheese cubes marinated in spiced yogurt and grilled in clay oven with bell peppers.",
    cookingTime: 12
  },
  {
    id: "food-2",
    name: "Crispy Spring Rolls",
    category: "starters",
    price: 180,
    isVeg: true,
    isAvailable: true,
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=60",
    description: "Hand-rolled crispy wrapper stuffed with seasoned sautéed crunchy fresh vegetables.",
    cookingTime: 10
  },
  {
    id: "food-3",
    name: "Classic Butter Chicken",
    category: "mains",
    price: 380,
    isVeg: false,
    isAvailable: true,
    image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&auto=format&fit=crop&q=60",
    description: "Tandoori grilled chicken shreds cooked in smooth, rich, buttery tomato gravy.",
    cookingTime: 18
  },
  {
    id: "food-4",
    name: "Paneer Butter Masala",
    category: "mains",
    price: 320,
    isVeg: true,
    isAvailable: true,
    image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=60",
    description: "Fresh cottage cheese chunks in rich and creamy spiced onion-tomato gravy with butter.",
    cookingTime: 15
  },
  {
    id: "food-5",
    name: "Sizzling Chocolate Brownie",
    category: "desserts",
    price: 190,
    isVeg: true,
    isAvailable: true,
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=60",
    description: "Warm fudgy chocolate brownie served with cold vanilla scoop on a sizzling hot metal plate.",
    cookingTime: 8
  },
  {
    id: "food-6",
    name: "Mango Mint Virgin Mojito",
    category: "beverages",
    price: 140,
    isVeg: true,
    isAvailable: true,
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=60",
    description: "Refreshing crushed ice drink with sweet ripe mango chunks, fresh lime juice, and fresh mint leaves.",
    cookingTime: 5
  }
];

function getFormattedDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

let orders: any[] = [];

let mqttLog: any[] = [];

let activeAlertTable: number | null = null;

let diningTables = [1, 2, 3, 4, 5, 6, 7, 8];

// --- SSE Client Array ---
let sseClients: any[] = [];

function broadcastSSE(event: string, data: any) {
  console.log(`[SSE Server] Broadcasting event "${event}" to ${sseClients.length} clients`);
  const activeClients: any[] = [];
  sseClients.forEach((client, idx) => {
    try {
      client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof client.flush === "function") {
        client.flush();
      }
      activeClients.push(client);
    } catch (err) {
      console.error(`[SSE Server] Error writing event "${event}" to client ${idx}, pruning client:`, err);
    }
  });
  sseClients = activeClients;
}

// Heartbeat Keep-Alive Mechanism
// Many cloud load balancers and proxies (e.g. Cloud Run, Nginx, GCLB) close connections 
// if no data is received within 30 seconds. A periodic 15s ping keeps the socket active.
setInterval(() => {
  if (sseClients.length > 0) {
    console.log(`[SSE Server] Sending keep-alive heartbeat to ${sseClients.length} connected clients...`);
    const activeClients: any[] = [];
    sseClients.forEach((client, idx) => {
      try {
        client.write(`event: ping\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);
        if (typeof client.flush === "function") {
          client.flush();
        }
        activeClients.push(client);
      } catch (err) {
        console.error(`[SSE Server] Error sending heartbeat to client ${idx}, pruning client:`, err);
      }
    });
    sseClients = activeClients;
  }
}, 15000);

// --- API Router Endpoints ---

// Live Server-Sent Events Endpoint
app.get("/api/orders/stream", (req, res) => {
  console.log('[SSE Server] New client connection request from:', req.ip || req.headers['x-forwarded-for']);
  
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform, private, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Keep-Alive", "timeout=120");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Content-Encoding", "none"); // Disable compression proxy buffering
  res.flushHeaders();

  // Instruct client to retry after 5 seconds if connection is broken
  res.write("retry: 5000\n\n");

  sseClients.push(res);
  console.log(`[SSE Server] Client registered. Total clients: ${sseClients.length}`);
  
  // Send initial connected event to acknowledge registration
  try {
    res.write(`event: connected\ndata: ${JSON.stringify({ status: "active", clientCount: sseClients.length })}\n\n`);
    if (typeof (res as any).flush === "function") {
      (res as any).flush();
    }
  } catch (err) {
    console.error('[SSE Server] Failed to write initial connection message:', err);
  }

  req.on("close", () => {
    sseClients = sseClients.filter(client => client !== res);
    console.log(`[SSE Server] Client connection closed. Remaining clients: ${sseClients.length}`);
  });
});

// GET Menu (Categories and Foods)
app.get("/api/system-info", (req, res) => {
  if (process.env.RENDER_EXTERNAL_URL) {
    return res.json({ publicUrl: process.env.RENDER_EXTERNAL_URL });
  }
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  res.json({ publicUrl: `${protocol}://${host}` });
});

// GET Tables
app.get("/api/tables", (req, res) => {
  res.json(diningTables);
});

// POST Table
app.post("/api/tables", (req, res) => {
  const { table } = req.body;
  const num = parseInt(table);
  if (isNaN(num) || num < 1) {
    return res.status(400).json({ error: "Invalid table number" });
  }
  if (diningTables.includes(num)) {
    return res.status(400).json({ error: "Table already exists" });
  }
  diningTables.push(num);
  diningTables.sort((a, b) => a - b);
  broadcastSSE("TABLES_UPDATED", diningTables);
  res.status(201).json(diningTables);
});

// GET Menu (Categories and Foods)
app.get("/api/menu", (req, res) => {
  res.json({ categories, foods });
});

// POST Food Item (Create / Edit)
app.post("/api/menu/food", (req, res) => {
  const foodData = req.body;
  if (!foodData.name || !foodData.category || !foodData.price) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (foodData.id) {
    // Update
    const idx = foods.findIndex(f => f.id === foodData.id);
    if (idx !== -1) {
      foods[idx] = {
        ...foods[idx],
        ...foodData,
        price: parseFloat(foodData.price),
        cookingTime: parseInt(foodData.cookingTime || "10")
      };
      return res.json({ success: true, food: foods[idx] });
    }
  }

  // Create
  const newFood = {
    id: "food-" + Math.random().toString(36).substr(2, 9),
    name: foodData.name,
    category: foodData.category,
    price: parseFloat(foodData.price),
    isVeg: !!foodData.isVeg,
    isAvailable: foodData.isAvailable !== undefined ? !!foodData.isAvailable : true,
    image: foodData.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60",
    description: foodData.description || "",
    cookingTime: parseInt(foodData.cookingTime || "10")
  };
  foods.push(newFood);
  res.status(201).json({ success: true, food: newFood });
});

// DELETE Food Item
app.delete("/api/menu/food/:id", (req, res) => {
  const { id } = req.params;
  foods = foods.filter(f => f.id !== id);
  res.json({ success: true });
});

// POST Category
app.post("/api/menu/category", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const newCat = {
    id: "cat-" + Math.random().toString(36).substr(2, 9),
    name,
    slug
  };
  categories.push(newCat);
  res.status(201).json({ success: true, category: newCat });
});

// GET Orders
app.get("/api/orders", (req, res) => {
  res.json(orders);
});

// GET Historical Orders
const historicalOrders = [
  {
    id: "ord-old-1",
    orderNumber: "ORD-1001",
    table: 3,
    time: "12:15 PM",
    date: "2026-07-13",
    items: [
      { id: "food-1", name: "Tandoori Paneer Tikka", price: 280, quantity: 1, isVeg: true, specialInstructions: "Extra green chutney", isReady: true },
      { id: "food-6", name: "Mango Mint Virgin Mojito", price: 140, quantity: 2, isVeg: true, isReady: true }
    ],
    status: "Delivered",
    totalPrice: 560,
    specialInstructions: "Please serve beverages first"
  },
  {
    id: "ord-old-2",
    orderNumber: "ORD-1002",
    table: 5,
    time: "12:30 PM",
    date: "2026-07-13",
    items: [
      { id: "food-3", name: "Classic Butter Chicken", price: 380, quantity: 2, isVeg: false, isReady: true },
      { id: "food-4", name: "Paneer Butter Masala", price: 320, quantity: 1, isVeg: true, isReady: true }
    ],
    status: "Delivered",
    totalPrice: 1080,
    specialInstructions: ""
  },
  {
    id: "ord-old-3",
    orderNumber: "ORD-1003",
    table: 8,
    time: "12:38 PM",
    date: "2026-07-13",
    items: [
      { id: "food-2", name: "Crispy Spring Rolls", price: 180, quantity: 1, isVeg: true, isReady: true },
      { id: "food-5", name: "Sizzling Chocolate Brownie", price: 190, quantity: 1, isVeg: true, isReady: true }
    ],
    status: "Delivered",
    totalPrice: 370,
    specialInstructions: "Brownie after main meal"
  }
];

app.get("/api/orders/history", (req, res) => {
  res.json(historicalOrders);
});

// POST Order
app.post("/api/orders", (req, res) => {
  const { table, items, totalPrice, specialInstructions } = req.body;
  if (!table || !items || !items.length) {
    return res.status(400).json({ error: "Missing table or food items" });
  }

  const date = new Date();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = getFormattedDate(date);

  const nextNum = 1001 + orders.length;
  const newOrder = {
    id: "ord-" + Math.random().toString(36).substr(2, 9),
    orderNumber: `ORD-${nextNum}`,
    table: parseInt(table),
    time: timeStr,
    date: dateStr,
    items: items.map((i: any) => ({
      id: i.id,
      name: i.name,
      price: parseFloat(i.price),
      quantity: parseInt(i.quantity),
      isVeg: !!i.isVeg,
      specialInstructions: i.specialInstructions || "",
      isReady: false,
      status: "Waiting"
    })),
    status: "Waiting" as const,
    totalPrice: parseFloat(totalPrice),
    specialInstructions: specialInstructions || ""
  };

  orders.push(newOrder);

  // Broadcast event
  broadcastSSE("ORDER_CREATED", newOrder);

  res.status(201).json(newOrder);
});

// POST Order Status
app.post("/api/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ["Waiting", "Cooking", "Ready", "Delivered"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  order.status = status as any;

  // Trigger simulated ESP32 MQTT ready alert if marked Ready
  if (status === "Ready") {
    activeAlertTable = order.table;
    const date = new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    mqttLog.unshift({
      table: order.table,
      status: "READY",
      timestamp: timeStr
    });
  }

  // Clear simulated active alert if delivered
  if (status === "Delivered" && activeAlertTable === order.table) {
    activeAlertTable = null;
    const date = new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    mqttLog.unshift({
      table: order.table,
      status: "RESET",
      timestamp: timeStr
    });
  }

  // Broadcast
  broadcastSSE("ORDER_STATUS_CHANGED", {
    orderId: id,
    table: order.table,
    status,
    order
  });

  res.json({ success: true, order });
});

// POST Order Item Readiness (Worker Checkbox)
app.post("/api/orders/:id/items/:itemId/ready", (req, res) => {
  const { id, itemId } = req.params;
  const { isReady } = req.body;

  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const item = order.items.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Item not found in order" });

  item.isReady = !!isReady;
  (item as any).status = isReady ? 'Ready' : 'Waiting';

  // Auto transition order status
  const allReady = order.items.every(i => i.isReady || (i as any).status === 'Ready');
  if (allReady && order.status !== 'Ready' && order.status !== 'Delivered') {
    order.status = 'Ready';
    activeAlertTable = order.table;
    const date = new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    mqttLog.unshift({
      table: order.table,
      status: "READY",
      timestamp: timeStr
    });
  } else if (!allReady && order.status === 'Ready') {
    order.status = 'Cooking';
    if (activeAlertTable === order.table) {
      activeAlertTable = null;
    }
  } else if (!allReady && order.items.some(i => (i as any).status === 'Cooking' || i.isReady) && order.status === 'Waiting') {
    order.status = 'Cooking';
  }

  // Broadcast update
  broadcastSSE("ORDER_STATUS_CHANGED", {
    orderId: id,
    table: order.table,
    status: order.status,
    order
  });

  res.json({ success: true, order });
});

// POST Order Item Status (Kitchen Dashboard Selection)
app.post("/api/orders/:id/items/:itemId/status", (req, res) => {
  const { id, itemId } = req.params;
  const { status } = req.body;

  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const item = order.items.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Item not found in order" });

  (item as any).status = status;
  item.isReady = status === 'Ready';

  // Auto transition order status
  const allReady = order.items.every(i => i.isReady || (i as any).status === 'Ready');
  if (allReady && order.status !== 'Ready' && order.status !== 'Delivered') {
    order.status = 'Ready';
    activeAlertTable = order.table;
    const date = new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    mqttLog.unshift({
      table: order.table,
      status: "READY",
      timestamp: timeStr
    });
  } else if (!allReady && order.status === 'Ready') {
    order.status = 'Cooking';
    if (activeAlertTable === order.table) {
      activeAlertTable = null;
    }
  } else if (!allReady && order.items.some(i => (i as any).status === 'Cooking' || i.isReady) && order.status === 'Waiting') {
    order.status = 'Cooking';
  }

  // Broadcast update
  broadcastSSE("ORDER_STATUS_CHANGED", {
    orderId: id,
    table: order.table,
    status: order.status,
    order
  });

  res.json({ success: true, order });
});

// GET MQTT Poll (ESP32 Simulator)
app.get("/api/mqtt/poll", (req, res) => {
  res.json({
    activeAlertTable,
    log: mqttLog
  });
});

// GET Simple Active Table for ESP32 (Plain Text)
app.get("/api/esp32/active-table", (req, res) => {
  res.send(activeAlertTable ? activeAlertTable.toString() : "0");
});

// POST Manual MQTT Instruction
app.post("/api/mqtt/instruct", (req, res) => {
  const { table } = req.body;
  const tableNum = parseInt(table);
  if (isNaN(tableNum) || tableNum < 1) {
    return res.status(400).json({ error: "Invalid table number" });
  }

  activeAlertTable = tableNum;
  const date = new Date();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  mqttLog.unshift({
    table: tableNum,
    status: "READY",
    timestamp: timeStr
  });

  // Broadcast event
  broadcastSSE("ORDER_STATUS_CHANGED", {
    status: "Ready",
    table: tableNum,
    manual: true
  });

  res.json({ success: true, activeAlertTable });
});

// POST MQTT Reset
app.post("/api/mqtt/reset", (req, res) => {
  const { table } = req.body;
  if (activeAlertTable === parseInt(table)) {
    activeAlertTable = null;
  }
  const date = new Date();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  mqttLog.unshift({
    table: parseInt(table),
    status: "RESET",
    timestamp: timeStr
  });

  broadcastSSE("MQTT_RESET", { table: parseInt(table) });
  res.json({ success: true });
});

// GET Analytics Metrics
app.get("/api/analytics", (req, res) => {
  // Simple calculated metrics
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
  
  // Popular foods counts
  const itemCounts: Record<string, { count: number; sales: number; isVeg: boolean }> = {};
  orders.forEach(o => {
    o.items.forEach(item => {
      if (!itemCounts[item.name]) {
        itemCounts[item.name] = { count: 0, sales: 0, isVeg: item.isVeg };
      }
      itemCounts[item.name].count += item.quantity;
      itemCounts[item.name].sales += item.price * item.quantity;
    });
  });

  const popularItems = Object.entries(itemCounts)
    .map(([name, val]) => ({
      name,
      count: val.count,
      sales: parseFloat(val.sales.toFixed(2)),
      isVeg: val.isVeg
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Daily and monthly totals
  const todayStr = getFormattedDate(new Date());
  const todayOrders = orders.filter(o => o.date === todayStr);
  const dailySales = todayOrders.reduce((sum, o) => sum + o.totalPrice, 0);
  const monthlySales = orders.reduce((sum, o) => sum + o.totalPrice, 0);

  // Dynamic sales trend for charts (last 7 days, formatted with leading zero, starting with zero if no sales)
  const salesTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = getFormattedDate(d);
    
    const dayOrders = orders.filter(o => o.date === dateStr);
    const dayRevenue = dayOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    
    salesTrend.push({
      date: dateStr,
      amount: parseFloat(dayRevenue.toFixed(2))
    });
  }

  res.json({
    dailySales: parseFloat(dailySales.toFixed(2)),
    monthlySales: parseFloat(monthlySales.toFixed(2)),
    totalOrders,
    popularItems,
    salesTrend
  });
});

// --- Server-Side Vite and Production Config ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite in development middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve build files in production mode
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    const baseUri = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    console.log("\n");
    console.log("=========================================================================");
    console.log("🚀  BITEEXPRESS SMART RESTAURANT DEPLOYED & ONLINE!");
    console.log("=========================================================================");
    console.log("");
    console.log("🔗 STANDALONE APPLICATIONS ACCESS LINKS:");
    console.log("-------------------------------------------------------------------------");
    console.log("🌐 1. CUSTOMER WEBSITE / DIGITAL QR ORDERING APP:");
    console.log(`   👉  ${baseUri}/`);
    console.log("");
    console.log("🍳 2. KITCHEN COMMAND DASHBOARD:");
    console.log(`   👉  ${baseUri}/kitchen`);
    console.log("");
    console.log("📟 3. ESP32 MICROCONTROLLER HARDWARE SIMULATOR:");
    console.log(`   👉  ${baseUri}/esp32`);
    console.log("-------------------------------------------------------------------------");
    console.log(`   Backend server listening on host 0.0.0.0, port ${PORT}`);
    console.log("=========================================================================\n");
  });
}

startServer();
