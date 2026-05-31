import { DAY_DURATION_MS } from '../data/worldConfig';

export type WeatherType = 'normal' | 'warm' | 'hot' | 'cool' | 'rainy';

export const WEATHER_META: Record<WeatherType, { label: string; icon: string; color: string }> = {
  normal: { label: 'Angenehm',   icon: '⛅',  color: 'text-slate-300'  },
  warm:   { label: 'Warm',       icon: '☀️',   color: 'text-yellow-400' },
  hot:    { label: 'Hitzewelle', icon: '🌡️',  color: 'text-red-400'    },
  cool:   { label: 'Kühl',       icon: '🌬️',  color: 'text-sky-400'    },
  rainy:  { label: 'Regnerisch', icon: '🌧️',  color: 'text-blue-400'   },
};

const BASE_TEMP: Record<WeatherType, number> = {
  normal: 50, warm: 63, hot: 77, cool: 35, rainy: 38,
};

export function getDayWeatherType(seed: number, day: number): WeatherType {
  if (day < 2) return 'normal';
  const h = (seed * 7 + day * 1013) % 100;
  if (h < 30) return 'normal';
  if (h < 55) return 'warm';
  if (h < 68) return 'hot';
  if (h < 85) return 'cool';
  return 'rainy';
}

// Returns ambient temperature (0–100) based on game time, world seed, and rain
export function getAmbientTemp(elapsedMs: number, seed: number, isRaining: boolean): number {
  const day  = Math.floor(elapsedMs / DAY_DURATION_MS);
  const hour = (elapsedMs % DAY_DURATION_MS) / DAY_DURATION_MS * 24;
  const weather = getDayWeatherType(seed, day);
  const base = BASE_TEMP[weather];
  // Hottest at 14h (+17), coldest at 4h (≈−15), cosine curve
  const timeOffset = Math.cos((hour - 14) / 24 * 2 * Math.PI) * 17;
  let ambient = base + timeOffset;
  if (isRaining) ambient -= 8;
  return Math.max(0, Math.min(100, ambient));
}
