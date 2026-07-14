import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FoodItem, OrderItem, Category, Order } from '../types';

interface AnimatedPriceProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

function AnimatedPrice({ 
  value, 
  duration = 800, 
  prefix = '₹', 
  suffix = '', 
  className = '' 
}: AnimatedPriceProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousValue = useRef(value);

  useEffect(() => {
    if (value === previousValue.current) return;

    setIsAnimating(true);
    let start: number | null = null;
    const from = previousValue.current;
    const to = value;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = from + (to - from) * ease;
      
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(to);
        previousValue.current = to;
        setIsAnimating(false);
      }
    };

    const animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [value, duration]);

  const animationStyles = "transition-all duration-300";

  return (
    <span className={`${className} ${animationStyles}`}>
      {prefix}{displayValue.toFixed(2)}{suffix}
    </span>
  );
}
import { 
  Search, ShoppingBag, Plus, Minus, FileText, Check, 
  AlertCircle, Clock, RotateCcw, ClipboardList, Utensils, 
  BellRing, ShieldCheck, ChevronRight
} from 'lucide-react';

interface CustomerAppProps {
  foods: FoodItem[];
  categories: Category[];
  activeTable: number;
  onTableChange: (tableNum: number) => void;
  onPlaceOrder: (order: { table: number; items: any[]; totalPrice: number; specialInstructions: string }) => Promise<any>;
  currentOrder: any | null;
  onResetTrackOrder: () => void;
  showEcosystemBar?: boolean;
  orders?: Order[];
}

export default function CustomerApp({
  foods,
  categories,
  activeTable,
  onTableChange,
  onPlaceOrder,
  currentOrder,
  onResetTrackOrder,
  showEcosystemBar = false,
  orders = []
}: CustomerAppProps) {
  const hotelName = localStorage.getItem('hotelName') || 'BiteExpress';
  const hotelSlogan = localStorage.getItem('hotelSlogan') || 'Smart QR Table Ordering';
  const isHotelMode = localStorage.getItem('isHotelMode') === 'true';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  
  // Tab-based navigation state ('menu' or 'tracking')
  const [activeTab, setActiveTab] = useState<'menu' | 'tracking'>('menu');

  // Filter foods for current menu
  const filteredFoods = useMemo(() => {
    return foods.filter(food => {
      const matchesSearch = food.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            food.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || food.category === selectedCategory;
      const matchesVeg = !vegOnly || food.isVeg;
      return matchesSearch && matchesCategory && matchesVeg && food.isAvailable;
    });
  }, [foods, searchQuery, selectedCategory, vegOnly]);

  // Compute all orders for the current table
  const tableOrders = useMemo(() => {
    return orders.filter(o => o.table === activeTable);
  }, [orders, activeTable]);

  // Active table orders (still in progress)
  const activeTableOrders = useMemo(() => {
    return tableOrders.filter(o => o.status !== 'Delivered');
  }, [tableOrders]);

  // Past/Served table orders
  const pastTableOrders = useMemo(() => {
    return tableOrders.filter(o => o.status === 'Delivered');
  }, [tableOrders]);

  // Grand subtotal across all orders for this table session
  const sessionTotal = useMemo(() => {
    return tableOrders.reduce((sum, o) => sum + o.totalPrice, 0);
  }, [tableOrders]);

  // Cart operations
  const addToCart = (food: FoodItem) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === food.id);
      if (existing) {
        return prev.map(item => item.id === food.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        id: food.id,
        name: food.name,
        price: food.price,
        quantity: 1,
        isVeg: food.isVeg,
        specialInstructions: ''
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === id);
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        return prev.filter(item => item.id !== id);
      }
      return prev.map(item => item.id === id ? { ...item, quantity: newQty } : item);
    });
  };

  const updateItemInstruction = (id: string, text: string) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, specialInstructions: text } : item));
  };

  const totalCartPrice = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cart]);

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    setIsOrdering(true);
    try {
      await onPlaceOrder({
        table: activeTable,
        items: cart,
        totalPrice: parseFloat(totalCartPrice.toFixed(2)),
        specialInstructions
      });
      setCart([]);
      setSpecialInstructions('');
      setIsCartOpen(false);
      // Auto-switch to live tracker tab so they can see confirmation and cook progress!
      setActiveTab('tracking');
    } catch (e) {
      console.warn('Failed to place order:', e);
    } finally {
      setIsOrdering(false);
    }
  };

  // Helper to convert order status to step number
  const getStatusStep = (status: string) => {
    switch (status) {
      case 'Waiting': return 1;
      case 'Cooking': return 2;
      case 'Ready': return 3;
      case 'Delivered': return 4;
      default: return 1;
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 pb-32" id="customer-app-root">
      
      {/* Table Tabletop Session Bar */}
      <div className="bg-slate-900 text-slate-100 py-2 px-4 text-center text-xs font-semibold flex justify-between items-center shadow-sm" id="qr-table-banner">
        <span className="flex items-center gap-1.5 font-bold text-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{isHotelMode ? 'Room / Suite' : 'Table'} {activeTable} • {isHotelMode ? 'Suite Service Session' : 'Dine-In Session'}</span>
        </span>
        <span className="text-[10px] text-slate-400 font-medium">
          Real-time Connection Active
        </span>
      </div>

      {/* Header */}
      <header className="sticky top-0 bg-white shadow-sm z-20 px-4 py-3 flex items-center justify-between border-b border-slate-100" id="customer-header">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md shadow-indigo-100" id="logo-icon-customer">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-950" id="restaurant-name">
              {hotelName}
            </h1>
            <p className="text-[10px] text-slate-500 font-bold">{hotelSlogan}</p>
          </div>
        </div>

        {/* Cart Trigger */}
        {cart.length > 0 && (
          <button 
            onClick={() => setIsCartOpen(true)}
            className="relative bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-md shadow-indigo-100 transition-all active:scale-95 cursor-pointer"
            id="customer-cart-btn"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="text-xs">₹{totalCartPrice.toFixed(2)}</span>
            <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full text-[10px] w-5 h-5 flex items-center justify-center font-black animate-pulse">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          </button>
        )}
      </header>

      {/* Navigation Tabs (Menu vs. Tracking) */}
      <div className="max-w-4xl mx-auto px-4 mt-5" id="customer-tabs-container">
        <div className="bg-white p-1 rounded-2xl border border-slate-200/50 flex gap-1.5 shadow-sm">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'menu'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
            }`}
            id="tab-btn-menu"
          >
            <span>🍽️</span>
            <span>Browse Menu</span>
          </button>
          
          <button
            onClick={() => setActiveTab('tracking')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
              activeTab === 'tracking'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
            }`}
            id="tab-btn-tracking"
          >
            <span>📋</span>
            <span>Live Tracker</span>
            {activeTableOrders.length > 0 && (
              <span className="absolute top-2 right-4 bg-rose-600 text-white rounded-full text-[9px] w-4.5 h-4.5 flex items-center justify-center font-black animate-pulse">
                {activeTableOrders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Floating Active Order Reminder Banner on Menu Tab */}
      {activeTab === 'menu' && activeTableOrders.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <button
            onClick={() => setActiveTab('tracking')}
            className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5 text-indigo-900 flex items-center justify-between hover:bg-indigo-100/60 transition-all cursor-pointer group shadow-sm"
            id="floating-active-tracker-banner"
          >
            <span className="flex items-center gap-2 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>
                Tracking {activeTableOrders.length} active order{activeTableOrders.length > 1 ? 's' : ''} in the kitchen (e.g., {activeTableOrders[0].orderNumber})
              </span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              View live status ➔
            </span>
          </button>
        </div>
      )}

      {/* Main Content Stage */}
      <main className="max-w-4xl mx-auto px-4 pt-6" id="customer-main-content">
        
        {/* TAB 1: FOOD MENU & CART SUBMISSION */}
        {activeTab === 'menu' && (
          <>
            {/* Banner offer */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-6 text-white mb-6 shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center" id="offer-banner">
              <div className="relative z-10 max-w-sm">
                <span className="bg-indigo-700/60 text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wide uppercase">⚡ Monsoon Offer</span>
                <h3 className="text-xl font-black tracking-tight mt-2">Get 15% Off Your Table Ordering</h3>
                <p className="text-xs opacity-90 mt-1">Order directly from your phone via QR. Food is delivered hot straight from the sizzlers.</p>
              </div>
              <div className="bg-white/10 text-white/90 border border-white/20 rounded-2xl px-4 py-2 mt-4 md:mt-0 font-mono text-xs font-bold tracking-widest relative z-10">
                PROMO: QR15
              </div>
              <div className="absolute right-0 bottom-0 bg-white/5 rounded-full w-44 h-44 -mr-10 -mb-10 pointer-events-none"></div>
              <div className="absolute left-1/3 top-0 bg-white/5 rounded-full w-24 h-24 -mt-5 pointer-events-none"></div>
            </div>

            {/* Search and Filters Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/50 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center" id="search-filter-card">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dishes, ingredients..." 
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                  id="customer-food-search"
                />
              </div>

              <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={vegOnly}
                    onChange={(e) => setVegOnly(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5.5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-500 relative"></div>
                  <span className="text-[11px] font-extrabold text-slate-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Veg Only
                  </span>
                </label>
              </div>
            </div>

            {/* Categories Scrollable Rail */}
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none" id="categories-rail">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedCategory === 'all' 
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100' 
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                All Dishes
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    selectedCategory === cat.slug 
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100' 
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Food items grid */}
            {filteredFoods.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200/50">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-700">No dishes match your preferences.</p>
                <p className="text-[11px] mt-1 text-slate-400">Try adjusting your filters or search keywords.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2" id="food-items-grid">
                {filteredFoods.map(food => {
                  const quantityInCart = cart.find(item => item.id === food.id)?.quantity || 0;

                  return (
                    <div 
                      key={food.id} 
                      className="bg-white rounded-2xl border border-slate-200/50 p-4 shadow-xs flex gap-4 hover:border-slate-300 transition-colors"
                      id={`food-card-${food.id}`}
                    >
                      {/* Image */}
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative">
                        <img 
                          src={food.image} 
                          alt={food.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span className={`absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full border border-white ${food.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                      </div>

                      {/* Info & Quantity trigger */}
                      <div className="flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-slate-900 text-xs sm:text-sm truncate pr-1">{food.name}</h3>
                            <span className="text-xs font-black text-indigo-600 shrink-0">₹{food.price.toFixed(2)}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">{food.description}</p>
                        </div>

                        <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-50">
                          <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {food.cookingTime} mins
                          </span>

                          {quantityInCart > 0 ? (
                            <div className="flex items-center gap-2.5 bg-indigo-50 border border-indigo-100 rounded-lg px-1 py-0.5 shadow-sm">
                              <button 
                                onClick={() => updateQuantity(food.id, -1)}
                                className="text-indigo-600 hover:bg-indigo-100 p-1 rounded transition-colors cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-indigo-950 font-black text-xs w-4 text-center">{quantityInCart}</span>
                              <button 
                                onClick={() => addToCart(food)}
                                className="text-indigo-600 hover:bg-indigo-100 p-1 rounded transition-colors cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => addToCart(food)}
                              className="bg-indigo-50 hover:bg-indigo-150 border border-indigo-100 text-indigo-700 text-[10px] px-2.5 py-1 rounded-lg font-black tracking-wide flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* TAB 2: LIVE ORDER TRACKING & RUNNING BILL SESSION */}
        {activeTab === 'tracking' && (
          <div className="max-w-2xl mx-auto space-y-6" id="tracking-tab-workspace">
            
            {tableOrders.length === 0 ? (
              /* Empty state if no orders are placed yet for this table */
              <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200/50 shadow-sm" id="empty-tracking-state">
                <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No orders placed yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  You haven't sent any food orders to the kitchen from this table session yet. Explore the menu and start ordering!
                </p>
                <button
                  onClick={() => setActiveTab('menu')}
                  className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer"
                >
                  Browse Food Menu 🍽️
                </button>
              </div>
            ) : (
              <>
                {/* Active Kitchen Prep Orders */}
                {activeTableOrders.length > 0 ? (
                  <div className="space-y-5" id="active-prep-orders">
                    <h3 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                      <span>Active Prep Orders ({activeTableOrders.length})</span>
                    </h3>
                    
                    {activeTableOrders.map(order => (
                      <div key={order.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60" id={`order-card-${order.id}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="bg-indigo-50 text-indigo-700 text-[11px] px-2 py-0.5 rounded font-black font-mono">
                                {order.orderNumber}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">{order.time}</span>
                            </div>
                            {order.specialInstructions && (
                              <p className="text-[11px] text-slate-500 mt-1 italic">
                                “{order.specialInstructions}”
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 font-bold block">Subtotal</span>
                            <span className="text-xs font-black text-slate-900">₹{order.totalPrice.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Order Stepper Status */}
                        <div className="mb-5 relative" id={`status-stepper-${order.id}`}>
                          <div className="flex items-center justify-between relative mb-2">
                            {/* Horizontal background line */}
                            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-100 z-0"></div>
                            {/* Horizontal active progress line */}
                            <div 
                              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-600 z-0 transition-all duration-1000"
                              style={{ width: `${((getStatusStep(order.status) - 1) / 3) * 100}%` }}
                            ></div>

                            {['Waiting', 'Cooking', 'Ready', 'Delivered'].map((step, idx) => {
                              const stepNum = idx + 1;
                              const currentStepNum = getStatusStep(order.status);
                              const isCompleted = stepNum < currentStepNum;
                              const isActive = stepNum === currentStepNum;

                              return (
                                <div key={step} className="flex flex-col items-center relative z-10">
                                  <div 
                                    className={`w-7.5 h-7.5 rounded-full flex items-center justify-center font-bold text-[11px] transition-all duration-300 ${
                                      isCompleted ? 'bg-indigo-600 text-white shadow-xs' :
                                      isActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-50 animate-pulse' :
                                      'bg-slate-50 text-slate-400 border border-slate-200'
                                    }`}
                                  >
                                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : stepNum}
                                  </div>
                                  <span className={`text-[9px] font-bold mt-1.5 ${isActive ? 'text-indigo-600 font-extrabold' : 'text-slate-400'}`}>
                                    {step}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Detail text on current state */}
                        <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50 flex items-start gap-2.5 mb-4">
                          <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <div className="text-[11px]">
                            <h4 className="font-extrabold text-indigo-950">
                              {order.status === 'Waiting' && 'Order Placed & Queued'}
                              {order.status === 'Cooking' && 'Chef preparing your dishes'}
                              {order.status === 'Ready' && 'Prepared & served shortly!'}
                              {order.status === 'Delivered' && 'Fully Served'}
                            </h4>
                            <p className="text-indigo-900/80 mt-0.5 leading-relaxed">
                              {order.status === 'Waiting' && 'The kitchen is queueing your request and will start preparing shortly.'}
                              {order.status === 'Cooking' && 'Fresh ingredients are being curated on active hotpans.'}
                              {order.status === 'Ready' && 'Dine-in worker is carrying your fresh order to the table!'}
                              {order.status === 'Delivered' && 'Order has successfully arrived at your table.'}
                            </p>
                          </div>
                        </div>

                        {/* Sub-items block */}
                        <div className="divide-y divide-slate-100 bg-slate-50 rounded-xl px-3.5 py-1 border border-slate-200/50">
                          {order.items.map((item: any) => (
                            <div key={item.id} className="py-2 flex justify-between items-center first:pt-1.5 last:pb-1.5 text-xs">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${item.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                  <span className="font-bold text-slate-800">{item.name}</span>
                                  <span className="text-[10px] text-slate-400 font-black bg-white border border-slate-200 px-1 rounded">x{item.quantity}</span>
                                </div>
                                {item.specialInstructions && (
                                  <p className="text-[10px] text-slate-500 italic mt-0.5 ml-3.5">
                                    “{item.specialInstructions}”
                                  </p>
                                )}
                              </div>
                              <span className="font-bold text-slate-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-emerald-950 flex gap-2.5 items-start">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <h4 className="font-extrabold">All active food dishes served!</h4>
                      <p className="opacity-90 mt-0.5">There are no cooking prep tickets active. You can add more treats from the order menu.</p>
                    </div>
                  </div>
                )}

                {/* Delivered/Served history list */}
                {pastTableOrders.length > 0 && (
                  <div className="space-y-3" id="served-history-orders">
                    <h3 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-widest">
                      Dishes Served ({pastTableOrders.length})
                    </h3>
                    
                    <div className="bg-white rounded-2xl p-4 border border-slate-200/50 shadow-xs divide-y divide-slate-100">
                      {pastTableOrders.map(order => (
                        <div key={order.id} className="py-3 first:pt-0 last:pb-0 flex justify-between items-center text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-black font-mono">
                                {order.orderNumber}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">{order.time}</span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-1 font-semibold leading-relaxed">
                              {order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-slate-900 block">₹{order.totalPrice.toFixed(2)}</span>
                            <span className="text-[9px] text-emerald-600 font-bold">Arrived ✓</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dining Session Running Bill Summary Box */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden" id="table-total-bill-box">
                  <div className="absolute right-0 top-0 bg-white/5 rounded-full w-32 h-32 -mr-8 -mt-8 pointer-events-none"></div>
                  <div className="absolute left-0 bottom-0 bg-white/5 rounded-full w-24 h-24 -ml-6 -mb-6 pointer-events-none"></div>

                  <div className="relative z-10">
                    <h3 className="text-[10px] font-black uppercase text-indigo-300 tracking-widest mb-4">
                      Table Session Bill
                    </h3>
                    
                    <div className="space-y-2.5 font-medium text-xs">
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Dishes Ordered ({tableOrders.reduce((s, o) => s + o.items.reduce((sumQty, i) => sumQty + i.quantity, 0), 0)} items)</span>
                        <AnimatedPrice value={sessionTotal} />
                      </div>
                      
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Taxes & GST (5%)</span>
                        <AnimatedPrice value={sessionTotal * 0.05} />
                      </div>

                      <div className="flex justify-between items-center text-slate-300">
                        <span>Monsoon QR Discount (15% Off)</span>
                        <AnimatedPrice value={sessionTotal * 0.15} prefix="-₹" className="text-emerald-400 font-bold" />
                      </div>

                      <div className="border-t border-white/10 my-3.5 pt-3.5 flex justify-between items-end">
                        <div>
                          <span className="text-[10px] text-indigo-200 uppercase font-black tracking-wider block">Grand Total</span>
                          <span className="text-[9px] text-slate-400 italic font-bold">Dine-In • Table {activeTable}</span>
                        </div>
                        <span className="text-xl font-black text-white">
                          <AnimatedPrice value={sessionTotal * 0.90} />
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
                      <button
                        onClick={() => {
                          alert(`A table server is heading to Table ${activeTable} with the billing binder & card machine. Thank you for choosing us!`);
                        }}
                        className="flex-1 bg-white hover:bg-slate-100 text-slate-900 py-3 rounded-xl font-black text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        💳 Pay / Ask For Bill
                      </button>
                      <button
                        onClick={onResetTrackOrder}
                        className="bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 py-3 px-5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Reset customer tracking state to start a fresh sequence"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>New Session</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Cart Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end" id="cart-drawer-backdrop">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col" id="cart-drawer-panel">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-950 text-sm">Your Cart (Table {activeTable})</h3>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-200 hover:bg-slate-300 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* List items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" id="cart-items-list">
              {cart.map(item => (
                <div key={item.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900">{item.name}</h4>
                      <p className="text-[10px] text-slate-500 font-semibold">₹{item.price.toFixed(2)} each</p>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-slate-950">₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>

                  {/* Quantity adjustments and individual instruction */}
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="flex items-center gap-2.5 border border-slate-200 bg-slate-50 rounded-lg p-0.5">
                      <button 
                        onClick={() => updateQuantity(item.id, -1)}
                        className="text-slate-500 hover:bg-slate-200 p-1 rounded cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-slate-900 font-bold text-xs w-4 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, 1)}
                        className="text-slate-500 hover:bg-slate-200 p-1 rounded cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex-1 max-w-xs ml-4">
                      <input 
                        type="text"
                        placeholder="Add cooking instructions..."
                        value={item.specialInstructions || ''}
                        onChange={(e) => updateItemInstruction(item.id, e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200/80 rounded-lg py-1 px-2.5 text-[10px] outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer with overall Instructions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <div className="mb-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <FileText className="w-4 h-4" /> Overall Order Instructions
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g. Please bring glasses with ice, separate bills, etc."
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 transition-shadow"
                />
              </div>

              <div className="flex justify-between items-center mb-4 text-xs">
                <span className="font-bold text-slate-600">Total Bill</span>
                <span className="text-base font-black text-slate-950">₹{totalCartPrice.toFixed(2)}</span>
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={isOrdering}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white py-3 rounded-xl font-extrabold shadow-md shadow-indigo-100 transition-all active:scale-[0.98] cursor-pointer text-xs"
              >
                {isOrdering ? 'Submitting Order...' : 'Send Order to Kitchen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Ecosystem Link Router */}
      {showEcosystemBar && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl py-2.5 px-4 flex flex-wrap md:flex-nowrap items-center justify-center gap-3 md:gap-5 z-40 max-w-[95%] w-max text-slate-800" id="ecosystem-router">
          <div className="flex items-center gap-1.5 shrink-0 border-r border-slate-200 pr-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-500">Live Ecosystem</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1 md:gap-2 text-[10px] md:text-xs font-bold font-sans">
            <a href="/" className="text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg transition-all">
              📱 Customer Website (/)
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
