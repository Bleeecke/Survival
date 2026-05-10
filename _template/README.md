# Phaser + React Game Template

Dieses Template basiert auf dem Survival Game Projekt.
Es enthält alle stabilen Kernsysteme die für ein neues 2D Top-Down Spiel wiederverwendet werden können.

---

## Stack

| Technologie | Zweck |
|---|---|
| React 18 | UI (Menü, HUD, Modals) |
| Phaser 3 | Game Engine (Render, Input, Physics) |
| Zustand | State Management (persistiert in localStorage) |
| Howler.js | Musik & Audio |
| Tailwind CSS | Styling |
| TypeScript | Typsicherheit |
| Vite | Build Tool |

---

## Ordnerstruktur

```
src/
├── components/
│   ├── game/          # In-Game UI (HUD, Inventar, Modals)
│   └── pages/         # Vollbild-Screens (MainMenu, GameScreen, DeathScreen, PauseMenu)
├── data/              # Spielinhalt (Ressourcen, Rezepte, Gewichte, World-Config)
├── hooks/             # React Hooks (useMusic)
├── services/
│   ├── phaser/        # GameManager, WorldGenerator
│   ├── game/          # CraftingSystem
│   └── MusicManager.ts
├── store/             # Zustand Stores
└── types/             # TypeScript Interfaces
```

---

## Kernsysteme & wo sie liegen

### 1. Phase-System (Spielzustand)
**Datei:** `src/store/gameStore.ts`

Kontrolliert welcher Screen angezeigt wird:
- `menu` → MainMenu
- `playing` → GameScreen (Phaser läuft)
- `paused` → GameScreen + PauseOverlay
- `dead` → DeathScreen
- `loading` → Ladescreen

Einstiegspunkt: `src/App.tsx` — switcht je nach Phase.

---

### 2. Phaser Game Engine
**Datei:** `src/services/phaser/GameManager.ts` (~1700 Zeilen)

Singleton-Klasse. Wird von `GameCanvas.tsx` gestartet und gestoppt.

Enthält:
- `onCreate()` — Szene initialisieren, Spieler/Kamera setup
- `onUpdate(delta)` — Game Loop (Bewegung, Kamera, Rendering)
- `onGameTick()` — Stat-Drain (Hunger, Ausdauer, Gesundheit) alle 100ms game-time
- `renderVisibleTiles()` — nur Tiles im Viewport zeichnen (Performance)
- `updateFog()` — Fog of War mit Row-Segment-Optimierung
- `getSightRadius()` — Tag/Nacht Sichtweite berechnen
- `executeGather()` — Ressourcen sammeln mit Tool-Checks
- `drawResource()` — alle Ressourcen-Sprites (Graphics API)
- `drawStructure()` — alle Struktur-Sprites

**Tag/Nacht:** Cosinus-Kurve über `DAY_DURATION_MS` (Standard: 10 Minuten real = 1 Spieltag)

---

### 3. Welt-Generierung
**Datei:** `src/services/phaser/WorldGenerator.ts`

Noise-basierter Generator:
- `generateScattered()` — gleichmäßig verteilte Ressourcen (config in `worldConfig.ts`)
- `generateClusters()` — Ressourcen in Gruppen (Steinbrüche, Palmen etc.)
- `generateSticks()` — Äste unter Bäumen
- `placeSpring()` — einzelne Wasserquelle in der Nähe des Spawns

Biome werden durch zwei Noise-Werte bestimmt: `elevation` und `moisture`.

**Konfiguration:** `src/data/worldConfig.ts` — Weltgröße, Tile-Größe, Ressource-Frequenz, Spawn-Biome

---

### 4. Crafting System
**Dateien:**
- `src/data/recipes.ts` — alle Rezepte (Input, Output, Tool, Tier)
- `src/types/crafting.ts` — Recipe Interface
- `src/services/game/CraftingSystem.ts` — Logik

Tier-System:
- `0` — immer sichtbar, keine Tools
- `1` — immer sichtbar
- `2+` — erst sichtbar wenn passendes Tool im Inventar

`requiresTool` = resourceId das in der Hand oder im Inventar sein muss.

---

### 5. Inventar & Equipment
**Datei:** `src/store/playerStore.ts`

- `inventory.items[]` — Gegenstände mit resourceId + quantity
- `equipment` — leftHand, rightHand Slots
- `stats` — health, hunger, thirst, stamina, fatigue (alle 0–100)

Gewichtslimit: `src/data/weights.ts` → `MAX_CARRY_KG = 20`

---

### 6. Musik
**Dateien:**
- `src/services/MusicManager.ts` — Singleton, Howler.js Wrapper
- `src/hooks/useMusic.ts` — React Hook, wechselt Track je Phase/Tageszeit

Tracks liegen in `public/music/` als `.mp3`.
Lautstärke & Mute werden in `localStorage` gespeichert.

---

### 7. Stores (Zustand)

| Store | Datei | Inhalt |
|---|---|---|
| gameStore | `store/gameStore.ts` | Phase, Zeit, Score, UI-Flags |
| playerStore | `store/playerStore.ts` | Player, Stats, Inventar, Equipment |
| worldStore | `store/worldStore.ts` | Welt, Ressourcen, Strukturen |
| tutorialStore | `store/tutorialStore.ts` | Tutorial-Schritte, Skip-Flag |

Alle Stores sind persistiert (`zustand/persist` → localStorage).
**Achtung:** Bei Spielstart immer alle Stores resetten (siehe `MainMenu.tsx → handleNewGame`).

---

## Für ein neues Projekt: Was anpassen?

Siehe `CUSTOMIZE.md` für die vollständige Checkliste.
