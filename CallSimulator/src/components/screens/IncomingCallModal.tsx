import React from 'react';
import { Phone, PhoneOff, User } from 'lucide-react';
import { UserProfile } from '../../types';

interface IncomingCallModalProps {
  caller: UserProfile;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  caller,
  onAccept,
  onDecline,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xs bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
        {/* Pulsing Avatar */}
        <div className="relative mb-6">
          <div className="absolute -inset-3 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="absolute -inset-1 rounded-full bg-emerald-500/30 animate-pulse" />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-emerald-400 flex items-center justify-center shadow-lg">
            <User className="w-10 h-10 text-emerald-400" />
          </div>
        </div>

        {/* Caller Info */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2 animate-bounce">
          Incoming Call
        </div>
        <h3 className="text-xl font-bold text-white tracking-tight">{caller.displayName}</h3>
        <p className="text-sm font-mono text-slate-400 mt-0.5">{caller.phoneNumber}</p>

        <p className="text-xs text-slate-400 mt-4 px-2">
          Two-person phone simulation. Accept to stream bidirectional audio.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-between w-full mt-8 px-4">
          {/* Decline */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={onDecline}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-900/40 transition-all"
              title="Decline Call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-xs font-medium text-slate-400">Decline</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={onAccept}
              className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-900/40 animate-pulse transition-all"
              title="Accept Call"
            >
              <Phone className="w-6 h-6" />
            </button>
            <span className="text-xs font-medium text-emerald-400">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};
