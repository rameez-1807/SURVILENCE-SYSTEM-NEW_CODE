import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#F0F5FA] dark:bg-[#070D1B] text-slate-800 dark:text-slate-100 overflow-hidden relative font-sans">
      {/* Subtle modern enterprise soft blue & purple ambient accents */}
      <div className="pointer-events-none fixed -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-300/20 dark:bg-blue-600/10 blur-[140px] z-0" />
      <div className="pointer-events-none fixed top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-purple-300/15 dark:bg-purple-600/10 blur-[140px] z-0" />
      <div className="pointer-events-none fixed -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full bg-cyan-300/15 dark:bg-cyan-500/10 blur-[140px] z-0" />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Fixed Navy Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full w-full relative z-10 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-7 scroll-smooth bg-[#F0F5FA] dark:bg-[#070D1B]">
          <div className="max-w-[1600px] mx-auto animate-fade-in pb-12">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
