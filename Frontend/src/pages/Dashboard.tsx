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
  FileText
} from 'lucide-react';
import { StatusBadge, DecisionBadge } from '../components/common/Badge';
import {
  mockMetrics,
  mockCallVolumeData,
  mockDetectionDistribution,
  mockLiveCalls,
  mockRecentActivity
} from '../services/mockData';
import { CallRecord } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [volumeFilter, setVolumeFilter] = useState('Last 7 Days');
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

  // Calculate coordinates for Donut chart
  const donutData = [
    { label: 'Human', count: mockDetectionDistribution.human.count, pct: mockDetectionDistribution.human.percentage, color: '#10B981' },
    { label: 'AI Generated', count: mockDetectionDistribution.aiGenerated.count, pct: mockDetectionDistribution.aiGenerated.percentage, color: '#8B5CF6' },
    { label: 'Uncertain', count: mockDetectionDistribution.uncertain.count, pct: mockDetectionDistribution.uncertain.percentage, color: '#818CF8' },
    { label: 'No Decision', count: mockDetectionDistribution.noDecision.count, pct: mockDetectionDistribution.noDecision.percentage, color: '#C7D2FE' }
  ];

  // Circumference for stroke-dasharray (r = 58)
  const radius = 58;
  const circumference = 2 * Math.PI * radius; // ~ 364.42
  let accumulatedPercent = 0;

  return (
    <div className="space-y-6">
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
              {mockMetrics.activeCalls.count}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
              <span className="text-[#10B981] font-semibold flex items-center">
                ↑ {mockMetrics.activeCalls.change}
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
              {mockMetrics.analyzing.count}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
              <span className="text-[#10B981] font-semibold flex items-center">
                ↑ {mockMetrics.analyzing.change}
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
              {mockMetrics.completed.count}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
              <span className="text-purple-600 font-semibold flex items-center">
                ↑ {mockMetrics.completed.change}
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
              {mockMetrics.needsAttention.count}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
              <span className="text-[#EF4444] font-semibold flex items-center">
                ↑ {mockMetrics.needsAttention.change}
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
          <div className="relative pt-2">
            {/* Horizontal Gridlines & Y-Axis */}
            <div className="flex flex-col justify-between h-48 text-[11px] text-slate-400 pr-2 select-none">
              {[40, 30, 20, 10, 0].map((val) => (
                <div key={val} className="flex items-center gap-3 w-full">
                  <span className="w-5 text-right shrink-0">{val}</span>
                  <div className="flex-1 border-b border-slate-100 border-dashed"></div>
                </div>
              ))}
            </div>

            {/* Bars */}
            <div className="absolute inset-x-0 bottom-0 top-2 ml-10 flex items-end justify-between px-4">
              {mockCallVolumeData.map((item, idx) => {
                const maxVal = 40;
                const humanHeight = (item.human / maxVal) * 100;
                const aiHeight = (item.aiGenerated / maxVal) * 100;

                return (
                  <div key={idx} className="flex flex-col items-center flex-1 group">
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 text-white text-[10px] rounded-lg px-2 py-1 pointer-events-none shadow-md whitespace-nowrap z-20">
                      Human: {item.human} | AI: {item.aiGenerated}
                    </div>

                    {/* Bar stack */}
                    <div className="w-6 sm:w-8 flex flex-col-reverse items-center">
                      {/* Human portion (bottom, green) */}
                      <div
                        style={{ height: `${(item.human / 40) * 180}px` }}
                        className="w-full bg-[#10B981] rounded-b-md transition-all group-hover:brightness-95"
                      ></div>
                      {/* AI Generated portion (top, purple) */}
                      <div
                        style={{ height: `${(item.aiGenerated / 40) * 180}px` }}
                        className="w-full bg-[#8B5CF6]/90 rounded-t-md transition-all group-hover:brightness-95"
                      ></div>
                    </div>

                    <span className="text-[11px] font-medium text-slate-500 mt-3">
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: AI Detection Distribution */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-[#10B981]" />
            <h2 className="text-sm font-bold text-slate-900">AI Detection Distribution</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-auto">
            {/* Donut Chart SVG */}
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
                {donutData.map((slice, index) => {
                  const dashLength = (slice.pct / 100) * circumference;
                  const dashOffset = (accumulatedPercent / 100) * circumference;
                  accumulatedPercent += slice.pct;

                  return (
                    <circle
                      key={index}
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth="18"
                      strokeDasharray={`${dashLength} ${circumference}`}
                      strokeDashoffset={-dashOffset}
                      className="transition-all duration-500 hover:opacity-90"
                    />
                  );
                })}
              </svg>

              {/* Center Text inside Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold text-slate-900">
                  {mockDetectionDistribution.totalCalls}
                </span>
                <span className="text-[11px] font-medium text-slate-400 -mt-0.5">
                  Total Calls
                </span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-3">
              {donutData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  ></span>
                  <span className="text-slate-600 font-medium min-w-[85px]">{item.label}</span>
                  <span className="text-slate-900 font-bold">
                    {item.count}{' '}
                    <span className="text-slate-400 font-normal text-[11px]">
                      ({item.pct}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. LOWER MIDDLE SECTION (Live Active Calls + Recent Activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Live Active Calls Table */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-xl bg-[#E8F8F0] flex items-center justify-center text-[#10B981]">
                <Phone className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Live Active Calls</h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E8F8F0] text-[#059669]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping"></span>
                Live
              </span>
            </div>
            <button
              onClick={() => navigate('/active-calls')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="pb-3 pl-1 font-medium">Call ID</th>
                  <th className="pb-3 font-medium">Caller</th>
                  <th className="pb-3 font-medium">Receiver</th>
                  <th className="pb-3 font-medium">Duration</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Latest Analysis</th>
                  <th className="pb-3 text-right pr-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 text-slate-700">
                {mockLiveCalls.map((call) => (
                  <tr key={call.callId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 pl-1 font-semibold text-slate-900 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${call.status === 'ACTIVE' || call.status === 'ANALYZING' ? 'bg-[#10B981]' : 'bg-blue-400'}`}></span>
                      {call.callId}
                    </td>
                    <td className="py-3 font-medium text-slate-700">{call.caller}</td>
                    <td className="py-3 text-slate-500">{call.receiver}</td>
                    <td className="py-3 font-medium text-slate-600">{call.duration}</td>
                    <td className="py-3">
                      <StatusBadge status={call.status} size="sm" />
                    </td>
                    <td className="py-3">
                      <DecisionBadge decision={call.latestAnalysis} size="sm" />
                    </td>
                    <td className="py-3 text-right pr-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedCall(call)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Call Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => navigate('/evidence')}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Inspect AI Evidence"
                        >
                          <Activity className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Recent Activity Feed */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <h2 className="text-sm font-bold text-slate-900">Recent Activity</h2>
              </div>
              <button
                onClick={() => navigate('/call-history')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View All <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4 mt-2">
              {mockRecentActivity.map((activity) => {
                let iconEl;
                let bgClass = 'bg-blue-50 text-blue-600';

                if (activity.type === 'completed' || activity.type === 'human') {
                  bgClass = 'bg-[#E8F8F0] text-[#10B981]';
                  iconEl = <CheckCircle2 className="w-4 h-4" />;
                } else if (activity.type === 'warning') {
                  bgClass = 'bg-rose-50 text-[#EF4444]';
                  iconEl = <AlertTriangle className="w-4 h-4" />;
                } else {
                  bgClass = 'bg-blue-50 text-blue-600';
                  iconEl = <Activity className="w-4 h-4" />;
                }

                return (
                  <div key={activity.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${bgClass}`}>
                        {iconEl}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{activity.callId}</p>
                        <p className="text-slate-500 text-[11px]">{activity.title}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                      {activity.timeAgo}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM ACTION CARDS (4 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Multi-Module Evidence */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-[#E8F8F0] flex items-center justify-center text-[#10B981] mb-3">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Multi-Module Evidence</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Explore Wav2Vec2, AASIST, prosody and spectrogram neural forensic breakdown.
            </p>
          </div>
          <button
            onClick={() => navigate('/evidence')}
            className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-emerald-300 text-[#059669] bg-emerald-50/50 hover:bg-emerald-50 rounded-xl text-xs font-semibold transition-colors"
          >
            Inspect Evidence <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Analysis Reports */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-3">
              <BarChart2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Analysis Reports</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              View detailed analysis results, evidence breakdown, and download reports.
            </p>
          </div>
          <button
            onClick={() => navigate('/reports')}
            className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-purple-200 text-purple-600 bg-purple-50/40 hover:bg-purple-50 rounded-xl text-xs font-semibold transition-colors"
          >
            View Reports <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 3: Build a Safer World */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Build a Safer World</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Help detect AI-generated voices and protect people from fraud and misinformation.
            </p>
          </div>
          <button
            onClick={() => navigate('/help')}
            className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-teal-200 text-teal-700 bg-teal-50/40 hover:bg-teal-50 rounded-xl text-xs font-semibold transition-colors"
          >
            Learn More <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 4: Mountain Graphic Quote */}
        <div className="relative rounded-2xl overflow-hidden p-5 flex flex-col justify-between border border-slate-200/80 shadow-card bg-gradient-to-b from-blue-900 via-indigo-900 to-slate-950 text-white min-h-[170px]">
          {/* Mountain Silhouette Background */}
          <div className="absolute inset-0 opacity-40 bg-cover bg-center pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 300 200" preserveAspectRatio="none" fill="none">
              <path d="M0 160L80 90L150 140L210 70L300 170V200H0V160Z" fill="#1E293B" />
              <path d="M40 180L120 120L190 160L250 100L300 150V200H40V180Z" fill="#0F172A" />
              <path d="M100 130L150 70L190 110L240 60L300 130V200H100V130Z" fill="#334155" opacity="0.5" />
            </svg>
          </div>

          <div className="relative z-10">
            <p className="text-xs italic font-medium leading-relaxed text-slate-100">
              &ldquo;Technology should build trust, not doubt.&rdquo;
            </p>
          </div>
          <div className="relative z-10 pt-4">
            <p className="text-[11px] text-slate-400 font-medium">
              — Audio DeepCheck
            </p>
          </div>
        </div>
      </div>

      {/* Quick Call Details Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                Live Call: {selectedCall.callId}
              </h3>
              <button
                onClick={() => setSelectedCall(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Caller:</span>
                <span className="font-semibold text-slate-800">{selectedCall.caller}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Receiver:</span>
                <span className="font-semibold text-slate-800">{selectedCall.receiver}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Duration:</span>
                <span className="font-semibold text-slate-800">{selectedCall.duration}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Status:</span>
                <StatusBadge status={selectedCall.status} size="sm" />
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Latest Master Decision:</span>
                <DecisionBadge decision={selectedCall.latestAnalysis} size="sm" />
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Conflict Level:</span>
                <span className="font-semibold text-emerald-600">{selectedCall.conflictLevel || 'LOW'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Signal Quality:</span>
                <span className="font-semibold text-emerald-600">GOOD (Score: {selectedCall.qualityScore || 0.85})</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setSelectedCall(null);
                  navigate('/evidence');
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors"
              >
                Inspect AI Evidence
              </button>
              <button
                onClick={() => setSelectedCall(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
