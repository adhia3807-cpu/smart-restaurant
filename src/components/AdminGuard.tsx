import React, { useState, useEffect } from 'react';
import { Lock, Unlock, ShieldAlert, Delete } from 'lucide-react';

interface AdminGuardProps {
  onSuccess: () => void;
}

export default function AdminGuard({ onSuccess }: AdminGuardProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const CORRECT_PIN = localStorage.getItem('adminPIN') || '1234';

  const handleKeyPress = (num: string) => {
    if (isSuccess) return;
    if (error) setError(false);
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
    }
  };

  const handleBackspace = () => {
    if (isSuccess) return;
    if (error) setError(false);
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isSuccess) return;
    if (error) setError(false);
    setPin('');
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === CORRECT_PIN) {
        setIsSuccess(true);
        setError(false);
        // Save to localStorage
        localStorage.setItem('adminAuth', 'true');
        // Delay callback for visual transition
        setTimeout(() => {
          onSuccess();
        }, 800);
      } else {
        setShake(true);
        setError(true);
        setPin('');
        // Play error sound/beep if audio context available
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, ctx.currentTime);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          osc.start();
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.stop(ctx.currentTime + 0.35);
        } catch (e) {}

        setTimeout(() => setShake(false), 500);
      }
    }
  }, [pin, onSuccess]);

  // Handle keyboard inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSuccess) return;
      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isSuccess, error]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-white select-none">
      
      {/* Decorative radial glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl flex flex-col items-center relative z-10">
        
        {/* Lock Icon Header */}
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 ${
          isSuccess 
            ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 scale-110' 
            : error 
              ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400 scale-95' 
              : 'bg-indigo-500/10 border border-slate-800 text-indigo-400'
        }`}>
          {isSuccess ? (
            <Unlock className="w-8 h-8 animate-bounce" />
          ) : (
            <Lock className={`w-7 h-7 ${pin.length > 0 ? 'animate-pulse' : ''}`} />
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl font-black tracking-tight text-center uppercase font-display bg-gradient-to-r from-slate-100 to-indigo-200 bg-clip-text text-transparent">
          BiteExpress Portal
        </h1>
        <p className="text-slate-400 text-xs mt-1 font-medium tracking-wide">
          {isSuccess ? 'Access Granted! Loading...' : 'Enter Admin Access PIN to unlock'}
        </p>

        {/* PIN Indicators */}
        <div className={`flex gap-4 my-8 ${shake ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3].map((index) => {
            const isActive = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border transition-all duration-200 ${
                  isSuccess 
                    ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-lg shadow-emerald-500/30'
                    : isActive
                      ? error 
                        ? 'bg-rose-500 border-rose-500 scale-105 shadow-md shadow-rose-500/20'
                        : 'bg-indigo-500 border-indigo-400 scale-105 shadow-lg shadow-indigo-500/40'
                      : 'border-slate-700 bg-slate-950/40'
                }`}
              />
            );
          })}
        </div>

        {/* Error Notification */}
        <div className="h-6 flex items-center justify-center mb-4">
          {error && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 py-1 px-3 rounded-full animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Invalid security PIN. Please try again.</span>
            </div>
          )}
        </div>

        {/* Num Pad Grid */}
        <div className="grid grid-cols-3 gap-3.5 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="aspect-square rounded-2xl bg-slate-950/60 border border-slate-800/40 hover:border-slate-700 hover:bg-slate-850 active:scale-95 text-lg font-black text-slate-200 font-mono transition-all flex items-center justify-center cursor-pointer"
            >
              {num}
            </button>
          ))}
          
          {/* C (Clear) */}
          <button
            onClick={handleClear}
            className="aspect-square rounded-2xl bg-slate-950/20 border border-transparent hover:bg-slate-900/40 hover:border-slate-800 text-xs font-bold text-slate-400 transition-all flex items-center justify-center cursor-pointer"
          >
            Clear
          </button>

          {/* 0 */}
          <button
            onClick={() => handleKeyPress('0')}
            className="aspect-square rounded-2xl bg-slate-950/60 border border-slate-800/40 hover:border-slate-700 hover:bg-slate-850 active:scale-95 text-lg font-black text-slate-200 font-mono transition-all flex items-center justify-center cursor-pointer"
          >
            0
          </button>

          {/* Backspace icon */}
          <button
            onClick={handleBackspace}
            className="aspect-square rounded-2xl bg-slate-950/20 border border-transparent hover:bg-slate-900/40 hover:border-slate-800 text-slate-400 hover:text-slate-200 transition-all flex items-center justify-center cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>


      </div>
    </div>
  );
}
