# Terrain Review

## Kurzfassung

Das aktuelle Terrain-System ist spielbar, aber visuell und logisch nicht sauber genug.
Die Hauptursache ist, dass Biome, Höhenlogik und Klippendarstellung getrennt voneinander erzeugt werden.
Dadurch entstehen Berge, Klippen und Ebenen, die technisch funktionieren, aber nicht wie ein zusammenhängendes Gelände wirken.

## Was aktuell schief läuft

### 1. `type` und `terrainTier` sind entkoppelt

In `src/services/phaser/WorldGenerator.ts` wird ein Tile zuerst als Biom gesetzt und danach separat ein `terrainTier` vergeben.
Das führt dazu, dass z. B. `forest`, `dense_jungle` oder `grass` auf sehr hohen Tiers liegen können.

Folge:
- Optisch passt das Gelände oft nicht zur Höhe.
- Ein Berg kann wie Wald aussehen.
- Eine Ebene kann plötzlich wie eine Stufe wirken.

### 2. Berge sind biome-getrieben statt geologisch

Die Bergverteilung entsteht nicht aus einer klaren Höhenmasse, sondern wird erst spät im `biome_depth`-Schema entschieden.
Dadurch wirken Berge eher wie zufällige Inseln in einem Biom-Gradienten.

Folge:
- Keine glaubwürdigen Gebirgsketten.
- Keine klaren Vorberge oder Übergänge.
- Zu viele isolierte Hochpunkte.

### 3. Die Tier-Smoothing-Logik macht die Landschaft stumpf

`smoothTiers()` glättet per Mehrheitsvotum, danach werden mit `capCliffSteps()` weitere Spitzen abgeschnitten.
Das erzeugt zwar Begehbarkeit, aber die Formen werden sehr rund, flach und generisch.

Folge:
- Viel Plateau, wenig Charakter.
- Stufen wirken konstruiert statt natürlich.
- Gelände verliert Lesbarkeit.

### 4. Klippen sind funktional, aber stilistisch zu generisch

In `src/services/phaser/GameManager.ts` wird die Klippe als eigener Canvas-Bake gebaut.
Das ist technisch sauber, aber die Darstellung folgt eher einer generischen Kanten-Ästhetik als einer glaubwürdigen Geologie.

Folge:
- Klippen dominieren visuell.
- Sie sehen nicht wie Fels, Hang oder Böschung eines bestimmten Bioms aus.
- Das Gelände bekommt keinen einheitlichen Stil.

### 5. Rampen werden nach Erreichbarkeit, nicht nach Optik gesetzt

`placeRamps()` sorgt dafür, dass Regionen erreichbar bleiben.
Das ist gut für die Spielbarkeit, aber es setzt Rampen an Stellen, die visuell oft unmotiviert sind.

Folge:
- Logisch korrekt, aber ästhetisch zufällig.
- Spieler lesen das Terrain nicht intuitiv.
- Übergänge wirken wie technische Ausnahmen.

### 6. Ebenen sind zu sauber und zu leer

`grass`, `tall_grass`, `forest`, `sparse_forest` unterscheiden sich aktuell stark über Farbe und Dichte, aber nicht über Form.
Es gibt kaum echte mittlere Topografie wie Mulden, Rücken oder sanfte Hänge.

Folge:
- Alles wirkt entweder flach oder abrupt abgestuft.
- Zwischenstufen fehlen.
- Das Terrain hat wenig natürliche Dramaturgie.

## Mein Urteil

Das System erzeugt Terrain, aber noch kein überzeugendes Gelände.
Die Welt ist technisch konsistent, aber gestalterisch nicht kohärent.

## Was ich ändern würde

### 1. Erst Geometrie, dann Biom

Der Generator sollte zuerst eine klare Höhenlandschaft erzeugen:
- Höhenzüge
- Plateaus
- Täler
- Küstenübergänge

Danach werden Biome auf diese Struktur projiziert.

### 2. Berge als zusammenhängende Massifs bauen

Nicht einzelne Berg-Tiles verteilen, sondern große Gebirgskörper erzeugen:
- Kern
- Vorzone
- Abfallzonen
- Felsausläufer

### 3. Klippen als Übergang behandeln

Klippen sollten weniger als Hauptform und mehr als Übergang zwischen Höhenstufen funktionieren.
Mehr Hang, weniger harte Kante.

### 4. Rampen gezielter platzieren

Rampen sollten an Lesepunkten sitzen, also dort, wo ein Spieler intuitiv einen Übergang erwartet.
Nicht nur dort, wo die Reachability-Logik gerade eine Verbindung erzwingen muss.

### 5. Ebenen visuell und geometrisch aufbrechen

Ebenen brauchen:
- kleine Höhenunterschiede
- sanfte Buckel
- Mulden
- Rücken

Sonst bleibt die Welt flach und künstlich.

## Konkrete Dateien

- [`src/services/phaser/WorldGenerator.ts`](C:\Users\chris\Projects\survival-game\src\services\phaser\WorldGenerator.ts)
- [`src/services/phaser/GameManager.ts`](C:\Users\chris\Projects\survival-game\src\services\phaser\GameManager.ts)
- [`src/data/tiles.ts`](C:\Users\chris\Projects\survival-game\src\data\tiles.ts)
- [`src/data/worldConfig.ts`](C:\Users\chris\Projects\survival-game\src\data\worldConfig.ts)

## Nächster sinnvoller Schritt

Der nächste Umbau sollte nicht an der Optik anfangen, sondern an der Weltlogik:
1. Ein gemeinsames Heightfield-System einführen.
2. Biome danach auf die Höhenkarte legen.
3. Klippen und Rampen aus dieser Struktur ableiten.
4. Erst danach die visuelle Bake feinjustieren.
