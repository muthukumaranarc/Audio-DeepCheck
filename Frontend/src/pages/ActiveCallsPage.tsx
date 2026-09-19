import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
  PhoneOff
} from 'lucide-react';
import { StatusBadge, DecisionBadge } from '../components/common/Badge';
import { CallRecord } from '../types';
import { api } from '../services/api';
import { liveMonitor } from '../services/LiveMonitoringService';
import { mockLiveCalls } from '../services/mockData';
import { formatStrength, formatPercent } from '../utils/formatters';

export const ActiveCallsPage: React.FC = () => {
  const navigate = useNavigate();
  const [calls, setCalls] = useState<CallRecord[]>(mockLiveCalls);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchCalls = useCallback(async () => {
    setIsLoading(true);
    try {
      const active = await api.getActiveCalls();
      setCalls(active);
    } catch {
      // keep fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
    liveMonitor.connect();

    const unsubActive = liveMonitor.onCallActive(() => fetchCalls());
    const unsubEnded = liveMonitor.onCallEnded(() => fetchCalls());
    const unsubAnalysis = liveMonitor.onAnalysisUpdate(() => fetchCalls());

    const poller = setInterval(fetchCalls, 5000);

    return () => {
      unsubActive();
      unsubEnded();
      unsubAnalysis();
      clearInterval(poller);
    };
  }, [fetchCalls]);

  const filteredCalls = calls.filter((call) => {
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
                Monitoring {calls.length} Active Channels
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuous neural audio stream verification via Spring Boot API /calls/active.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/live-monitor')}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Open Two-User Live Monitor</span>
          </button>

          <button
            onClick={fetchCalls}
            className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            title="Refresh active calls"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
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
        {filteredCalls.map((call) => {
          const isAI = call.latestAnalysis === 'AI_GENERATED';
          const isHuman = call.latestAnalysis === 'HUMAN';
          const isUncertain = call.latestAnalysis === 'UNCERTAIN';

          return (
            <div
              key={call.callId}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-cardHover transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                {/* Header: Call ID, Status, and Live Indicator */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="font-bold text-slate-900 text-sm font-mono">
                      {call.callId}
                    </span>
                  </div>
                  <StatusBadge status={call.status} size="sm" />
                </div>

                {/* Call Participant Details */}
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Caller:</span>
                    <span className="font-bold text-slate-800">{call.caller}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Receiver:</span>
                    <span className="font-semibold text-slate-600">{call.receiver}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Duration:</span>
                    <span className="font-mono text-slate-700 font-bold">{call.duration}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Quality Score:</span>
                    <span className="font-mono text-emerald-600 font-bold">
                      {formatPercent(call.qualityScore, '94%')}
                    </span>
                  </div>
                </div>

                {/* Live Analysis Status Card */}
                <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Live AI Verdict
                    </span>
                    <div className="mt-1">
                      <DecisionBadge decision={call.latestAnalysis} size="sm" />
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Strength
                    </span>
                    <p className="font-mono font-bold text-sm text-slate-800">
                      {call.decisionStrength !== undefined && call.decisionStrength !== null
                        ? formatStrength(call.decisionStrength)
                        : '--'}
                    </p>
                    <span className="text-[9px] text-amber-600 uppercase font-semibold">Provisional</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => navigate(`/live-monitor/${call.callId}`)}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Live Monitor</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
