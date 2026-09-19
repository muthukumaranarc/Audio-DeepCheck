import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
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
  Info,
  RefreshCw,
  Sliders,
  Layers
} from 'lucide-react';
import { StatusBadge, DecisionBadge } from '../components/common/Badge';
import { CallReportData } from '../types';
import { api } from '../services/api';
import { formatStrength, formatPercent, formatSec } from '../utils/formatters';

export const AnalysisReportsPage: React.FC = () => {
  const { callId: routeCallId } = useParams<{ callId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryCallId = searchParams.get('callId');
  const initialCallId = routeCallId || queryCallId || 'CALL-1001';

  const [selectedCallId, setSelectedCallId] = useState<string>(initialCallId);
  const [report, setReport] = useState<CallReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const effectiveCallId = routeCallId || queryCallId;
    if (effectiveCallId && effectiveCallId !== selectedCallId) {
      setSelectedCallId(effectiveCallId);
    }
  }, [routeCallId, queryCallId]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    api.getCallReport(selectedCallId).then((data) => {
      if (isMounted) {
        setReport(data);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedCallId]);

  const handleSelectCall = (callId: string) => {
    setSelectedCallId(callId);
    if (routeCallId) {
      navigate(`/reports/${callId}`);
    } else {
      setSearchParams({ callId });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const exportJSON = () => {
    if (!report) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audio-deepcheck-report-${selectedCallId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Call Selector */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Analysis Report & Forensic Audit</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              Spring Boot GET /calls/{selectedCallId}/report — Multi-evidence arbitration summary.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Select Call Dropdown */}
          <select
            value={selectedCallId}
            onChange={(e) => handleSelectCall(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 font-bold focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-mono"
          >
            <option value="CALL-1001">CALL-1001 (Muthu ↔ Friend)</option>
            <option value="CALL-1002">CALL-1002 (Muthu ↔ Support)</option>
            <option value="CALL-1003">CALL-1003 (Bank Support Demo)</option>
            <option value="CALL-1004">CALL-1004 (Priya ↔ Insurance)</option>
            <option value="CALL-1005">CALL-1005 (Unknown Caller)</option>
          </select>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>

          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
          >
            <Download className="w-4 h-4" />
            Export JSON
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

      {isLoading || !report ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-xs text-slate-400">
          Loading comprehensive forensic report...
        </div>
      ) : (
        /* Main Report Content */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-6">
          {/* Section 1: Call Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Session ID</span>
              <p className="text-sm font-extrabold text-slate-900 mt-0.5 font-mono">{report.callId}</p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Participants</span>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{report.caller}</p>
              <p className="text-slate-500 text-[11px]">→ {report.receiver}</p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Duration & Status</span>
              <p className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                {Math.floor(report.durationSec / 60)}m {report.durationSec % 60}s
              </p>
              <div className="mt-1">
                <StatusBadge status={report.status} size="sm" />
              </div>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Started At</span>
              <p className="text-xs text-slate-700 font-mono mt-0.5">
                {new Date(report.startedAt).toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-400">Trace: {report.requestId || 'REQ-AUDIT'}</span>
            </div>
          </div>

          {/* Section 2: Master Verdict Card */}
          <div className="p-5 bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
                Final Master Decision Verdict
              </span>
              <div className="mt-1 flex items-center gap-3">
                <DecisionBadge decision={report.finalDecision} size="lg" />
                <span className="text-xs font-mono font-bold text-slate-700">
                  Strength: {formatStrength(report.decisionStrength)}
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                  {report.confidenceStatus}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 font-medium">Signal Quality:</span>
                <p className="font-bold text-emerald-600">{formatPercent(report.quality?.score)} (SNR: {report.quality?.snrDb ?? 28} dB)</p>
              </div>
              <div className="pl-4 border-l border-slate-200">
                <span className="text-slate-400 font-medium">Conflict Level:</span>
                <p className="font-bold text-slate-800">{report.conflictLevel}</p>
              </div>
            </div>
          </div>

          {/* Section 3: Chunks Summary Report */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Chunks Evaluation Summary (5.0s Windows)</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Chunks</span>
                <p className="text-lg font-extrabold text-slate-900 font-mono mt-1">
                  {report.chunksSummary.totalChunks}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Usable</span>
                <p className="text-lg font-extrabold text-emerald-600 font-mono mt-1">
                  {report.chunksSummary.usableChunks}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Human</span>
                <p className="text-lg font-extrabold text-[#10B981] font-mono mt-1">
                  {report.chunksSummary.humanChunks}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 text-[10px] uppercase font-bold">AI Generated</span>
                <p className="text-lg font-extrabold text-[#8B5CF6] font-mono mt-1">
                  {report.chunksSummary.aiChunks}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Uncertain</span>
                <p className="text-lg font-extrabold text-amber-500 font-mono mt-1">
                  {report.chunksSummary.uncertainChunks}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 text-[10px] uppercase font-bold">AI Ratio</span>
                <p className="text-lg font-extrabold text-slate-800 font-mono mt-1">
                  {formatPercent(report.chunksSummary?.aiChunkRatio)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Trimmed Score</span>
                <p className="text-lg font-extrabold text-indigo-600 font-mono mt-1">
                  {formatStrength(report.chunksSummary?.trimmedMeanScore)}
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Evidence Modules Forensic Table */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Multi-Evidence Specialist Classifier Breakdown</span>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-semibold">
                    <th className="py-3 px-4">Specialist Detector</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Evidence Direction</th>
                    <th className="py-3 px-4">Contribution Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {report.modules.map((mod) => (
                    <tr key={mod.module} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-800">{mod.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          {mod.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            mod.direction === 'SYNTHETIC'
                              ? 'bg-rose-100 text-rose-800'
                              : mod.direction === 'HUMAN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {mod.direction}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {formatPercent(mod.contribution)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Chunk Timeline Table */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-600" />
              <span>Evaluated Chunk History</span>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-semibold">
                    <th className="py-2.5 px-4">Chunk Index</th>
                    <th className="py-2.5 px-4">Time Window</th>
                    <th className="py-2.5 px-4">Verdict</th>
                    <th className="py-2.5 px-4">Decision Strength</th>
                    <th className="py-2.5 px-4">Quality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                  {report.chunks.map((ch) => (
                    <tr key={ch.chunkIndex} className="hover:bg-slate-50/50">
                      <td className="py-2 px-4 font-bold">Chunk {ch.chunkIndex + 1}</td>
                      <td className="py-2 px-4 text-slate-500">
                        {formatSec(ch.startSec)}s – {formatSec(ch.endSec)}s
                      </td>
                      <td className="py-2 px-4 font-sans">
                        <DecisionBadge decision={ch.decision} size="sm" />
                      </td>
                      <td className="py-2 px-4 font-bold text-slate-800">
                        {formatStrength(ch.decisionStrength)}
                      </td>
                      <td className="py-2 px-4 text-emerald-600 font-bold">
                        {formatPercent(ch.qualityScore)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
