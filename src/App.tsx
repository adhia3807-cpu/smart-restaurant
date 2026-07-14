import React, { useState, useEffect, useRef } from 'react';
import { FoodItem, Category, Order, OrderStatus } from './types';
import CustomerApp from './components/CustomerApp';
import KitchenDashboard from './components/KitchenDashboard';
import ESP32Simulator from './components/ESP32Simulator';
import AdminGuard from './components/AdminGuard';
import AdminHub from './components/AdminHub';
import { 
  ShoppingBag, ChefHat, Compass, Cpu, BellRing, LogOut, Lock
} from 'lucide-react';

type SimulatedRole = 'customer' | 'kitchen' | 'esp32';

export default function App() {
  const [activeRole, setActiveRole] = useState<SimulatedRole>('customer');
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Parse and track URL search params
  const [currentSearch, setCurrentSearch] = useState(window.location.search);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      setCurrentSearch(window.location.search);
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('pushstate_changed', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('pushstate_changed', handleLocationChange);
    };
  }, []);

  const navigateTo = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    setCurrentPath(window.location.pathname);
    setCurrentSearch(window.location.search);
    window.dispatchEvent(new Event('pushstate_changed'));
  };

  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Secure Admin Authentication state (for 'app accessible by me')
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('adminAuth') === 'true';
  });

  const handleAdminSignOut = () => {
    localStorage.removeItem('adminAuth');
    setIsAdminAuthenticated(false);
  };

  // Helper to parse table parameter from current search
  const getTableFromQuery = (searchStr: string) => {
    const params = new URLSearchParams(searchStr);
    const tbl = params.get('table');
    return tbl ? parseInt(tbl) : null;
  };

  const [activeTable, setActiveTable] = useState<number>(() => {
    const urlTable = getTableFromQuery(window.location.search);
    if (urlTable) {
      localStorage.setItem('activeTable', urlTable.toString());
      return urlTable;
    }
    const saved = localStorage.getItem('activeTable');
    return saved ? parseInt(saved) : 5;
  });

  // Keep table synchronized if search params change
  useEffect(() => {
    const urlTable = getTableFromQuery(currentSearch);
    if (urlTable && urlTable !== activeTable) {
      setActiveTable(urlTable);
    }
  }, [currentSearch]);
  const [currentCustomerOrder, setCurrentCustomerOrder] = useState<Order | null>(null);
  const [activeTableAlert, setActiveTableAlert] = useState<number | null>(null);
  const [mqttLog, setMqttLog] = useState<any[]>([]);
  const [serverConnected, setServerConnected] = useState(true);

  // Keep references to active order for realtime updates
  const activeCustomerOrderRef = useRef<Order | null>(null);
  activeCustomerOrderRef.current = currentCustomerOrder;

  // Fetch Menu
  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        setFoods(data.foods);
        setCategories(data.categories);
      }
    } catch (e) {
      console.warn('Menu sync warning (will retry):', e);
      setServerConnected(false);
    }
  };

  // Fetch Orders
  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        
        // Sync active tracking order with localStorage backup
        const savedOrderId = localStorage.getItem('activeCustomerOrderId');
        const activeOrderId = activeCustomerOrderRef.current?.id || savedOrderId;
        
        if (activeOrderId) {
          const freshOrder = data.find((o: Order) => o.id === activeOrderId);
          if (freshOrder) {
            setCurrentCustomerOrder(freshOrder);
          } else if (savedOrderId && !activeCustomerOrderRef.current) {
            // Saved order is no longer on the server (e.g. server was restarted or reset)
            localStorage.removeItem('activeCustomerOrderId');
          }
        }
      }
    } catch (e) {
      console.warn('Orders sync warning (will retry):', e);
    }
  };

  // Manual Refresh Helper for dashboard syncing
  const handleManualRefresh = async () => {
    try {
      await fetchOrders();
      await fetchMqtt();
    } catch (e) {
      console.warn('Manual refresh warning:', e);
    }
  };

  // Fetch MQTT Simulation status
  const fetchMqtt = async () => {
    try {
      const res = await fetch('/api/mqtt/poll');
      if (res.ok) {
        const data = await res.json();
        setActiveTableAlert(data.activeAlertTable);
        setMqttLog(data.log);
      }
    } catch (e) {
      console.warn('MQTT state sync warning (will retry):', e);
    }
  };

  // Setup EventSource for Instant Pushes and backup Polling Timer
  useEffect(() => {
    fetchMenu();
    fetchOrders();
    fetchMqtt();

        // 1. Instant Real-time Pushes via Server-Sent Events (SSE)
    console.log('[SSE] Attempting to connect to SSE stream: /api/orders/stream');
    const eventSource = new EventSource('/api/orders/stream');
    let disconnectTimer: any = null;

    eventSource.onopen = (e) => {
      console.log('[SSE] Connection opened successfully. readyState:', eventSource.readyState);
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
      setServerConnected(true);
    };

    eventSource.onerror = (err) => {
      console.warn('[SSE] Connection error/reconnect occurred. readyState:', eventSource.readyState);
      if (eventSource.readyState === EventSource.CLOSED) {
        setServerConnected(false);
      } else {
        // It is in CONNECTING state, trying to auto-reconnect.
        // Give it a 5-second grace period before displaying a disconnected indicator.
        if (!disconnectTimer) {
          disconnectTimer = setTimeout(() => {
            if (eventSource.readyState !== EventSource.OPEN) {
              setServerConnected(false);
            }
          }, 5000);
        }
      }
    };

    eventSource.onmessage = (e) => {
      console.log('[SSE] Default message received:', e.data);
    };

    eventSource.addEventListener('connected', (e: any) => {
      console.log('[SSE] Received "connected" event from server:', e.data);
    });

    eventSource.addEventListener('ping', (e: any) => {
      console.log('[SSE] Received heartbeat "ping" event:', e.data);
    });

    eventSource.addEventListener('ORDER_CREATED', (e: any) => {
      console.log('[SSE] Received "ORDER_CREATED" event:', e.data);
      try {
        const newOrder = JSON.parse(e.data);
        console.log('[SSE] Parsed ORDER_CREATED order:', newOrder);
        setOrders(prev => {
          if (prev.some(o => o.id === newOrder.id)) {
            console.log(`[SSE] Order with ID ${newOrder.id} already exists in client state. Skipping append.`);
            return prev;
          }
          return [...prev, newOrder];
        });
      } catch (err) {
        console.error('[SSE] Failed to parse ORDER_CREATED payload:', err);
      }
    });

    eventSource.addEventListener('ORDER_STATUS_CHANGED', (e: any) => {
      console.log('[SSE] Received "ORDER_STATUS_CHANGED" event:', e.data);
      try {
        const payload = JSON.parse(e.data);
        console.log('[SSE] Parsed ORDER_STATUS_CHANGED payload:', payload);
        setOrders(prev => prev.map(o => o.id === payload.orderId ? { ...o, status: payload.status, items: (payload.order && payload.order.items) ? payload.order.items : o.items } : o));
        
        if (activeCustomerOrderRef.current && activeCustomerOrderRef.current.id === payload.orderId) {
          console.log('[SSE] Active customer order status updated. New order object:', payload.order);
          setCurrentCustomerOrder(payload.order);
        }
        
        // Fetch MQTT state since statuses trigger alerts
        fetchMqtt();
      } catch (err) {
        console.error('[SSE] Failed to parse ORDER_STATUS_CHANGED payload:', err);
      }
    });

    eventSource.addEventListener('MQTT_RESET', () => {
      console.log('[SSE] Received "MQTT_RESET" event. Triggering MQTT poll...');
      fetchMqtt();
    });

    // 2. Regular background backup polling timer (runs every 3.5 seconds)
    const backupTimer = setInterval(() => {
      fetchOrders();
      fetchMqtt();
    }, 3500);

    return () => {
      eventSource.close();
      clearInterval(backupTimer);
    };
  }, []);

  // Place order
  const handlePlaceOrder = async (orderData: { table: number; items: any[]; totalPrice: number; specialInstructions: string }) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      if (res.ok) {
        const order = await res.json();
        setCurrentCustomerOrder(order);
        localStorage.setItem('activeCustomerOrderId', order.id); // Save tracking state
        setOrders(prev => {
          if (prev.some(o => o.id === order.id)) return prev;
          return [...prev, order];
        });
        return order;
      }
    } catch (e) {
      console.error('Order submission failed:', e);
      throw e;
    }
  };

  // Select/Scan table QR action
  const handleSelectTable = (tableNum: number) => {
    setActiveTable(tableNum);
    localStorage.setItem('activeTable', tableNum.toString());
    navigateTo(`?table=${tableNum}`);
  };

  // Update order status (Kitchen Actions)
  const handleUpdateStatus = async (id: string, status: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        await fetchOrders();
        await fetchMqtt();
      }
    } catch (e) {
      console.error('Status save failure:', e);
    }
  };

  // Toggle single food item ready checklist (Worker Checklist Actions)
  const handleToggleItemReady = async (orderId: string, itemId: string, isReady: boolean) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${itemId}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReady })
      });
      if (res.ok) {
        await fetchOrders();
      }
    } catch (e) {
      console.error('Checklist save failure:', e);
    }
  };

  // Update single food item status (Kitchen Selector Actions)
  const handleUpdateItemStatus = async (orderId: string, itemId: string, status: 'Waiting' | 'Cooking' | 'Ready') => {
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${itemId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        await fetchOrders();
      }
    } catch (e) {
      console.error('Item status save failure:', e);
    }
  };

  // Hardware Reset (ESP32 Alert Silencing)
  const handleHardwareReset = async (table: number) => {
    try {
      const res = await fetch('/api/mqtt/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table })
      });
      if (res.ok) {
        await fetchMqtt();
      }
    } catch (e) {
      console.error('Hardware reset transmission failed:', e);
    }
  };

  // Standalone Routing Render block
  const renderRouteContent = () => {
    // Check default role from query param or environment variable
    const queryParams = new URLSearchParams(window.location.search);
    const defaultRole = (queryParams.get('role') || (import.meta as any).env?.VITE_DEFAULT_ROLE || 'customer').toLowerCase();

    // Check if user is trying to access an Admin app
    const hasTableParam = queryParams.has('table');
    const isTryingToAccessAdmin = 
      (!hasTableParam && currentPath === '/') ||
      currentPath === '/app' ||
      currentPath === '/kitchen' || 
      currentPath === '/esp32' || 
      currentPath === '/serial' || 
      currentPath === '/sandbox' ||
      defaultRole === 'kitchen' ||
      defaultRole === 'esp32' ||
      defaultRole === 'serial';

    if (isTryingToAccessAdmin && !isAdminAuthenticated) {
      return <AdminGuard onSuccess={() => setIsAdminAuthenticated(true)} />;
    }

    if (currentPath === '/app' || (currentPath === '/' && !hasTableParam)) {
      return (
        <AdminHub
          orders={orders}
          activeTableAlert={activeTableAlert}
          onSignOut={handleAdminSignOut}
          navigateTo={navigateTo}
          serverConnected={serverConnected}
          onUpdateStatus={handleUpdateStatus}
          onToggleItemReady={handleToggleItemReady}
          onUpdateItemStatus={handleUpdateItemStatus}
          onRefresh={handleManualRefresh}
        />
      );
    }

    if (currentPath === '/kitchen') {
      return (
        <KitchenDashboard
          orders={orders}
          onUpdateStatus={handleUpdateStatus}
          onToggleItemReady={handleToggleItemReady}
          onUpdateItemStatus={handleUpdateItemStatus}
          onRefresh={handleManualRefresh}
          serverConnected={serverConnected}
          onSignOut={handleAdminSignOut}
        />
      );
    }

    if (currentPath === '/esp32' || currentPath === '/serial') {
      return (
        <ESP32Simulator
          activeTableAlert={activeTableAlert}
          mqttLog={mqttLog}
          onHardwareReset={handleHardwareReset}
          onSignOut={handleAdminSignOut}
        />
      );
    }

    if (currentPath === '/sandbox') {
      return (
        <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans text-slate-900" id="app-root">
          
          {/* LEFT NAVIGATION COLUMN: Eco Sandbox Control Panel */}
          <aside className="w-full lg:w-72 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between shrink-0" id="master-nav-sidebar">
            <div>
              {/* Brand header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest font-display">BiteExpress</h2>
                  <p className="text-[10px] text-indigo-600 font-bold">ECOSYSTEM SANDBOX</p>
                </div>
                {/* Status light & Logout */}
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5" title={serverConnected ? 'Local API connected' : 'Connecting to local API...'}>
                    <span className={`w-2 h-2 rounded-full ${serverConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400 animate-ping'}`}></span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase font-mono">{serverConnected ? 'Online' : 'Pending'}</span>
                  </div>
                  <button 
                    onClick={handleAdminSignOut}
                    className="text-[9px] text-slate-400 hover:text-rose-500 font-bold uppercase flex items-center gap-1 transition-colors cursor-pointer"
                    title="Lock Admin Portal"
                  >
                    <Lock className="w-2.5 h-2.5" />
                    <span>Lock</span>
                  </button>
                </div>
              </div>

              {/* Quick active hardware notifier overlay inside sidebar */}
              {activeTableAlert !== null && (
                <div className="m-4 bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3 items-start animate-pulse shadow-sm shadow-rose-200/50" id="sidebar-alert-indicator">
                  <BellRing className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-rose-600">MQTT Hardware Trigger</h4>
                    <p className="text-[10px] text-slate-600 mt-0.5">Table {activeTableAlert} dishes are ready! ESP32 console alerting active.</p>
                    <button 
                      onClick={() => setActiveRole('esp32')}
                      className="mt-2 text-[9px] font-bold text-indigo-600 hover:text-indigo-500 underline uppercase flex items-center gap-0.5 cursor-pointer"
                    >
                      Inspect Serial Monitor
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <nav className="p-4 space-y-4" id="nav-group">
                <div>
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest pl-2 block mb-2">Simulate Devices & Roles</span>
                  
                  <div className="space-y-1.5">
                    {[
                      { id: 'customer', label: 'Customer Web UI', icon: ShoppingBag, pathUrl: '/' },
                      { id: 'kitchen', label: 'Kitchen Android App', icon: ChefHat, pathUrl: '/kitchen' },
                      { id: 'esp32', label: 'ESP32 IoT Client', icon: Cpu, pathUrl: '/esp32' }
                    ].map(role => {
                      const Icon = role.icon;
                      const isSelected = activeRole === role.id;
                      
                      return (
                        <div key={role.id} className="space-y-1">
                          <button
                            onClick={() => setActiveRole(role.id as any)}
                            className={`w-full text-left py-3 px-4 rounded-xl flex items-center gap-3.5 transition-all text-xs font-bold cursor-pointer border ${
                              isSelected 
                                ? 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm' 
                                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                            }`}
                            id={`role-btn-${role.id}`}
                          >
                            <Icon className={`w-4.5 h-4.5 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <span>{role.label}</span>
                          </button>
                          
                          {/* Standalone URL hints */}
                          <div className="pl-12 pr-2">
                            <span 
                              onClick={() => navigateTo(role.pathUrl)} 
                              className="text-[10px] text-indigo-500 hover:text-indigo-600 hover:underline font-medium cursor-pointer block truncate"
                              title={`Click to open standalone route: ${role.pathUrl}`}
                            >
                              Open Standalone ↗
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </nav>
            </div>

            {/* Footer credits info */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 text-[10px] text-slate-500 flex flex-col gap-1">
              <div className="flex justify-between font-mono">
                <span>Broker:</span>
                <span className="text-indigo-600 font-bold">hivemq.com:1883</span>
              </div>
              <div className="flex justify-between font-mono">
                <span>WebSocket Port:</span>
                <span className="text-slate-600 font-bold">3000 (ws/stream)</span>
              </div>
            </div>
          </aside>

          {/* RIGHT WORKSPACE MODULE: Dynamically swaps based on Active Role */}
          <section className="flex-1 bg-slate-50 overflow-y-auto pb-20" id="main-role-stage">
            {activeRole === 'customer' && (
              <CustomerApp
                foods={foods}
                categories={categories}
                activeTable={activeTable}
                onTableChange={(tableNum) => {
                  setActiveTable(tableNum);
                  localStorage.setItem('activeTable', tableNum.toString());
                  navigateTo(`?table=${tableNum}`);
                }}
                onPlaceOrder={handlePlaceOrder}
                currentOrder={currentCustomerOrder}
                onResetTrackOrder={() => {
                  setCurrentCustomerOrder(null);
                  localStorage.removeItem('activeCustomerOrderId');
                }}
                showEcosystemBar={true}
                orders={orders}
              />
            )}

            {activeRole === 'kitchen' && (
              <KitchenDashboard
                orders={orders}
                onUpdateStatus={handleUpdateStatus}
                onToggleItemReady={handleToggleItemReady}
                onUpdateItemStatus={handleUpdateItemStatus}
                onRefresh={handleManualRefresh}
                serverConnected={serverConnected}
                onSignOut={handleAdminSignOut}
              />
            )}

            {activeRole === 'esp32' && (
              <ESP32Simulator
                activeTableAlert={activeTableAlert}
                mqttLog={mqttLog}
                onHardwareReset={handleHardwareReset}
                onSignOut={handleAdminSignOut}
              />
            )}
          </section>
        </div>
      );
    }

    // Default standalone route: '/' or '/customer' renders standard CustomerApp (website)
    // This dynamically renders the specified default role if set via VITE_DEFAULT_ROLE or ?role=...
    if (defaultRole === 'kitchen') {
      return (
        <KitchenDashboard
          orders={orders}
          onUpdateStatus={handleUpdateStatus}
          onToggleItemReady={handleToggleItemReady}
          onUpdateItemStatus={handleUpdateItemStatus}
          onRefresh={handleManualRefresh}
          serverConnected={serverConnected}
          onSignOut={handleAdminSignOut}
        />
      );
    }

    if (defaultRole === 'esp32' || defaultRole === 'serial') {
      return (
        <ESP32Simulator
          activeTableAlert={activeTableAlert}
          mqttLog={mqttLog}
          onHardwareReset={handleHardwareReset}
          onSignOut={handleAdminSignOut}
        />
      );
    }

    // QR checking for main Customer views
    if (!hasTableParam) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
          <p className="text-slate-400 font-bold mb-4">Please scan a tabletop QR code to view the menu and order.</p>
          <button 
            onClick={() => navigateTo('/app')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Open Restaurant App Portal
          </button>
        </div>
      );
    }

    return (
      <CustomerApp
        foods={foods}
        categories={categories}
        activeTable={activeTable}
        onTableChange={(tableNum) => {
          setActiveTable(tableNum);
          localStorage.setItem('activeTable', tableNum.toString());
          navigateTo(`?table=${tableNum}`);
        }}
        onPlaceOrder={handlePlaceOrder}
        currentOrder={currentCustomerOrder}
        onResetTrackOrder={() => {
          setCurrentCustomerOrder(null);
          localStorage.removeItem('activeCustomerOrderId');
        }}
        orders={orders}
      />
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 relative flex flex-col">
      {/* Dynamic Route Handler */}
      <div className="flex-1 flex flex-col min-h-0">
        {renderRouteContent()}
      </div>
    </div>
  );
}
