# Grafikreferenzen

`npm run art:cliffs` erzeugt zusätzlich `cliff-scene.svg` und `cliff-directions.svg`: gestufter Wald-/Strandrand sowie Aufgänge nach Norden, Osten, Süden und Westen einschließlich Innenecke. Sie verwenden `CliffArt.ts` und dienen der Prüfung zusammenhängender Höhenkanten. Die Palmen stammen unverändert aus `ResourceArt.ts`.

`reference-scene.svg` und `asset-sheet.svg` entstehen mit `npm run art:review` aus den aktiven TypeScript-Zeichenfunktionen. Die Szene ist konstruiert und hat keinen Spielstand/Seed. Sie prüft Form, Farbe, Maßstab und Zusammenspiel der frühen Objekte, nicht Phaser-WebGL, dynamische Tiefensortierung, Nebel oder die Bildrate. Die Feuerstelle in dieser Referenz ist unbeleuchtet.

Die PNGs sind rasterisierte Prüfansichten der SVGs. Dafür wurde `@resvg/resvg-js` temporär außerhalb des Projekts installiert; es ist keine neue Spielabhängigkeit. Nach einer Änderung zuerst die SVGs neu erzeugen; vorhandene PNGs müssen separat neu rasterisiert werden.

Die fünf SVGs in `public/art` werden ebenfalls vom Skript erzeugt und im Spiel verwendet. Herkunft: prozedurale Projektzeichnungen aus `ResourceArt.ts`, keine externen Bildvorlagen. Größe 32 × 32, gemeinsamer Zeichenanker (16, 28). Welttexturen haben Größe 160 × 192 und Bodenanker (80, 156). Varianten/Zustände sind in `SpriteFactory.ts` definiert.

`plants-sheet.svg` / `.png`: Drei Bambusvarianten, Pilzgruppen und Beerenb?sche mit reifen, wenigen und abgeernteten Fr?chten. Erzeugt mit `npm run art:review` aus dem aktiven Ressourcenrenderer. Die Rampenansichten zeigen die ?berarbeiteten Erdpfade in vier Richtungen. PNGs sind offline gerenderte Pr?fzeichnungen, keine Browser-Screenshots.
# Bauphasen

`node scripts/render-construction-review.cjs` erzeugt `construction-stages.svg` aus den aktiven `drawConstruction`-/`drawCamp`-Funktionen. Das zugehörige PNG wurde offline gerendert und visuell geprüft. Vier Bauarten bei 0/20/50/85/100 Prozent; kein Live-Browser-Screenshot.
