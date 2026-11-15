import { fb } from '../hooks/useFirebaseData';

export const DEFAULT_ROOTSTOCKS: Array<{ id: string; value: string }> = [
  { id: 'rs_franc', value: '🌱 Franc (semis)' },
  { id: 'rs_non_greffe', value: '🌱 Non greffé / Franc de pied' },
  { id: 'rs_m9', value: '🌱 M9 (Pommier - faible vigueur)' },
  { id: 'rs_m26', value: '🌱 M26 (Pommier - vigueur modérée)' },
  { id: 'rs_mm106', value: '🌱 MM106 (Pommier - demi-tige)' },
  { id: 'rs_mm111', value: '🌱 MM111 (Pommier - haute-tige)' },
  { id: 'rs_ba29', value: '🌱 Cognassier de Provence BA29 (Poirier)' },
  { id: 'rs_sydo', value: "🌱 Cognassier d'Angers Sydo (Poirier)" },
  { id: 'rs_st_julien', value: '🌱 Saint-Julien A (Prunier / Pêcher)' },
  { id: 'rs_myrobolan', value: '🌱 Myrobolan (Prunier / Abricotier)' },
  { id: 'rs_gisela5', value: '🌱 Gisela 5 (Cerisier - nain)' },
  { id: 'rs_maxma14', value: '🌱 MaxMa 14 (Cerisier - demi-tige)' },
  { id: 'rs_mahaleb', value: '🌱 Sainte-Lucie / Mahaleb (Cerisier)' },
  { id: 'rs_gf677', value: '🌱 GF 677 (Pêcher / Amandier)' },
  { id: 'rs_montclar', value: '🌱 Montclar (Pêcher)' },
];

let isSeedingRootstocks = false;

export async function ensureRootstocksInitialized(config: any[] | undefined | null): Promise<void> {
  if (!config || config.length === 0 || isSeedingRootstocks) return;
  const isInitialized = config.some((c: any) => c.id === 'rootstocks_initialized');
  const existingRootstocks = config.filter((c: any) => c.type === 'rootstock');

  if (!isInitialized && existingRootstocks.length === 0) {
    isSeedingRootstocks = true;
    try {
      await fb.put('config', {
        id: 'rootstocks_initialized',
        type: 'setting',
        value: 'true',
      });
      for (const def of DEFAULT_ROOTSTOCKS) {
        await fb.put('config', {
          id: def.id,
          type: 'rootstock',
          value: def.value,
          attributes: { emoji: '🌱' },
        });
      }
    } catch (err) {
      console.error('Failed to seed default rootstocks:', err);
    } finally {
      isSeedingRootstocks = false;
    }
  }
}
