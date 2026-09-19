import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowRight,
  BarChart2,
  Target,
  Clock,
  Eye,
  Layers,
  ShieldCheck,
  Radio,
  FileText,
  Server,
  Database,
  Cpu,
  RefreshCw,
  X,
  Upload
} from 'lucide-react';
import { StatusBadge, DecisionBadge } from '../components/common/Badge';
import {
  mockCallVolumeData,
  mockDetectionDistribution,
} from '../services/mockData';
import { CallRecord } from '../types';
import { useLiveDashboard } from '../hooks/useLiveDashboard';
import { AudioFileVerifier } from '../components/common/AudioFileVerifier';


export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [volumeFilter, setVolumeFilter] = useState('Last 7 Days');
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [showVerifier, setShowVerifier] = useState(false);

  const {
    metrics,
    health,
    alerts,
    activeCalls,
    connectionState,
    refresh,
    dismissAlert,
  } = useLiveDashboard();

  // Donut chart distribution data
  const donutData = [
    { label: 'Human', count: mockDetectionDistribution.human.count, pct: mockDetectionDistribution.human.percentage, color: '#10B981' },
    { label: 'AI Generated', count: mockDetectionDistribution.aiGenerated.count, pct: mockDetectionDistribution.aiGenerated.percentage, color: '#8B5CF6' },
    { label: 'Uncertain', count: mockDetectionDistribution.uncertain.count, pct: mockDetectionDistribution.uncertain.percentage, color: '#818CF8' },
    { label: 'No Decision', count: mockDetectionDistribution.noDecision.count, pct: mockDetectionDistribution.noDecision.percentage, color: '#C7D2FE' }
  ];

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return (
    <div className="space-y-6">
      {/* 0. SYSTEM HEALTH & LIVE TELEMETRY BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-slate-900 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            Infrastructure Health:
          </span>

          {/* Backend Status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl">
            <Server className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-medium text-slate-700">Spring Boot:</span>
            <span
              className={`font-bold ${
                health.components.backend === 'UP' ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {health.components.backend}
            </span>
          </div>

          {/* AI Service Status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl">
            <Cpu className="w-3.5 h-3.5 text-purple-500" />
            <span className="font-medium text-slate-700">FastAPI AI:</span>
            <span
              className={`font-bold ${
                health.components.aiService === 'UP' ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {health.components.aiService}
            </span>
          </div>

          {/* Database Status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl">
            <Database className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-medium text-slate-700">MongoDB:</span>
            <span
              className={`font-bold ${
                health.components.database === 'UP' ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {health.components.database}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border ${
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
            <span className="text-[10px] uppercase font-bold tracking-wider">
              Telemetry {connectionState}
            </span>
          </div>

          <button
            onClick={() => refresh()}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
            title="Refresh System Metrics"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 1. TOP STAT CARDS (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Calls */}
        <div
          onClick={() => navigate('/active-calls')}
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-cardHover transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-2xl bg-[#E8F8F0] flex items-center justify-center text-[#10B981]">
              <Phone className="w-5 h-5" />
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-800">Active Calls</span>
            </div>
            <div className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:border-emerald-300 transition-colors">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {metrics.activeCalls.count}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
              <span className="text-[#10B981] font-semibold flex items-center">
                ↑ {metrics.activeCalls.change}
              </span>
              <span>from last hour</span>
            </p>
          </div>
        </div>

        {/* Card 2: Analyzing */}
        <div
          onClick={() => navigate('/active-calls')}
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-cardHover transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
              <Activity className="w-5 h-5" />
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-800">Analyzing</span>
            </div>
            <div className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:border-blue-300 transition-colors">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {metrics.analyzing.count}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
              <span className="text-[#10B981] font-semibold flex items-center">
                ↑ {metrics.analyzing.change}
              </span>
              <span>from last hour</span>
            </p>
          </div>
        </div>

        {/* Card 3: Completed */}
        <div
          onClick={() => navigate('/call-history')}
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-cardHover transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-800">Completed</span>
            </div>
            <div className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-purple-600 group-hover:border-purple-300 transition-colors">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {metrics.completed.count}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
              <span className="text-purple-600 font-semibold flex items-center">
                ↑ {metrics.completed.change}
              </span>
              <span>from last hour</span>
            </p>
          </div>
        </div>

        {/* Card 4: Needs Attention */}
        <div
          onClick={() => navigate('/evidence')}
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-cardHover transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 flex items-center justify-center text-[#EF4444]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-800">Needs Attention</span>
            </div>
            <div className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-rose-600 group-hover:border-rose-300 transition-colors">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {metrics.needsAttention.count}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
              <span className="text-[#EF4444] font-semibold flex items-center">
                ↑ {metrics.needsAttention.change}
              </span>
              <span>from last hour</span>
            </p>
          </div>
        </div>
      </div>

      {/* 2. CHARTS SECTION (Call Volume + AI Detection Distribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Call Volume (Last 7 Days) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#10B981]" />
              <h2 className="text-sm font-bold text-slate-900">Call Volume (Last 7 Days)</h2>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
                <span>Human</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]"></span>
                <span>AI Generated</span>
              </div>
              <select
                value={volumeFilter}
                onChange={(e) => setVolumeFilter(e.target.value)}
                aria-label="Filter call volume by time period"
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              >
                <option>Last 7 Days</option>
                <option>Last 14 Days</option>
                <option>Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Stacked Bar Chart Graphic */}
          <div className="h-44 flex items-end justify-between gap-2 pt-4 px-2">
            {mockCallVolumeData.map((d) => {
              const maxVal = 40;
              const humanHeight = (d.human / maxVal) * 100;
              const aiHeight = (d.aiGenerated / maxVal) * 100;

              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full max-w-[28px] h-32 flex flex-col justify-end gap-1 relative">
                    <div
                      style={{ height: `${aiHeight}%` }}
                      className="w-full bg-[#8B5CF6] rounded-t-md opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                    <div
                      style={{ height: `${humanHeight}%` }}
                      className="w-full bg-[#10B981] rounded-b-md opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: AI Detection Distribution (Donut Chart) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="text-sm font-bold text-slate-900">AI Detection Distribution</h2>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              Total: {mockDetectionDistribution.totalCalls} Calls
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            {/* SVG Donut */}
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                {donutData.map((slice) => {
                  const strokeLength = (slice.pct / 100) * circumference;
                  const offset = (accumulatedPercent / 100) * circumference;
                  accumulatedPercent += slice.pct;

                  return (
                    <circle
                      key={slice.label}
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth="16"
                      strokeDasharray={`${strokeLength} ${circumference}`}
                      strokeDashoffset={-offset}
                      className="transition-all duration-500"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {mockDetectionDistribution.totalCalls}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  Total Calls
                </span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-2.5 w-full sm:w-auto text-xs">
              {donutData.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 font-medium">{item.label}</span>
                  </div>
                  <span className="font-bold text-slate-800">
                    {item.count} ({item.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center mt-2">
            Provisional neural detections cross-checked by 5-module fusion engine.
          </p>
        </div>
      </div>

      {/* 3. LIVE MONITORING SECTION: Active Calls Table + Live Alerts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Calls Table */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
              <h2 className="text-sm font-bold text-slate-900">Live Active Streams</h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                {activeCalls.length} Active
              </span>
            </div>
            <button
              onClick={() => navigate('/active-calls')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              View Full Table <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="pb-3 pl-1 font-medium">Session ID</th>
                  <th className="pb-3 font-medium">Participants</th>
                  <th className="pb-3 font-medium">Duration</th>
                  <th className="pb-3 font-medium">State</th>
                  <th className="pb-3 font-medium">AI Verdict</th>
                  <th className="pb-3 text-right pr-2 font-medium">Live Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 text-slate-700">
                {activeCalls.slice(0, 5).map((call) => (
                  <tr key={call.callId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 pl-1 font-semibold text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-mono">{call.callId}</span>
                    </td>
                    <td className="py-3">
                      <p className="font-semibold text-slate-900 leading-tight">{call.caller}</p>
                      <p className="text-[11px] text-slate-400 leading-tight">→ {call.receiver}</p>
                    </td>
                    <td className="py-3 font-mono font-medium text-slate-600">{call.duration}</td>
                    <td className="py-3">
                      <StatusBadge status={call.status} size="sm" />
                    </td>
                    <td className="py-3">
                      <DecisionBadge decision={call.latestAnalysis} size="sm" />
                    </td>
                    <td className="py-3 text-right pr-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/live-monitor/${call.callId}`)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <Activity className="w-3 h-3" />
                          <span>Monitor</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Real-Time Alerts Feed */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900">Live Security Alerts</h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {alerts.length} Events
              </span>
            </div>

            <div className="space-y-3 mt-2 max-h-80 overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No active diagnostic events.
                </div>
              ) : (
                alerts.slice(0, 5).map((alert) => {
                  const isDanger = alert.severity === 'danger';
                  const isWarning = alert.severity === 'warning';

                  return (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-xl border text-xs relative group ${
                        isDanger
                          ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                          : isWarning
                          ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      <div className="flex items-center justify-between pr-4">
                        <span className="font-bold">{alert.title}</span>
                        <span className="text-[10px] font-mono opacity-70">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug opacity-90">{alert.message}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono opacity-75">
                        <span>Session: {alert.callId}</span>
                        <span>•</span>
                        <span>{alert.type}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            onClick={() => navigate('/live-monitor')}
            className="mt-4 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Launch Two-User Monitor Demo (CALL-1001)</span>
          </button>
        </div>
      </div>

      {/* 5. AUDIO FILE UPLOAD & VERIFICATION PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        {/* Panel Header / Toggle */}
        <button
          onClick={() => setShowVerifier((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/70 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
              <Upload className="w-4.5 h-4.5" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-bold text-slate-900">Upload &amp; Verify Audio</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Analyze .mp3 or .wav files for AI-generated voice detection</p>
            </div>
          </div>
          <div className={`w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 transition-transform ${showVerifier ? 'rotate-180' : ''}`}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {/* Expandable Verifier Panel */}
        {showVerifier && (
          <div className="px-6 pb-6 border-t border-slate-100">
            <AudioFileVerifier onClose={() => setShowVerifier(false)} />
          </div>
        )}
      </div>
    </div>
  );
};
