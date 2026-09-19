import React from 'react';
import { PhoneOff, User } from 'lucide-react';

interface ConnectingScreenProps {
  receiver: string;
  caller: string;
  onCancel: () => void;
}

export const ConnectingScreen: React.FC<ConnectingScreenProps> = ({
  receiver,
  caller,
  onCancel
}) => {
  return (
    <div className="flex-1 flex flex-col justify-between items-center p-6 text-center">
      {/* Top Header */}
      <div className="pt-8">
        <div className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-1 flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Connecting Call
        </div>
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">{receiver}</h2>
        <div className="text-xs text-slate-400 mt-0.5">Calling from: {caller}</div>
      </div>

      {/* Center Pulsing Avatar */}
      <div className="relative my-auto flex items-center justify-center">
        {/* Pulsing rings */}
        <div className="absolute w-44 h-44 rounded-full border border-emerald-500/20 animate-ping" />
        <div className="absolute w-36 h-36 rounded-full border border-emerald-500/30 animate-pulse" />
        
        {/* Avatar Circle */}
        <div className="relative w-28 h-28 rounded-full bg-gradient-to-tr from-slate-800 via-slate-700 to-slate-800 border-2 border-emerald-500/40 flex items-center justify-center shadow-xl shadow-emerald-950/40">
          <User className="w-12 h-12 text-emerald-400" />
        </div>
      </div>

      {/* Status & Cancel Action */}
      <div className="w-full pb-8 flex flex-col items-center gap-6">
        <div className="text-xs text-slate-400 font-medium animate-pulse">
          Establishing encrypted voice channel...
        </div>

        {/* End / Cancel Call Button */}
        <button
          onClick={onCancel}
          className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-900/40 transition-all cursor-pointer"
          aria-label="Cancel Call"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};
