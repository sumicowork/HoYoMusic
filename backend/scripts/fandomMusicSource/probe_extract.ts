import { extractEntity, classifyDuring } from './adapters/resolve';
const cases = [
  'Version 2.7 Trailer — "A New Venture on the Eighth Dawn"',
  'Version 3.1 Trailer: "Light Slips the Gate, Shadow Greets the Throne"',
  'Mission|Nemesis, Scorched by Golden Blood|showChapter=0',
  'Cutscene in Mission|Nemesis, Scorched by Golden Blood|showChapter=0',
  'Cosmic Ninjutsu Inscriptions — Havoc Exorcism: Lunar Vileslayer Scroll',
  'Login Menu',
  'Elite Combat',
];
for (const c of cases) {
  const k = classifyDuring(c);
  const e = extractEntity(c, k as any);
  console.log('[' + k + '] ' + c.slice(0, 45) + '  =>  "' + e + '"');
}
