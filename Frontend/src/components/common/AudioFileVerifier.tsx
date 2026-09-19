import React, { useState, useRef } from 'react';
import {
  Upload,
  FileAudio,
  CheckCircle,
  AlertTriangle,
  Bot,
  UserCheck,
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
  Volume2,
  X,
  ArrowRight
} from 'lucide-react';
import { api } from '../../services/api';
import { AudioVerificationResult } from '../../types';

interface AudioFileVerifierProps {
  onClose?: () => void;
  standalone?: boolean;
}

export const AudioFileVerifier: React.FC<AudioFileVerifierProps> = ({ onClose, standalone = false }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<AudioVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    setResult(null);
    const name = selectedFile.name.toLowerCase();
    const valid = name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.war') || name.endsWith('.ogg') || name.endsWith('.flac');
    if (!valid) {
      setError('Please select an audio file (.mp3, .wav, or .war format)');
      return;
    }
    setFile(selectedFile);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await api.verifyAudioFile(file);
      setResult(res);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to analyze audio file with models.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFormatBadge = (filename: string) => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.mp3')) return { label: 'MP3 (Will convert to WAV)', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    if (lower.endsWith('.war')) return { label: 'WAR / WAV Audio', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    return { label: 'WAV 16kHz PCM', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden ${standalone ? '' : 'p-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Audio Deepfake Verifier</h2>
            <p className="text-xs text-slate-500">
              Upload <span className="font-semibold text-slate-700">.mp3</span> or <span className="font-semibold text-slate-700">.wav / .war</span> to verify AI vs Human authenticity
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Upload Dropzone (if not analyzed yet) */}
        {!result && (
          <div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.war,.ogg,.flac,audio/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center mb-3 shadow-inner">
                  <Upload className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {file ? file.name : 'Click to upload or drag & drop audio file'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports <span className="font-bold text-slate-700">.MP3</span> and <span className="font-bold text-slate-700">.WAV / .WAR</span> (up to 25 MB)
                </p>
                <p className="text-[11px] text-indigo-600 font-medium mt-2 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                  * Note: .MP3 files are automatically converted to 16kHz mono WAV before model verification
                </p>
              </div>
            </div>

            {/* Selected File Card */}
            {file && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center">
                    <FileAudio className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 truncate max-w-xs md:max-w-md">{file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      <span className="text-slate-300">•</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getFormatBadge(file.name).color}`}>
                        {getFormatBadge(file.name).label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={resetAll}
                    disabled={isAnalyzing}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors"
                  >
                    Change
                  </button>

                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying with AI Models...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Verify Authenticity</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Live Result View */}
        {result && (
          <div className="space-y-5 animate-fadeIn">
            {/* Top Verdict Banner */}
            <div
              className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm ${
                result.decision === 'AI_GENERATED'
                  ? 'bg-gradient-to-r from-rose-50 via-rose-100/50 to-amber-50 border-rose-300'
                  : result.decision === 'HUMAN'
                  ? 'bg-gradient-to-r from-emerald-50 via-emerald-100/50 to-teal-50 border-emerald-300'
                  : 'bg-gradient-to-r from-amber-50 via-amber-100/50 to-yellow-50 border-amber-300'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${
                    result.decision === 'AI_GENERATED'
                      ? 'bg-rose-600 text-white'
                      : result.decision === 'HUMAN'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {result.decision === 'AI_GENERATED' && <Bot className="w-8 h-8" />}
                  {result.decision === 'HUMAN' && <UserCheck className="w-8 h-8" />}
                  {result.decision === 'UNCERTAIN' && <AlertTriangle className="w-8 h-8" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full ${
                        result.decision === 'AI_GENERATED'
                          ? 'bg-rose-200 text-rose-900 font-black'
                          : result.decision === 'HUMAN'
                          ? 'bg-emerald-200 text-emerald-900 font-black'
                          : 'bg-amber-200 text-amber-900 font-black'
                      }`}
                    >
                      {result.decision === 'AI_GENERATED' && 'AI-Generated Voice (Deepfake)'}
                      {result.decision === 'HUMAN' && 'Authentic Human Voice'}
                      {result.decision === 'UNCERTAIN' && 'Inconclusive / Mixed Evidence'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Strength: {(result.decision_strength * 100).toFixed(1)}%
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    {result.decision === 'AI_GENERATED' && 'Synthetic Speech Detected'}
                    {result.decision === 'HUMAN' && 'Verified Genuine Human Speech'}
                    {result.decision === 'UNCERTAIN' && 'Analysis Inconclusive'}
                  </h3>

                  <p className="text-xs text-slate-600 mt-0.5">
                    File: <span className="font-semibold">{result.original_filename}</span>
                    {result.was_converted && (
                      <span className="ml-2 text-emerald-700 font-medium bg-emerald-100/80 px-2 py-0.5 rounded-md text-[10px]">
                        ✓ Converted MP3 to 16kHz WAV before inference
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button
                  onClick={resetAll}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Verify Another Audio</span>
                </button>
              </div>
            </div>

            {/* Evidence & Confidence Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-500">Synthetic Evidence</p>
                <p className="text-lg font-black text-rose-600 mt-0.5">
                  {(result.synthetic_evidence_score * 100).toFixed(1)}%
                </p>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${result.synthetic_evidence_score * 100}%` }} />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-500">Human Evidence</p>
                <p className="text-lg font-black text-emerald-600 mt-0.5">
                  {(result.human_evidence_score * 100).toFixed(1)}%
                </p>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${result.human_evidence_score * 100}%` }} />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-500">Audio Duration</p>
                <p className="text-lg font-black text-slate-800 mt-0.5">
                  {result.duration_sec ? `${result.duration_sec.toFixed(1)}s` : 'N/A'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Processed at 16kHz mono</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-500">Model Agreement</p>
                <p className="text-lg font-black text-indigo-600 mt-0.5">{result.conflict_level} CONFLICT</p>
                <p className="text-[10px] text-slate-400 mt-1">Primary: Wav2Vec2 (55%)</p>
              </div>
            </div>

            {/* Specialist Module Breakdown */}
            {result.modules && result.modules.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-slate-700" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Multi-Model Forensic Evidence Breakdown
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Wav2Vec2 is high-priority primary detector (55% weight)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                        <th className="pb-2">Model Specialist</th>
                        <th className="pb-2">Weight</th>
                        <th className="pb-2">Normalized Score</th>
                        <th className="pb-2">Contribution</th>
                        <th className="pb-2">Direction</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 font-mono text-[11px]">
                      {result.modules.map((m) => {
                        const isAi = m.normalized_score > 0.05;
                        const isHuman = m.normalized_score < -0.05;

                        return (
                          <tr key={m.module} className="hover:bg-slate-100/50 transition-colors">
                            <td className="py-2.5 font-bold font-sans text-slate-800 flex items-center gap-1.5">
                              {m.module === 'wav2vec2' && <span className="text-indigo-600 font-extrabold">★</span>}
                              {m.module}
                              {m.module === 'wav2vec2' && (
                                <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-sans font-bold">
                                  PRIMARY
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 font-semibold text-slate-600 font-sans">
                              {(m.effective_weight * 100).toFixed(0)}%
                            </td>
                            <td className="py-2.5">
                              <span className={isAi ? 'text-rose-600 font-bold' : isHuman ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                                {m.normalized_score > 0 ? `+${m.normalized_score.toFixed(4)}` : m.normalized_score.toFixed(4)}
                              </span>
                            </td>
                            <td className="py-2.5 text-slate-600">
                              {m.contribution > 0 ? `+${m.contribution.toFixed(4)}` : m.contribution.toFixed(4)}
                            </td>
                            <td className="py-2.5 font-sans">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isAi
                                    ? 'bg-rose-100 text-rose-800'
                                    : isHuman
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {isAi ? 'AI_VOICE' : isHuman ? 'HUMAN' : 'NEUTRAL'}
                              </span>
                            </td>
                            <td className="py-2.5 font-sans text-[10px] text-slate-500">
                              {m.status}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
