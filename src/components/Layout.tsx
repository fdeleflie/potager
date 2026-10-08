import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, ChevronLeft, Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { QuotaBanner } from './QuotaBanner';
import { getFirebaseQuotaStats, syncPriorityCollections, QuotaStats } from '../hooks/useFirebaseData';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  setCurrentView: (view: string) => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

export function Layout({ children, currentView, setCurrentView, onBack, canGoBack }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [quotaStats, setQuotaStats] = useState<QuotaStats>(getFirebaseQuotaStats);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    const updateStats = () => setQuotaStats(getFirebaseQuotaStats());
    window.addEventListener('firebase_reads_updated', updateStats);
    window.addEventListener('firebase_writes_updated', updateStats);
    window.addEventListener('firebase_quota_warning', updateStats);
    window.addEventListener('firebase_priority_synced', (e: any) => {
      updateStats();
      if (e?.detail?.time) setLastSyncTime(e.detail.time);
    });

    return () => {
      window.removeEventListener('firebase_reads_updated', updateStats);
      window.removeEventListener('firebase_writes_updated', updateStats);
      window.removeEventListener('firebase_quota_warning', updateStats);
      window.removeEventListener('firebase_priority_synced', updateStats);
    };
  }, []);

  const handleQuickSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncPriorityCollections();
      if (res.success) {
        setLastSyncTime(res.time);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

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
        <div className="flex items-center justify-between mb-4 bg-white/50 backdrop-blur-sm p-2 rounded-xl border border-stone-200/60 lg:hidden">
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

          <div className="flex items-center gap-2 pr-1">
            <button
              type="button"
              onClick={handleQuickSync}
              disabled={isSyncing}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                quotaStats.isQuotaExceeded
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : quotaStats.isMarginActive
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
              title="Synchronisation prioritaire Journal & Calendrier perpétuel"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-emerald-600' : 'text-stone-500'}`} />
              <span>{isSyncing ? 'Synchro...' : quotaStats.isQuotaExceeded ? 'Cache' : 'En ligne'}</span>
            </button>
            <span className="text-base font-serif font-medium text-stone-900 pr-2">Mon Potager</span>
          </div>
        </div>

        {/* Desktop Header (Optional, but helpful) */}
        <div className="hidden lg:flex items-center justify-between mb-4 gap-4">
          <div>
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickSync}
              disabled={isSyncing}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-all shadow-2xs ${
                quotaStats.isQuotaExceeded
                  ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                  : quotaStats.isMarginActive
                    ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
              title="Cliquer pour forcer la synchronisation prioritaire (Journal & Calendrier perpétuel)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : 'text-emerald-700'}`} />
              <span>
                {isSyncing 
                  ? 'Synchronisation prioritaire...' 
                  : quotaStats.isQuotaExceeded 
                    ? 'Mode Cache Local Actif' 
                    : lastSyncTime 
                      ? `Synchronisé à ${lastSyncTime}` 
                      : 'Synchro Journal & Perpétuel'}
              </span>
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto w-full">
          <QuotaBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
