import React, { useState } from 'react';
import { Settings, Server, Check, AlertCircle, Save, RefreshCw, Sliders } from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [apiUrl, setApiUrl] = useState(api.getBaseUrl());
  const [chunkDuration, setChunkDuration] = useState('500');
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await api.checkHealth();
      setHealthStatus(`Online: ${res.service} (status: ${res.status})`);
    } catch {
      setHealthStatus('Backend offline (using simulated mock pipeline)');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = () => {
    api.setBaseUrl(apiUrl);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Application Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure Spring Boot backend connection, streaming parameters, and AI thresholds.
          </p>
        </div>
      </div>

      {/* Backend API Configuration */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Server className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">Spring Boot API Configuration</h2>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              API Base URL (SPRING_BOOT_ENDPOINTS.md)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                Test Health
              </button>
            </div>
            {healthStatus && (
              <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> {healthStatus}
              </p>
            )}
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Audio Chunk Size Duration (milliseconds)
            </label>
            <select
              value={chunkDuration}
              onChange={(e) => setChunkDuration(e.target.value)}
              className="w-full sm:w-64 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:outline-hidden"
            >
              <option value="250">250 ms (Ultra Low Latency)</option>
              <option value="500">500 ms (Standard Recommended)</option>
              <option value="1000">1000 ms (High Precision)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
        >
          <Save className="w-4 h-4" />
          Save Configuration
        </button>
        {savedSuccess && (
          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
            <Check className="w-4 h-4" /> Settings updated successfully!
          </span>
        )}
      </div>
    </div>
  );
};
