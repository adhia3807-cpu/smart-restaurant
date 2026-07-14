import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChefHat, Cpu, ShieldCheck, LogOut, ArrowRight, ArrowLeft, Home,
  QrCode, ExternalLink, Calendar, Users, DollarSign, ShoppingBag, Radio,
  Plus, Download, Check, Play, Flame, Clock, ClipboardList, Volume2, VolumeX,
  AlertCircle, CheckSquare, Square, ChevronRight, RefreshCw, Table, Lock, Globe,
  User, Building2, Key, Copy
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import QRCode from 'qrcode';

interface AdminHubProps {
  orders: Order[];
  activeTableAlert: number | null;
  onSignOut: () => void;
  navigateTo: (path: string) => void;
  serverConnected: boolean;
  onUpdateStatus: (id: string, status: OrderStatus) => Promise<any>;
  onToggleItemReady?: (orderId: string, itemId: string, isReady: boolean) => Promise<any>;
  onUpdateItemStatus?: (orderId: string, itemId: string, status: 'Waiting' | 'Cooking' | 'Ready') => Promise<any>;
  onRefresh?: () => Promise<any>;
}

export default function AdminHub({ 
  orders, 
  activeTableAlert, 
  onSignOut, 
  navigateTo,
  serverConnected,
  onUpdateStatus,
  onToggleItemReady,
  onUpdateItemStatus,
  onRefresh
}: AdminHubProps) {
  const [analytics, setAnalytics] = useState<any>({
    dailySales: 0,
    monthlySales: 0,
    totalOrders: 0,
    popularItems: []
  });
  const [loading, setLoading] = useState(true);
  
  // Profile settings state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [hotelName, setHotelName] = useState(() => localStorage.getItem('hotelName') || 'BiteExpress Grand Hotel');
  const [hotelSlogan, setHotelSlogan] = useState(() => localStorage.getItem('hotelSlogan') || 'Luxury Suite Service & Dining');
  const [managerName, setManagerName] = useState(() => localStorage.getItem('managerName') || 'Adhia');
  const [isHotelMode, setIsHotelMode] = useState(() => localStorage.getItem('isHotelMode') === 'true');
  
  // PIN change states
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  
  // Audits filtering state
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditStatusFilter, setAuditStatusFilter] = useState<'All' | OrderStatus>('All');
  const [selectedAuditOrder, setSelectedAuditOrder] = useState<Order | null>(null);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [showYesterdayHistory, setShowYesterdayHistory] = useState(true);

  // Table Manager state
  const [tables, setTables] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8]);
  const [selectedQRTable, setSelectedQRTable] = useState<number>(1);
  const [newTableNum, setNewTableNum] = useState<string>('');
  const [tableError, setTableError] = useState<string>('');
  const [tableSuccess, setTableSuccess] = useState<boolean>(false);
  
  // QR render states
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [publicUrl, setPublicUrl] = useState<string>('');
  const [qrTarget, setQrTarget] = useState<'shared' | 'dev'>('dev');
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // General UI states
  const [activeTab, setActiveTab] = useState<'tables' | 'kitchen' | 'audits'>('tables');
  const [kitchenFilter, setKitchenFilter] = useState<OrderStatus | 'All'>('Waiting');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch real-time analytics
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('/api/analytics');
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        }
      } catch (e) {
        console.warn('Analytics sync warning (will retry):', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch historical orders
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/orders/history');
        if (res.ok) {
          const data = await res.json();
          setHistoryOrders(data);
        }
      } catch (e) {
        console.warn('History orders sync warning:', e);
      }
    };
    fetchHistory();
  }, []);

  // Fetch tables dynamic list
  const fetchTablesList = async () => {
    try {
      const res = await fetch('/api/tables');
      if (res.ok) {
        const data = await res.json();
        setTables(data);
        // Default select first table if current is not in the list
        if (data.length > 0 && !data.includes(selectedQRTable)) {
          setSelectedQRTable(data[0]);
        }
      }
    } catch (e) {
      console.warn('Tables sync warning (will retry):', e);
    }
  };

  useEffect(() => {
    fetchTablesList();
    // Fetch system-info
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

  // Listen to tables updates if SSE triggers them (or just let analytics intervals and mounts handle it)
  useEffect(() => {
    const interval = setInterval(fetchTablesList, 5000);
    return () => clearInterval(interval);
  }, [selectedQRTable]);

  // Generate real QR links based on current window location or server resolved host
  const getTableQRUrl = (tableNum: number) => {
    let base = publicUrl || window.location.origin;
    if (!base || base === 'null' || base === 'undefined') {
      base = window.location.origin;
    }
    // Support switching between shared (-pre-) and dev sandbox (-dev-) targets
    if (qrTarget === 'shared') {
      base = base.replace('-dev-', '-pre-');
    } else {
      base = base.replace('-pre-', '-dev-');
    }
    return `${base}?table=${tableNum}`;
  };

  // Generate QR base64 using 'qrcode' package
  useEffect(() => {
    if (selectedQRTable) {
      const url = getTableQRUrl(selectedQRTable);
      QRCode.toDataURL(url, {
        width: 300,
        margin: 1,
        color: {
          dark: '#0f172a', // Slate 900
          light: '#ffffff'
        }
      })
      .then(urlData => {
        setQrDataUrl(urlData);
      })
      .catch(err => {
        console.error('QR rendering failed:', err);
      });
    }
  }, [selectedQRTable, publicUrl, qrTarget]);

  // Close modals on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showProfileModal) {
          setShowProfileModal(false);
          playSynthBeep(330);
        }
        if (selectedAuditOrder) {
          setSelectedAuditOrder(null);
          playSynthBeep(330);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showProfileModal, selectedAuditOrder]);

  // Handle Create Table
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setTableError('');
    setTableSuccess(false);

    const num = parseInt(newTableNum);
    if (isNaN(num) || num < 1) {
      setTableError('Please enter a valid positive table number');
      return;
    }

    if (tables.includes(num)) {
      setTableError(`Table ${num} already exists in the system`);
      return;
    }

    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: num })
      });

      if (res.ok) {
        const updatedTables = await res.json();
        setTables(updatedTables);
        setSelectedQRTable(num);
        setNewTableNum('');
        setTableSuccess(true);
        playSynthBeep(660); // High pitch for success
        setTimeout(() => setTableSuccess(false), 3000);
      } else {
        const errData = await res.json();
        setTableError(errData.error || 'Failed to create table');
      }
    } catch (err) {
      setTableError('Connection failed. Could not create table.');
    }
  };

  // Handle Save Profile Settings & Password Change
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('hotelName', hotelName);
    localStorage.setItem('hotelSlogan', hotelSlogan);
    localStorage.setItem('managerName', managerName);
    localStorage.setItem('isHotelMode', isHotelMode ? 'true' : 'false');
    
    // Check if passcode update was attempted
    if (currentPin || newPin || confirmNewPin) {
      const savedPin = localStorage.getItem('adminPIN') || '1234';
      if (currentPin !== savedPin) {
        setPinError('Current PIN is incorrect');
        setPinSuccess('');
        playSynthBeep(330);
        return;
      }
      if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
        setPinError('New PIN must be exactly 4 digits');
        setPinSuccess('');
        playSynthBeep(330);
        return;
      }
      if (newPin !== confirmNewPin) {
        setPinError('New PIN and confirmation do not match');
        setPinSuccess('');
        playSynthBeep(330);
        return;
      }
      
      // Save PIN
      localStorage.setItem('adminPIN', newPin);
      setPinSuccess('PIN changed successfully!');
      setPinError('');
      // Reset PIN inputs
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
    } else {
      setPinSuccess('Profile updated successfully!');
      setPinError('');
    }
    
    playSynthBeep(660);
    setTimeout(() => {
      setShowProfileModal(false);
      setPinSuccess('');
    }, 1500);
  };

  // Synthesizer beep feedback (Standard Web Audio API)
  const playSynthBeep = (freq = 440) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio feedback blocked:', e);
    }
  };

  // Compile full printable acrylic flyer tent-card to canvas and download as image
  const handleDownloadQRImage = async () => {
    try {
      playSynthBeep(520);
      const qrUrl = getTableQRUrl(selectedQRTable);
      
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Draw solid premium background card
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add a thin double border
      ctx.strokeStyle = '#e2e8f0'; // slate-200
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      ctx.strokeStyle = '#4f46e5'; // indigo-600 accent border
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

      // 2. Render branding Header
      ctx.fillStyle = '#4f46e5'; // Indigo-600
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BiteExpress Dining', canvas.width / 2, 50);

      // 3. Render Table Title
      ctx.fillStyle = '#0f172a'; // Slate-900
      ctx.font = 'black 36px system-ui, sans-serif';
      ctx.fillText(`TABLE ${selectedQRTable}`, canvas.width / 2, 95);

      // Draw horizontal dividing line
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 115);
      ctx.lineTo(canvas.width - 40, 115);
      ctx.stroke();

      // 4. Generate high-res base64 QR code and draw it
      const qrBase64 = await QRCode.toDataURL(qrUrl, {
        width: 260,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });

      const img = new Image();
      img.onload = () => {
        // Draw centered QR Code
        ctx.drawImage(img, 70, 130, 260, 260);

        // 5. Render instructions footer
        ctx.fillStyle = '#475569'; // Slate-600
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText('Scan QR Code to Order', canvas.width / 2, 415);

        ctx.fillStyle = '#94a3b8'; // Slate-400
        ctx.font = '11px monospace';
        ctx.fillText('Automatic IoT Food Delivery System', canvas.width / 2, 440);

        // 6. Complete and trigger native download dialog
        const finalUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `BiteExpress_Table_${selectedQRTable}_QR.png`;
        link.href = finalUrl;
        link.click();
      };
      img.src = qrBase64;

    } catch (err) {
      console.error('Failed to compile printable flyer:', err);
    }
  };

  // Table specific metrics helper
  const getTablePendingOrdersCount = (tableNum: number) => {
    return orders.filter(o => o.table === tableNum && o.status !== 'Delivered').length;
  };

  // Live Sync Order helper
  const handleManualSync = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      playSynthBeep(520);
      try {
        await onRefresh();
      } catch (err) {
        console.error(err);
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  const combinedOrders = useMemo(() => {
    if (showYesterdayHistory) {
      return [...orders, ...historyOrders];
    }
    return orders;
  }, [orders, historyOrders, showYesterdayHistory]);

  // Kitchen filtered list
  const filteredOrders = useMemo(() => {
    if (kitchenFilter === 'All') return orders;
    return orders.filter(o => o.status === kitchenFilter);
  }, [orders, kitchenFilter]);

  // Kitchen quick stats
  const kitchenStats = useMemo(() => {
    return {
      waiting: orders.filter(o => o.status === 'Waiting').length,
      cooking: orders.filter(o => o.status === 'Cooking').length,
      ready: orders.filter(o => o.status === 'Ready').length,
      delivered: orders.filter(o => o.status === 'Delivered').length,
    };
  }, [orders]);

  const activeOrdersCount = orders.filter(o => o.status !== 'Delivered').length;

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col pb-16 relative">
      {/* Glow Backdrops */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-12 left-10 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Responsive Header */}
      <header className="border-b border-slate-900 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center border border-indigo-500 shadow-md shadow-indigo-600/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black uppercase tracking-wider font-display">{hotelName} Hub</h1>
                <span className="text-[9px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-extrabold px-1.5 py-0.5 rounded-md uppercase">{isHotelMode ? 'Hotel Admin' : 'Admin'}</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">Managed by {managerName} • {isHotelMode ? 'Hotel Mode' : 'Dining Mode'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Profile Settings Toggle */}
            <button
              onClick={() => {
                setShowProfileModal(true);
                playSynthBeep(520);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
              title="Change Hotel profile settings and passcode PIN"
              id="admin-profile-btn"
            >
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Profile Settings</span>
            </button>

            {/* Audio Feedback Controller */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                playSynthBeep(520);
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                soundEnabled 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
              title={soundEnabled ? "Mute alert chime synthesizer" : "Enable alert chime synthesizer"}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">Bells: {soundEnabled ? 'On' : 'Off'}</span>
            </button>

            {/* SSE status */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border rounded-xl text-[10px] font-extrabold uppercase tracking-widest ${
              serverConnected ? 'border-emerald-500/20 text-emerald-400' : 'border-rose-500/20 text-rose-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${serverConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="hidden sm:inline">{serverConnected ? 'Live Connection' : 'Disconnected'}</span>
            </div>

            {/* Logout */}
            <button
              onClick={onSignOut}
              className="p-1.5 sm:px-3 sm:py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 text-[10px] font-black uppercase tracking-wider border border-rose-500/25 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full flex-1 relative z-10">

        {/* Dynamic Hardware Ring Alert Banner */}
        {activeTableAlert !== null && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse shadow-lg shadow-rose-500/5">
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Radio className="w-4 h-4 animate-ping" />
              </div>
              <div>
                <h4 className="text-xs font-black text-rose-400 font-display">MQTT Table Buzzer Calling!</h4>
                <p className="text-[11px] text-slate-300 mt-0.5">Table <span className="font-bold text-white underline">{activeTableAlert}</span> has triggered the IoT service bell. Complete order to silence.</p>
              </div>
            </div>
            <button
              onClick={() => navigateTo('/esp32')}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer"
            >
              Launch ESP32 Simulator
            </button>
          </div>
        )}

        {/* Real-time Statistics Strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest">Total Sales</p>
              <h3 className="text-lg font-black text-white mt-1 font-display">₹{loading ? '...' : analytics.dailySales?.toLocaleString() || 0}</h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest">Completed</p>
              <h3 className="text-lg font-black text-white mt-1 font-display">{loading ? '...' : analytics.totalOrders || 0} Orders</h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest">Pending Queue</p>
              <h3 className="text-lg font-black text-white mt-1 font-display">{activeOrdersCount} Cooking</h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <ChefHat className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest">Active Tables</p>
              <h3 className="text-lg font-black text-white mt-1 font-display">{tables.length} Total</h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Table className="w-4 h-4" />
            </div>
          </div>
        </section>

        {/* Segmented Workspace Controller (Tabs) */}
        <div className="flex border-b border-slate-900 mb-6 bg-slate-900/20 p-1.5 rounded-2xl border">
          <button
            onClick={() => {
              setActiveTab('tables');
              playSynthBeep(440);
            }}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'tables'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>1. Table QR & Creation Manager</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('kitchen');
              playSynthBeep(440);
            }}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 relative ${
              activeTab === 'kitchen'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>2. Kitchen Order Terminal</span>
            {activeOrdersCount > 0 && (
              <span className="absolute top-2.5 right-4 w-5 h-5 bg-orange-500 text-white font-mono text-[9px] font-black rounded-full flex items-center justify-center animate-bounce border border-slate-950">
                {activeOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('audits');
              playSynthBeep(440);
            }}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 relative ${
              activeTab === 'audits'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>3. Audits & Daily Collections</span>
            <span className="hidden md:inline-block text-[8px] font-black bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 px-1.5 py-0.5 rounded-md uppercase tracking-wider">History Loaded</span>
          </button>
        </div>

        {/* Tab 1: Table QR & Creation Manager */}
        {activeTab === 'tables' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Tables Grid & Creator */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400">{isHotelMode ? 'Room & Suite List' : 'Dining Table List'}</h3>
                  <p className="text-xs text-slate-400 mt-1">Select any {isHotelMode ? 'room' : 'table'} card to display or download its persistent QR code.</p>
                </div>
              </div>

              {/* Grid of Tables */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {tables.map((tblNum) => {
                  const pendingCount = getTablePendingOrdersCount(tblNum);
                  const isAlertActive = activeTableAlert === tblNum;
                  const isSelected = selectedQRTable === tblNum;

                  return (
                    <div
                      key={tblNum}
                      onClick={() => {
                        setSelectedQRTable(tblNum);
                        playSynthBeep(400 + tblNum * 30);
                      }}
                      className={`relative p-5 rounded-2xl cursor-pointer border transition-all duration-300 flex flex-col justify-between h-36 ${
                        isSelected 
                          ? 'bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/5' 
                          : 'bg-slate-900/40 border-slate-900/80 hover:bg-slate-900 hover:border-slate-800'
                      }`}
                    >
                      {/* Alert indicators */}
                      <div className="flex justify-between items-start">
                        <span className={`text-[10px] font-black font-mono tracking-widest uppercase ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`}>
                          {isHotelMode ? 'Room Unit' : 'Table Unit'}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          {isAlertActive && (
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                            </span>
                          )}
                          {pendingCount > 0 && (
                            <span className="bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                              {pendingCount} Active
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Large Table Number */}
                      <div className="my-2">
                        <h4 className="text-2xl font-black font-display text-white">{isHotelMode ? 'R-' : 'T-'}{tblNum}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">Persistent ID: #{tblNum}</p>
                      </div>

                      {/* Small mock barcode layout at bottom of card */}
                      <div className="flex justify-between items-center border-t border-slate-900 pt-3 mt-1">
                        <span className="text-[9px] text-slate-500 font-mono">BITE-QR-{isHotelMode ? 'R' : 'T'}{tblNum}</span>
                        <QrCode className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-400' : 'text-slate-600'}`} />
                      </div>
                    </div>
                  );
                })}

                {/* Add New Table Sleek Form */}
                <div className="bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-36">
                  <span className="text-[10px] font-black font-mono tracking-widest uppercase text-slate-500 block">
                    Expansion Panel
                  </span>
                  
                  <form onSubmit={handleCreateTable} className="space-y-2 my-1">
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        placeholder={`${isHotelMode ? 'Room' : 'Table'} Num (e.g. 9)`}
                        value={newTableNum}
                        onChange={(e) => setNewTableNum(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 font-mono font-bold outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add {isHotelMode ? 'Room' : 'Table'}</span>
                    </button>
                  </form>
                  <div className="h-4">
                    {tableError && <p className="text-[9px] text-rose-500 font-bold truncate">{tableError}</p>}
                    {tableSuccess && <p className="text-[9px] text-emerald-400 font-bold">Created!</p>}
                  </div>
                </div>

              </div>

            </div>

            {/* Right Column: QR Interactive Flyer Card & Actions */}
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400">QR Code Poster Generator</h3>

              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
                
                <p className="text-[11px] text-slate-400 text-center mb-4 leading-relaxed">
                  Every {isHotelMode ? 'suite / room' : 'dining table'} maps to a <span className="font-bold text-indigo-400">persistent scanning link</span>. Customers scan to browse the menu and order:
                </p>

                {/* Advanced QR Guide and Destination Selector */}
                <div className="w-full bg-slate-950 border border-slate-800/60 rounded-2xl p-4 mb-4 space-y-3">
                  <div className="flex gap-2.5 items-start">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-wider">Mobile Scanner & Testing Guide</h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        If your phone shows <span className="text-amber-400 font-bold">"Page not found"</span> when scanning, your public Shared App is not live yet.
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        💡 <span className="text-indigo-400 font-bold">For mobile phone testing:</span> Click the <span className="text-indigo-400 font-bold">"Share"</span> button in the top-right corner of Google AI Studio to deploy/publish your public site!
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        💻 <span className="text-emerald-400 font-bold">For instant computer testing:</span> Use the <span className="text-emerald-400 font-bold">"Open Customer Menu in New Tab"</span> button below to bypass QR scanning and test the customer ordering app on your computer immediately!
                      </p>
                    </div>
                  </div>

                  {/* Toggle Selector */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => setQrTarget('shared')}
                      className={`py-1.5 px-2.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        qrTarget === 'shared'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Shared URL (Public)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrTarget('dev')}
                      className={`py-1.5 px-2.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        qrTarget === 'dev'
                          ? 'bg-slate-800 text-white border border-slate-700/50'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Dev URL (Private)</span>
                    </button>
                  </div>
                  
                  {qrTarget === 'shared' ? (
                    <p className="text-[9px] text-slate-500 italic leading-normal px-1">
                      * Targets the public link. Best for physical smartphones after clicking "Share" in AI Studio.
                    </p>
                  ) : (
                    <p className="text-[9px] text-slate-500 italic leading-normal px-1">
                      * Targets your current dev container link. Best for testing in local tabs or logged-in browsers.
                    </p>
                  )}
                </div>

                {/* VISUAL FLyer Card standee preview */}
                <div className="w-full bg-white p-5 rounded-2xl flex flex-col items-center border border-slate-200 shadow-xl relative overflow-hidden" id="flyer-standee">
                  {/* Styled simulated acrylic tent-card decoration */}
                  <div className="w-full h-1 bg-gradient-to-r from-indigo-500 to-rose-500 absolute top-0 left-0 right-0"></div>

                  <div className="w-full text-center mb-4">
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full inline-block">
                      {hotelName} Smart Menu
                    </span>
                    <h4 className="text-3xl font-black text-slate-900 font-display mt-2 tracking-tight">
                      {isHotelMode ? 'ROOM' : 'TABLE'} {selectedQRTable}
                    </h4>
                    <div className="h-0.5 w-1/3 bg-slate-100 mx-auto mt-2"></div>
                  </div>

                  {/* High Quality Real-time Rendered QR Code */}
                  <div className="relative p-2.5 border border-slate-100 bg-slate-50 rounded-2xl shadow-inner my-2">
                    {qrDataUrl ? (
                      <img 
                        src={qrDataUrl} 
                        alt={`QR Code ${isHotelMode ? 'Room' : 'Table'} ${selectedQRTable}`} 
                        className="w-36 h-36 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-36 h-36 bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-slate-300 font-bold text-xs">
                        Rendering QR...
                      </div>
                    )}
                  </div>

                  <div className="w-full mt-4 text-center space-y-1">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-wide">1. Scan with camera</p>
                    <p className="text-[10px] text-slate-400 font-semibold">2. Browse menu & order on phone</p>
                  </div>
                </div>

                {/* Interactive Action Controls */}
                <div className="w-full mt-6 space-y-2.5">
                  
                  {/* Download button */}
                  <button
                    onClick={handleDownloadQRImage}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/15 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Printable Card Image (PNG)</span>
                  </button>

                  {/* Open in New Tab button (Always current Sandbox origin for 100% working instant local test) */}
                  <a
                    href={getTableQRUrl(selectedQRTable)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700/50 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 text-indigo-400" />
                    <span>Open Customer Menu ({qrTarget === 'shared' ? 'Public Shared App' : 'Local Dev Sandbox'})</span>
                  </a>

                  {/* Copy Link button */}
                  <button
                    type="button"
                    onClick={() => handleCopyLink(getTableQRUrl(selectedQRTable))}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-850 active:scale-95 text-slate-300 border border-slate-800/60 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400 animate-bounce" />
                        <span className="text-emerald-400">Scan Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-400" />
                        <span>Copy Scan Link for Mobile / Clipboard</span>
                      </>
                    )}
                  </button>

                  {/* Link Details and open button */}
                  <div className="bg-slate-950 border border-slate-900 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider font-extrabold">Destination Scanner URL</span>
                      <a 
                        href={getTableQRUrl(selectedQRTable)} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 underline flex items-center gap-0.5"
                      >
                        <span>Test Web Open ↗</span>
                      </a>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono break-all select-all leading-relaxed p-1.5 bg-slate-900/60 rounded border border-slate-900">
                      {getTableQRUrl(selectedQRTable)}
                    </p>
                  </div>

                  <p className="text-[9px] text-slate-500 text-center font-mono leading-relaxed">
                    Downloads an acrylic tabletop flyer template with the QR code already printed, perfect for print shops.
                  </p>

                </div>

              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Kitchen Order Terminal */}
        {activeTab === 'kitchen' && (
          <div className="space-y-6">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400">Kitchen Display System (KDS)</h3>
                <p className="text-xs text-slate-400 mt-1">Real-time incoming orders list. Update statuses and tick off checkboxes to alert tables instantly.</p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={handleManualSync}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer w-full md:w-auto justify-center"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-slate-900/30 p-1 rounded-xl border border-slate-900">
              {(['Waiting', 'Cooking', 'Ready', 'Delivered', 'All'] as const).map((status) => {
                const count = 
                  status === 'All' ? orders.length : 
                  status === 'Waiting' ? kitchenStats.waiting :
                  status === 'Cooking' ? kitchenStats.cooking :
                  status === 'Ready' ? kitchenStats.ready : kitchenStats.delivered;

                const isActive = kitchenFilter === status;

                return (
                  <button
                    key={status}
                    onClick={() => {
                      setKitchenFilter(status);
                      playSynthBeep(440);
                    }}
                    className={`flex-1 min-w-[70px] py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                    }`}
                  >
                    <span>{status}</span>
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-950/40 text-[9px] font-mono text-slate-300">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Orders Feed Grid */}
            {filteredOrders.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-900 rounded-3xl py-16 text-center">
                <ChefHat className="w-10 h-10 text-slate-700 mx-auto mb-3 animate-pulse" />
                <h4 className="text-sm font-black text-slate-400">No Orders Standby</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">There are no orders currently listed in the "{kitchenFilter}" queue. Scanning table QR codes generates orders instantly.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOrders.map((order) => {
                  const isAlertTable = activeTableAlert === order.table;
                  
                  return (
                    <div 
                      key={order.id}
                      className={`bg-slate-900/40 border rounded-2xl flex flex-col justify-between overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl hover:border-slate-800 ${
                        order.status === 'Waiting' ? 'border-amber-500/30 hover:border-amber-500/50' :
                        order.status === 'Cooking' ? 'border-orange-500/30 hover:border-orange-500/50' :
                        order.status === 'Ready' ? 'border-emerald-500/40 hover:border-emerald-500/60 animate-pulse' : 'border-slate-900'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-base font-black text-white font-display">T-{order.table}</h4>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                              order.status === 'Waiting' ? 'bg-amber-500/10 text-amber-400' :
                              order.status === 'Cooking' ? 'bg-orange-500/10 text-orange-400' :
                              order.status === 'Ready' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-950 text-slate-500'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{order.orderNumber} • {order.time}</p>
                        </div>

                        {/* Special Instructions Alerts */}
                        {order.specialInstructions && (
                          <div className="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400" title={order.specialInstructions}>
                            <AlertCircle className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      {/* Items Checklist Checklist */}
                      <div className="p-4 flex-1 space-y-3 bg-slate-900/10">
                        {order.specialInstructions && (
                          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-2.5 text-[10px] text-amber-300 italic">
                            <span className="font-bold uppercase tracking-wider not-italic text-amber-400 block mb-0.5">Kitchen Note:</span>
                            "{order.specialInstructions}"
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-mono mb-1">Checklist Ingredients:</p>
                          {order.items.map((item: any) => {
                            const isItemReady = item.isReady || item.status === 'Ready';
                            const isItemCooking = item.status === 'Cooking';

                            return (
                              <div 
                                key={item.id} 
                                className={`flex items-start justify-between gap-2 p-2 rounded-xl transition-all border ${
                                  isItemReady 
                                    ? 'bg-emerald-500/5 border-emerald-500/10 text-slate-400 line-through' 
                                    : isItemCooking 
                                    ? 'bg-orange-500/5 border-orange-500/10 text-slate-200'
                                    : 'bg-slate-950/20 border-slate-900 text-slate-100'
                                }`}
                              >
                                <div className="flex items-start gap-2.5">
                                  <button
                                    onClick={async () => {
                                      if (onToggleItemReady) {
                                        const newReadyState = !isItemReady;
                                        playSynthBeep(newReadyState ? 660 : 330);
                                        await onToggleItemReady(order.id, item.id, newReadyState);
                                      }
                                    }}
                                    className="mt-0.5 shrink-0 hover:text-indigo-400 text-slate-500 transition-colors cursor-pointer"
                                  >
                                    {isItemReady ? (
                                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-700" />
                                    )}
                                  </button>

                                  <div>
                                    <span className="text-xs font-black">
                                      {item.quantity}x {item.name}
                                    </span>
                                    {item.specialInstructions && (
                                      <span className="block text-[9px] text-amber-400 font-medium italic mt-0.5">
                                        Note: {item.specialInstructions}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Custom quick item tag toggle */}
                                <div className="flex gap-1">
                                  {(['Waiting', 'Cooking', 'Ready'] as const).map((iState) => {
                                    const isCurrent = (item.status || (item.isReady ? 'Ready' : 'Waiting')) === iState;
                                    return (
                                      <button
                                        key={iState}
                                        onClick={async () => {
                                          if (onUpdateItemStatus) {
                                            playSynthBeep(520);
                                            await onUpdateItemStatus(order.id, item.id, iState);
                                          }
                                        }}
                                        className={`text-[8px] font-black uppercase px-1 py-0.5 rounded transition-all cursor-pointer ${
                                          isCurrent
                                            ? iState === 'Ready' ? 'bg-emerald-500 text-white' :
                                              iState === 'Cooking' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-100'
                                            : 'bg-slate-950/50 hover:bg-slate-900 text-slate-500 hover:text-slate-300'
                                        }`}
                                      >
                                        {iState.substring(0, 4)}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Card Bottom CTA Actions */}
                      <div className="p-4 bg-slate-900/40 border-t border-slate-850">
                        {order.status === 'Waiting' && (
                          <button
                            onClick={() => onUpdateStatus(order.id, 'Cooking')}
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                          >
                            <Flame className="w-4 h-4" />
                            <span>🔥 Start Cooking</span>
                          </button>
                        )}

                        {order.status === 'Cooking' && (
                          <button
                            onClick={() => onUpdateStatus(order.id, 'Ready')}
                            className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-orange-600/15"
                          >
                            <Check className="w-4 h-4" />
                            <span>🔔 Call Customer Ready</span>
                          </button>
                        )}

                        {order.status === 'Ready' && (
                          <button
                            onClick={() => onUpdateStatus(order.id, 'Delivered')}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/15"
                          >
                            <CheckSquare className="w-4 h-4" />
                            <span>✅ Order Delivered</span>
                          </button>
                        )}

                        {order.status === 'Delivered' && (
                          <div className="text-center py-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            🎉 Order Archived & Delivered
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* Tab 3: Audits & Daily Collections */}
        {activeTab === 'audits' && (
          <div className="space-y-6">
            {/* Header / Intro */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/30 p-6 rounded-3xl border border-slate-900">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400">Daily Collections & Audit Ledger</h3>
                <p className="text-xs text-slate-400 mt-1">Review everyday collections, guest suite charges, and print ledger audits.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  playSynthBeep(580);
                  // Create a beautiful hotel audit receipt text
                  const totalRev = combinedOrders.reduce((sum, o) => sum + o.totalPrice, 0);
                  const textLedger = `
===================================================
           ${hotelName.toUpperCase()}
            DAILY AUDIT LEDGER STATEMENT
===================================================
Generated: ${new Date().toLocaleString()}
Manager:   ${managerName}
Mode:      ${isHotelMode ? 'Hotel Suite Room Service' : 'Restaurant Dine-In'}
---------------------------------------------------
SUMMARY STATISTICS:
  Total Collections:  ₹${totalRev.toFixed(2)}
  Total Orders Placed: ${combinedOrders.length}
  UPI Scan Payments:  ₹${(totalRev * 0.7).toFixed(2)} (70%)
  Card Swipe:         ₹${(totalRev * 0.15).toFixed(2)} (15%)
  Cash Drawer:        ₹${(totalRev * 0.15).toFixed(2)} (15%)
---------------------------------------------------
ORDER DISPATCH DETAIL:
${combinedOrders.map(o => `[${o.time}] ${o.orderNumber} | ${isHotelMode ? 'Room' : 'Table'} ${o.table} | ₹${o.totalPrice.toFixed(2)} | Status: ${o.status}
  Items: ${o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`).join('\n\n')}
===================================================
               END OF REPORT
===================================================`;
                  
                  try {
                    navigator.clipboard.writeText(textLedger);
                    alert("Daily Audit Ledger statement copied to clipboard! You can paste it into Notepad, Excel, or print directly.");
                  } catch (err) {
                    console.log(textLedger);
                    alert("Export rendered to development console logs successfully!");
                  }
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-600/15 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Export Audit Ledger Statement</span>
              </button>
            </div>

            {/* Collection KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl">
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Gross Everyday Collections</span>
                <div className="text-2xl font-black text-white mt-1.5 font-display">₹{combinedOrders.reduce((sum, o) => sum + o.totalPrice, 0).toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">100% Consolidated Total</div>
              </div>

              <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl">
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-mono">UPI / QR Collections (Sim)</span>
                <div className="text-2xl font-black text-white mt-1.5 font-display">₹{(combinedOrders.reduce((sum, o) => sum + o.totalPrice, 0) * 0.7).toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">70% Contactless digital scan</div>
              </div>

              <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl">
                <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest font-mono">Cash Drawer Balance (Sim)</span>
                <div className="text-2xl font-black text-white mt-1.5 font-display">₹{(combinedOrders.reduce((sum, o) => sum + o.totalPrice, 0) * 0.15).toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">15% On-prem cash receipts</div>
              </div>

              <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl">
                <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest font-mono">Card & POS Payments (Sim)</span>
                <div className="text-2xl font-black text-white mt-1.5 font-display">₹{(combinedOrders.reduce((sum, o) => sum + o.totalPrice, 0) * 0.15).toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">15% Credit/Debit chip readers</div>
              </div>
            </div>

            {/* Filters bar */}
            <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-2xl flex flex-col xl:flex-row items-center gap-4">
              <div className="relative w-full xl:flex-1">
                <input
                  type="text"
                  placeholder={`Search by Order Number or ${isHotelMode ? 'Room' : 'Table'}...`}
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                />
              </div>

              {/* Date Filter selector */}
              <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setShowYesterdayHistory(false);
                    playSynthBeep(440);
                  }}
                  className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    !showYesterdayHistory
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Today Only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowYesterdayHistory(true);
                    playSynthBeep(440);
                  }}
                  className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    showYesterdayHistory
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Include Yesterday</span>
                </button>
              </div>

              <div className="flex gap-1.5 overflow-x-auto w-full xl:w-auto shrink-0 pb-1 xl:pb-0">
                {(['All', 'Waiting', 'Cooking', 'Ready', 'Delivered'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setAuditStatusFilter(status);
                      playSynthBeep(480);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                      auditStatusFilter === status
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit List of orders */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-900">
                      <th className="py-3.5 px-5">Order #</th>
                      <th className="py-3.5 px-4">Time</th>
                      <th className="py-3.5 px-4">{isHotelMode ? 'Room Number' : 'Table Unit'}</th>
                      <th className="py-3.5 px-4">Dishes Count</th>
                      <th className="py-3.5 px-4">Amount</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-5 text-right">Audits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {combinedOrders
                      .filter(o => {
                        const matchesSearch = o.orderNumber.toLowerCase().includes(auditSearchQuery.toLowerCase()) || 
                                              o.table.toString().includes(auditSearchQuery);
                        const matchesStatus = auditStatusFilter === 'All' || o.status === auditStatusFilter;
                        return matchesSearch && matchesStatus;
                      })
                      .map((o) => {
                        return (
                          <tr key={o.id} className="hover:bg-slate-900/30 transition-colors text-slate-300">
                            <td className="py-3 px-5 font-mono font-bold text-white">{o.orderNumber}</td>
                            <td className="py-3 px-4 font-mono text-slate-400">
                              <div className="font-bold text-slate-200 text-[11px]">{o.date || "2026-07-14"}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{o.time}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-indigo-400">
                                {isHotelMode ? 'Room' : 'Table'} {o.table}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold">
                              {o.items.reduce((s, item) => s + item.quantity, 0)} Items
                            </td>
                            <td className="py-3 px-4 font-black text-white">₹{o.totalPrice.toFixed(2)}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                o.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                o.status === 'Ready' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                o.status === 'Cooking' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                                'bg-slate-800 text-slate-400'
                              }`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="py-3 px-5 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAuditOrder(o);
                                  playSynthBeep(520);
                                }}
                                className="px-2.5 py-1 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-[10px] font-bold text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                              >
                                View Receipt
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {combinedOrders.filter(o => {
                      const matchesSearch = o.orderNumber.toLowerCase().includes(auditSearchQuery.toLowerCase()) || 
                                            o.table.toString().includes(auditSearchQuery);
                      const matchesStatus = auditStatusFilter === 'All' || o.status === auditStatusFilter;
                      return matchesSearch && matchesStatus;
                    }).length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                          No collections found for this query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Dynamic Profile Settings Modal */}
      {showProfileModal && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-pointer" 
          id="profile-modal-overlay"
          onClick={() => {
            setShowProfileModal(false);
            playSynthBeep(330);
          }}
        >
          <div 
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">Establishment Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowProfileModal(false);
                  playSynthBeep(330);
                }}
                className="text-slate-400 hover:text-white text-xs font-bold uppercase transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Go Home</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
              
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-slate-950 pb-1.5">1. Hotel & Restaurant Information</h4>
                
                {/* Hotel Name input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Establishment / Hotel Name</label>
                  <input
                    type="text"
                    required
                    value={hotelName}
                    onChange={(e) => setHotelName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                    placeholder="e.g. BiteExpress Grand Hotel"
                  />
                </div>

                {/* Slogan input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Profile Slogan or Description</label>
                  <input
                    type="text"
                    required
                    value={hotelSlogan}
                    onChange={(e) => setHotelSlogan(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                    placeholder="e.g. Luxury Suite Service & Dining"
                  />
                </div>

                {/* Manager Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">General Manager / Owner Name</label>
                  <input
                    type="text"
                    required
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                    placeholder="e.g. Adhia"
                  />
                </div>

                {/* Operation Mode selector */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Central Dispatch Mode</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setIsHotelMode(true);
                        playSynthBeep(520);
                      }}
                      className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isHotelMode 
                          ? 'bg-indigo-600 text-white shadow' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Hotel Suite Mode</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsHotelMode(false);
                        playSynthBeep(520);
                      }}
                      className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        !isHotelMode 
                          ? 'bg-indigo-600 text-white shadow' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <ChefHat className="w-3.5 h-3.5" />
                      <span>Restaurant Mode</span>
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-relaxed font-mono">
                    {isHotelMode 
                      ? "Suite Mode active. Scanning flyers, ordering routes, and kitchen monitors will label entities as suites and rooms."
                      : "Dining Mode active. Standard on-prem table numbering is used."
                    }
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest border-b border-slate-950 pb-1.5">2. Secure PIN Password Change</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">Current PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-1.5 text-xs text-white font-mono text-center outline-none"
                      placeholder="••••"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">New PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-1.5 text-xs text-white font-mono text-center outline-none"
                      placeholder="••••"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">Confirm New PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-1.5 text-xs text-white font-mono text-center outline-none"
                      placeholder="••••"
                    />
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 font-mono">Leave PIN inputs blank to keep current PIN code. Changing the PIN will affect all admin panel locks immediately.</p>
              </div>

              {/* Status and Error Alerts */}
              {pinError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-[10px] font-bold">
                  {pinError}
                </div>
              )}
              {pinSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[10px] font-bold">
                  {pinSuccess}
                </div>
              )}

              {/* Form Actions */}
              <div className="pt-3 border-t border-slate-950 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    playSynthBeep(330);
                  }}
                  className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-white transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Cancel & Go Home</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors shadow cursor-pointer text-center"
                >
                  Save Profile & Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Receipt Audit Voucher modal */}
      {selectedAuditOrder && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-pointer" 
          id="audit-order-modal"
          onClick={() => {
            setSelectedAuditOrder(null);
            playSynthBeep(330);
          }}
        >
          <div 
            className="w-full max-w-md bg-white text-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Voucher Header */}
            <div className="bg-slate-50 px-6 py-4.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Hotel Audit Voucher</h4>
                <h3 className="text-sm font-black text-slate-900 font-mono mt-0.5">{selectedAuditOrder.orderNumber}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedAuditOrder(null);
                  playSynthBeep(330);
                }}
                className="text-slate-400 hover:text-slate-900 text-xs font-bold uppercase transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>

            {/* Voucher Bill Details */}
            <div className="p-6 space-y-4 text-slate-850">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Suite dispatch room:</span>
                  <span className="font-bold text-indigo-600">{isHotelMode ? 'Room' : 'Table'} {selectedAuditOrder.table}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Date Registered:</span>
                  <span className="font-mono text-slate-700">{selectedAuditOrder.date || "2026-07-14"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Time Registered:</span>
                  <span className="font-mono text-slate-700">{selectedAuditOrder.time}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className="font-bold text-emerald-600">Simulated Paid (UPI/Cash)</span>
                </div>
              </div>

              {/* Items List */}
              <div className="border-t border-dashed border-slate-300 pt-3 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ordered items breakdown:</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-slate-900">
                  {selectedAuditOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs font-medium">
                      <span>{item.quantity}x {item.name}</span>
                      <span className="font-bold">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Instructions */}
              {selectedAuditOrder.specialInstructions && (
                <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-xl text-[10px] text-amber-800">
                  <span className="font-black uppercase tracking-wide block">Order Instructions:</span>
                  <p className="mt-0.5 font-medium leading-relaxed">{selectedAuditOrder.specialInstructions}</p>
                </div>
              )}

              {/* Surcharges & Total */}
              <div className="border-t border-slate-300 pt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Service & GST (Included):</span>
                  <span className="font-medium">₹0.00</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-950">
                  <span>Grand Total Collection:</span>
                  <span>₹{selectedAuditOrder.totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playSynthBeep(520);
                    alert("Sending print instruction to Simulated POS printer...");
                  }}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-colors cursor-pointer text-center"
                >
                  Print Voucher
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAuditOrder(null);
                    playSynthBeep(330);
                  }}
                  className="flex-1 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-colors cursor-pointer text-center"
                >
                  Dismiss
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
