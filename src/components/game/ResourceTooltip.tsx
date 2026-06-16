import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { RECIPES } from '../../data/recipes';

// ── Static data ───────────────────────────────────────────────────────────────

const ITEM_NAMES: Record<string, string> = {
  wood: 'Holz', stone: 'Stein', food: 'Beeren', sticks: 'Äste',
  pebbles: 'Kieselsteine', flint: 'Feuerstein', driftwood: 'Treibholz',
  shells: 'Muscheln', palm_leaf: 'Palmenblatt', herbs: 'Kräuter',
  fiber: 'Fasern', mushroom: 'Pilze', exotic_fruit: 'Exotische Frucht',
  vine: 'Lianen', iron_ore: 'Eisenerz', spring: 'Quelle', puddle: 'Pfütze', palm_tree: 'Palme',
  rope: 'Seil', plank: 'Holzbrett', iron_bar: 'Eisenbarren', fish: 'Fisch',
  flint_knife: 'Feuersteinmesser', stone_axe: 'Steinaxt',
  stone_pickaxe: 'Steinspitzhacke', stone_spear: 'Steinspeer',
  improved_axe: 'Verbesserte Axt', improved_pickaxe: 'Verbesserte Spitzhacke',
  iron_axe: 'Eisenaxt', iron_pickaxe: 'Eisenspitzhacke',
  fishing_rod: 'Angelrute', torch: 'Fackel',
  water_container: 'Wassercontainer', cooked_food: 'Gekochtes Essen',
  cooked_fish_meal: 'Gebratener Fisch', herbal_remedy: 'Kräutermittel',
  cooked_mushroom: 'Geb. Pilze',
  // Bäume & Pflanzen
  resin_tree: 'Harzbaum', large_tree: 'Großer Baum', banyan_tree: 'Banyanbaum',
  bamboo: 'Bambus', rubber_tree: 'Kautschukbaum', cacao_tree: 'Kakaobaum',
  pandanus: 'Pandanus', breadfruit_tree: 'Brotfruchtbaum', berry_bush: 'Beerenstrauch',
  fern: 'Farn',
  // Rohstoffe
  tree_resin: 'Baumharz', coconut: 'Kokosnuss', coconut_shell: 'Kokosschale',
  coconut_water: 'Kokoswasser', dew_water: 'Tauwasser',
  obsidian: 'Obsidian', granite: 'Granit',
  // Tierprod.
  turtle_meat: 'Schildkrötenfleisch', turtle_shell: 'Schildkrötenpanzer',
  cooked_turtle: 'Gek. Schildkröte', crab_meat: 'Krabbenfleisch',
  cooked_crab: 'Gek. Krabbe', boar_meat: 'Wildschweinfleisch',
  boar_hide: 'Wildschweinfell', cooked_boar: 'Gek. Wildschwein',
  bone: 'Knochen', hide: 'Tierhaut', fat: 'Tierfett',
  // Verarbeitetes
  sharp_flint: 'Gespl. Feuerstein', hardened_stick: 'Gehärteter Ast',
  bandage: 'Verband', fever_tea: 'Fiebertee', antiparasitic: 'Parasitenmedizin',
  smoked_meat: 'Geräuchertes Fleisch', dried_fish: 'Getrockneter Fisch',
  dried_fruit: 'Getrocknete Frucht',
};

const ITEM_ICON: Record<string, string> = {
  wood: '🪵', stone: '🪨', food: '🫐', sticks: '🌿', pebbles: '⚪',
  flint: '🔶', driftwood: '🪵', shells: '🐚', palm_leaf: '🌴',
  herbs: '🌿', fiber: '🌾', mushroom: '🍄', exotic_fruit: '🍊',
  vine: '🌿', iron_ore: '🟤', spring: '💧', puddle: '💧', palm_tree: '🌴',
  fish: '🐟', obsidian: '⬛', granite: '🪨', bamboo: '🎋',
  resin_tree: '🌳', large_tree: '🌲', banyan_tree: '🌳', rubber_tree: '🌳',
  cacao_tree: '🌿', pandanus: '🌴', breadfruit_tree: '🌳', berry_bush: '🫐',
  fern: '🌿', tree_resin: '🫙', coconut: '🥥', coconut_shell: '🥥',
  coconut_water: '💧', dew_water: '💧',
  turtle_meat: '🥩', turtle_shell: '🐢', cooked_turtle: '🍖',
  crab_meat: '🦀', cooked_crab: '🍖', boar_meat: '🥩',
  boar_hide: '🟫', cooked_boar: '🍖', bone: '🦴', hide: '🟫', fat: '🫙',
  sharp_flint: '🔷', hardened_stick: '🪵', bandage: '🩹',
  fever_tea: '🍵', antiparasitic: '💊',
  smoked_meat: '🍖', dried_fish: '🐟', dried_fruit: '🍊',
};

const RESOURCE_DESC: Record<string, string> = {
  wood:         'Baumholz – Grundmaterial für Bauten und Werkzeuge. Benötigt eine Axt.',
  stone:        'Stein aus dem Steinbruch – für Werkzeuge und Bauten. Benötigt Spitzhacke.',
  food:         'Wilde Beeren – stillt etwas Hunger, roh essbar.',
  sticks:       'Gefallene Äste – liegen unter Bäumen im Wald.',
  pebbles:      'Kleine Kieselsteine – am Strand zu finden.',
  flint:        'Scharfkantiger Feuerstein – erstes Werkzeugmaterial.',
  driftwood:    'Angeschwemmtes Holz – frühes Baumaterial, keine Axt nötig.',
  shells:       'Muscheln – als Behälter für den Wassercontainer.',
  palm_leaf:    'Palmenblatt – von Palmen ablesen. Mit Messer auch Fasern.',
  herbs:        'Heilkräuter – roh nutzbar oder als Kräutermittel verarbeiten.',
  fiber:        'Pflanzenfasern – für Seile. Messer empfohlen.',
  mushroom:     'Pilze – roh essbar, aber besser gekocht.',
  exotic_fruit: 'Exotische Früchte aus dem Dschungel – sehr nahrhaft.',
  vine:         'Lianen – zähe Pflanzenstränge für Seile. Messer nötig.',
  iron_ore:     'Eisenerz aus dem Gebirge – für Metallwerkzeuge. Spitzhacke nötig.',
  spring:          'Natürliche Wasserquelle – sprudelt unerschöpflich.',
  puddle:          'Regenpfütze – nur 3 Schlucke Wasser. Wird sofort getrunken, nicht gesammelt.',
  palm_tree:       'Palme – gibt Palmenblätter beim Ablesen. Mit Messer auch Fasern.',
  fish:            'Fisch aus dem Meer – rohes Protein. Angel oder Speer zum Fangen nötig.',
  resin_tree:      'Knorriger Baum mit harzreicher Rinde. Kerbe einritzen, Harz mit Kokosschale auffangen. Regeneriert nach einiger Zeit.',
  large_tree:      'Mächtiger Urwaldbaum – liefert viel Holz. Nur mit Axt fällbar.',
  banyan_tree:     'Banyanbaum mit Luftwurzeln – sehr hartes Holz, ergiebig. Benötigt Axt.',
  bamboo:          'Schnell wachsendes Bambusrohr – vielseitiges Baumaterial.',
  rubber_tree:     'Kautschukbaum – aus dem Saft lässt sich Kautschuk gewinnen.',
  cacao_tree:      'Kakaobaum – die Früchte enthalten Kakaobohnen.',
  pandanus:        'Schraubenpalme mit langen, rasiermesserscharfen Blättern. Früchte essbar.',
  breadfruit_tree: 'Brotfruchtbaum – die stärkereichen Früchte sättigen gut.',
  berry_bush:      'Beerenstrauch – trägt wilde Beeren. Regelmäßig ernten.',
  fern:            'Großer Farn – Blätter sammeln Tau. Bei Regen auffangen möglich.',
  tree_resin:      'Bernsteinfarbenes Baumharz – Klebstoff, Dichtmasse und Brennstoff.',
  coconut:         'Kokosnuss – enthält Kokoswasser und Fruchtfleisch.',
  coconut_shell:   'Halbe Kokosschale – als Auffangbehälter für Harzbäume unverzichtbar.',
  obsidian:        'Vulkanisches Glas – extrem scharf, schwer abzubauen. Spitzhacke nötig.',
  granite:         'Hartes Granitgestein – langlebiges Baumaterial. Spitzhacke nötig.',
  bone:            'Tierknochen – Material für Werkzeuge und Nadeln.',
  hide:            'Rohe Tierhaut – zum Gerben und Herstellen von Lederausrüstung.',
  fat:             'Tierfett – für Fackeln, Lampen und als Konservierungsmittel.',
};

const GATHER_INFO: Record<string, { tool?: string; yield?: string }> = {
  wood:     { tool: '🪓 Axt erforderlich',        yield: 'Axt: ×2 | Verbessert: ×4 | Eisen: ×5' },
  stone:    { tool: '⛏️ Spitzhacke erforderlich',  yield: 'Spitzhacke: ×2 | Verbessert: ×4 | Eisen: ×5' },
  iron_ore: { tool: '⛏️ Spitzhacke erforderlich',  yield: '×1 (Eisen-Pick: ×2)' },
  sticks:   { yield: 'Messer: ×2 | Axt: ×3' },
  pebbles:  { yield: 'Bare Hands: ×2 | Spitzhacke: ×3' },
  fiber:    { tool: '🔪 Messer empfohlen',         yield: 'Ohne: ×1 | Messer: ×3 | Axt: ×4' },
  vine:     { tool: '🔪 Messer empfohlen',         yield: 'Ohne: ×1 | Messer: ×2' },
  herbs:    { yield: 'Messer: ×2' },
  palm_tree:       { tool: '🔪 Messer für Fasern',           yield: 'Ohne: ×1 Blatt | Messer: ×2 Blatt +1 Faser' },
  fish:            { tool: '🎣 Angel oder 🏹 Speer',         yield: 'Speer: 40% Chance | Angel: sicher' },
  resin_tree:      { tool: '🪓 Axt + 🥥 Kokosschale',        yield: '×1–5 Baumharz je nach Vorkommen' },
  large_tree:      { tool: '🪓 Axt erforderlich',            yield: '×8–12 Holz' },
  banyan_tree:     { tool: '🪓 Axt erforderlich',            yield: '×10–15 Holz' },
  bamboo:          { tool: '🔪 Messer empfohlen',            yield: 'Messer: ×3 | Ohne: ×1' },
  breadfruit_tree: { tool: '🔪 Messer empfohlen',            yield: 'Messer: schneller & mehr' },
  obsidian:        { tool: '⛏️ Spitzhacke erforderlich',     yield: '×1–2 Obsidian' },
  granite:         { tool: '⛏️ Spitzhacke erforderlich',     yield: '×2–4 Granit' },
};

// Circumference of progress circle (r=8)
const CIRC = 2 * Math.PI * 8;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResourceTooltip() {
  const hoveredResource  = useGameStore(s => s.hoveredResource);
  const setCraftingOpen  = useGameStore(s => s.setCraftingOpen);

  const [mousePos, setMousePos]       = useState({ x: 0, y: 0 });
  const [frozenPos, setFrozenPos]     = useState<{ x: number; y: number } | null>(null);
  const [expanded, setExpanded]       = useState(false);
  const [pinned, setPinned]           = useState(false);
  const [pinnedResource, setPinnedResource] = useState(hoveredResource);
  const [animKey, setAnimKey]         = useState(0);
  const mousePosRef = useRef({ x: 0, y: 0 });

  const expandTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unpinTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track mouse — always update ref, only update state when not frozen
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // When hovered resource changes
  useEffect(() => {
    if (expandTimer.current) clearTimeout(expandTimer.current);
    if (hoveredResource) {
      // New resource hovered — reset expansion, restart animation, unfreeze position
      setExpanded(false);
      setFrozenPos(null);
      setPinned(false);
      setPinnedResource(hoveredResource);
      setAnimKey(k => k + 1);
      expandTimer.current = setTimeout(() => {
        setExpanded(true);
        // Freeze position at current mouse location
        setFrozenPos({ x: mousePosRef.current.x, y: mousePosRef.current.y });
      }, 2000);
    } else {
      // Mouse left the tile — give a small grace period for mouse to reach tooltip
      unpinTimer.current = setTimeout(() => {
        if (!pinned) {
          setExpanded(false);
          setPinnedResource(null);
        }
      }, 120);
    }
    return () => {
      if (expandTimer.current) clearTimeout(expandTimer.current);
    };
  }, [hoveredResource?.id]);

  const visible = !!hoveredResource || pinned;
  if (!visible || !pinnedResource) return null;

  const type = pinnedResource.type;
  const name = ITEM_NAMES[type] ?? type;
  const icon = ITEM_ICON[type] ?? '📦';
  const info = GATHER_INFO[type];

  const producedBy = RECIPES.filter(r => r.outputs.some(o => o.resourceId === type));
  const usedIn     = RECIPES.filter(r => r.inputs.some(i => i.resourceId === type));

  // Frozen when expanded, follows mouse otherwise
  const pos = frozenPos ?? mousePos;
  const tx = Math.min(pos.x + 16, window.innerWidth  - 272);
  const ty = Math.min(pos.y + 16, window.innerHeight - 420);

  return (
    <div
      className="fixed z-50"
      style={{
        left: tx,
        top: ty,
        pointerEvents: expanded ? 'auto' : 'none',
      }}
      onMouseEnter={() => {
        if (unpinTimer.current) clearTimeout(unpinTimer.current);
        setPinned(true);
      }}
      onMouseLeave={() => {
        setPinned(false);
        setExpanded(false);
        setFrozenPos(null);
        setPinnedResource(null);
      }}
    >
      <div className="bg-slate-900/97 border border-slate-600 rounded-xl shadow-2xl w-64 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="text-xl w-7 text-center">{icon}</span>
          <div className="flex-1">
            <div className="text-white text-sm font-bold">{name}</div>
            <div className="text-slate-400 text-xs">
              ×{Math.min(pinnedResource.quantity, 99)} verfügbar
            </div>
          </div>

          {/* SVG progress ring */}
          {!expanded && (
            <svg
              key={animKey}
              width="22" height="22"
              viewBox="0 0 22 22"
              style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
            >
              {/* Track */}
              <circle cx="11" cy="11" r="8" fill="none" stroke="#334155" strokeWidth="2.5" />
              {/* Progress — CSS animation via style tag */}
              <circle
                cx="11" cy="11" r="8"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC}
                style={{ animation: 'tooltipRing 2s linear forwards' }}
              />
            </svg>
          )}
          {expanded && (
            <span className="text-green-400 text-sm">✓</span>
          )}
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t border-slate-700 px-3 py-2.5 space-y-2.5">

            {/* Description */}
            {RESOURCE_DESC[type] && (
              <p className="text-slate-300 text-xs leading-relaxed">{RESOURCE_DESC[type]}</p>
            )}

            {/* Gather info */}
            {info && (
              <div className="space-y-0.5">
                {info.tool && (
                  <div className="text-orange-400 text-xs font-medium">{info.tool}</div>
                )}
                {info.yield && (
                  <div className="text-slate-400 text-xs">{info.yield}</div>
                )}
              </div>
            )}

            {/* Produced by */}
            {producedBy.length > 0 && (
              <div>
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Hergestellt durch
                </div>
                <div className="space-y-1">
                  {producedBy.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setCraftingOpen(true)}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800 hover:bg-emerald-900/60 transition-colors text-left"
                    >
                      <span className="text-base">{r.icon}</span>
                      <span className="text-emerald-400 text-xs flex-1">{r.name}</span>
                      <span className="text-slate-600 text-xs">→</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Used in */}
            {usedIn.length > 0 && (
              <div>
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Verwendet in
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {usedIn.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setCraftingOpen(true)}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800 hover:bg-sky-900/60 transition-colors text-left"
                    >
                      <span className="text-base">{r.icon}</span>
                      <span className="text-sky-400 text-xs flex-1">{r.name}</span>
                      <span className="text-slate-600 text-xs">→</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inject CSS animation once */}
      <style>{`
        @keyframes tooltipRing {
          from { stroke-dashoffset: ${CIRC}; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
