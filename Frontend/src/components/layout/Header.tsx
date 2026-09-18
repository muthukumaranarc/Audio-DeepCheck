import React, { useState, useEffect } from 'react';
import { Bell, Calendar, ChevronDown } from 'lucide-react';

export const Header: React.FC = () => {
  const [currentTime, setCurrentTime] = useState({
    date: 'Thu, Sep 18, 2026',
    time: '10:24 AM'
  });
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    // Keep date/time formatted consistently
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#F4F7FB]/95 backdrop-blur-md px-8 py-4 flex items-center justify-between gap-4 select-none border-b border-slate-200/50">
      {/* Left: User Greeting & Subtitle */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          Good Morning, <span className="text-[#059669]">Muthukumaran</span>
          <span className="text-2xl">👋</span>
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Monitor calls, analyze voices, and detect AI-generated audio in real time.
        </p>
      </div>

      {/* Center: Quote & Animated Waveform */}
      <div className="hidden xl:flex items-center gap-3 bg-white/80 backdrop-blur-xs border border-slate-200/80 rounded-2xl px-4 py-2 shadow-2xs">
        <div className="text-right">
          <p className="text-[11px] italic text-slate-600 font-medium leading-tight">
            &ldquo;Same voice.
          </p>
          <p className="text-[11px] italic text-slate-500 font-normal leading-tight">
            But not always the same person.&rdquo;
          </p>
        </div>
        {/* Soft decorative soundwave SVG matching screenshot */}
        <div className="flex items-center gap-0.5 text-teal-500 h-6 px-1">
          <svg className="w-16 h-6 text-teal-400" viewBox="0 0 70 24" fill="none">
            <path
              d="M2 12C6 12 8 8 11 8C14 8 16 16 19 16C22 16 25 4 28 4C31 4 34 20 37 20C40 20 43 10 46 10C49 10 52 14 55 14C58 14 62 12 68 12"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Right: Actions, Profile & Date/Time Card */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-2xs transition-all"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#EF4444] rounded-full ring-2 ring-white"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                <span className="text-xs font-bold text-slate-800">Notifications</span>
                <span className="text-[10px] text-emerald-600 font-semibold">3 new</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-rose-50/70 rounded-xl border border-rose-100">
                  <p className="font-semibold text-rose-900">CALL-0997 Alert</p>
                  <p className="text-[10px] text-rose-700 mt-0.5">Suspicious neural vocoder pattern detected (synthetic speech score 0.89).</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="font-semibold text-slate-800">CALL-1001 Result</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Flagged as UNCERTAIN due to background acoustic noise.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div className="flex items-center gap-2.5 bg-white border border-slate-200/80 rounded-2xl px-3 py-1.5 shadow-2xs cursor-pointer hover:border-slate-300 transition-all">
          <div className="w-8 h-8 rounded-full bg-[#8B5CF6] text-white font-bold flex items-center justify-center text-sm shadow-xs">
            M
          </div>
          <div className="hidden sm:block text-left pr-1">
            <p className="text-xs font-bold text-slate-900 leading-tight">Muthukumaran</p>
            <p className="text-[10px] text-slate-400 font-medium">Team Zero</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>

        {/* Date & Time Widget Card */}
        <div className="hidden md:flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl px-4 py-2 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
            <Calendar className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-left">
            <p className="text-[11px] text-slate-500 font-medium leading-tight">
              {currentTime.date}
            </p>
            <p className="text-sm font-extrabold text-slate-900 tracking-tight leading-tight mt-0.5">
              {currentTime.time}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
