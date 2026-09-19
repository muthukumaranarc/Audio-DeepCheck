import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Signal } from 'lucide-react';
import { ConnectionState, MicPermissionState } from '../../types';

interface MobileFrameProps {
  children: React.ReactNode;
  connectionState: ConnectionState;
  micPermissionState: MicPermissionState;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  children,
  connectionState,
  micPermissionState
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-[390px] h-[780px] bg-slate-950 rounded-[48px] p-3 shadow-2xl shadow-emerald-950/30 border-4 border-slate-800 flex flex-col justify-between overflow-hidden">
      {/* Outer Phone Border Highlight */}
      <div className="absolute inset-0 rounded-[44px] pointer-events-none border border-slate-700/40" />

      {/* Top Status Bar */}
      <div className="relative z-30 pt-3 px-6 pb-2 flex items-center justify-between text-xs text-slate-300">
        <span className="font-semibold text-[13px] tracking-tight">{currentTime || '09:41'}</span>

        {/* Dynamic Island Notch */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2.5 w-24 h-5 bg-black rounded-full flex items-center justify-center gap-1.5 border border-slate-800">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-blue-950" />
          </div>
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              micPermissionState === 'GRANTED' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-800'
            }`}
            title={`Microphone: ${micPermissionState}`}
          />
        </div>

        {/* Status Icons */}
        <div className="flex items-center gap-2">
          <Signal className="w-3.5 h-3.5" />
          <Wifi
            className={`w-3.5 h-3.5 ${
              connectionState === 'ONLINE' || connectionState === 'CONNECTED'
                ? 'text-slate-300'
                : 'text-amber-400 animate-pulse'
            }`}
          />
          <Battery className="w-4 h-4 text-slate-300" />
        </div>
      </div>

      {/* Main Screen Content Area */}
      <div className="relative flex-1 bg-gradient-to-b from-slate-900 to-slate-950 rounded-[36px] overflow-hidden flex flex-col">
        {children}
      </div>

      {/* Bottom Home Indicator Bar */}
      <div className="relative z-30 pt-2 pb-1 flex justify-center">
        <div className="w-32 h-1 bg-slate-600 rounded-full" />
      </div>
    </div>
  );
};
