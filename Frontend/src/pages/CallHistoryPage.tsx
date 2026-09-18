import React, { useState } from 'react';
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
  ShieldAlert
} from 'lucide-react';
import { StatusBadge, DecisionBadge } from '../components/common/Badge';
import { mockCallHistory } from '../services/mockData';
import { CallRecord } from '../types';

export const CallHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDecision, setSelectedDecision] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const filteredHistory = mockCallHistory.filter((call) => {
    const matchesSearch =
      call.callId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.caller.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.receiver.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDecision =
      selectedDecision === 'ALL' || call.latestAnalysis === selectedDecision;

    const matchesStatus =
      selectedStatus === 'ALL' || call.status === selectedStatus;

    return matchesSearch && matchesDecision && matchesStatus;
  });

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const paginatedCalls = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredHistory, null, 2));
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

        <button
          onClick={exportJSON}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
        >
          <Download className="w-4 h-4" />
          Export JSON Report
        </button>
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Decision Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Decision:</span>
            <select
              value={selectedDecision}
              onChange={(e) => {
                setSelectedDecision(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="ALL">All Decisions</option>
              <option value="HUMAN">Human Only</option>
              <option value="AI_GENERATED">AI Generated Only</option>
              <option value="UNCERTAIN">Uncertain Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="ACTIVE">Active</option>
              <option value="ANALYZING">Analyzing</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold">
              <tr>
                <th className="py-3.5 px-5 font-semibold">Call ID</th>
                <th className="py-3.5 px-4 font-semibold">Caller</th>
                <th className="py-3.5 px-4 font-semibold">Receiver</th>
                <th className="py-3.5 px-4 font-semibold">Duration</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Final Decision</th>
                <th className="py-3.5 px-4 font-semibold">Quality</th>
                <th className="py-3.5 px-5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedCalls.length > 0 ? (
                paginatedCalls.map((call) => (
                  <tr key={call.callId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5 font-bold text-slate-900">
                      {call.callId}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {call.caller}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {call.receiver}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {call.duration}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={call.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <DecisionBadge decision={call.latestAnalysis} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-emerald-600 font-semibold">
                        {(call.qualityScore ?? 0.85) * 100}%
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/reports`)}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-lg text-[11px] transition-colors flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          Report
                        </button>
                        <button
                          onClick={() => navigate(`/evidence`)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#059669] font-semibold rounded-lg text-[11px] transition-colors flex items-center gap-1"
                        >
                          <Activity className="w-3 h-3" />
                          Evidence
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No calls match your search and filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <span className="font-semibold text-slate-800">{paginatedCalls.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{filteredHistory.length}</span> calls
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-slate-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
