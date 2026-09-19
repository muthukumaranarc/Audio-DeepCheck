import React from 'react';
import { CheckCircle2, Clock, PhoneForwarded, RotateCcw, Shield } from 'lucide-react';
import { CallDetailsResponse } from '../../types';

interface EndedCallScreenProps {
  callId: string | null;
  receiver: string;
  durationSeconds: number;
  completedDetails: CallDetailsResponse | null;
  onReturnHome: () => void;
}

export const EndedCallScreen: React.FC<EndedCallScreenProps> = ({
  callId,
  receiver,
  durationSeconds,
  completedDetails,
  onReturnHome
}) => {
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="flex-1 flex flex-col justify-between items-center p-6 text-center select-none">
      {/* Top Header */}
      <div className="pt-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-3">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Call Ended</h2>
        <div className="text-xs text-slate-400 mt-0.5">{receiver}</div>
      </div>

      {/* Summary Card */}
      <div className="w-full my-auto bg-slate-900/80 rounded-2xl border border-slate-800 p-4 text-left space-y-3 shadow-lg">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 pb-2 flex items-center justify-between">
          <span>Call Summary</span>
          <span className="text-emerald-400 font-bold">COMPLETED</span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Duration:
            </span>
            <span className="font-semibold text-slate-200">
              {formatTimer(completedDetails?.durationSec ?? durationSeconds)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400 flex items-center gap-1.5">
              <PhoneForwarded className="w-3.5 h-3.5 text-slate-500" />
              Session ID:
            </span>
            <span className="font-mono text-[11px] text-slate-300">
              {callId || 'N/A'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              Backend Sync:
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">
              Persisted in MongoDB
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 text-center">
          Audio capture stopped. Hardware released.
        </div>
      </div>

      {/* Bottom Action: Return Home */}
      <div className="w-full pb-6">
        <button
          onClick={onReturnHome}
          className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-emerald-400 font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>New Simulated Call</span>
        </button>
      </div>
    </div>
  );
};
