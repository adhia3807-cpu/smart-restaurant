import React, { useState, useMemo } from 'react';
import { Order, OrderStatus } from '../types';
import { Play, Check, Flame, Clock, ClipboardList, ChefHat, Volume2, VolumeX, AlertCircle, CheckSquare, Square, ChevronRight, RefreshCw, Lock } from 'lucide-react';

interface KitchenDashboardProps {
  orders: Order[];
  onUpdateStatus: (id: string, status: OrderStatus) => Promise<any>;
  onToggleItemReady?: (orderId: string, itemId: string, isReady: boolean) => Promise<any>;
  onUpdateItemStatus?: (orderId: string, itemId: string, status: 'Waiting' | 'Cooking' | 'Ready') => Promise<any>;
  onRefresh?: () => Promise<any>;
  serverConnected?: boolean;
  onSignOut?: () => void;
}

export default function KitchenDashboard({ 
  orders, 
  onUpdateStatus, 
  onToggleItemReady, 
  onUpdateItemStatus,
  onRefresh,
  serverConnected = true,
  onSignOut
}: KitchenDashboardProps) {
  const [activeTab, setActiveTab] = useState<OrderStatus | 'All'>('Waiting');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedItemState, setSelectedItemState] = useState<{ orderId: string; itemId: string; status: 'Waiting' | 'Cooking' | 'Ready' } | null>(null);

  const handleRefreshClick = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      playStateBeep(520);
      try {
        await onRefresh();
      } catch (err) {
        console.error(err);
      } finally {
        setTimeout(() => setIsRefreshing(false), 600);
      }
    }
  };

  // Play beep sound for state changes
  const playStateBeep = (freq = 440) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn('Audio Context block:', e);
    }
  };

  const filteredOrders = useMemo(() => {
    if (activeTab === 'All') return orders;
    return orders.filter(o => o.status === activeTab);
  }, [orders, activeTab]);

  const handleAction = async (id: string, status: OrderStatus, soundFreq: number) => {
    playStateBeep(soundFreq);
    await onUpdateStatus(id, status);
  };

  const stats = useMemo(() => {
    return {
      waiting: orders.filter(o => o.status === 'Waiting').length,
      cooking: orders.filter(o => o.status === 'Cooking').length,
      ready: orders.filter(o => o.status === 'Ready').length,
      delivered: orders.filter(o => o.status === 'Delivered').length,
    };
  }, [orders]);

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 p-4 md:p-6 pb-24" id="kitchen-dashboard-root">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-100">
            <ChefHat className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2 text-slate-800">
              Kitchen Command App <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded-full font-mono uppercase font-bold">Android View</span>
            </h1>
            <p className="text-xs text-slate-500">Manage ongoing cooking lines and publish instant ready notifications.</p>
          </div>
        </div>

        {/* Audio control & Quick Stats */}
        <div className="flex flex-wrap items-center gap-2.5">
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-bold transition-all active:scale-[0.98] cursor-pointer"
              title="Lock and Secure Admin Portal"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Admin</span>
            </button>
          )}

          {/* Real-time Connection Status */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold ${
            serverConnected 
              ? 'bg-emerald-50/70 border-emerald-100 text-emerald-700' 
              : 'bg-rose-50 border-rose-100 text-rose-700 animate-pulse'
          }`} id="kitchen-connection-status">
            <span className={`w-2 h-2 rounded-full ${
              serverConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}></span>
            <span>{serverConnected ? 'Live Connection' : 'Offline'}</span>
          </div>

          {/* Sync Now manual action */}
          {onRefresh && (
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-600 font-bold transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              id="kitchen-manual-refresh"
              title="Manually sync kitchen orders from server"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}

          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              playStateBeep(520);
            }}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              soundEnabled 
                ? 'bg-indigo-50 border-indigo-100 text-indigo-600 font-bold' 
                : 'bg-slate-100 border-slate-200 text-slate-400'
            }`}
            id="kitchen-sound-toggle"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>Kitchen Bell: {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Tabs list with stats bubbles */}
      <div className="flex gap-2.5 overflow-x-auto pb-4 border-b border-slate-200 mb-6" id="kitchen-tabs-container">
        {[
          { key: 'Waiting', label: 'Order Received', count: stats.waiting, color: 'bg-rose-500 text-white border-rose-500/30' },
          { key: 'Cooking', label: 'Cooking', count: stats.cooking, color: 'bg-amber-500 text-white border-amber-500/30' },
          { key: 'Ready', label: 'Ready', count: stats.ready, color: 'bg-blue-500 text-white border-blue-500/30' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide flex items-center gap-2 border transition-all cursor-pointer ${
              activeTab === tab.key
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-100'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === tab.key ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Kitchen Grid Content */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-3xl bg-white shadow-sm max-w-lg mx-auto">
          <ChefHat className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-sm font-extrabold text-slate-500">No Orders in this Section</h3>
          <p className="text-xs text-slate-400 mt-1">Incoming orders from table scans will appear here instantly with alerts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="kitchen-orders-grid">
          {filteredOrders.map(order => {
            const readyItemsCount = order.items.filter(item => item.isReady).length;
            const totalItemsCount = order.items.length;
            const allItemsReady = readyItemsCount === totalItemsCount;

            return (
              <div 
                key={order.id} 
                className={`bg-white rounded-2xl border-y border-r border-slate-200 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-slate-300 transition-all ${
                  order.status === 'Waiting' ? 'border-l-4 border-l-rose-500' :
                  order.status === 'Cooking' ? 'border-l-4 border-l-amber-500' :
                  order.status === 'Ready' ? 'border-l-4 border-l-blue-500' :
                  'border-l-4 border-l-slate-400'
                }`}
                id={`kitchen-order-${order.id}`}
              >
                {/* Card Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 rounded-t-2xl">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-lg text-slate-800">Table {order.table}</span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        order.status === 'Waiting' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                        order.status === 'Cooking' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        order.status === 'Ready' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {order.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-400 font-bold mt-0.5">Order: {order.orderNumber}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-500 text-xs font-bold flex items-center gap-1 justify-end">
                      <Clock className="w-3.5 h-3.5" />
                      {order.time}
                    </span>
                    <span className="text-indigo-600 font-black text-sm">₹{order.totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="p-4 flex-1 space-y-3">
                  <div className="space-y-1 divide-y divide-slate-100">
                    {order.items.map(item => {
                      const canToggle = !!onUpdateItemStatus && (order.status === 'Waiting' || order.status === 'Cooking' || order.status === 'Ready');
                      const itemStatus = (item as any).status || (item.isReady ? 'Ready' : 'Waiting');
                      const isCurrentSelection = selectedItemState?.orderId === order.id && selectedItemState?.itemId === item.id;

                      const handleCycleStatus = async () => {
                        if (!canToggle || !onUpdateItemStatus) return;
                        let nextStatus: 'Waiting' | 'Cooking' | 'Ready' = 'Waiting';
                        if (itemStatus === 'Waiting') nextStatus = 'Cooking';
                        else if (itemStatus === 'Cooking') nextStatus = 'Ready';
                        else if (itemStatus === 'Ready') nextStatus = 'Waiting';

                        playStateBeep(nextStatus === 'Ready' ? 880 : nextStatus === 'Cooking' ? 580 : 330);
                        await onUpdateItemStatus(order.id, item.id, nextStatus);
                      };

                      return (
                        <div key={item.id} className="pt-2 first:pt-0">
                          <div 
                            onClick={() => {
                              if (canToggle) {
                                setSelectedItemState({
                                  orderId: order.id,
                                  itemId: item.id,
                                  status: itemStatus
                                });
                              }
                            }}
                            className={`py-1.5 flex justify-between items-start ${
                              canToggle ? 'cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 rounded-xl transition-all' : ''
                            }`}
                          >
                            <div className="flex gap-2.5 items-start">
                              <div 
                                onClick={(e) => {
                                  if (canToggle) {
                                    e.stopPropagation();
                                    handleCycleStatus();
                                  }
                                }}
                                className="mt-0.5"
                                id={`circle-${item.id}`}
                              >
                                {itemStatus === 'Waiting' ? (
                                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/20 flex items-center justify-center shrink-0 transition-all cursor-pointer" title="Waiting Queue (Click to change)">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                  </div>
                                ) : itemStatus === 'Cooking' ? (
                                  <div className="w-5 h-5 rounded-full border-2 border-amber-500 bg-amber-50 flex items-center justify-center shrink-0 text-amber-500 animate-pulse transition-all cursor-pointer" title="Cooking (Click to change)">
                                    <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-full border-2 border-indigo-600 bg-indigo-50 flex items-center justify-center shrink-0 text-indigo-600 transition-all cursor-pointer" title="Ready (Click to change)">
                                    <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                                  </div>
                                )}
                              </div>

                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${item.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                  <span className={`font-bold text-sm transition-all ${
                                    itemStatus === 'Ready' && (order.status === 'Waiting' || order.status === 'Cooking' || order.status === 'Ready')
                                      ? 'line-through text-slate-400' 
                                      : 'text-slate-700'
                                  }`}>
                                    {item.name}
                                  </span>
                                  {itemStatus === 'Cooking' && (
                                    <span className="text-[9px] bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.2 rounded-full font-extrabold animate-pulse">
                                      Active Cooking
                                    </span>
                                  )}
                                  {itemStatus === 'Waiting' && (
                                    <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-500 px-1.5 py-0.2 rounded-full font-bold">
                                      Waiting
                                    </span>
                                  )}
                                </div>
                                {item.specialInstructions && (
                                  <div className="bg-amber-50 border border-amber-100 rounded px-2 py-0.5 mt-1 text-[11px] text-amber-700 font-medium italic">
                                    “{item.specialInstructions}”
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-sm text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded shrink-0">
                                x{item.quantity}
                              </span>
                            </div>
                          </div>

                          {/* OPTION AND OK INTERACTIVE SECTION */}
                          {isCurrentSelection && (
                            <div className="my-2 bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5 shadow-inner">
                              <p className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Select Dish Level (or tap icon to quick-toggle):</p>
                              <div className="grid grid-cols-3 gap-2">
                                {(['Waiting', 'Cooking', 'Ready'] as const).map(s => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedItemState(prev => prev ? { ...prev, status: s } : null);
                                    }}
                                    className={`py-2 px-1 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                                      selectedItemState?.status === s
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-100'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    {s === 'Waiting' ? 'Waiting' : s === 'Cooking' ? 'Active Cooking' : 'Ready'}
                                  </button>
                                ))}
                              </div>
                              <div className="flex justify-end gap-1.5 pt-1 border-t border-slate-150">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItemState(null);
                                  }}
                                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (selectedItemState && onUpdateItemStatus) {
                                      playStateBeep(selectedItemState.status === 'Ready' ? 880 : 580);
                                      await onUpdateItemStatus(selectedItemState.orderId, selectedItemState.itemId, selectedItemState.status);
                                      setSelectedItemState(null);
                                    }
                                  }}
                                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-lg shadow-sm transition-all cursor-pointer"
                                  id={`confirm-ok-${item.id}`}
                                >
                                  OK
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {order.specialInstructions && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex gap-2 items-start mt-2">
                      <ClipboardList className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-indigo-600">Global Table Note:</h4>
                        <p className="text-xs text-slate-500 leading-relaxed italic">“{order.specialInstructions}”</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                {order.status !== 'Delivered' && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex flex-col gap-2">
                    {order.status === 'Waiting' && (
                      <div className="w-full flex flex-col gap-2">
                        {allItemsReady ? (
                          <div className="w-full space-y-2">
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 font-semibold text-center">
                              🎉 All items are ready! Press Okay to alert Table {order.table}.
                            </div>
                            <button
                              onClick={() => handleAction(order.id, 'Ready', 880)}
                              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md shadow-indigo-100 transition-colors active:scale-[0.98] cursor-pointer"
                              id={`kitchen-ok-btn-${order.id}`}
                            >
                              <Check className="w-4 h-4" /> Okay (Send to ESP32)
                            </button>
                          </div>
                        ) : (
                          <div className="w-full space-y-2">
                            <div className="bg-rose-50/50 border border-rose-100/60 text-rose-800 text-[11px] rounded-xl p-2.5 font-medium text-center">
                              Click circles above to mark food ready, or accept order:
                            </div>
                            <button
                              onClick={() => handleAction(order.id, 'Cooking', 580)}
                              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 text-xs border border-slate-200 transition-colors active:scale-[0.98] cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" /> Start Cooking
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {order.status === 'Cooking' && (
                      <div className="w-full flex flex-col gap-2">
                        {!allItemsReady && (
                          <div className="text-center py-2 text-xs text-slate-500 font-semibold bg-slate-100/50 border border-slate-200/50 rounded-xl">
                            Preparing... ({readyItemsCount}/{totalItemsCount} ready)
                          </div>
                        )}
                        
                        {allItemsReady ? (
                          <div className="w-full space-y-2">
                            <div className="bg-emerald-50 border border-emerald-150 text-emerald-800 text-[11px] rounded-xl p-2.5 font-bold text-center">
                              🎉 Last food is ready! Press Okay to notify robot.
                            </div>
                            <button
                              onClick={() => handleAction(order.id, 'Ready', 880)}
                              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md shadow-indigo-100 transition-colors active:scale-[0.98] cursor-pointer"
                              id={`kitchen-ok-btn-${order.id}`}
                            >
                              <Check className="w-4 h-4" /> Okay (Send to ESP32)
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 text-center italic mt-1">
                            OK option will appear once all items are checked off.
                          </p>
                        )}
                      </div>
                    )}

                    {order.status === 'Ready' && (
                      <div className="w-full space-y-2">
                        <div className="w-full text-center text-xs text-blue-600 bg-blue-50 py-2.5 rounded-xl border border-blue-100 flex items-center justify-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
                          <span>Ready - Alerting Table {order.table} via MQTT</span>
                        </div>
                        <button
                          onClick={() => handleAction(order.id, 'Delivered', 640)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-md shadow-emerald-100 transition-colors active:scale-[0.98] cursor-pointer"
                          id={`kitchen-deliver-btn-${order.id}`}
                        >
                          <Check className="w-4 h-4" /> Deliver Order
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
