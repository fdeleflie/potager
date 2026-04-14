import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, ChevronLeft } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  setCurrentView: (view: string) => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

export function Layout({ children, currentView, setCurrentView, onBack, canGoBack }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-white text-stone-900 font-sans print:bg-white print:h-auto">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={`print:hidden fixed lg:relative z-50 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar 
          currentView={currentView} 
          setCurrentView={(view) => {
            setCurrentView(view);
            setIsSidebarOpen(false);
          }} 
        />
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible flex flex-col">
        {/* Header with Back Button and Menu */}
        <div className="flex items-center justify-between mb-4 bg-white/50 backdrop-blur-sm p-2 rounded-xl border border-stone-200/60 sticky top-0 z-30 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-stone-500 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            {canGoBack && (
              <button
                onClick={onBack}
                className="p-2 text-stone-500 hover:bg-stone-100 rounded-lg transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Retour</span>
              </button>
            )}
          </div>
          <span className="text-lg font-serif font-medium text-stone-900 pr-4">Mon Potager</span>
        </div>

        {/* Desktop Header (Optional, but helpful) */}
        <div className="hidden lg:flex items-center mb-4 gap-4 sticky top-0 z-30">
          {canGoBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-stone-500 hover:text-emerald-600 transition-colors text-sm font-medium group bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-stone-200/60"
            >
              <ChevronLeft className="w-4 h-4" />
              Retour
            </button>
          )}
        </div>

        <div className="max-w-6xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
