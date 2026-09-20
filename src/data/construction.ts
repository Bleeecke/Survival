import type { BuildMaterial } from './buildDefinitions';
export const BUILD_WIDTHS: Record<string, number> = { palm_shelter: 2, wooden_shelter: 3, log_cabin: 4 };
export const buildWidth = (type: string) => BUILD_WIDTHS[type] ?? 1;
export const MOVABLE_BUILDS = new Set(['sleeping_spot', 'arbeitsplatz', 'campfire', 'storage_box']);
export const UPGRADES: Record<string, { target: string; materials: BuildMaterial[]; work: number }> = {
  sleeping_spot: { target: 'palm_shelter', materials: [{ item: 'sticks', amount: 8 }, { item: 'palm_leaf', amount: 6 }, { item: 'vine', amount: 3 }], work: 40 },
  palm_shelter: { target: 'wooden_shelter', materials: [{ item: 'wood', amount: 18 }, { item: 'stone', amount: 5 }], work: 100 },
  wooden_shelter: { target: 'log_cabin', materials: [{ item: 'wood', amount: 20 }, { item: 'stone', amount: 15 }, { item: 'plank', amount: 10 }], work: 180 },
};
