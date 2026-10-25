import React, { useState, useEffect } from 'react';
import { AlertCircle, ExternalLink, X, ChevronDown, ChevronUp, ShieldCheck, RefreshCw, CheckCircle, Zap } from 'lucide-react';
import { getFirebaseQuotaStats, syncPriorityCollections, testFirebaseConnection, QuotaStats } from '../hooks/useFirebaseData';

export function QuotaBanner() {
  const [showBanner, setShowBanner] = useState(() => {
    return sessionStorage.getItem('dismissed_quota_banner') !== 'true';
  });
  // Hidden / collapsed by default as requested by user
  const [isExpanded, setIsExpanded] = useState(false);
  const [stats, setStats] = useState<QuotaStats>(getFirebaseQuotaStats);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setStats(getFirebaseQuotaStats());
    };

    window.addEventListener('firebase_quota_warning', handleUpdate);
    window.addEventListener('firebase_reads_updated', handleUpdate);
    window.addEventListener('firebase_writes_updated', handleUpdate);
    window.addEventListener('firebase_priority_synced', handleUpdate);

    return () => {
      window.removeEventListener('firebase_quota_warning', handleUpdate);
      window.removeEventListener('firebase_reads_updated', handleUpdate);
      window.removeEventListener('firebase_writes_updated', handleUpdate);
      window.removeEventListener('firebase_priority_synced', handleUpdate);
    };
  }, []);

  // Only show if quota exceeded OR margin is active (> 70% of reads)
  const shouldDisplay = (stats.isQuotaExceeded || stats.isMarginActive) && showBanner;

  if (!shouldDisplay) {
    return null;
  }

  const upgradeUrl = "https://console.firebase.google.com/project/gen-lang-client-0410975419/firestore/databases/ai-studio-5e99e311-d3dc-4085-9892-a0b63aed5f7a/data?openUpgradeDialog=true";

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('dismissed_quota_banner', 'true');
  };

  const handlePrioritySync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncPriorityCollections();
      if (res.success) {
        setSyncFeedback(`Synchronisé (${res.syncedCount} entrées à ${res.time})`);
      } else {
        setSyncFeedback(res.error || 'Erreur de synchro');
      }
    } catch (e: any) {
      setSyncFeedback(e.message || 'Erreur');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setSyncFeedback(null);
    try {
      const res = await testFirebaseConnection();
      setSyncFeedback(res.message);
      setStats(getFirebaseQuotaStats());
    } catch (e: any) {
      setSyncFeedback(e.message || 'Erreur de test');
    } finally {
      setIsTesting(false);
      setTimeout(() => setSyncFeedback(null), 6000);
    }
  };

  // Compact 1-line collapsed view by default
  if (!isExpanded) {
    return (
      <div className={`mb-3 border rounded-xl px-3 py-1.5 text-xs text-stone-800 shadow-2xs backdrop-blur-sm print:hidden flex items-center justify-between gap-2 animate-fade-in ${
        stats.isQuotaExceeded 
          ? 'bg-amber-50/90 border-amber-300 text-amber-950' 
          : 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
      }`}>
        <div className="flex items-center gap-2 truncate">
          {stats.isQuotaExceeded ? (
            <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          ) : (
            <Zap className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          )}
          <span className="font-semibold truncate text-[11px] sm:text-xs">
            {stats.isQuotaExceeded 
              ? (stats.readsToday < stats.maxDailyReads 
                  ? `Mode Cache Local Actif (Alerte quota serveur Firebase • ${stats.readsToday.toLocaleString('fr-FR')} lues ici)`
                  : 'Mode Cache Local Actif (Quota Spark journalier atteint)')
              : 'Protection Quota Active : Journal & Perpétuel prioritaires'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 px-2 py-0.5 rounded-md hover:bg-stone-100/60 border border-stone-200/80 bg-white/70 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Détails</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          <button 
            type="button"
            onClick={handleDismiss}
            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-md transition-colors cursor-pointer"
            title="Masquer cet avertissement"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded full view
  return (
    <div className={`mb-4 border rounded-xl p-3.5 sm:p-4 text-stone-900 shadow-sm backdrop-blur-sm print:hidden animate-fade-in ${
      stats.isQuotaExceeded 
        ? 'bg-amber-50/95 border-amber-300 text-amber-950' 
        : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
            stats.isQuotaExceeded ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {stats.isQuotaExceeded ? <AlertCircle className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                {stats.isQuotaExceeded 
                  ? 'Mode Cache Local Actif' 
                  : 'Marge Quota Active : Journal & Calendrier Perpétuel prioritaires'}
              </span>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                stats.isQuotaExceeded 
                  ? 'bg-amber-200/80 text-amber-900' 
                  : 'bg-emerald-200/80 text-emerald-900'
              }`}>
                <ShieldCheck className="w-3 h-3" />
                {stats.isQuotaExceeded ? 'Cache Local Sécurisé' : 'Protection Prioritaire Active'}
              </span>
            </div>

            {/* Quota Progress Bar */}
            <div className="w-full max-w-md pt-0.5">
              <div className="flex justify-between items-center text-[11px] text-stone-600 mb-1">
                <span>Lectures estimées sur cet appareil : <strong className="text-stone-800">{stats.readsToday.toLocaleString('fr-FR')}</strong> / {stats.maxDailyReads.toLocaleString('fr-FR')}</span>
                <span>{stats.readPercent}%</span>
              </div>
              <div className="w-full bg-stone-200/80 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    stats.readPercent >= 90 ? 'bg-red-500' : stats.readPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, stats.readPercent)}%` }}
                />
              </div>
            </div>

            <div className="text-xs text-stone-700 leading-relaxed max-w-3xl space-y-1.5">
              {stats.isQuotaExceeded ? (
                <>
                  <p>Vos données restent <strong>100% consultables et modifiables</strong> grâce au cache sécurisé de votre navigateur. Le quota gratuit Spark (50&nbsp;000 lectures) est réinitialisé chaque jour par Google (vers 9h-10h).</p>
                  {stats.readsToday < stats.maxDailyReads && (
                    <p className="text-[11px] text-amber-950 bg-amber-100/70 p-2.5 rounded-lg border border-amber-200/90 leading-snug">
                      💡 <strong>Comprendre les {stats.readsToday.toLocaleString('fr-FR')} lectures :</strong> Ce compteur mesure uniquement les requêtes effectuées depuis ce navigateur. Cependant, la limite de 50&nbsp;000 lectures de Firebase s'applique <strong>à tout votre projet Google</strong> (cumul de votre téléphone, PC, ou connexions précédentes). Dès que le serveur Google signale la limite, l'application bascule automatiquement en cache local pour éviter tout blocage.
                    </p>
                  )}
                </>
              ) : (
                <p>Pour garantir que votre <strong>Journal</strong> et votre <strong>Calendrier perpétuel</strong> restent accessibles et synchronisés sur votre téléphone et PC, les 15&nbsp;000 lectures restantes leur sont strictement réservées.</p>
              )}
            </div>

            <div className="pt-2 flex items-center gap-3 flex-wrap text-xs">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-300 text-stone-800 font-medium rounded-lg shadow-2xs hover:bg-stone-50 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-amber-600' : 'text-emerald-600'}`} />
                <span>{isTesting ? 'Vérification...' : 'Tester connexion Firestore'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrioritySync}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-300 text-stone-800 font-medium rounded-lg shadow-2xs hover:bg-stone-50 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : 'text-stone-500'}`} />
                <span>{isSyncing ? 'Synchronisation...' : 'Synchroniser Journal & Perpétuel'}</span>
              </button>

              {syncFeedback && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-md border border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{syncFeedback}</span>
                </span>
              )}

              <a 
                href={upgradeUrl} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900 underline underline-offset-2 transition-colors ml-auto text-[11px]"
              >
                <span>Forfait Blaze (sans limite)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={() => setIsExpanded(false)}
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-200/50 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer"
            title="Réduire l'encart"
          >
            <ChevronUp className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px]">Réduire</span>
          </button>
          <button 
            onClick={handleDismiss}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-lg transition-colors cursor-pointer"
            title="Masquer cet avertissement"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
