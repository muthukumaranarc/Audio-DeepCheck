import React from 'react';
import { HelpCircle, Layers, Cpu, ShieldCheck, Code2, ArrowRight } from 'lucide-react';

export const HelpPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Audio DeepCheck System Documentation</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Architecture overview, endpoint specs, and error contracts defined in the project specification.
          </p>
        </div>
      </div>

      {/* 1. Core Architecture Visualizer */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#10B981]" />
          Separation of Concerns & Architecture
        </h2>

        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs font-mono text-slate-700 space-y-4">
          <p className="font-bold text-slate-900">High-Level Data Flow:</p>
          <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl overflow-x-auto text-xs leading-relaxed">
{`Mobile App (Simulator) ──────> Spring Boot (Port 8080) <────── Dashboard Frontend
                                      │
                                      ▼
                             FastAPI AI Service (Internal)
                                      │
                                      ▼
                 [Wav2Vec2, AASIST, Prosody, Spectrogram, Whisper]`}
          </pre>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans mt-4">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <strong className="text-emerald-700 block mb-1">Rule 1 & 2: Decoupled Clients</strong>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Neither the Mobile Simulator nor the Dashboard frontend communicates directly with FastAPI. Spring Boot mediates all session state, databases, and stream ingestion.
              </p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <strong className="text-purple-700 block mb-1">Rule 5: Authoritative Chunking</strong>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Every audio packet carries <code className="bg-slate-100 px-1 py-0.5 rounded">sequenceNumber</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">timestampMs</code>, and <code className="bg-slate-100 px-1 py-0.5 rounded">callId</code>. Arrival order over HTTP is not assumed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Spring Boot Endpoints Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Code2 className="w-4 h-4 text-[#8B5CF6]" />
          Spring Boot Public API Contract
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                <th className="pb-2.5 font-medium">Method</th>
                <th className="pb-2.5 font-medium">Endpoint</th>
                <th className="pb-2.5 font-medium">Consumer</th>
                <th className="pb-2.5 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
              <tr>
                <td className="py-2.5 text-blue-600 font-bold">GET</td>
                <td className="py-2.5 text-slate-900 font-bold">/health</td>
                <td className="py-2.5 text-slate-500 font-sans">Both</td>
                <td className="py-2.5 text-slate-600 font-sans">Health and uptime check</td>
              </tr>
              <tr>
                <td className="py-2.5 text-emerald-600 font-bold">POST</td>
                <td className="py-2.5 text-slate-900 font-bold">/calls</td>
                <td className="py-2.5 text-slate-500 font-sans">Mobile</td>
                <td className="py-2.5 text-slate-600 font-sans">Create a simulated call session</td>
              </tr>
              <tr>
                <td className="py-2.5 text-emerald-600 font-bold">POST</td>
                <td className="py-2.5 text-slate-900 font-bold">/calls/{'{id}'}/start</td>
                <td className="py-2.5 text-slate-500 font-sans">Mobile</td>
                <td className="py-2.5 text-slate-600 font-sans">Transition call state to ACTIVE</td>
              </tr>
              <tr>
                <td className="py-2.5 text-emerald-600 font-bold">POST</td>
                <td className="py-2.5 text-slate-900 font-bold">/calls/{'{id}'}/audio</td>
                <td className="py-2.5 text-slate-500 font-sans">Mobile</td>
                <td className="py-2.5 text-slate-600 font-sans">Stream multipart audio chunks with sequence numbers</td>
              </tr>
              <tr>
                <td className="py-2.5 text-blue-600 font-bold">GET</td>
                <td className="py-2.5 text-slate-900 font-bold">/calls/active</td>
                <td className="py-2.5 text-slate-500 font-sans">Dashboard</td>
                <td className="py-2.5 text-slate-600 font-sans">Fetch list of active & analyzing calls</td>
              </tr>
              <tr>
                <td className="py-2.5 text-blue-600 font-bold">GET</td>
                <td className="py-2.5 text-slate-900 font-bold">/calls/{'{id}'}/evidence</td>
                <td className="py-2.5 text-slate-500 font-sans">Dashboard</td>
                <td className="py-2.5 text-slate-600 font-sans">5-module neural evidence weights</td>
              </tr>
              <tr>
                <td className="py-2.5 text-blue-600 font-bold">GET</td>
                <td className="py-2.5 text-slate-900 font-bold">/calls/{'{id}'}/chunks</td>
                <td className="py-2.5 text-slate-500 font-sans">Dashboard</td>
                <td className="py-2.5 text-slate-600 font-sans">Evolution of analysis across time windows</td>
              </tr>
              <tr>
                <td className="py-2.5 text-emerald-600 font-bold">POST</td>
                <td className="py-2.5 text-slate-900 font-bold">/calls/{'{id}'}/end</td>
                <td className="py-2.5 text-slate-500 font-sans">Mobile</td>
                <td className="py-2.5 text-slate-600 font-sans">Close call session and finalize analysis</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
