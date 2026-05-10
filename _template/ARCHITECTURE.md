# Architektur-Übersicht

## Wie React und Phaser zusammenarbeiten

```
App.tsx
  └── useGameStore(phase)
        ├── 'menu'    → <MainMenu />
        ├── 'playing' → <GameScreen />
        │     ├── <GameCanvas />  ← Phaser läuft hier
        │     ├── <GameHUD />
        │     ├── <InventoryPanel />
        │     └── Modals (Crafting, Sleep, Storage...)
        ├── 'paused'  → <GameScreen /> + <PauseMenu />
        └── 'dead'    → <DeathScreen />
```

---

## Datenfluss

```
User Input (Keyboard/Mouse)
    ↓
GameManager.ts (Phaser)
    ↓ liest/schreibt
Zustand Stores (playerStore, worldStore, gameStore)
    ↓ React re-renders
HUD / Inventar / Modals (React)
```

GameManager liest Stores direkt (`usePlayerStore.getState()`) ohne React-Subscription.
React-Komponenten subscriben per Hook (`usePlayerStore(s => s.player)`).

---

## Game Loop

```
Phaser update() → 60fps
  ├── processInput()       — WASD Bewegung
  ├── movePlayer()         — Position berechnen, Kollision
  ├── updateCamera()       — Kamera folgt Spieler
  ├── renderVisibleTiles() — nur Viewport-Tiles zeichnen
  ├── updateFog()          — Fog of War neu zeichnen (wenn Spieler bewegt)
  └── (alle 100ms) onGameTick() — Stats drain, Tod-Check
```

---

## Store-Kommunikation

Stores kommunizieren NICHT direkt miteinander.
GameManager ist der Mediator:

```
GameManager liest:  playerStore, worldStore, gameStore
GameManager schreibt: playerStore.updateStats(), worldStore.harvestResource(), gameStore.setPhase('dead')
```

React-Komponenten schreiben direkt in Stores (z.B. MainMenu → initializeWorld).

---

## Persistenz

Alle Stores persistieren via `zustand/persist` in localStorage.
Bei "New Game" werden ALLE Stores manuell resettet (Reihenfolge wichtig):
```ts
resetGame()    // gameStore
resetPlayer()  // playerStore  
resetWorld()   // worldStore
resetTutorial() // tutorialStore
// dann neu initialisieren:
initPlayer()
initializeWorld(new WorldGenerator().generate(seed))
setPhase('playing')
```

---

## Performance-Tricks

**Tiles:** Nur Tiles im Viewport + 2 Tiles Rand werden gezeichnet (~500 statt 22500)

**Fog of War:** Row-Segment-Algorithmus — zusammenhängende dunkle Tiles pro Zeile 
werden als ein `fillRect` gezeichnet (~40 statt ~700 draw calls)

**Ressourcen:** Graphics-Objekte werden einmal erstellt und nur bei Änderungen neu gezeichnet.
Nicht sichtbare Ressourcen werden per `setVisible(false)` ausgeblendet.

---

## Häufige Fallstricke

**Phaser startet nicht:** `GameCanvas` wird nur gerendert wenn `phase === 'playing'`.
Sicherstellen dass `worldStore.world` nicht null ist bevor Phase auf 'playing' gesetzt wird.
→ Synchroner Guard in `App.tsx`:
```ts
const phase = (rawPhase === 'playing') && !world ? 'menu' : rawPhase;
```

**Tab-Wechsel friert ein:** Phaser pausiert automatisch bei Visibility-Change.
Manuell mit `game.loop.sleep()` / `game.loop.wake()` steuern.

**Zustand nach Crash:** Stores sind persistiert — nach Absturz kann ein inkonsistenter
State geladen werden. Der Phase-Guard in App.tsx fängt den häufigsten Fall ab.
