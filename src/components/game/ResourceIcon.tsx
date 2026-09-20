const ART_ICONS = new Set(['flint', 'pebbles', 'sticks', 'fiber', 'coconut', 'herbs']);

/** Decorative: the adjacent item/recipe name supplies the accessible label. */
export default function ResourceIcon({ id, fallback = '📦' }: { id: string; fallback?: string }) {
  return ART_ICONS.has(id)
    ? <img src={`${import.meta.env.BASE_URL}art/${id}.svg`} alt="" aria-hidden="true" width={24} height={24} className="inline-block h-6 w-6 shrink-0 align-middle" draggable={false} />
    : <span aria-hidden="true">{fallback}</span>;
}
