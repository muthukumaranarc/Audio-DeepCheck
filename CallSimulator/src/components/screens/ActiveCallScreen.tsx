import React from 'react';
import { PhoneOff, Mic, MicOff, Volume2, ShieldCheck, User, Activity, Bot } from 'lucide-react';
import { AudioVisualizer } from '../common/AudioVisualizer';
import { ConnectionState, ParticipantRole, AnalysisUpdateEvent } from '../../types';

interface ActiveCallScreenProps {
  callId: string | null;
  receiver: string;
  caller: string;
  participantRole?: ParticipantRole;
  elapsedSeconds: number;
  audioLevel: number;
  remoteAudioLevel?: number;
  latestAnalysis?: AnalysisUpdateEvent | null;
  isMuted: boolean;
  connectionState: ConnectionState;
  onToggleMute: () => void;
  onEndCall: () => void;
}

export const ActiveCallScreen: React.FC<ActiveCallScreenProps> = ({
  callId,
  receiver,
  caller,
  participantRole = 'CALLER',
  elapsedSeconds,
  audioLevel,
  remoteAudioLevel = 0,
  latestAnalysis,
  isMuted,
  connectionState,
  onToggleMute,
  onEndCall,
}) => {
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col justify-between items-center p-4 text-center select-none overflow-y-auto">
      {/* Top Details & Timer */}
      <div className="pt-2 w-full">
        {/* Role & Session Tag */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="w-3 h-3" />
            {callId || 'CALL-ACTIVE'}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {participantRole}
          </span>
        </div>

        <h2 className="text-xl font-bold text-slate-100 tracking-tight">{receiver}</h2>
        <div className="text-xs text-slate-400">Caller: {caller}</div>

        {/* Dynamic Timer */}
        <div className="mt-2 inline-block px-4 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-base font-mono font-bold text-emerald-400 tracking-widest shadow-inner">
          {formatTimer(elapsedSeconds)}
        </div>
      </div>

      {/* Center Section: Dual Visualizers & Live AI Status */}
      <div className="my-auto flex flex-col items-center gap-4 w-full max-w-xs">
        {/* Avatar & Mic Indicator */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-emerald-500/50 flex items-center justify-center shadow-xl">
            <User className="w-8 h-8 text-emerald-400" />
          </div>
          <span
            className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center ${
              isMuted ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          >
            {isMuted ? <MicOff className="w-3 h-3 text-slate-950" /> : <Mic className="w-3 h-3 text-slate-950" />}
          </span>
        </div>

        {/* Equalizer 1: Local Microphone (My Voice) */}
        <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-2.5 shadow-inner">
          <div className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center justify-between px-1">
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3 text-emerald-400" /> My Voice (Outgoing)
            </span>
            <span className={isMuted ? 'text-amber-400' : 'text-emerald-400'}>
              {isMuted ? 'Muted' : 'Streaming'}
            </span>
          </div>
          <AudioVisualizer level={audioLevel} isMuted={isMuted} />
        </div>

        {/* Equalizer 2: Remote Peer Speaker (Friend's Voice) */}
        <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-2.5 shadow-inner">
          <div className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center justify-between px-1">
            <span className="flex items-center gap-1">
              <Volume2 className="w-3 h-3 text-indigo-400" /> Friend's Voice (Incoming)
            </span>
            <span className="text-indigo-400">
              {remoteAudioLevel > 0.05 ? 'Speaking' : 'Listening'}
            </span>
          </div>
          <AudioVisualizer level={remoteAudioLevel} isMuted={false} />
        </div>

        {/* Live AI Analysis Ticker (When Windows Are Analyzed) */}
        {latestAnalysis && (
          <div className="w-full bg-slate-950/80 border border-indigo-500/30 rounded-xl p-2 text-left animate-fadeIn">
            <div className="flex items-center justify-between text-[10px] font-bold text-indigo-300 mb-1">
              <span className="flex items-center gap-1">
                <Bot className="w-3 h-3 text-indigo-400" /> AI Window #{latestAnalysis.chunkIndex} ({latestAnalysis.participant})
              </span>
              <span className={latestAnalysis.decision === 'HUMAN' ? 'text-emerald-400' : latestAnalysis.decision === 'AI_GENERATED' ? 'text-rose-400' : 'text-amber-400'}>
                {latestAnalysis.decision}
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
              <span>Time: {latestAnalysis.startSec.toFixed(1)}s - {latestAnalysis.endSec.toFixed(1)}s</span>
              <span>Strength: {latestAnalysis.decisionStrength.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Hardware Status Strip */}
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${connectionState === 'ONLINE' || connectionState === 'CONNECTED' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {connectionState}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400" /> Live Relay Active
          </span>
        </div>
      </div>

      {/* In-Call Controls & End Call */}
      <div className="w-full pb-4 flex flex-col items-center gap-4">
        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-6">
          {/* Mute Button */}
          <button
            onClick={onToggleMute}
            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center border transition-all active:scale-95 ${
              isMuted
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            <span className="text-[7px] font-medium mt-0.5">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Speaker Indicator */}
          <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 flex flex-col items-center justify-center">
            <Volume2 className="w-5 h-5 text-indigo-400" />
            <span className="text-[7px] font-medium mt-0.5">Speaker</span>
          </div>
        </div>

        {/* End Call Button */}
        <button
          onClick={onEndCall}
          className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-900/40 transition-all cursor-pointer"
          aria-label="End Call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
