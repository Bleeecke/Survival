import { useState } from 'react';
import {
  BUILD_DEFINITIONS, BUILD_CATEGORY_LABELS,
  type BuildDefinition, type BuildCategory,
} from '../../data/buildDefinitions';
import { KNOWLEDGE_LABELS } from '../../data/knowledge';
import { SKILL_LABELS, DEFAULT_SKILLS } from '../../types/skills';
import { usePlayerStore } from '../../store/playerStore';
import { useGameStore } from '../../store/gameStore';

// ── item name lookup ────────────────────────────────────────────────
const ITEM_NAMES: Record<string, string> = {
  sticks: 'Äste', pebbles: 'Bruchstein', wood: 'Holz', stone: 'Stein',
  rope: 'Seil', plank: 'Holzbretter', vine: 'Lianen', palm_leaf: 'Palmblatt',
  fiber: 'Fasern', coconut_shell: 'Kokosschale', coconut: 'Kokosnuss',
  tree_resin: 'Baumharz', granite: 'Granit', iron_ore: 'Eisenerz',
  fish: 'Fisch', boar_meat: 'Wildschweinfleisch',
  exotic_fruit: 'Exotische Frucht', herbs: 'Kräuter',
  stone_axe: 'Steinaxt', stone_pickaxe: 'Steinspitzhacke',
};

const TOOL_LABELS: Record<string, string> = {
  stone_axe: 'Steinaxt', stone_pickaxe: 'Steinspitzhacke', any_axe: 'Eine Axt',
};

const CATEGORY_ORDER: BuildCategory[] = [
  'survival', 'fire', 'shelter', 'storage', 'water', 'food', 'workstation', 'hunting', 'medicine',
];

// ── visibility helper (no hooks) ─────────────────────────────────────
function getVisibility(
  def: BuildDefinition,
  knownMaterials: string[],
  knowledge: Record<string, boolean>,
  skills: ReturnType<typeof usePlayerStore.getState>['player']['skills'],
  freeCraft: boolean,
): 'hidden' | 'locked' | 'available' {
  if (freeCraft) return 'available';
  if (def.visibleWhenSeen.length > 0 && !def.visibleWhenSeen.some(m => knownMaterials.includes(m))) return 'hidden';
  const missingK = def.requiredKnowledge.some(f => !knowledge[f]);
  const missingS = def.requiredSkills.some(r => (skills?.[r.skill]?.level ?? 1) < r.level);
  return missingK || missingS ? 'locked' : 'available';
}

// ── Main component ───────────────────────────────────────────────────

export default function BuildBar() {
  const [openCategory, setOpenCategory] = useState<BuildCategory | null>(null);

  const inventory      = usePlayerStore(s => s.player.inventory);
  const knownMaterials = usePlayerStore(s => s.knownMaterials);
  const knowledge      = usePlayerStore(s => s.knowledge);
  const skills         = usePlayerStore(s => s.player.skills ?? DEFAULT_SKILLS);
  const freeCraft      = useGameStore(s => s.freeCraft);
  const enterPlacement = useGameStore(s => s.enterPlacementMode);

  const toggle = (cat: BuildCategory) =>
    setOpenCategory(prev => (prev === cat ? null : cat));

  // visible build items for a category (not hidden)
  const visibleFor = (cat: BuildCategory) =>
    BUILD_DEFINITIONS
      .filter(d => d.category === cat)
      .filter(d => getVisibility(d, knownMaterials, knowledge, skills, freeCraft) !== 'hidden');

  const openDefs = openCategory ? visibleFor(openCategory) : [];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none select-none">

      {/* ── Expanded panel (slides up above bar) ─────────────────── */}
      {openCategory && openDefs.length > 0 && (
        <div
          className="pointer-events-auto mx-2 mb-0 rounded-t-xl border border-b-0 border-slate-600 bg-slate-900/95 backdrop-blur-sm overflow-hidden"
          style={{ maxHeight: '42vh' }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
            <span className="text-white font-bold text-sm flex items-center gap-2">
              <span>{BUILD_CATEGORY_LABELS[openCategory].icon}</span>
              <span>{BUILD_CATEGORY_LABELS[openCategory].label}</span>
            </span>
            <button
              onClick={() => setOpenCategory(null)}
              className="text-slate-400 hover:text-white text-lg leading-none"
            >×</button>
          </div>

          {/* Build items scroll row */}
          <div className="flex gap-2 p-3 overflow-x-auto">
            {openDefs.map(def => (
              <BuildCard
                key={def.id}
                def={def}
                inventory={inventory}
                knowledge={knowledge}
                skills={skills}
                freeCraft={freeCraft}
                onSelect={() => {
                  enterPlacement(def.id);
                  setOpenCategory(null);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom category bar ──────────────────────────────────── */}
      <div className="pointer-events-auto flex items-end bg-slate-900/90 backdrop-blur-sm border-t border-slate-700 px-2 py-1 gap-1">
        {CATEGORY_ORDER.map(cat => {
          const items = visibleFor(cat);
          if (items.length === 0) return null;

          const { icon, label } = BUILD_CATEGORY_LABELS[cat];
          const isOpen = openCategory === cat;
          const buildableCount = items.filter(d =>
            getVisibility(d, knownMaterials, knowledge, skills, freeCraft) === 'available'
          ).length;

          return (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              className={`flex flex-col items-center px-3 py-1.5 rounded-t-lg transition-colors min-w-[56px] relative ${
                isOpen
                  ? 'bg-slate-700 text-white border border-b-0 border-slate-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-transparent'
              }`}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-[10px] mt-0.5 font-semibold leading-tight whitespace-nowrap">{label}</span>
              {buildableCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-green-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {buildableCount}
                </span>
              )}
            </button>
          );
        })}

        {/* Spacer so bar doesn't feel cramped */}
        <div className="flex-1" />
        <span className="text-slate-600 text-[10px] pr-1 self-center">Klick → Platzieren</span>
      </div>
    </div>
  );
}

// ── BuildCard (compact horizontal card in the expanded panel) ────────

function BuildCard({ def, inventory, knowledge, skills, freeCraft, onSelect }: {
  def: BuildDefinition;
  inventory: ReturnType<typeof usePlayerStore.getState>['player']['inventory'];
  knowledge: Record<string, boolean>;
  skills: ReturnType<typeof usePlayerStore.getState>['player']['skills'];
  freeCraft: boolean;
  onSelect: () => void;
}) {
  const knownMaterials = usePlayerStore(s => s.knownMaterials);
  const vis = getVisibility(def, knownMaterials, knowledge, skills, freeCraft);
  const locked = vis === 'locked';

  const eq = usePlayerStore.getState().player.equipment;
  const hasTool = freeCraft || def.requiredTools.length === 0 || def.requiredTools.every(tool =>
    inventory.items.some(i => i.resourceId === tool) ||
    eq?.leftHand?.resourceId === tool ||
    eq?.rightHand?.resourceId === tool
  );

  const matStatus = def.requiredMaterials.map(m => ({
    ...m,
    have: inventory.items.find(i => i.resourceId === m.item)?.quantity ?? 0,
  }));
  const hasMats = freeCraft || matStatus.every(m => m.have >= m.amount);
  const canBuild = !locked && hasMats && hasTool;

  const missingKnowledge = locked ? def.requiredKnowledge.filter(f => !knowledge[f]) : [];
  const missingSkills    = locked ? def.requiredSkills.filter(r => (skills?.[r.skill]?.level ?? 1) < r.level) : [];

  return (
    <div
      className={`flex-shrink-0 w-44 rounded-xl border p-3 flex flex-col gap-2 transition-colors cursor-pointer ${
        locked    ? 'border-slate-700 bg-slate-800/60 opacity-70' :
        canBuild  ? 'border-green-700 bg-slate-800 hover:bg-slate-700' :
                    'border-slate-600 bg-slate-800/80 hover:bg-slate-750'
      }`}
      onClick={!locked ? onSelect : undefined}
      title={locked ? 'Voraussetzungen nicht erfüllt' : def.description}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">{def.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-xs leading-tight truncate">{def.name}</div>
          <div className="text-slate-500 text-[10px]">{def.buildTime}s Bauzeit</div>
        </div>
        {canBuild && <span className="text-green-400 text-xs">✓</span>}
        {locked    && <span className="text-slate-600 text-xs">🔒</span>}
      </div>

      {/* Locked reason */}
      {locked && (
        <div className="space-y-0.5">
          {missingKnowledge.map(f => (
            <div key={f} className="text-[10px] text-cyan-400/80 leading-tight">
              💡 {KNOWLEDGE_LABELS[f]}
            </div>
          ))}
          {missingSkills.map(r => (
            <div key={r.skill} className="text-[10px] text-purple-400/80 leading-tight">
              📚 {SKILL_LABELS[r.skill]} Stufe {r.level}
            </div>
          ))}
        </div>
      )}

      {/* Materials */}
      {!locked && (
        <div className="space-y-0.5">
          {matStatus.map(m => (
            <div key={m.item} className="flex justify-between text-[10px]">
              <span className="text-slate-400 truncate">{ITEM_NAMES[m.item] ?? m.item}</span>
              <span className={`font-mono font-bold ml-1 ${m.have >= m.amount ? 'text-green-400' : 'text-red-400'}`}>
                {m.have}/{m.amount}
              </span>
            </div>
          ))}
          {!hasTool && def.requiredTools.length > 0 && (
            <div className="text-[10px] text-orange-400">
              ⚠ {def.requiredTools.map(t => TOOL_LABELS[t] ?? t).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
