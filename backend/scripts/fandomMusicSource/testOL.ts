import { parseOtherLanguages, getWikitext } from './fandomClient';

(async () => {
  for (const page of ['Planarcadia', 'Gloom', 'Phantasmoon Courtyard', 'The Xianzhou Luofu', 'Penacony']) {
    const wt = await getWikitext('honkai-star-rail', page);
    const ol = parseOtherLanguages(wt || '');
    console.log(`[${page}]  zhs=${ol['zhs'] || '(none)'}  zht=${ol['zht'] || ''}  en=${ol['en'] || ''}`);
  }
})();
