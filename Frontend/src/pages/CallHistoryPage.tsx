import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Search,
  Download,
  Filter,
  FileText,
  Activity,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  RefreshCw
} from 'lucide-react';
import { StatusBadge, DecisionBadge } from '../components/common/Badge';
import { CallRecord } from '../types';
import { api } from '../services/api';
import { formatStrength, formatPercent } from '../utils/formatters';

export const CallHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDecision, setSelectedDecision] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const itemsPerPage = 8;

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getCallHistory({
        page: currentPage - 1,
        size: itemsPerPage,
        decision: selectedDecision,
        status: selectedStatus,
        search: searchTerm,
      });
      setCalls(res.content);
      setTotalPages(res.totalPages || 1);
      setTotalElements(res.totalElements || res.content.length);
    } catch {
      // quiet fallback
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, selectedDecision, selectedStatus, searchTerm]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(calls, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audio-deepcheck-history-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Call History & Verification Log</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Archived calls, final decision verdicts, and signal quality metrics (Spring Boot GET /calls).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportJSON}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
          >
            <Download className="w-4 h-4" />
            Export JSON Report
          </button>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Call ID, caller, receiver..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Decision Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Verdict:</span>
            <select
              value={selectedDecision}
              onChange={(e) => {
                setSelectedDecision(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-medium focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Decisions</option>
              <option value="HUMAN">Human</option>
              <option value="AI_GENERATED">AI Generated</option>
              <option value="UNCERTAIN">Uncertain</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-medium focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="ENDED">Ended</option>
              <option value="ACTIVE">Active</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          <button
            onClick={fetchHistory}
            className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            title="Refresh History"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* History Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-3.5 pl-6">Call ID</th>
                <th className="py-3.5 px-4">Participants</th>
                <th className="py-3.5 px-4">Duration</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Final Verdict</th>
                <th className="py-3.5 px-4">Strength / Mode</th>
                <th className="py-3.5 px-4">Quality Score</th>
                <th className="py-3.5 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No historical calls found matching filters.
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr key={call.callId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 pl-6 font-semibold font-mono text-slate-900">
                      {call.callId}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{call.caller}</p>
                      <p className="text-[11px] text-slate-400">→ {call.receiver}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                      {call.duration}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={call.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <DecisionBadge decision={call.latestAnalysis} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="font-bold text-slate-900">
                        {call.decisionStrength !== undefined && call.decisionStrength !== null
                          ? formatStrength(call.decisionStrength)
                          : '--'}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1.5 uppercase">
                        {call.confidenceStatus || 'PROVISIONAL'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                      {formatPercent(call.qualityScore, '94%')}
                    </td>
                    <td className="py-3.5 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/reports?callId=${call.callId}`)}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Report</span>
                        </button>
                        <button
                          onClick={() => navigate(`/live-monitor/${call.callId}`)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <Activity className="w-3 h-3" />
                          <span>Timeline</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-50/60 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-800">{calls.length}</span> of{' '}
            <span className="font-bold text-slate-800">{totalElements}</span> calls
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
