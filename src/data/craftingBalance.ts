import type { ItemQuality } from '../types/player';

export const QUALITY_LABELS: Record<ItemQuality, string> = {
  rough: 'Behelfsmäßig', standard: 'Solide', good: 'Gut',
};
export const QUALITY_DURABILITY: Record<ItemQuality, number> = {
  rough: 0.5, standard: 1, good: 1.4,
};

export function craftTimeMultiplier(level: number): number {
  return 1 - Math.min(0.45, Math.max(0, level - 1) * 0.05);
}

export function outcomeChances(level: number, failures = 0) {
  const base = level <= 2 ? [0.2, 0.55, 0.23, 0.02]
    : level <= 5 ? [0.08, 0.27, 0.55, 0.1]
    : level <= 8 ? [0.02, 0.08, 0.6, 0.3] : [0, 0.02, 0.48, 0.5];
  const failure = Math.max(0, base[0] - failures * 0.1);
  return { failure, rough: base[1] + base[0] - failure, standard: base[2], good: base[3] };
}

export function rollCraftQuality(level: number, failures: number, roll: number): ItemQuality | 'failed' {
  const p = outcomeChances(level, failures);
  if (roll < p.failure) return 'failed';
  if (roll < p.failure + p.rough) return 'rough';
  if (roll < p.failure + p.rough + p.standard) return 'standard';
  return 'good';
}
