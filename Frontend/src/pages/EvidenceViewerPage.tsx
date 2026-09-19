import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Layers,
  Activity,
  AudioWaveform as WaveIcon,
  Cpu,
  BarChart,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Clock
} from 'lucide-react';
import { mockEvidenceModules, mockChunkTimeline } from '../services/mockData';
import { DecisionBadge } from '../components/common/Badge';
import { EvidenceModule } from '../types';
import { api } from '../services/api';
import { formatStrength, formatPercent, formatSec } from '../utils/formatters';

export const EvidenceViewerPage: React.FC = () => {
  const { callId: routeCallId } = useParams<{ callId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryCallId = searchParams.get('callId');
  const activeCallId = routeCallId || queryCallId || 'CALL-1001';

  const [evidenceModules, setEvidenceModules] = useState<EvidenceModule[]>(mockEvidenceModules);
  const [chunkTimeline, setChunkTimeline] = useState<any[]>(mockChunkTimeline);
  const [conflictLevel, setConflictLevel] = useState<string>('LOW');
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      api.getCallEvidence(activeCallId),
      api.getCallChunks(activeCallId)
    ]).then(([evidenceRes, chunksRes]) => {
      if (isMounted) {
        if (evidenceRes && evidenceRes.modules && evidenceRes.modules.length > 0) {
          setEvidenceModules(evidenceRes.modules);
          setConflictLevel(evidenceRes.conflictLevel || 'LOW');
        }
        if (chunksRes && chunksRes.length > 0) {
          setChunkTimeline(chunksRes);
          setSelectedChunkIndex(Math.min(selectedChunkIndex, chunksRes.length - 1));
        }
        setIsLoading(false);
      }
    }).catch(() => {
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [activeCallId]);

  const currentChunk = chunkTimeline[selectedChunkIndex] || chunkTimeline[0] || {
    chunkIndex: 0,
    startSec: 0,
    endSec: 5,
    decision: 'UNCERTAIN',
    decisionStrength: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Multi-Module AI Evidence Viewer</h1>
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-700 border border-slate-200">
                {activeCallId}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Spring Boot GET /api/v1/calls/{activeCallId}/evidence & /chunks — Individual neural classifier analysis.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-[#059669] rounded-xl border border-emerald-200">
            Signal Quality: 92% (Clean)
          </span>
          <span className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
            Model Conflict: {conflictLevel}
          </span>
        </div>
      </div>

      {/* 1. Interactive Chunk Timeline (Section 12 of spec) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Audio Chunk Timeline Evolution (5.0s Windows)</h2>
          </div>
          <span className="text-xs text-slate-400">Click a chunk to inspect time slice</span>
        </div>

        {/* Timeline Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {chunkTimeline.map((chunk, idx) => {
            const isSelected = selectedChunkIndex === idx;
            return (
              <button
                key={chunk.chunkIndex}
                onClick={() => setSelectedChunkIndex(idx)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="font-bold text-slate-800">Chunk {chunk.chunkIndex + 1}</span>
                  <span className="font-mono text-slate-400">
                    {formatSec(chunk.startSec)}s
                  </span>
                </div>

                <div className="mb-2">
                  <DecisionBadge decision={chunk.decision} size="sm" />
                </div>

                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>Score:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {formatStrength(chunk.decisionStrength)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Chunk Details Banner */}
        <div className="mt-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Inspecting Window:</span>
            <span className="font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 font-semibold">
              {formatSec(currentChunk.startSec)}s — {formatSec(currentChunk.endSec)}s
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500">Verdict for this slice:</span>
            <DecisionBadge decision={currentChunk.decision} size="sm" />
            <span className="text-slate-500 font-mono">
              (Strength: {formatStrength(currentChunk.decisionStrength)})
            </span>
          </div>
        </div>
      </div>

      {/* 2. The 5 Evidence Modules Grid (Section 10 of spec) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {evidenceModules.map((mod, index) => {
          const isSynthetic = mod.direction === 'SYNTHETIC';
          const isHuman = mod.direction === 'HUMAN';

          return (
            <div
              key={mod.module}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card flex flex-col justify-between hover:shadow-cardHover transition-all"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                    Module 0{index + 1}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      isSynthetic
                        ? 'bg-rose-100 text-rose-700'
                        : isHuman
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {mod.direction}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mt-3">{mod.name}</h3>

                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  {mod.description}
                </p>

                {/* Simulated Neural Feature Visualization */}
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1.5 font-medium">
                    <span>Fusion Contribution</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {formatPercent(mod.contribution)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isSynthetic ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.abs(mod.contribution ?? 0) * 250)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Status: <strong className="text-slate-700">{mod.status}</strong></span>
                <span>FastAPI Latency: <strong className="text-slate-700">18ms</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
