# Checkliste: Neues Spiel aus diesem Template

Gehe diese Liste von oben nach unten durch.
Alles andere (Menü, Phaser Loop, Stores, Musik) läuft ohne Änderungen.

---

## 1. Projektname & localStorage Keys

**Dateien:**
- `src/store/gameStore.ts` → `name: 'survival-game-save'` → umbenennen
- `src/store/playerStore.ts` → `name: 'survival-player-save'`
- `src/store/worldStore.ts` → `name: 'survival-world-save'`
- `src/store/tutorialStore.ts` → `name: 'survival-tutorial-save'`
- `src/components/pages/DeathScreen.tsx` → `localStorage.getItem('survival-scores')`

Alles auf neuen Projektnamen ändern damit alte Saves nicht kollidieren.

---

## 2. Welt-Konfiguration

**Datei:** `src/data/worldConfig.ts`

```ts
export const WORLD_CONFIG = {
  width: 150,          // Tiles horizontal
  height: 150,         // Tiles vertikal
  tileSize: 32,        // Pixel pro Tile
  resources: { ... }   // Ressourcen-Frequenz & Spawn-Biome
}
```

Weltgröße, Tile-Größe und welche Ressourcen wo spawnen anpassen.

---

## 3. Biome & Tiles

**Datei:** `src/services/phaser/WorldGenerator.ts`

- Noise-Schwellwerte für Biome: Methode `determineTileType(elevation, moisture)`
- Biome-Namen und Farben: Methode `tileColor(type)` in `GameManager.ts`
- Neue Biome hinzufügen: in beiden Dateien ergänzen

---

## 4. Ressourcen

**Datei:** `src/data/resources.ts`

Jede Ressource hat:
```ts
{
  id, name, spriteIndex,
  gatherTime,    // ms bis gesammelt
  maxStack,      // max im Inventar
  regenerates,   // nachwachsend?
  regenerationTime  // ms bis voll
}
```

`spriteIndex` ist nur für ältere Sprite-Sheet-Systeme — bei Graphics-Rendering ignorieren.

---

## 5. Ressourcen zeichnen

**Datei:** `src/services/phaser/GameManager.ts` → Methode `drawResource()`

Für jede neue Ressource einen `case` hinzufügen.
Phaser Graphics API: `fillStyle`, `fillRect`, `fillCircle`, `fillEllipse`, `lineBetween`

---

## 6. Ressourcen spawnen

**Datei:** `src/services/phaser/WorldGenerator.ts`

- Verteilt (zufällig): in `worldConfig.ts` unter `resources` eintragen
- Geclustert (Gruppen): in `generateClusters()` → `configs` Objekt ergänzen
- Speziallogik (z.B. immer 1 Stück): eigene private Methode wie `placeSpring()`

---

## 7. Ressourcen sammeln

**Datei:** `src/services/phaser/GameManager.ts` → Methode `executeGather()`

Drei Stellen anpassen:
1. `cost` switch → Stamina-Kosten und Zeit pro Ressource
2. Tool-Gates → `if (resource.type === 'X' && !hasTool)` Fehlertext
3. `giveType` → was der Spieler bekommt (Standard: resourceId, kann abweichen)

---

## 8. Rezepte (Crafting)

**Datei:** `src/data/recipes.ts`

```ts
{
  id: 'recipe_id',
  name: 'Anzeigename',
  description: '...',
  icon: '🔨',
  category: 'tool' | 'shelter' | 'food' | 'weapon' | 'utility' | 'resource',
  tier: 0 | 1 | 2 | 3,
  inputs: [{ resourceId: 'wood', quantity: 3 }],
  outputs: [{ resourceId: 'plank', quantity: 2 }],
  craftingTime: 3000,         // ms
  requiresTool: 'stone_axe',  // optional
}
```

Tier 0/1 = immer sichtbar. Tier 2+ = erst sichtbar wenn Input-Ressource im Inventar.

---

## 9. Gewichte

**Datei:** `src/data/weights.ts`

Jede neue Ressource und jeden neuen Gegenstand eintragen (kg pro Einheit).
Nicht eingetragene Items bekommen Fallback 0.5 kg.

---

## 10. Spieler-Stats

**Datei:** `src/services/phaser/GameManager.ts` → Methode `onGameTick()`

Läuft alle 100ms (game-time). Hier:
- Hunger/Durst/Müdigkeit erhöhen
- Ausdauer regenerieren
- Gesundheitsschaden bei kritischen Werten

Stats sind alle in `playerStore` unter `player.stats` (0–100 Skala).

---

## 11. Strukturen (baubare Objekte)

**Dateien:**
- `src/types/index.ts` → `Structure` Interface (type, x, y, extra Felder)
- `src/store/worldStore.ts` → `addStructure()`, `removeStructure()`
- `src/services/phaser/GameManager.ts` → `drawStructure()` + `interactStructure()`
- `src/services/game/CraftingSystem.ts` → Strukturen beim Craften platzieren

---

## 12. Musik

**Dateien:**
- `public/music/` → `menu.mp3`, `day.mp3`, `night.mp3` ersetzen
- `src/services/MusicManager.ts` → Dateinamen anpassen
- `src/hooks/useMusic.ts` → Wechsel-Logik anpassen (z.B. andere Trigger als Tag/Nacht)

---

## 13. UI-Texte & Sprache

Aktuell auf Deutsch. Suche nach deutschen Strings:
```
grep -r "Du hast\|Benötigt\|Überleben\|gestorben" src/
```

---

## 14. Tutorial

**Datei:** `src/store/tutorialStore.ts` + `src/components/pages/GameScreen.tsx`

Tutorial-Schritte in `tutorialStore.ts` definieren.
Step-Detection-Hooks in `GameScreen.tsx` → `useEffect` mit Store-Subscriptions.
Tutorial-Texte in `src/components/game/TutorialPanel.tsx`.

---

## 15. Day/Night Dauer

**Datei:** `src/services/phaser/GameManager.ts`

```ts
const DAY_DURATION_MS = 10 * 60 * 1000; // 10 real minutes = 1 game day
```

Und `src/hooks/useMusic.ts` → gleiche Konstante dort auch anpassen.
