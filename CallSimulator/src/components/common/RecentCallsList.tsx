import React from 'react';
import { Phone, Clock, ArrowDownLeft, ShieldAlert } from 'lucide-react';
import { CallSummary } from '../../types';

interface RecentCallsListProps {
  calls: CallSummary[];
  isLoading?: boolean;
  onSelectNumber: (number: string) => void;
}

export const RecentCallsList: React.FC<RecentCallsListProps> = ({
  calls,
  isLoading = false,
  onSelectNumber
}) => {
  if (isLoading) {
    return (
      <div className="py-6 text-center text-xs text-slate-400">
        <div className="inline-block animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full mb-2" />
        <div>Loading recent calls...</div>
      </div>
    );
  }

  if (!calls || calls.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-slate-500">
        No recent calls found. Place a call to start simulating.
      </div>
    );
  }

  const formatDuration = (sec?: number) => {
    if (sec === undefined || sec === null) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="divide-y divide-slate-800/80 max-h-48 overflow-y-auto custom-scrollbar">
      {calls.slice(0, 5).map((call) => (
        <button
          key={call.callId}
          onClick={() => onSelectNumber(call.receiver)}
          className="w-full flex items-center justify-between py-2.5 px-3 hover:bg-slate-800/50 transition-colors text-left rounded-lg group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors">
              <Phone className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-200 group-hover:text-emerald-300 transition-colors">
                {call.receiver}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="flex items-center gap-0.5">
                  <ArrowDownLeft className="w-2.5 h-2.5 text-emerald-400" />
                  {formatTime(call.createdAt)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDuration(call.durationSec)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                call.status === 'COMPLETED'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : call.status === 'ACTIVE' || call.status === 'ANALYZING'
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30 animate-pulse'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {call.status}
            </span>
            {call.latestDecision === 'AI_GENERATED' && (
              <div className="flex items-center justify-end gap-0.5 text-[9px] text-red-400 mt-1 font-semibold">
                <ShieldAlert className="w-2.5 h-2.5" />
                FLAGGED
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};
