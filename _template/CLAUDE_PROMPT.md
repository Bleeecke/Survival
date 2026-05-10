# Prompt für neuen Claude Code Chat

Kopiere diesen Text als erste Nachricht in einen neuen Claude Code Chat:

---

Wir bauen ein neues 2D Top-Down Spiel basierend auf einem bewährten Template.

**Stack:** React 18 + Phaser 3 + Zustand + Howler.js + Tailwind + TypeScript + Vite

**Lies zuerst diese Dateien im Ordner `_template/`:**
- `README.md` — Übersicht aller Systeme und wo sie liegen
- `ARCHITECTURE.md` — wie React und Phaser zusammenarbeiten, Datenfluss, Fallstricke
- `CUSTOMIZE.md` — vollständige Checkliste was für ein neues Spiel angepasst werden muss

**Das bestehende Spiel** (Survival Game) zeigt die vollständige Implementierung.
Alle Kernsysteme sind dort bereits stabil und getestet:
- Phase-System (menu/playing/paused/dead) → `src/App.tsx` + `src/store/gameStore.ts`
- Phaser Game Loop + Rendering → `src/services/phaser/GameManager.ts`
- Welt-Generierung (Noise-basiert) → `src/services/phaser/WorldGenerator.ts`
- Crafting System → `src/data/recipes.ts` + `src/services/game/CraftingSystem.ts`
- Musik → `src/services/MusicManager.ts` + `src/hooks/useMusic.ts`
- Alle Stores → `src/store/`

**Neues Spiel:** [HIER BESCHREIBEN WAS DU BAUEN WILLST]

Fang damit an, `CUSTOMIZE.md` durchzugehen und frage mich welche Punkte ich zuerst
anpassen möchte.
