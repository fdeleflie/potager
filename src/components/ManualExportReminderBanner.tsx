import React, { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Clock, Download, X } from 'lucide-react';
import {
  backupService,
  formatBackupSize,
  MANUAL_EXPORT_UPDATED_EVENT,
  ManualExportReminderStatus
} from '../backupService';
import { getTargetUid } from '../hooks/useFirebaseData';
import { getAllIdbCollectionsForUid } from '../services/localCacheDb';

interface ManualExportReminderBannerProps {
  setCurrentView: (view: string) => void;
}

export function ManualExportReminderBanner({ setCurrentView }: ManualExportReminderBannerProps) {
  const [status, setStatus] = useState<ManualExportReminderStatus>(() =>
    backupService.getManualExportReminderStatus()
  );
  const [hasUserData, setHasUserData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedMessage, setExportedMessage] = useState<string | null>(null);

  const checkDataAndStatus = async () => {
    setStatus(backupService.getManualExportReminderStatus());
    try {
      const uid = await getTargetUid();
      if (!uid) {
        setHasUserData(false);
        return;
      }
      const colls = await getAllIdbCollectionsForUid(uid);
      const count = Object.values(colls).reduce(
        (acc, items) => acc + (Array.isArray(items) ? items.length : 0),
        0
      );
      setHasUserData(count > 0);
    } catch {
      setHasUserData(false);
    }
  };

  useEffect(() => {
    void checkDataAndStatus();
    const timer = window.setTimeout(() => void checkDataAndStatus(), 3500);

    const handleRefresh = () => {
      void checkDataAndStatus();
    };
    window.addEventListener(MANUAL_EXPORT_UPDATED_EVENT, handleRefresh);
    window.addEventListener('targetUidResolved', handleRefresh);
    window.addEventListener('potager_local_sync_status_changed', handleRefresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(MANUAL_EXPORT_UPDATED_EVENT, handleRefresh);
      window.removeEventListener('targetUidResolved', handleRefresh);
      window.removeEventListener('potager_local_sync_status_changed', handleRefresh);
    };
  }, []);

  const handleQuickExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await backupService.exportJsonFile(true);
      if (!res.cancelled) {
        setExportedMessage(
          `Export complet enregistré (${res.totalItems} fiches, ${formatBackupSize(
            res.sizeBytes
          )}). Prochain rappel dans ${status.intervalDays} jours.`
        );
        setTimeout(() => setExportedMessage(null), 6000);
      }
    } catch (err) {
      console.error('Quick export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (exportedMessage) {
    return (
      <div className="mb-3 border border-emerald-300 bg-emerald-50/90 rounded-xl px-3.5 py-2 text-xs text-emerald-950 shadow-2xs print:hidden flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportedMessage}</span>
        </div>
        <button
          type="button"
          onClick={() => setExportedMessage(null)}
          className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-md cursor-pointer"
          title="Fermer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (!hasUserData || !status.isDue) {
    return null;
  }

  return (
    <div className="mb-3 border border-blue-200 bg-blue-50/90 rounded-xl px-3.5 py-2 text-xs text-blue-950 shadow-2xs print:hidden flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 shrink-0">
          <BellRing className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="font-semibold">Rappel d'export manuel : </span>
          <span className="text-blue-900">
            {status.daysSinceLastExport === null
              ? "pensez à télécharger une copie complète (.json) sur votre appareil ou Google Drive (puis tous les " +
                status.intervalDays +
                ' jours).'
              : `votre dernier fichier .json date d'il y a ${status.daysSinceLastExport} jour${
                  status.daysSinceLastExport > 1 ? 's' : ''
                }. Téléchargez une nouvelle copie de sécurité.`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
        <button
          type="button"
          disabled={isExporting}
          onClick={() => void handleQuickExport()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold transition-colors cursor-pointer shadow-2xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? 'Export...' : 'Exporter .json complet'}</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentView('backup')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100/70 text-blue-800 border border-blue-200 font-medium transition-colors cursor-pointer"
        >
          <span>Options</span>
        </button>
        <button
          type="button"
          onClick={() => backupService.snoozeManualExportReminder(24)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors font-medium cursor-pointer"
          title="Rappeler demain (dans 24h)"
        >
          <Clock className="w-3 h-3" />
          <span>Demain</span>
        </button>
      </div>
    </div>
  );
}
