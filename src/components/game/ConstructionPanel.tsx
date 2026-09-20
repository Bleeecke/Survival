import { useState } from 'react';
import { useWorldStore } from '../../store/worldStore';
import { usePlayerStore } from '../../store/playerStore';
import { useGameStore } from '../../store/gameStore';
import { useCraftingStore } from '../../store/craftingStore';
import { getBuildDefinition } from '../../data/buildDefinitions';
import { MOVABLE_BUILDS, UPGRADES } from '../../data/construction';
import { abandonSite, knownBuild, planConstruction, siteWorkReason, supplySite, toggleReservation } from '../../services/game/ConstructionSystem';
import resources from '../../data/json/resources.json';
import { SKILL_LABELS } from '../../types/skills';

const names = Object.fromEntries(resources.map(r => [r.id, r.name]));
export default function ConstructionPanel() {
  const [open, setOpen] = useState(false);
  const world = useWorldStore(s => s.world);
  const x = usePlayerStore(s => s.player.x);
  const y = usePlayerStore(s => s.player.y);
  usePlayerStore(s => s.player.stats.stamina);
  usePlayerStore(s => s.player.skills);
  usePlayerStore(s => s.player.inventory);
  usePlayerStore(s => s.player.equipment);
  usePlayerStore(s => s.knowledge);
  const selected = useGameStore(s => s.constructionSelected);
  const job = useCraftingStore(s => s.job);
  const message = useCraftingStore(s => s.message);
  if (!world) return null;
  const sites = world.constructionSites ?? [];
  const site = sites.find(s => s.id === selected);
  const structure = world.structures.find(s => s.id === selected);
  const nearby = world.structures.filter(s => s.id === selected || (Math.abs(s.x - x) <= 4 && Math.abs(s.y - y) <= 4));
  const report = (reason: string | null, success: string) => useCraftingStore.setState({ message: reason ?? success });
  const upgrade = structure ? UPGRADES[structure.type] : undefined;
  const active = job?.building?.siteId === site?.id && !!site;
  const button = 'rounded bg-slate-700 px-2 py-1 text-left hover:bg-slate-600 disabled:opacity-40';
  return <aside className="absolute right-2 top-28 z-30 w-72 text-xs text-slate-100 pointer-events-auto">
    <button className={`${button} float-right`} onClick={() => { setOpen(!open); if (open || selected) useGameStore.setState({ constructionSelected: null }); }}>Bauen & Lager ({sites.length})</button>
    {(open || selected) && <div className="clear-both mt-8 max-h-[60vh] overflow-y-auto rounded-lg border border-slate-600 bg-slate-900/95 p-3 space-y-2">
      <div className="flex justify-between"><strong>Baustellen und Einrichtungen</strong><button aria-label="Baufenster schließen" onClick={() => { setOpen(false); useGameStore.setState({ constructionSelected: null }); }}>×</button></div>
      {!site && !structure && <p>Klicke im Spiel auf das Gebäude oder die Baustelle.</p>}
      {!site && !structure && <div className="flex flex-wrap gap-1">
        {[...sites.map(s => ({ id:s.id, name:getBuildDefinition(s.target)?.name })), ...nearby.map(s => ({ id:s.id, name:getBuildDefinition(s.type)?.name }))].map(s => <button key={s.id} className={button} onClick={() => useGameStore.setState({ constructionSelected:s.id })}>{s.name}</button>)}
      </div>}
      {site && <>
        <strong>{getBuildDefinition(site.target)?.name} · {site.mode === 'move' ? 'Versetzen' : site.mode === 'upgrade' ? 'Ausbau' : 'Neubau'}</strong>
        <p>{site.phase === 'pack' ? 'Am bisherigen Standort abbauen' : site.phase === 'carry' ? `Transportgut bei ${site.cargoX}, ${site.cargoY}; Ziel ${site.x}, ${site.y}` : 'Am Ziel aufbauen'} · {Math.floor(site.completed / site.work * 100)}%</p>
        <progress className="w-full" aria-label="Baufortschritt" value={site.completed} max={site.work} />
        {site.materials.map(m => <div key={m.item}>{names[m.item] ?? m.item}: {site.supplied ? m.amount : site.delivered?.[m.item] ?? 0}/{m.amount} angeliefert</div>)}
        {!site.supplied && <button className={button} onClick={() => report(supplySite(site.id), 'Material ist an der Baustelle gebunden.')}>Material übernehmen (Inventar / 3 Felder)</button>}
        <p className="text-amber-200">{active ? 'Aktive Arbeit' : siteWorkReason(site) ?? 'Bereit zum Arbeiten'}</p>
        <div className="flex flex-wrap gap-2">
          <button className={button} disabled={!!job && !active} onClick={() => active ? useCraftingStore.getState().cancel() : useCraftingStore.getState().resumeBuild(site.id)}>{active ? 'Unterbrechen / ablegen' : site.phase === 'carry' ? 'Tragen' : site.phase === 'pack' ? 'Abbauen' : 'Bauen'}</button>
          {!site.cargo && <button className={button} onClick={() => {
            if (!window.confirm(site.completed ? 'Baustelle aufgeben? Du erhältst die Hälfte des Baumaterials zurück.' : 'Bauplan aufgeben? Geliefertes Material wird vollständig zurückgegeben.')) return;
            if (active) useCraftingStore.getState().cancel();
            report(abandonSite(site.id), 'Baustelle aufgegeben. Material liegt am Bauplatz.');
          }}>Aufgeben</button>}
        </div>
      </>}
      {structure && <>
        <strong>{getBuildDefinition(structure.type)?.name ?? structure.type}</strong>
        {upgrade && knownBuild(upgrade.target) && <div className="group relative inline-block">
          <button className={button} aria-describedby="expansion-details" onClick={() => {
            const reason = planConstruction(upgrade.target, structure.x, structure.y, structure.id);
            report(reason, 'Ausbau geplant.');
            if (!reason) useGameStore.setState({ constructionSelected: useWorldStore.getState().world?.constructionSites?.at(-1)?.id ?? null });
          }}>Ausbauen</button>
          <div id="expansion-details" role="tooltip" className="hidden group-hover:block group-focus-within:block rounded border border-slate-500 bg-slate-800 p-2 mt-1 space-y-1">
            <strong>{getBuildDefinition(upgrade.target)?.name}</strong>
            <p>Benötigt: {upgrade.materials.map(m => String(m.amount)+' '+(names[m.item] ?? m.item)).join(', ')}</p>
            <p>{getBuildDefinition(upgrade.target)?.requiredTools.map(t => t === 'any_axe' ? 'Eine Axt' : names[t] ?? t).join(', ') || 'Kein Werkzeug erforderlich'}</p>
            <p>{getBuildDefinition(upgrade.target)?.requiredSkills.map(s => SKILL_LABELS[s.skill]+' Stufe '+s.level).join(', ')}</p>
          </div>
        </div>}
        {MOVABLE_BUILDS.has(structure.type) && <button className={button} onClick={() => { useGameStore.getState().enterPlacementMode(structure.type, structure.id); setOpen(false); useGameStore.setState({ constructionSelected: null }); }}>Versetzen: Ziel auswählen</button>}
        {structure.type === 'campfire' && (structure.fuel ?? 0) > 0 && <button className={button} onClick={() => {
          useWorldStore.getState().updateStructure(structure.id, { fuel: 0, coldFuel: (structure.coldFuel ?? 0) + (structure.fuel ?? 0), coolingUntil: useGameStore.getState().elapsedTime + 5000 });
          report(null, 'Feuer gelöscht. Fünf Sekunden abkühlen lassen; Restbrennstoff bleibt erhalten.');
        }}>Feuer löschen</button>}
        {structure.type === 'campfire' && (structure.coldFuel ?? 0) > 0 && <button className={button} onClick={() => useWorldStore.getState().updateStructure(structure.id, { fuel: (structure.fuel ?? 0) + structure.coldFuel!, coldFuel: 0 })}>Restbrennstoff wieder entzünden</button>}
      </>}
      {(site || structure) && <button className={button} onClick={() => report(toggleReservation((site ?? structure)!.id), 'Ausbaureservierung geändert.')}>{world.buildReservations?.some(r => r.ownerId === selected) ? 'Ausbaufläche freigeben' : 'Bekannte Ausbaufläche reservieren'}</button>}
      {message && <p role="status" className="text-amber-200">{message}</p>}
      <p className="text-slate-400">Bewegung unterbricht Bauarbeit. Beim Tragen gehst du selbst zum Ziel; Unterbrechen legt das Transportgut ab.</p>
    </div>}
  </aside>;
}
