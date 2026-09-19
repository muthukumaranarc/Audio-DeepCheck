import React, { useState, useEffect } from 'react';
import { Phone, Delete, Shield, AlertCircle, Mic, RefreshCw, UserCheck, ArrowRightLeft } from 'lucide-react';
import { ConnectionState, MicPermissionState, CallSummary, CallFailureState, UserProfile, UserPresence } from '../../types';
import { RecentCallsList } from '../common/RecentCallsList';
import { callApiService } from '../../services/CallApiService';

interface DialerScreenProps {
  currentUser?: UserProfile;
  peerUser?: UserProfile;
  presenceList?: UserPresence[];
  onSwitchIdentity?: () => void;
  onStartCall: (receiver: string, caller?: string) => void;
  connectionState: ConnectionState;
  micPermissionState: MicPermissionState;
  onRequestMicPermission: () => void;
  failureState: CallFailureState | null;
  errorMessage: string | null;
}

export const DialerScreen: React.FC<DialerScreenProps> = ({
  currentUser = { userId: 'USER-A', phoneNumber: '+91 90000 00001', displayName: 'Muthu' },
  peerUser = { userId: 'USER-B', phoneNumber: '+91 90000 00002', displayName: 'Friend' },
  presenceList = [],
  onSwitchIdentity,
  onStartCall,
  connectionState,
  micPermissionState,
  onRequestMicPermission,
  failureState,
  errorMessage,
}) => {
  const [number, setNumber] = useState<string>(peerUser.phoneNumber);
  const [recentCalls, setRecentCalls] = useState<CallSummary[]>([]);
  const [isLoadingRecents, setIsLoadingRecents] = useState<boolean>(false);
  const [showRecents, setShowRecents] = useState<boolean>(false);

  // Sync dialed number when peerUser changes
  useEffect(() => {
    setNumber(peerUser.phoneNumber);
  }, [peerUser.phoneNumber]);

  const peerPresence = presenceList.find(
    (u) => u.userId === peerUser.userId || u.phoneNumber.replace(/\s+/g, '') === peerUser.phoneNumber.replace(/\s+/g, '')
  );
  const peerStatus = peerPresence ? peerPresence.status : 'ONLINE';

  const fetchRecentCalls = async () => {
    setIsLoadingRecents(true);
    try {
      const calls = await callApiService.getRecentCalls();
      setRecentCalls(calls);
    } catch {
      // ignore
    } finally {
      setIsLoadingRecents(false);
    }
  };

  useEffect(() => {
    fetchRecentCalls();
  }, []);

  const handleKeyPress = (digit: string) => {
    if (number.length < 18) {
      setNumber((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    setNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = () => {
    const trimmed = number.trim();
    if (!trimmed) return;
    onStartCall(trimmed, currentUser.displayName);
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-4 overflow-y-auto">
      {/* App Header & Identity Banner */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs tracking-wide uppercase">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>DeepCheck 2-User Sim</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Backend Status Pill */}
            <span
              className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-medium ${
                connectionState === 'ONLINE' || connectionState === 'CONNECTED'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connectionState === 'ONLINE' || connectionState === 'CONNECTED'
                    ? 'bg-emerald-400'
                    : 'bg-amber-400 animate-ping'
                }`}
              />
              {connectionState}
            </span>

            {/* Mic Status Pill */}
            <button
              onClick={onRequestMicPermission}
              className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                micPermissionState === 'GRANTED'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              }`}
              title="Click to request microphone permission"
            >
              <Mic className="w-2.5 h-2.5" />
              {micPermissionState === 'GRANTED' ? 'MIC READY' : 'ALLOW MIC'}
            </button>
          </div>
        </div>

        {/* Identity Selector Pill */}
        <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-2 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-left">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-200">{currentUser.displayName} (Device)</div>
              <div className="text-[9px] font-mono text-slate-400">{currentUser.phoneNumber}</div>
            </div>
          </div>

          {onSwitchIdentity && (
            <button
              onClick={onSwitchIdentity}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-[10px] text-slate-300 border border-slate-600 transition-all"
              title="Switch user identity (User A / User B)"
            >
              <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
              <span>Switch Identity</span>
            </button>
          )}
        </div>

        {/* Peer Presence Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-1.5 mb-2 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px]">Peer Target:</span>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">{peerUser.displayName}</span>
            <span
              className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded font-mono ${
                peerStatus === 'ONLINE'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : peerStatus === 'IN_CALL' || peerStatus === 'BUSY'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              ● {peerStatus}
            </span>
          </div>
        </div>

        {/* Failure Message Toast */}
        {failureState && errorMessage && (
          <div className="mb-2 p-2 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Number Display & Dialed Text */}
      <div className="my-1 flex flex-col items-center">
        <div className="text-2xl font-mono font-bold tracking-wider text-slate-100 min-h-[36px] flex items-center justify-center">
          {number || <span className="text-slate-600 text-xl font-sans font-normal">Enter phone number...</span>}
        </div>
      </div>

      {/* Keypad Grid */}
      <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto w-full my-auto">
        {[
          { key: '1', sub: '' },
          { key: '2', sub: 'ABC' },
          { key: '3', sub: 'DEF' },
          { key: '4', sub: 'GHI' },
          { key: '5', sub: 'JKL' },
          { key: '6', sub: 'MNO' },
          { key: '7', sub: 'PQRS' },
          { key: '8', sub: 'TUV' },
          { key: '9', sub: 'WXYZ' },
          { key: '*', sub: '' },
          { key: '0', sub: '+' },
          { key: '#', sub: '' },
        ].map(({ key, sub }) => (
          <button
            key={key}
            onClick={() => handleKeyPress(key)}
            className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 border border-slate-700/60 flex flex-col items-center justify-center text-slate-100 font-medium transition-all active:scale-95 shadow-sm"
          >
            <span className="text-base font-bold leading-none">{key}</span>
            {sub && <span className="text-[8px] text-slate-400 tracking-wider leading-none mt-0.5">{sub}</span>}
          </button>
        ))}
      </div>

      {/* Bottom Action Row: History Toggle, Call, Delete */}
      <div className="pt-2 flex items-center justify-around max-w-[260px] mx-auto w-full">
        {/* Toggle Recents */}
        <button
          onClick={() => setShowRecents(!showRecents)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          title="Recent Calls"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Big Call Button */}
        <button
          onClick={handleCall}
          disabled={!number.trim()}
          className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center shadow-lg shadow-emerald-900/40 transition-all cursor-pointer"
          aria-label="Call"
        >
          <Phone className="w-6 h-6" />
        </button>

        {/* Backspace / Delete */}
        <button
          onClick={handleDelete}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          title="Delete Digit"
        >
          <Delete className="w-4 h-4" />
        </button>
      </div>

      {/* Recent Calls Modal / Drawer */}
      {showRecents && (
        <div className="mt-2 p-2 bg-slate-900 border border-slate-700/80 rounded-2xl">
          <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-800 text-xs font-semibold text-slate-300">
            <span>Recent Simulated Calls</span>
            <button onClick={() => setShowRecents(false)} className="text-slate-400 hover:text-slate-200">✕</button>
          </div>
          <RecentCallsList
            calls={recentCalls}
            isLoading={isLoadingRecents}
            onSelectNumber={(selectedNum: string) => {
              setNumber(selectedNum);
              setShowRecents(false);
            }}
          />
        </div>
      )}
    </div>
  );
};
