import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Printer,
  Download,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mic,
  Cpu,
  Share2,
  ArrowRight,
  Info
} from 'lucide-react';
import { StatusBadge, DecisionBadge } from '../components/common/Badge';
import { mockCallHistory, mockEvidenceModules } from '../services/mockData';
import { CallRecord } from '../types';

export const AnalysisReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCallId, setSelectedCallId] = useState<string>('CALL-1003');

  const activeCall =
    mockCallHistory.find((c) => c.callId === selectedCallId) || mockCallHistory[0];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Call Selector */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Analysis Report & Explainability</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Spring Boot GET /calls/{selectedCallId}/report — Comprehensive neural forensic report.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Select Call Dropdown */}
          <select
            value={selectedCallId}
            onChange={(e) => setSelectedCallId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 font-bold focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          >
            {mockCallHistory.map((c) => (
              <option key={c.callId} value={c.callId}>
                {c.callId} — {c.caller} ({c.latestAnalysis})
              </option>
            ))}
          </select>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Strict Spec Notice Banner */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-900">
        <Info className="w-5 h-5 text-amber-600 shrink-0" />
        <p>
          <span className="font-bold">Specification Notice (Sec 7 & 11):</span> Avoid presenting provisional confidence as a calibrated probability. Feature & embedding contributions are directional neural indicators, not guarantees.
        </p>
      </div>

      {/* Main Report Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-6">
        {/* Section 1: Call Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 font-medium">Session ID</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">{activeCall.callId}</p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Caller & Receiver</span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{activeCall.caller}</p>
            <p className="text-slate-500 text-[11px]">→ {activeCall.receiver}</p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Duration & Status</span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{activeCall.duration}</p>
            <div className="mt-1">
              <StatusBadge status={activeCall.status} size="sm" />
            </div>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Session Timestamp</span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">Sep 18, 2026</p>
            <p className="text-slate-500 text-[11px]">10:24 AM UTC</p>
          </div>
        </div>

        {/* Section 2: Master Decision Hero Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`lg:col-span-6 p-6 rounded-2xl border flex flex-col justify-between ${
            activeCall.latestAnalysis === 'AI_GENERATED'
              ? 'bg-rose-50/50 border-rose-200'
              : activeCall.latestAnalysis === 'HUMAN'
              ? 'bg-emerald-50/50 border-emerald-200'
              : 'bg-amber-50/50 border-amber-200'
          }`}>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Master Decision Engine
              </span>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="text-2xl font-black text-slate-900">
                  {activeCall.latestAnalysis === 'AI_GENERATED'
                    ? 'AI GENERATED (SYNTHETIC VOICE)'
                    : activeCall.latestAnalysis === 'HUMAN'
                    ? 'AUTHENTIC HUMAN VOICE'
                    : 'UNCERTAIN / INCONCLUSIVE'}
                </h2>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {activeCall.latestAnalysis === 'AI_GENERATED'
                  ? 'Strong synthetic vocoder footprints and spectral continuity discrepancies were detected across multiple independent modules.'
                  : activeCall.latestAnalysis === 'HUMAN'
                  ? 'Natural micro-prosodic variations and biological pitch jitter are consistent with authentic human speech.'
                  : 'Acoustic background distortion or insufficient speech density prevented definitive classification.'}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200/60 grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Provisional Strength:</span>
                <p className="font-mono font-bold text-slate-900 mt-0.5">
                  {activeCall.decisionStrength ?? '+0.84'}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Signal Quality:</span>
                <p className="font-bold text-emerald-600 mt-0.5">
                  GOOD ({(activeCall.qualityScore ?? 0.86) * 100}%)
                </p>
              </div>
              <div>
                <span className="text-slate-500">Model Conflict:</span>
                <p className="font-bold text-slate-800 mt-0.5">
                  {activeCall.conflictLevel ?? 'LOW'}
                </p>
              </div>
            </div>
          </div>

          {/* Fusion Radar/Progress Breakdown */}
          <div className="lg:col-span-6 p-6 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#8B5CF6]" />
              Master Multi-Model Fusion Weights
            </h3>
            <div className="space-y-3 mt-3">
              {mockEvidenceModules.map((mod, i) => (
                <div key={i} className="text-xs">
                  <div className="flex justify-between font-medium mb-1">
                    <span className="text-slate-700">{mod.name}</span>
                    <span className="font-mono text-slate-900 font-bold">
                      {(mod.contribution * 100).toFixed(0)}% weight
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        mod.direction === 'SYNTHETIC'
                          ? 'bg-rose-500'
                          : mod.direction === 'HUMAN'
                          ? 'bg-emerald-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${mod.contribution * 200}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Inspection link:</span>
              <button
                onClick={() => navigate('/evidence')}
                className="text-[#059669] font-bold hover:underline flex items-center gap-1"
              >
                Open Full Evidence Viewer <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
