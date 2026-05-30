import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';


const GIVE_ITEMS: { id: string; label: string; icon: string }[] = [
  { id: 'coconut',       label: 'Kokosnuss',     icon: '🥥' },
  { id: 'coconut_shell', label: 'Kokosschale',   icon: '🥥' },
  { id: 'palm_leaf',     label: 'Palmenblatt',   icon: '🌿' },
  { id: 'sticks',        label: 'Äste',          icon: '🪵' },
  { id: 'wood',          label: 'Holz',          icon: '🪵' },
  { id: 'stone',         label: 'Stein',         icon: '🪨' },
  { id: 'flint',         label: 'Feuerstein',    icon: '🔩' },
  { id: 'pebbles',       label: 'Kieselsteine',  icon: '⚪' },
  { id: 'fiber',         label: 'Fasern',        icon: '🧵' },
  { id: 'rope',          label: 'Seil',          icon: '🪢' },
  { id: 'stone_axe',     label: 'Steinaxt',      icon: '🪓' },
  { id: 'flint_knife',   label: 'Messer',        icon: '🔪' },
  { id: 'stone_spear',   label: 'Speer',         icon: '🗡️' },
  { id: 'water',         label: 'Wasser',        icon: '💧' },
  { id: 'food',          label: 'Beeren',        icon: '🫐' },
  { id: 'exotic_fruit',  label: 'Exotische Frucht', icon: '🍈' },
  { id: 'herbs',         label: 'Kräuter',       icon: '🌱' },
  { id: 'plank',         label: 'Holzbretter',   icon: '🪵' },
  { id: 'shells',        label: 'Muscheln',      icon: '🐚' },
];

export default function DevPanel() {
  const [open, setOpen] = useState(false);
  const freeCraft       = useGameStore(s => s.freeCraft);
  const devRain         = useGameStore(s => s.devRain);
  const toggleFreeCraft = useGameStore(s => s.toggleFreeCraft);
  const toggleDevRain   = useGameStore(s => s.toggleDevRain);

  function fillStats() {
    usePlayerStore.getState().updateStats({
      health: 100, hunger: 0, thirst: 0, stamina: 100, fatigue: 0,
    });
  }


  function skipDay() {
    useGameStore.getState().tickTime(600_000); // 10 min real = 1 game day
  }

  function skip6Hours() {
    // 6h = 1500 ticks. Apply stat drain manually then advance game time.
    const stats = usePlayerStore.getState().player.stats;
    const TICKS = 1500;
    const hunger  = stats.hunger  ?? 0;
    const thirst  = stats.thirst  ?? 0;
    const fatigue = stats.fatigue ?? 0;
    const hungerGain  = hunger < 65
      ? Math.min(100, hunger  + TICKS * (65 / 12000))
      : Math.min(100, hunger  + TICKS * (35 / 3000));
    const thirstGain  = Math.min(100, thirst  + TICKS * (100 / 9000));
    const fatigueGain = Math.min(100, fatigue + TICKS * (100 / 6000));
    usePlayerStore.getState().updateStats({
      hunger:  hungerGain,
      thirst:  thirstGain,
      fatigue: fatigueGain,
    });
    useGameStore.getState().tickTime(150_000); // 2.5 min real = 6 game hours
  }

  function giveItem(id: string) {
    usePlayerStore.getState().addToInventory(id, 5);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-3 right-3 z-[9999] px-2 py-1 bg-purple-900/80 hover:bg-purple-800 text-purple-300 text-xs font-bold rounded-lg border border-purple-700 pointer-events-auto"
      >
        🛠 DEV
      </button>
    );
  }

  return (
    <div className="absolute top-3 right-3 z-[9999] w-64 bg-slate-900/95 border border-purple-700 rounded-xl shadow-2xl pointer-events-auto text-xs">
      <div className="flex items-center justify-between px-3 py-2 border-b border-purple-800">
        <span className="text-purple-300 font-bold">🛠 Dev Modus</span>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">✕</button>
      </div>

      <div className="p-3 space-y-2">
        {/* Actions */}
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={fillStats}
            className="py-1.5 bg-green-800 hover:bg-green-700 text-green-200 rounded-lg font-semibold">
            ❤️ Stats voll
          </button>
          <button onClick={toggleDevRain}
            className={`py-1.5 rounded-lg font-semibold transition-colors ${
              devRain ? 'bg-sky-600 text-white' : 'bg-sky-900 hover:bg-sky-800 text-sky-300'
            }`}>
            🌧️ Regen {devRain ? 'AN' : 'AUS'}
          </button>
          <button onClick={skip6Hours}
            className="py-1.5 bg-amber-700 hover:bg-amber-600 text-amber-200 rounded-lg font-semibold">
            ⏩ +6 Stunden
          </button>
          <button onClick={skipDay}
            className="py-1.5 bg-amber-800 hover:bg-amber-700 text-amber-200 rounded-lg font-semibold">
            ⏩ Tag +1
          </button>
          <button
            onClick={toggleFreeCraft}
            className={`py-1.5 rounded-lg font-semibold transition-colors ${
              freeCraft ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            🆓 Gratis Craft
          </button>
        </div>

        {/* Give items */}
        <div className="border-t border-slate-700 pt-2">
          <div className="text-slate-400 mb-1.5 font-semibold">Items geben (×5)</div>
          <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
            {GIVE_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => giveItem(item.id)}
                className="py-1 px-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-left truncate"
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
