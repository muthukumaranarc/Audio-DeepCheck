import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FB] text-slate-800">
      {/* Static Left Sidebar */}
      <Sidebar />

      {/* Main Content Area (scrolls independently) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Header */}
        <Header />

        {/* Dynamic Route Page View */}
        <main className="flex-1 px-8 pb-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
