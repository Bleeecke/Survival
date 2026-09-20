# Techbaum: aktueller Datenkatalog

Stand: erster Crafting-/Skill-Ausbau vom 2026-09-08. Generiert mit `node scripts/export-tech-tree.cjs`.

Design, Quellenbefunde und offene Arbeiten: [SURVIVAL_DESIGN.md](SURVIVAL_DESIGN.md), besonders Abschnitt 1a. Diese Tabellen sind Datendefinitionen, kein Nachweis, dass jeder Spawn und jeder beschriebene Struktureffekt aktiv ist.

Enthalten: 64 Ressourcen, 32 Rezepte, 18 Bauten und 17 Wissens-Flags.

## Aktive gemeinsame Regeln

- Bekannte Materialien und Wissen bestimmen Rezeptentdeckung. Werkzeugverlust versteckt bekannte Verfahren nicht. Skill, Werkzeug, aktive Feuerstelle und Materialien werden beim Start sowie vor dem Abschluss geprueft.
- Skill verkuerzt die Basiszeit um 5 Prozent je Stufe oberhalb 1, maximal 45 Prozent. Ein gemeinsamer Auftrag verhindert parallele Crafting-Abkuerzungen.
- Feuersteinspalten und haltbare Werkzeuge benutzen Qualitaet aus craftingBalance.ts. Fehlschlag: eine Einheit der ersten Zutat verloren, reduzierte Lern-XP. Qualitaet veraendert Werkzeughaltbarkeit.
- Materialverbrauch erst am Ende, Platzmangel wartet ohne Verlust. Fuer Baukosten werden Inventar, Bodenstapel und Lagerboxen im Umkreis von drei Feldern um den Bauplatz beruecksichtigt.
- Palmendach vergibt Konstruktionswissen; Feuerstelle vergibt Feuerwissen. Drei erfolgreiche Auftraege fuer gegarte Nahrung lehren Konservierung.
- Laufende Arbeit wird noch nicht gespeichert. Skill, Wissen, Qualitaet und Werkzeugverschleiss werden gespeichert.

## Ressourcen

Quelle: src/data/json/resources.json. Verwendung zeigt direkte Rezept- und Bauzutaten. Ernten, Brennstoff, direkte Nutzung und besondere Interaktionen stehen zusaetzlich im Runtime-Code. Spawn-Frequenz und Erreichbarkeit gesondert pruefen.

| Ressource | Sammelzeit ms | Stack laut Daten | Regeneration ms | Direkte Zutatenverwendung |
|---|---:|---:|---:|---|
| Holz (`wood`) | 1200 | 99 | 120000 | wood_to_sticks, plank, iron_bar, improved_axe, improved_pickaxe, wooden_shelter (Bau), log_cabin (Bau), storage_box (Bau), smoking_rack (Bau), workbench (Bau), furnace (Bau) |
| Stein (`stone`) | 2000 | 50 | 180000 | improved_axe, improved_pickaxe, wooden_shelter (Bau), log_cabin (Bau), workbench (Bau), furnace (Bau), farm_plot (Bau) |
| Wasser (`water`) | 500 | 50 | 10000 | fever_tea |
| Beeren (`food`) | 800 | 30 | 150000 | cooked_food |
| Beerenstrauch (`berry_bush`) | 800 | 10 | 600000 | Keine direkte Zutat; weitere Verwendung pruefen |
| Äste (`sticks`) | 500 | 99 | 60000 | harden_stick, flint_knife, stone_pickaxe, torch_carry, fishing_rod, smoked_meat, campfire (Bau), palm_shelter (Bau), granite_campfire (Bau), torch (Bau), drying_rack (Bau), herb_drying_rack (Bau), snare_trap (Bau) |
| Bruchstein (`pebbles`) | 400 | 99 | 120000 | knap_flint, stone_pickaxe, arbeitsplatz (Bau), campfire (Bau) |
| Quelle (`spring`) | 800 | 1 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Pfütze (`puddle`) | 600 | 3 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Palme (`palm_tree`) | 800 | 5 | 1800000 | Keine direkte Zutat; weitere Verwendung pruefen |
| Fisch (`fish`) | 1500 | 20 | 300000 | cooked_fish, dried_fish |
| Eisenerz (`iron_ore`) | 3000 | 30 | 600000 | iron_bar |
| Feuerstein (`flint`) | 600 | 50 | 120000 | knap_flint, campfire (Bau) |
| Treibholz (`driftwood`) | 700 | 40 | 180000 | Keine direkte Zutat; weitere Verwendung pruefen |
| Muscheln (`shells`) | 300 | 60 | 90000 | Keine direkte Zutat; weitere Verwendung pruefen |
| Palmenblatt (`palm_leaf`) | 500 | 50 | 120000 | palm_leaf_to_fiber, bandage, arbeitsplatz (Bau), water_container (Bau), sleeping_spot (Bau), palm_shelter (Bau), bed (Bau), smoking_rack (Bau) |
| Kräuter (`herbs`) | 600 | 30 | 120000 | herbal_remedy, fever_tea, antiparasitic |
| Fasern (`fiber`) | 500 | 60 | 90000 | rope_fiber, flint_knife, stone_spear, obsidian_blade, bandage |
| Pilze (`mushroom`) | 700 | 20 | 150000 | cooked_mushroom |
| Exotische Frucht (`exotic_fruit`) | 900 | 15 | 1200000 | dried_fruit |
| Lianen (`vine`) | 600 | 40 | 90000 | rope_fiber, fishing_rod, palm_shelter (Bau), herb_drying_rack (Bau) |
| Harzbaum (`resin_tree`) | 2000 | 1 | 300000 | Keine direkte Zutat; weitere Verwendung pruefen |
| Baumharz (`tree_resin`) | 0 | 20 | - | torch_carry, antiparasitic, torch (Bau) |
| Kokosnuss (`coconut`) | 1200 | 5 | 300000 | coconut_open |
| Kokosschale (`coconut_shell`) | 800 | 10 | 200000 | water_container (Bau) |
| Farn (`fern`) | 800 | 1 | 600000 | Keine direkte Zutat; weitere Verwendung pruefen |
| Tauschale (`dew_water`) | 0 | 10 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Kokoswasser (`coconut_water`) | 0 | 5 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Obsidian (`obsidian`) | 3000 | 10 | 900000 | obsidian_blade |
| Granit (`granite`) | 2500 | 30 | 600000 | granite_campfire (Bau) |
| Schildkrötenfleisch (`turtle_meat`) | 0 | 20 | - | cooked_turtle |
| Schildkrötenpanzer (`turtle_shell`) | 0 | 5 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Gek. Schildkröte (`cooked_turtle`) | 0 | 20 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Krabbenfleisch (`crab_meat`) | 0 | 20 | - | cooked_crab |
| Gek. Krabbe (`cooked_crab`) | 0 | 20 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Wildschweinfleisch (`boar_meat`) | 0 | 10 | - | cooked_boar, smoked_meat |
| Wildschweinfell (`boar_hide`) | 0 | 10 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Gek. Wildschwein (`cooked_boar`) | 0 | 10 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Knochen (`bone`) | 0 | 20 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Tierhaut (`hide`) | 0 | 10 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Tierfett (`fat`) | 0 | 10 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Gespl. Feuerstein (`sharp_flint`) | 0 | 20 | - | flint_knife, stone_axe, stone_spear |
| Gehärteter Ast (`hardened_stick`) | 0 | 10 | - | stone_axe, stone_spear, obsidian_blade |
| Seil (`rope`) | 0 | 30 | - | stone_axe, torch_carry, fishing_rod, storage_box (Bau), torch (Bau), drying_rack (Bau), smoking_rack (Bau), snare_trap (Bau) |
| Holzbrett (`plank`) | 0 | 50 | - | iron_axe, iron_pickaxe, log_cabin (Bau), bed (Bau), furnace (Bau), farm_plot (Bau) |
| Eisenbarren (`iron_bar`) | 0 | 20 | - | iron_axe, iron_pickaxe |
| Verband (`bandage`) | 0 | 10 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Fiebertee (`fever_tea`) | 0 | 10 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Parasitenmedizin (`antiparasitic`) | 0 | 10 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Kräutermittel (`herbal_remedy`) | 0 | 10 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Geräuchertes Fleisch (`smoked_meat`) | 0 | 10 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Getrockneter Fisch (`dried_fish`) | 0 | 10 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Getrocknete Frucht (`dried_fruit`) | 0 | 10 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Gekochtes Essen (`cooked_food`) | 0 | 20 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Geb. Pilze (`cooked_mushroom`) | 0 | 20 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Gebratener Fisch (`cooked_fish_meal`) | 0 | 20 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Großer Baum (`large_tree`) | 20000 | 1 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Banyanbaum (`banyan_tree`) | 25000 | 1 | - | Keine direkte Zutat; weitere Verwendung pruefen |
| Bambus (`bamboo`) | 1000 | 1 | 240000 | Keine direkte Zutat; weitere Verwendung pruefen |
| Kautschukbaum (`rubber_tree`) | 3000 | 1 | 600000 | Keine direkte Zutat; weitere Verwendung pruefen |
| Kakaobaum (`cacao_tree`) | 2000 | 1 | 600000 | Keine direkte Zutat; weitere Verwendung pruefen |
| Pandanus (`pandanus`) | 1500 | 1 | 300000 | Keine direkte Zutat; weitere Verwendung pruefen |
| Brotfruchtbaum (`breadfruit_tree`) | 2000 | 1 | 600000 | Keine direkte Zutat; weitere Verwendung pruefen |
| Grasbüschel (`grass_tuft`) | 0 | 1 | 120000 | Keine direkte Zutat; weitere Verwendung pruefen |

## Rezepte

Quelle: src/data/json/recipes.json. Tier ist keine automatische Zugangssperre. Stationen mit `_near` werden nicht verbraucht.

| Rezept / Tier | Zutaten | Ausgaben | Werkzeug / Station | Mindestskill | Wissen | Basiszeit ms | XP | Qualitaet |
|---|---|---|---|---|---|---:|---|---|
| Feuerstein absplittern (`knap_flint`), T0 | 1 x `flint`, 1 x `pebbles` | 1 x `sharp_flint` | - | - | `knows_sharp_edges` | 3000 | 15 crafting | Ja |
| Ast in Feuer härten (`harden_stick`), T0 | 2 x `sticks` | 1 x `hardened_stick` | campfire_near | survival 1 | `knows_fire` | 4000 | 10 survival | - |
| Palmenblätter zerreißen (`palm_leaf_to_fiber`), T0 | 3 x `palm_leaf` | 1 x `fiber` | - | - | - | 4000 | 5 crafting | - |
| Kokosnuss öffnen (`coconut_open`), T0 | 1 x `coconut` | 2 x `coconut_shell`, 1 x `coconut_water` | any_axe | - | - | 1500 | - | - |
| Seil flechten (`rope_fiber`), T1 | 4 x `fiber`, 2 x `vine` | 2 x `rope` | any_knife | - | `knows_binding` | 3000 | 10 crafting | - |
| Holz zu Ästen (`wood_to_sticks`), T2 | 1 x `wood` | 3 x `sticks` | stone_axe | - | - | 2000 | 5 crafting | - |
| Holzbretter (`plank`), T3 | 10 x `wood` | 5 x `plank` | workbench_near | - | `knows_construction` | 4000 | 12 crafting | - |
| Eisenbarren (`iron_bar`), T4 | 3 x `iron_ore`, 5 x `wood` | 1 x `iron_bar` | furnace_near | - | `knows_metal` | 15000 | - | - |
| Feuersteinmesser (`flint_knife`), T0 | 1 x `sharp_flint`, 1 x `sticks`, 3 x `fiber` | 1 x `flint_knife` | - | crafting 1 | `knows_sharp_edges`, `knows_binding` | 5000 | 25 crafting | Ja |
| Primitive Axt (`stone_axe`), T1 | 2 x `hardened_stick`, 1 x `sharp_flint`, 2 x `rope` | 1 x `stone_axe` | - | crafting 1 | `knows_tool_binding` | 5000 | 20 crafting | Ja |
| Steinspitzhacke (`stone_pickaxe`), T1 | 2 x `sticks`, 6 x `pebbles` | 1 x `stone_pickaxe` | - | - | `knows_tool_binding` | 5000 | 20 crafting | Ja |
| Steinspeer (`stone_spear`), T1 | 1 x `hardened_stick`, 1 x `sharp_flint`, 2 x `fiber` | 1 x `stone_spear` | - | hunting 1 | `knows_hardened_wood`, `knows_sharp_edges` | 4000 | 15 hunting | Ja |
| Fackel (tragbar) (`torch_carry`), T1 | 2 x `sticks`, 1 x `rope`, 2 x `tree_resin` | 2 x `torch` | - | - | `knows_fire` | 3000 | - | - |
| Angelrute (`fishing_rod`), T1 | 3 x `sticks`, 1 x `rope`, 1 x `vine` | 1 x `fishing_rod` | any_knife | - | `knows_basic_weapon` | 4000 | 10 hunting | Ja |
| Verbesserte Axt (`improved_axe`), T2 | 5 x `wood`, 10 x `stone` | 1 x `improved_axe` | stone_axe | - | `knows_construction` | 8000 | 20 crafting | Ja |
| Verbesserte Spitzhacke (`improved_pickaxe`), T2 | 5 x `wood`, 12 x `stone` | 1 x `improved_pickaxe` | stone_pickaxe | - | `knows_construction` | 8000 | 20 crafting | Ja |
| Obsidianklinge (`obsidian_blade`), T2 | 2 x `obsidian`, 1 x `hardened_stick`, 3 x `fiber` | 1 x `flint_knife` | - | crafting 3 | `knows_obsidian` | 6000 | 30 crafting | Ja |
| Eisenaxt (`iron_axe`), T4 | 1 x `iron_bar`, 3 x `plank` | 1 x `iron_axe` | furnace_near | - | `knows_metal` | 10000 | 30 crafting | Ja |
| Eisenspitzhacke (`iron_pickaxe`), T4 | 1 x `iron_bar`, 3 x `plank` | 1 x `iron_pickaxe` | furnace_near | - | `knows_metal` | 10000 | 30 crafting | Ja |
| Gekochtes Essen (`cooked_food`), T1 | 2 x `food` | 2 x `cooked_food` | campfire_near | - | `knows_fire` | 3000 | 10 cooking | - |
| Gebratene Pilze (`cooked_mushroom`), T1 | 2 x `mushroom` | 2 x `cooked_mushroom` | campfire_near | - | `knows_fire` | 2500 | 10 cooking | - |
| Gebratenes Wildschwein (`cooked_boar`), T1 | 2 x `boar_meat` | 2 x `cooked_boar` | campfire_near | - | `knows_fire` | 5000 | 12 cooking | - |
| Gebratener Fisch (`cooked_fish`), T1 | 2 x `fish` | 2 x `cooked_fish_meal` | campfire_near | - | `knows_fire` | 4000 | 10 cooking | - |
| Gekochte Krabbe (`cooked_crab`), T1 | 2 x `crab_meat` | 2 x `cooked_crab` | campfire_near | - | `knows_fire` | 4000 | 10 cooking | - |
| Gegarte Schildkröte (`cooked_turtle`), T1 | 2 x `turtle_meat` | 2 x `cooked_turtle` | campfire_near | - | `knows_fire` | 6000 | 10 cooking | - |
| Fleisch räuchern (`smoked_meat`), T1 | 2 x `boar_meat`, 2 x `sticks` | 2 x `smoked_meat` | campfire_near | - | `knows_preservation` | 8000 | 15 cooking | - |
| Fisch trocknen (`dried_fish`), T1 | 2 x `fish` | 2 x `dried_fish` | campfire_near | - | `knows_preservation` | 10000 | 12 cooking | - |
| Früchte trocknen (`dried_fruit`), T1 | 2 x `exotic_fruit` | 3 x `dried_fruit` | campfire_near | - | `knows_preservation` | 8000 | 10 cooking | - |
| Verband (`bandage`), T0 | 2 x `fiber`, 1 x `palm_leaf` | 1 x `bandage` | - | - | `knows_medicine` | 2000 | 8 medicine | - |
| Kräutermittel (`herbal_remedy`), T1 | 3 x `herbs` | 1 x `herbal_remedy` | - | - | `knows_medicine` | 2000 | 12 medicine | - |
| Fiebertee (`fever_tea`), T1 | 2 x `herbs`, 1 x `water` | 1 x `fever_tea` | campfire_near | - | `knows_medicine` | 3000 | 15 medicine | - |
| Parasitenmedizin (`antiparasitic`), T1 | 4 x `herbs`, 1 x `tree_resin` | 1 x `antiparasitic` | - | - | `knows_medicine` | 4000 | 20 medicine | - |

## Bauten

Quelle: src/data/json/buildDefinitions.json. Basiszeit in Sekunden; der Arbeitsauftrag wendet den Skillbonus an. Einzelne beschriebene Effekte sind weiterhin zu pruefen.

| Bau | Material | Werkzeug | Mindestskills | Wissen | Sichtbar nach einem dieser Funde | Basiszeit s | Vergibt Wissen |
|---|---|---|---|---|---|---:|---|
| Arbeitsplatz (`arbeitsplatz`) | 4 x `pebbles`, 4 x `palm_leaf` | - | - | `knows_basic_storage` | `pebbles` | 8 | - |
| Lagerfeuerstelle (`campfire`) | 5 x `sticks`, 3 x `pebbles`, 1 x `flint` | - | survival 1 | `knows_basic_fire` | `sticks`, `pebbles`, `flint` | 8 | `knows_fire` |
| Einfacher Regensammler (`water_container`) | 1 x `coconut_shell`, 1 x `palm_leaf` | - | - | `knows_rain_collection` | `coconut_shell`, `coconut` | 10 | - |
| Schlafplatz (`sleeping_spot`) | 4 x `palm_leaf` | - | - | `knows_basic_rest` | `palm_leaf` | 5 | - |
| Palmendach (`palm_shelter`) | 8 x `sticks`, 6 x `palm_leaf`, 3 x `vine` | - | building 1 | `knows_basic_rest` | `palm_leaf`, `vine`, `sticks` | 40 | `knows_basic_shelter`, `knows_construction` |
| Holzunterkunft (`wooden_shelter`) | 20 x `wood`, 5 x `stone` | `stone_axe` | building 2, crafting 1 | `knows_construction` | `wood`, `stone` | 120 | - |
| Blockhütte (`log_cabin`) | 40 x `wood`, 20 x `stone`, 10 x `plank` | `stone_axe` | building 3, crafting 3 | `knows_construction` | `plank` | 300 | - |
| Bett (`bed`) | 8 x `plank`, 10 x `palm_leaf` | - | building 3, crafting 3 | `knows_construction` | `plank` | 90 | - |
| Lagerbox (`storage_box`) | 8 x `wood`, 2 x `rope` | `stone_axe` | crafting 2 | `knows_construction` | `wood`, `rope` | 60 | - |
| Granit-Feuerstelle (`granite_campfire`) | 6 x `granite`, 4 x `sticks` | `stone_pickaxe` | survival 2 | `knows_fire` | `granite` | 45 | - |
| Fackelhalter (`torch`) | 2 x `sticks`, 1 x `rope`, 2 x `tree_resin` | - | - | `knows_fire` | `tree_resin` | 20 | - |
| Trockengestell (`drying_rack`) | 6 x `sticks`, 2 x `rope` | - | cooking 2 | `knows_preservation` | `fish`, `boar_meat`, `exotic_fruit` | 50 | - |
| Räucherstelle (`smoking_rack`) | 8 x `wood`, 4 x `rope`, 2 x `palm_leaf` | - | survival 3, cooking 2 | `knows_preservation`, `knows_fire` | `boar_meat`, `fish` | 80 | - |
| Werkbank (`workbench`) | 15 x `wood`, 10 x `stone` | `stone_axe` | crafting 2 | `knows_construction` | `wood`, `stone` | 90 | - |
| Schmelzofen (`furnace`) | 20 x `wood`, 15 x `stone`, 10 x `plank` | `stone_axe` | survival 4, crafting 4 | `knows_metal`, `knows_fire` | `iron_ore` | 180 | - |
| Ackerbeet (`farm_plot`) | 10 x `plank`, 5 x `stone` | - | naturelore 3 | `knows_construction` | `plank` | 120 | - |
| Kräutergestell (`herb_drying_rack`) | 4 x `sticks`, 2 x `vine` | - | naturelore 2 | `knows_medicine` | `herbs` | 30 | - |
| Schlinge (`snare_trap`) | 2 x `rope`, 3 x `sticks` | - | hunting 2 | `knows_basic_weapon` | `rope` | 20 | - |

### Bauwirkungen laut Definition

| Bau | Beschriebene Wirkung | Platzierungsregeln | XP |
|---|---|---|---|
| `arbeitsplatz` | Crafting möglich; Benötigt 4 Bruchsteine & 4 Palmblätter; Kein Regenschutz | {} | 10 building |
| `campfire` | Wärme & Licht; Kochen möglich; Hält Tiere fern; Risiko: Regen & Wind | {} | 15 survival |
| `water_container` | Sammelt Regenwasser passiv; Kapazität: 2 Schluck; Nur bei Regen aktiv; Muss unter freiem Himmel stehen | {"requiresOpenSky":true} | 12 survival |
| `sleeping_spot` | Schlafen möglich; Schlechte Erholung; Leichter Gesundheitsmalus; Kein Schutz gegen Regen oder Kälte | {} | 8 building |
| `palm_shelter` | Schutz vor leichtem Regen; Besserer Schlaf; Hält Nässe von Lagerplatz fern; Nachteil: sturmanfällig | {} | 25 building |
| `wooden_shelter` | +80% Regenprotection; +30% Schlafqualität; Schutz vor Kälte | {} | 35 building |
| `log_cabin` | Vollschutz gegen Regen & Kälte; +60% Schlafqualität; Permanenter Heimatpunkt | {} | 50 building |
| `bed` | +35% Schlafqualität; +20% Erholungsrate; Setzt Schlafpunkt | {} | 20 building |
| `storage_box` | 20 Lagerslots; Schützt Inhalt vor Regen (20%) | {} | 15 building |
| `granite_campfire` | 2× längere Brenndauer; Bessere Wärmeabgabe | {} | 20 survival |
| `torch` | +3 Sichtweite in der Nacht; Markiert wichtige Orte | {} | 10 building |
| `drying_rack` | Fisch & Früchte trocknen ohne Lagerfeuer; Bis zu 10 Tage Haltbarkeit | {"requiresOpenSky":true} | 12 cooking |
| `smoking_rack` | Räuchert Fleisch & Fisch; +50% Haltbarkeit gegenüber getrocknet | {"requiresNearbyFire":true} | 15 cooking |
| `workbench` | Fortgeschrittenes Crafting; Mehr Rezepte sichtbar | {} | 25 building |
| `furnace` | Eisenerz → Eisenbarren; Schaltet Eisenwerkzeuge frei | {} | 45 building |
| `farm_plot` | Passiv: 1× Nahrung alle 40s | {} | 20 naturelore |
| `herb_drying_rack` | +25% Heilwirkung bei Kräutermitteln | {"requiresOpenSky":true} | 12 naturelore |
| `snare_trap` | Fängt Kleintiere passiv; Muss täglich kontrolliert werden | {} | 10 hunting |

## Wissen

Materialausloeser und Regenregeln aus knowledgeDefinitions.json; weitere aktive Quellen sind Bauabschluss, Rezeptabschluss und Tagebuch. Die Ideen-Daten sind weiterhin nicht an Schlaf angeschlossen.

| Flag | Bedeutung | Start | Materialausloeser | Vergabe durch Rezept | Vergabe durch Bau |
|---|---|---|---|---|---|
| `knows_basic_rest` | Einfaches Lager | Ja | - | - | - |
| `knows_basic_storage` | Arbeitsplatz | Ja | - | - | - |
| `knows_basic_fire` | Feuerstelle möglich | - | `pebbles`, `sticks` | - | - |
| `knows_sharp_edges` | Klingen formen | - | `flint`, `sharp_flint` | `knap_flint` | - |
| `knows_hardened_wood` | Holz härten | - | - | `harden_stick` | - |
| `knows_binding` | Fasern binden | - | `fiber` | - | - |
| `knows_tool_binding` | Werkzeug binden | - | - | `flint_knife` | - |
| `knows_basic_weapon` | Primitive Waffe | - | - | `stone_spear` | - |
| `knows_basic_shelter` | Dach bauen | - | - | - | `palm_shelter` |
| `knows_rain_collection` | Regenwasser sammeln | - | `coconut_shell`, `coconut` | - | - |
| `knows_fire` | Feuer beherrschen | - | - | - | `campfire` |
| `knows_cooking` | Kochen | - | - | `cooked_food` | - |
| `knows_preservation` | Konservierung | - | - | `smoked_meat` | - |
| `knows_construction` | Konstruktion | - | - | - | `palm_shelter` |
| `knows_medicine` | Heilkunde | - | `herbs` | `herbal_remedy` | - |
| `knows_metal` | Metallverarbeitung | - | `iron_ore` | `iron_bar` | - |
| `knows_obsidian` | Obsidian | - | `obsidian` | - | - |

### Weitere Wissensereignisse

| Ereignis | Flag | Bedingung |
|---|---|---|
| `first_flint` | `knows_basic_fire` | Tagebucheintrag annehmen |
| `first_rain_with_leaves` | `knows_rain_collection` | Tagebucheintrag annehmen |
| `first_campfire` | `knows_fire` | Tagebucheintrag annehmen |
| `first_knapping` | `knows_sharp_edges` | Tagebucheintrag annehmen |
| `first_fiber` | `knows_binding` | Tagebucheintrag annehmen |
| `first_knife` | `knows_tool_binding` | Tagebucheintrag annehmen |
| `first_harden` | `knows_hardened_wood` | Tagebucheintrag annehmen |
| `first_iron_ore` | `knows_metal` | Tagebucheintrag annehmen |
| `first_rain_awake` | `knows_basic_shelter` | Tagebucheintrag annehmen |
| `first_wood_shelter` | `knows_construction` | Tagebucheintrag annehmen |
| `first_herbs` | `knows_medicine` | Tagebucheintrag annehmen |
| `first_hunt_kill` | `knows_basic_weapon` | Tagebucheintrag annehmen |
| `first_cook` | `knows_cooking` | Tagebucheintrag annehmen |
| `first_cook_advanced` | `knows_preservation` | Tagebucheintrag annehmen |
| Regen | `knows_basic_shelter` | Eines bekannt: `palm_leaf`, `sticks`, `vine` |
| Regen | `knows_rain_collection` | Eines bekannt: `coconut`, `coconut_shell`, `palm_leaf` |
| Drei gegarte Mahlzeiten-Auftraege | `knows_preservation` | Aktiver Zaehler in craftingStore |

Neue Designideen in SURVIVAL_DESIGN.md pflegen; diesen Katalog aus den Daten neu exportieren.
