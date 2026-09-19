import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PhoneCall,
  Activity,
  Radio,
  Clock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Volume2,
  VolumeX,
  Cpu,
  Layers,
  Sparkles,
  Info,
  RefreshCw,
  PhoneOff,
  UserCheck,
  User,
  Sliders,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { StatusBadge, DecisionBadge } from '../components/common/Badge';
import { useLiveCallMonitor } from '../hooks/useLiveCallMonitor';
import { ParticipantChunkTimelineItem } from '../types';
import { api } from '../services/api';
import { liveMonitor } from '../services/LiveMonitoringService';
import { formatStrength, formatPercent, formatSec } from '../utils/formatters';

export const LiveCallMonitorPage: React.FC = () => {
  const { callId: routeCallId } = useParams<{ callId?: string }>();
  const navigate = useNavigate();

  // Default to CALL-1001 (Two-User Demo Muthu <-> Friend) if no route param
  const activeCallId = routeCallId || 'CALL-1001';

  const {
    callRecord,
    connectionState,
    callerState,
    receiverState,
    callerTimeline,
    receiverTimeline,
    evidenceModules,
    masterDecision,
    decisionStrength,
    confidenceStatus,
    conflictLevel,
    quality,
    callAlerts,
    refresh,
  } = useLiveCallMonitor({
    callId: activeCallId,
    defaultCallerName: 'Muthu',
    defaultReceiverName: 'Friend',
  });

  const [selectedChunk, setSelectedChunk] = useState<ParticipantChunkTimelineItem | null>(null);
  const [durationSec, setDurationSec] = useState<number>(callRecord?.durationSec || 45);
  const [isEnding, setIsEnding] = useState(false);

  // Call duration counter
  useEffect(() => {
    const timer = setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    if (isEnding) return;
    setIsEnding(true);
    try {
      await api.endCall(activeCallId, 'OPERATOR_ENDED');
      refresh();
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. TOP HEADER & TELEMETRY CONTROLS */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/active-calls')}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
            title="Back to Active Calls"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-extrabold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-800 border border-slate-200">
                {activeCallId}
              </span>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Live Dual-Voice Telephony Monitor
              </h1>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#059669] border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping"></span>
                <span>Two-User Streaming Active</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-2">
              <span>Muthu ({callerState.phoneNumber})</span>
              <span>↔</span>
              <span>Friend ({receiverState.phoneNumber})</span>
              <span>•</span>
              <span>Spring Boot /ws/call + 5.0s / 2.5s Sliding Window Fusion</span>
            </p>
          </div>
        </div>

        {/* Live Status Widgets & Action */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Connection Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              connectionState === 'connected'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : connectionState === 'reconnecting'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : connectionState === 'reconnecting'
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span className="uppercase tracking-wider text-[10px]">WS {connectionState}</span>
          </div>

          {/* Duration Counter */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 text-white rounded-xl font-mono font-bold text-xs shadow-xs">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{formatTimer(durationSec)}</span>
          </div>

          {/* Manual Refresh */}
          <button
            onClick={() => refresh()}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
            title="Refresh Authoritative State"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            disabled={isEnding || callRecord?.status === 'COMPLETED'}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>{isEnding ? 'Ending...' : 'End Call'}</span>
          </button>
        </div>
      </div>

      {/* Disconnection Notice Banner */}
      {connectionState !== 'connected' && (
        <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-center justify-between gap-4 text-xs text-amber-900 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />
            <div>
              <p className="font-bold">Live Telemetry Feed Disconnected (ws://localhost:8080/ws/call)</p>
              <p className="text-amber-700 text-[11px] mt-0.5">
                The dashboard is running with fallback state. If you started the platform, check that the Spring Boot backend window is running.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              liveMonitor.connect();
              refresh();
            }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reconnect
          </button>
        </div>
      )}

      {/* 2. DUAL PARTICIPANT CARDS (Caller vs Receiver) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PARTICIPANT 1: CALLER (Muthu) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-lg">
                M
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">{callerState.displayName}</h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-100 text-indigo-800 tracking-wider">
                    CALLER
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{callerState.phoneNumber}</p>
              </div>
            </div>

            {/* Voice Activity Status */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  callerState.voiceActivity
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    callerState.voiceActivity ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                  }`}
                />
                <span>{callerState.voiceActivity ? 'Speaking (Active)' : 'Silent'}</span>
              </span>
            </div>
          </div>

          {/* Caller Live Metrics Grid */}
          <div className="mt-5 grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Latest Verdict
              </span>
              <div className="mt-1">
                <DecisionBadge decision={callerState.latestDecision} size="sm" />
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Decision Strength
              </span>
              <p className="text-sm font-extrabold text-slate-800 font-mono mt-0.5">
                {formatStrength(callerState.decisionStrength)}
              </p>
              <span className="text-[9px] text-amber-600 font-semibold uppercase">Provisional</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Acoustic Quality
              </span>
              <p className="text-sm font-extrabold text-emerald-600 font-mono mt-0.5">
                {formatPercent(callerState.quality?.score)}
              </p>
              <span className="text-[9px] text-slate-500">SNR: {callerState.quality?.snrDb ?? '28.0'} dB</span>
            </div>
          </div>
        </div>

        {/* PARTICIPANT 2: RECEIVER (Friend) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 font-extrabold text-lg">
                F
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">{receiverState.displayName}</h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-teal-100 text-teal-800 tracking-wider">
                    RECEIVER
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{receiverState.phoneNumber}</p>
              </div>
            </div>

            {/* Voice Activity Status */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  receiverState.voiceActivity
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    receiverState.voiceActivity ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                  }`}
                />
                <span>{receiverState.voiceActivity ? 'Speaking (Active)' : 'Silent'}</span>
              </span>
            </div>
          </div>

          {/* Receiver Live Metrics Grid */}
          <div className="mt-5 grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Latest Verdict
              </span>
              <div className="mt-1">
                <DecisionBadge decision={receiverState.latestDecision} size="sm" />
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Decision Strength
              </span>
              <p className="text-sm font-extrabold text-slate-800 font-mono mt-0.5">
                {formatStrength(receiverState.decisionStrength)}
              </p>
              <span className="text-[9px] text-amber-600 font-semibold uppercase">Provisional</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Acoustic Quality
              </span>
              <p className="text-sm font-extrabold text-emerald-600 font-mono mt-0.5">
                {formatPercent(receiverState.quality?.score)}
              </p>
              <span className="text-[9px] text-slate-500">SNR: {receiverState.quality?.snrDb ?? '27.2'} dB</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MASTER DECISION & SIGNAL HEALTH SUMMARY */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              <span>Master Fusion Verdict & Multi-Evidence Arbitration</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              10% Trimmed Mean across 5.0s sliding chunks. Conflict-gated UNCERTAIN fallback protects against false fraud accusations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Confidence Mode
              </span>
              <p className="text-xs font-bold text-amber-600">{confidenceStatus}</p>
            </div>
            <div className="text-right pl-3 border-l border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Model Conflict
              </span>
              <p
                className={`text-xs font-bold ${
                  conflictLevel === 'HIGH'
                    ? 'text-rose-600'
                    : conflictLevel === 'MEDIUM'
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {conflictLevel}
              </p>
            </div>
          </div>
        </div>

        {/* Master Metrics Grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Master Decision Badge */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-xs text-slate-400 font-medium">Session Decision</span>
            <div className="mt-2">
              <DecisionBadge decision={masterDecision} size="lg" />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">
              {masterDecision === 'HUMAN'
                ? 'Consistent bona-fide human biological characteristics.'
                : masterDecision === 'AI_GENERATED'
                ? 'Synthetic vocoder or latent voice cloning artifacts.'
                : 'Arbitrated UNCERTAIN to avoid false accusations.'}
            </p>
          </div>

          {/* Metric 2: Decision Strength */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-xs text-slate-400 font-medium">Decision Strength</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {formatStrength(decisionStrength)}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ [-1.0, +1.0]</span>
            </div>
            <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  (decisionStrength ?? 0) > 0.3
                    ? 'bg-rose-500'
                    : (decisionStrength ?? 0) < -0.3
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, Math.abs(decisionStrength ?? 0) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              Continuous signed scale; not a calibrated probability.
            </p>
          </div>

          {/* Metric 3: Acoustic Signal Quality */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-xs text-slate-400 font-medium">Signal Quality Gate</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 font-mono">
                {formatPercent(quality?.score)}
              </span>
              <span className="text-xs text-emerald-700 font-semibold font-mono">
                {quality?.usable ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2 font-mono">
              SNR: {quality?.snrDb ?? 28} dB • Bandwidth: 16 kHz
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {quality?.flags && quality.flags.length > 0 ? quality.flags.join(', ') : 'No acoustic clipping detected.'}
            </p>
          </div>

          {/* Metric 4: Streaming Telemetry Health */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-xs text-slate-400 font-medium">Pipeline Telemetry</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900">
                {callerTimeline.length + receiverTimeline.length} Chunks
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              5.0s window • 2.5s hop • Bounded queue: 4 max
            </p>
            <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
              Zero raw audio persisted to database.
            </p>
          </div>
        </div>
      </div>

      {/* 4. PARTICIPANT-SPECIFIC SEGREGATED TIMELINE */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-600" />
              <span>Participant-Segregated Chunk Timeline (5.0s Windows)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Temporal breakdown separating Caller (Muthu) and Receiver (Friend). Click any chunk block to inspect forensic details.
            </p>
          </div>

          {selectedChunk && (
            <button
              onClick={() => setSelectedChunk(null)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* LANE 1: CALLER TIMELINE */}
        <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <span className="text-xs font-bold text-indigo-950">Muthu (Caller Lane)</span>
              <span className="text-[11px] text-indigo-700 font-mono">
                {callerTimeline.length} evaluated windows
              </span>
            </div>
            <span className="text-[11px] text-slate-400">16kHz mono</span>
          </div>

          {callerTimeline.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 font-medium">
              Awaiting 5.0s audio window from Caller...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {callerTimeline.map((chunk) => {
                const isSelected = selectedChunk?.chunkIndex === chunk.chunkIndex && selectedChunk?.participant === 'CALLER';
                return (
                  <button
                    key={`caller-${chunk.chunkIndex}`}
                    onClick={() => setSelectedChunk(chunk)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/30 shadow-xs'
                        : 'border-indigo-100 bg-white hover:bg-indigo-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-slate-800">Chunk {chunk.chunkIndex + 1}</span>
                      <span className="font-mono text-slate-400">{formatSec(chunk.startSec)}s</span>
                    </div>
                    <div className="mb-1.5">
                      <DecisionBadge decision={chunk.decision} size="sm" />
                    </div>
                    <div className="text-[10px] text-slate-500 flex justify-between font-mono">
                      <span>Score:</span>
                      <span className="font-bold text-slate-700">
                        {formatStrength(chunk.decisionStrength)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* LANE 2: RECEIVER TIMELINE */}
        <div className="p-4 bg-teal-50/40 rounded-2xl border border-teal-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
              <span className="text-xs font-bold text-teal-950">Friend (Receiver Lane)</span>
              <span className="text-[11px] text-teal-700 font-mono">
                {receiverTimeline.length} evaluated windows
              </span>
            </div>
            <span className="text-[11px] text-slate-400">16kHz mono</span>
          </div>

          {receiverTimeline.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 font-medium">
              Awaiting 5.0s audio window from Receiver...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {receiverTimeline.map((chunk) => {
                const isSelected = selectedChunk?.chunkIndex === chunk.chunkIndex && selectedChunk?.participant === 'RECEIVER';
                return (
                  <button
                    key={`receiver-${chunk.chunkIndex}`}
                    onClick={() => setSelectedChunk(chunk)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-teal-600 bg-white ring-2 ring-teal-500/30 shadow-xs'
                        : 'border-teal-100 bg-white hover:bg-teal-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-slate-800">Chunk {chunk.chunkIndex + 1}</span>
                      <span className="font-mono text-slate-400">{formatSec(chunk.startSec)}s</span>
                    </div>
                    <div className="mb-1.5">
                      <DecisionBadge decision={chunk.decision} size="sm" />
                    </div>
                    <div className="text-[10px] text-slate-500 flex justify-between font-mono">
                      <span>Score:</span>
                      <span className="font-bold text-slate-700">
                        {formatStrength(chunk.decisionStrength)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Chunk Inspection Detail Banner */}
        {selectedChunk && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs animate-in fade-in duration-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">
                  Inspecting {selectedChunk.participant} Chunk {selectedChunk.chunkIndex + 1}:
                </span>
                <span className="font-mono font-bold bg-white px-2 py-0.5 rounded-md border text-slate-800">
                  {formatSec(selectedChunk.startSec)}s – {formatSec(selectedChunk.endSec)}s (5.0s window)
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Participant ID: {selectedChunk.userId} • Quality Score: {formatPercent(selectedChunk.qualityScore)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Chunk Verdict</span>
                <div className="mt-0.5">
                  <DecisionBadge decision={selectedChunk.decision} size="sm" />
                </div>
              </div>
              <div className="text-right pl-3 border-l border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Score</span>
                <p className="font-mono font-bold text-sm text-slate-900">
                  {formatStrength(selectedChunk.decisionStrength)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. MULTI-EVIDENCE AI TELEMETRY (5 Models) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card">
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <span>Multi-Evidence Specialist AI Telemetry</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Directional contributions across 5 deepfake audio analysis models. Never presented as fabricated probabilities.
            </p>
          </div>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-mono font-semibold">
            5 Active Models
          </span>
        </div>

        {/* Models Grid */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evidenceModules.map((mod) => (
            <div
              key={mod.module}
              className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200/80 transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">{mod.name}</h4>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    mod.direction === 'SYNTHETIC'
                      ? 'bg-rose-100 text-rose-800'
                      : mod.direction === 'HUMAN'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {mod.direction}
                </span>
              </div>

              {/* Progress Bar of Weight/Contribution */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400 font-medium">Contribution Weight:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatPercent(mod.contribution)}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      mod.direction === 'SYNTHETIC'
                        ? 'bg-rose-500'
                        : mod.direction === 'HUMAN'
                        ? 'bg-emerald-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.abs(mod.contribution ?? 0) * 100)}%` }}
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-snug">
                {mod.description || 'Forensic acoustic feature extracted and normalized across signed scale.'}
              </p>
            </div>
          ))}
        </div>

        {/* Compliance Alert */}
        <div className="mt-5 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <p>
            <span className="font-bold">Anti-Hallucination Evidence Rule:</span> Feature and embedding representations (Whisper Tiny, Spectrogram, Prosody/F0) provide directional acoustic cues and are never converted into unsupported probability claims.
          </p>
        </div>
      </div>

      {/* 6. REAL-TIME MONITORING ALERTS FEED */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">Real-Time Telephony Monitoring Alerts</h2>
          </div>
          <span className="text-xs text-slate-400">Diagnostic telemetry stream</span>
        </div>

        {callAlerts.length === 0 ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs text-slate-400">
            No diagnostic anomalies or conflict events detected on current session.
          </div>
        ) : (
          <div className="space-y-2.5">
            {callAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs transition-all ${
                  alert.severity === 'danger'
                    ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                    : alert.severity === 'warning'
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 font-bold">
                    <span>{alert.title}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] opacity-90">{alert.message}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                  {alert.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
