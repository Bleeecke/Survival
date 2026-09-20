const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'src/data/json', `${name}.json`), 'utf8'));
const recipes = read('recipes'), builds = read('buildDefinitions'), resources = read('resources'), knowledge = read('knowledgeDefinitions');
const flags = values => values?.map(v => `\`${v}\``).join(', ') || '-';
const amounts = (values, id = 'resourceId', quantity = 'quantity') => values.map(v => `${v[quantity]} x \`${v[id]}\``).join(', ');
const lines = [
  '# Techbaum: aktueller Datenkatalog', '',
  'Stand: erster Crafting-/Skill-Ausbau vom 2026-09-08. Generiert mit `node scripts/export-tech-tree.cjs`.', '',
  'Design, Quellenbefunde und offene Arbeiten: [SURVIVAL_DESIGN.md](SURVIVAL_DESIGN.md), besonders Abschnitt 1a. Diese Tabellen sind Datendefinitionen, kein Nachweis, dass jeder Spawn und jeder beschriebene Struktureffekt aktiv ist.', '',
  `Enthalten: ${resources.length} Ressourcen, ${recipes.length} Rezepte, ${builds.length} Bauten und ${Object.keys(knowledge.flags).length} Wissens-Flags.`, '',
  '## Aktive gemeinsame Regeln', '',
  '- Bekannte Materialien und Wissen bestimmen Rezeptentdeckung. Werkzeugverlust versteckt bekannte Verfahren nicht. Skill, Werkzeug, aktive Feuerstelle und Materialien werden beim Start sowie vor dem Abschluss geprueft.',
  '- Skill verkuerzt die Basiszeit um 5 Prozent je Stufe oberhalb 1, maximal 45 Prozent. Ein gemeinsamer Auftrag verhindert parallele Crafting-Abkuerzungen.',
  '- Feuersteinspalten und haltbare Werkzeuge benutzen Qualitaet aus craftingBalance.ts. Fehlschlag: eine Einheit der ersten Zutat verloren, reduzierte Lern-XP. Qualitaet veraendert Werkzeughaltbarkeit.',
  '- Materialverbrauch erst am Ende, Platzmangel wartet ohne Verlust. Fuer Baukosten werden Inventar, Bodenstapel und Lagerboxen im Umkreis von drei Feldern um den Bauplatz beruecksichtigt.',
  '- Palmendach vergibt Konstruktionswissen; Feuerstelle vergibt Feuerwissen. Drei erfolgreiche Auftraege fuer gegarte Nahrung lehren Konservierung.',
  '- Laufende Arbeit wird noch nicht gespeichert. Skill, Wissen, Qualitaet und Werkzeugverschleiss werden gespeichert.', '',
  '## Ressourcen', '',
  'Quelle: src/data/json/resources.json. Verwendung zeigt direkte Rezept- und Bauzutaten. Ernten, Brennstoff, direkte Nutzung und besondere Interaktionen stehen zusaetzlich im Runtime-Code. Spawn-Frequenz und Erreichbarkeit gesondert pruefen.', '',
  '| Ressource | Sammelzeit ms | Stack laut Daten | Regeneration ms | Direkte Zutatenverwendung |',
  '|---|---:|---:|---:|---|',
];
for (const r of resources) {
  const uses = [...recipes.filter(x => x.inputs.some(i => i.resourceId === r.id)).map(x => x.id), ...builds.filter(x => x.requiredMaterials.some(i => i.item === r.id)).map(x => `${x.id} (Bau)`)];
  lines.push(`| ${r.name} (\`${r.id}\`) | ${r.gatherTime} | ${r.maxStack} | ${r.regenerates ? r.regenerationTime : '-'} | ${uses.join(', ') || 'Keine direkte Zutat; weitere Verwendung pruefen'} |`);
}
lines.push('', '## Rezepte', '', 'Quelle: src/data/json/recipes.json. Tier ist keine automatische Zugangssperre. Stationen mit `_near` werden nicht verbraucht.', '',
  '| Rezept / Tier | Zutaten | Ausgaben | Werkzeug / Station | Mindestskill | Wissen | Basiszeit ms | XP | Qualitaet |',
  '|---|---|---|---|---|---|---:|---|---|');
const toolIds = new Set(['flint_knife','stone_axe','stone_pickaxe','stone_spear','improved_axe','improved_pickaxe','iron_axe','iron_pickaxe','fishing_rod']);
for (const r of recipes) lines.push(`| ${r.name} (\`${r.id}\`), T${r.tier} | ${amounts(r.inputs)} | ${amounts(r.outputs)} | ${r.requiresTool || '-'} | ${r.requiresSkill ? `${r.requiresSkill.skill} ${r.requiresSkill.level}` : '-'} | ${flags(r.requiredKnowledge)} | ${r.craftingTime} | ${r.grantsSkill ? `${r.grantsSkill.xp} ${r.grantsSkill.skill}` : '-'} | ${r.qualityBased || r.outputs.some(o => toolIds.has(o.resourceId)) ? 'Ja' : '-'} |`);
lines.push('', '## Bauten', '', 'Quelle: src/data/json/buildDefinitions.json. Basiszeit in Sekunden; der Arbeitsauftrag wendet den Skillbonus an. Einzelne beschriebene Effekte sind weiterhin zu pruefen.', '',
  '| Bau | Material | Werkzeug | Mindestskills | Wissen | Sichtbar nach einem dieser Funde | Basiszeit s | Vergibt Wissen |',
  '|---|---|---|---|---|---|---:|---|');
for (const b of builds) lines.push(`| ${b.name} (\`${b.id}\`) | ${amounts(b.requiredMaterials, 'item', 'amount')} | ${flags(b.requiredTools)} | ${b.requiredSkills.map(s => `${s.skill} ${s.level}`).join(', ') || '-'} | ${flags(b.requiredKnowledge)} | ${flags(b.visibleWhenSeen)} | ${b.buildTime} | ${flags(b.grantsKnowledge)} |`);
lines.push('', '### Bauwirkungen laut Definition', '', '| Bau | Beschriebene Wirkung | Platzierungsregeln | XP |', '|---|---|---|---|');
for (const b of builds) lines.push(`| \`${b.id}\` | ${b.effects.join('; ')} | ${JSON.stringify(b.placementRules || {})} | ${b.grantsSkill ? `${b.grantsSkill.xp} ${b.grantsSkill.skill}` : '-'} |`);
lines.push('', '## Wissen', '', 'Materialausloeser und Regenregeln aus knowledgeDefinitions.json; weitere aktive Quellen sind Bauabschluss, Rezeptabschluss und Tagebuch. Die Ideen-Daten sind weiterhin nicht an Schlaf angeschlossen.', '', '| Flag | Bedeutung | Start | Materialausloeser | Vergabe durch Rezept | Vergabe durch Bau |', '|---|---|---|---|---|---|');
for (const [flag, d] of Object.entries(knowledge.flags)) lines.push(`| \`${flag}\` | ${d.label} | ${knowledge.startingKnowledge.includes(flag) ? 'Ja' : '-'} | ${flags(Object.entries(knowledge.materialGrants).filter(([, f]) => f === flag).map(([m]) => m))} | ${flags(recipes.filter(r => r.grantsKnowledge?.includes(flag)).map(r => r.id))} | ${flags(builds.filter(b => b.grantsKnowledge?.includes(flag)).map(b => b.id))} |`);
lines.push('', '### Weitere Wissensereignisse', '', '| Ereignis | Flag | Bedingung |', '|---|---|---|');
for (const j of read('journalEntries')) lines.push(`| \`${j.triggerId}\` | \`${j.grantsKnowledge}\` | Tagebucheintrag annehmen |`);
for (const r of knowledge.rainGrants) lines.push(`| Regen | \`${r.flag}\` | Eines bekannt: ${flags(r.needsAny)} |`);
lines.push('| Drei gegarte Mahlzeiten-Auftraege | `knows_preservation` | Aktiver Zaehler in craftingStore |', '', 'Neue Designideen in SURVIVAL_DESIGN.md pflegen; diesen Katalog aus den Daten neu exportieren.', '');
fs.writeFileSync(path.join(root, 'TECHBAUM_IST.md'), lines.join('\n'), 'utf8');
console.log('Techbaum-Katalog aktualisiert.');
