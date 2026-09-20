# Inselvergleich

Erzeugt mit `npm run islands:compare` aus dem aktiven Generator, drei Profilen und Seeds 42, 137, 2026. `comparison.json` enthält Kennzahlen, `comparison.svg` die zusammengefassten Karten. Hellgrün = Tiefland, Dunkelgrün = Plateau, Graugrün = Hochland, Hellgrau = höchste Stufe; Sandfarbe = Strand, Blau = Wasser. Punkte markieren den Start.

`comparison.png` wurde aus der SVG rasterisiert und visuell geprüft. Dafür wurde die bereits temporär außerhalb des Projekts installierte Bibliothek `@resvg/resvg-js` verwendet; keine zusätzliche Spielabhängigkeit. Nach Neuerzeugung der SVG auch die PNG aktualisieren.

Zeiten sind Messwerte dieses Node-Laufs und schwanken je nach Gerät/Auslastung. Erreichbarkeit bezieht sich auf die Gelände-/Höhenregeln. Die Grafik bildet keine Live-Ansicht, Objektkollisionen oder Bildrate ab. Einstellungen, Bedienung und Save-Kompatibilität: [INSEL_GENERATOR.md](../../INSEL_GENERATOR.md).
