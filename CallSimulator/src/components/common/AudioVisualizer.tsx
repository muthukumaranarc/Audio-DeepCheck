import React from 'react';

interface AudioVisualizerProps {
  level: number; // 0.0 to 1.0
  isMuted?: boolean;
}

/**
 * Local audio level activity indicator.
 * 
 * Strict forensic requirement:
 * This represents ONLY local microphone physical volume.
 * It is NOT an AI confidence score or fraud detection metric.
 */
export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ level, isMuted = false }) => {
  const numBars = 16;
  const bars = Array.from({ length: numBars }, (_, i) => {
    // Generate organic wave heights based on level and bar position
    const distanceToCenter = Math.abs(i - (numBars - 1) / 2) / (numBars / 2);
    const weight = 1.0 - distanceToCenter * 0.4;
    const baseHeight = isMuted ? 4 : Math.max(4, level * 52 * weight * (0.8 + ((i % 3) * 0.2)));
    return Math.min(56, Math.max(4, Math.round(baseHeight)));
  });

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 backdrop-blur-sm w-full max-w-xs">
      <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isMuted ? 'bg-amber-500' : level > 0.05 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
        {isMuted ? 'Microphone Muted' : 'Local Mic Activity'}
      </div>

      {/* Equalizer Bars */}
      <div className="flex items-center justify-center gap-1.5 h-14 w-full px-2">
        {bars.map((height, idx) => (
          <div
            key={idx}
            style={{ height: `${height}px` }}
            className={`w-1.5 rounded-full transition-all duration-75 ease-out ${
              isMuted
                ? 'bg-slate-700'
                : level > 0.6
                ? 'bg-gradient-to-t from-emerald-500 via-teal-400 to-amber-400'
                : level > 0.15
                ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                : 'bg-slate-700'
            }`}
          />
        ))}
      </div>

      {/* Disclaimer */}
      <div className="mt-2 text-[10px] text-slate-500 text-center font-normal">
        Local Audio Activity Indicator • Not AI Verdict
      </div>
    </div>
  );
};
