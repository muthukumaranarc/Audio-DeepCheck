import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PhoneCall,
  Activity,
  Radio,
  Clock,
  Shield,
  Search,
  Filter,
  ArrowRight,
  Eye,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { StatusBadge, DecisionBadge } from '../components/common/Badge';
import { mockLiveCalls } from '../services/mockData';
import { CallRecord } from '../types';

export const ActiveCallsPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

  const filteredCalls = mockLiveCalls.filter((call) => {
    const matchesFilter =
      filterStatus === 'ALL' || call.status === filterStatus;
    const matchesSearch =
      call.callId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.caller.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.receiver.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#E8F8F0] flex items-center justify-center text-[#10B981]">
            <PhoneCall className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Live Active Calls</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E8F8F0] text-[#059669]">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping"></span>
                Monitoring 5 Live Channels
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuous neural audio stream verification via Spring Boot API /calls/active.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-[#059669] rounded-xl text-xs font-semibold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping"></span>
            Real-time Feed Active
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'ANALYZING', 'ACTIVE', 'CONNECTING'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterStatus === status
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {status === 'ALL' ? 'All Live' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by caller, receiver, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Active Call Monitoring Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCalls.map((call) => (
          <div
            key={call.callId}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-cardHover transition-all flex flex-col justify-between"
          >
            <div>
              {/* Header: Call ID + Status */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#10B981] animate-pulse" />
                  <span className="text-sm font-bold text-slate-900">{call.callId}</span>
                </div>
                <StatusBadge status={call.status} size="sm" />
              </div>

              {/* Call Parties */}
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Caller:</span>
                  <span className="font-semibold text-slate-800">{call.caller}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Receiver:</span>
                  <span className="font-semibold text-slate-800">{call.receiver}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Duration:</span>
                  <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                    {call.duration}
                  </span>
                </div>
              </div>

              {/* Animated Live Waveform */}
              <div className="mt-4 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between text-[11px] mb-2">
                  <span className="text-slate-500 font-medium">Acoustic Audio Stream</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    500ms Chunks
                  </span>
                </div>
                <div className="flex items-end justify-between h-8 gap-1 px-1">
                  {[4, 12, 18, 24, 10, 16, 22, 14, 20, 8, 15, 25, 12, 6, 19, 14].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}px` }}
                      className={`w-full rounded-full transition-all duration-300 ${
                        call.latestAnalysis === 'AI_GENERATED'
                          ? 'bg-rose-400 animate-pulse'
                          : call.latestAnalysis === 'HUMAN'
                          ? 'bg-emerald-400'
                          : 'bg-amber-400'
                      }`}
                    ></div>
                  ))}
                </div>
              </div>

              {/* Current AI Decision Preview */}
              <div className="mt-4 flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 font-medium">Master Decision:</span>
                <DecisionBadge decision={call.latestAnalysis} size="sm" />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => navigate('/evidence')}
                className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#059669] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1"
              >
                <Layers className="w-3.5 h-3.5" />
                Inspect Evidence
              </button>
              <button
                onClick={() => setSelectedCall(call)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="View Full Call Info"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Call Details Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-500" />
                Call Inspector: {selectedCall.callId}
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
                <span className="text-slate-500">Status:</span>
                <StatusBadge status={selectedCall.status} size="sm" />
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Master Decision:</span>
                <DecisionBadge decision={selectedCall.latestAnalysis} size="sm" />
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Decision Strength (Provisional):</span>
                <span className="font-mono font-bold text-slate-800">{selectedCall.decisionStrength ?? 0.31}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Confidence Status:</span>
                <span className="font-semibold text-slate-700">{selectedCall.confidenceStatus ?? 'PROVISIONAL'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Signal Quality:</span>
                <span className="font-semibold text-emerald-600">GOOD (Score: {selectedCall.qualityScore ?? 0.82})</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Conflict Level:</span>
                <span className="font-semibold text-amber-600">{selectedCall.conflictLevel ?? 'LOW'}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setSelectedCall(null);
                  navigate('/evidence');
                }}
                className="flex-1 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white font-semibold rounded-xl text-xs transition-colors"
              >
                View 5-Module Evidence Breakdown
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
