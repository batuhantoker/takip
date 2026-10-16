/**
 * TAKIP — the diseases an outbreak item must name to count, as canonical names.
 * Patterns also catch disease names that contain a place ("Sudan virus", "Crimean-Congo", "Guinea worm"),
 * so they can be removed before scanning a title for countries.
 */

export const DISEASES: readonly { name: string; pattern: RegExp }[] = [
  { name: 'Ebola', pattern: /\bebola\w*|\bbundibugyo\b|\bsudan (?:ebola)?virus(?: disease)?|\bta[iï] forest virus/i },
  { name: 'Marburg', pattern: /\bmarburg\b/i },
  { name: 'Mpox', pattern: /\bm(?:pox|onkeypox)\b/i },
  { name: 'Cholera', pattern: /\bcholera\b/i },
  { name: 'Measles', pattern: /\bmeasles\b/i },
  { name: 'Dengue', pattern: /\bdengue\b/i },
  { name: 'Chikungunya', pattern: /\bchikungunya\b/i },
  { name: 'Zika', pattern: /\bzika\b/i },
  { name: 'Yellow fever', pattern: /\byellow fever\b/i },
  { name: 'Polio', pattern: /\bpolio(?:virus|myelitis)?\b|\bcvdpv\d?\b/i },
  { name: 'Avian influenza', pattern: /\bavian influenza\b|\bbird flu\b|\bh(?:5|7|9|10)n\d{1,2}\b(?!\)?v)|\binfluenza a\(h(?:5|7|9)\)/i },
  { name: 'Swine influenza', pattern: /\bswine (?:influenza|flu)\b|\bvariant influenza\b|\bh[13]n[12]\)?v\b/i },
  { name: 'MERS', pattern: /\bmers(?:-cov)?\b|\bmiddle east respiratory syndrome(?: coronavirus)?/i },
  { name: 'COVID-19', pattern: /\bcovid(?:-19)?\b|\bsars-cov-2\b/i },
  { name: 'Nipah', pattern: /\bnipah\b/i },
  { name: 'Hantavirus', pattern: /\bhantavirus\b|\bandes virus\b/i },
  { name: 'Lassa fever', pattern: /\blassa\b/i },
  { name: 'Crimean-Congo haemorrhagic fever', pattern: /\bcrimean[- ]congo(?: ha?emorrhagic fever)?|\bcchf\b/i },
  { name: 'Rift Valley fever', pattern: /\brift valley fever\b/i },
  { name: 'West Nile virus', pattern: /\bwest nile(?: virus| fever)?/i },
  { name: 'Plague', pattern: /\bplague\b/i },
  { name: 'Diphtheria', pattern: /\bdiphtheria\b/i },
  { name: 'Meningococcal disease', pattern: /\bmeningococcal\b|\bmeningitis\b/i },
  { name: 'Hepatitis A', pattern: /\bhepatitis a\b/i },
  { name: 'Hepatitis E', pattern: /\bhepatitis e\b/i },
  { name: 'Paratyphoid fever', pattern: /\bparatyphoid\b/i },
  { name: 'Typhoid fever', pattern: /\btyphoid\b/i },
  { name: 'Malaria', pattern: /\bmalaria\b/i },
  { name: 'Rocky Mountain spotted fever', pattern: /\brocky mountain spotted fever\b|\brmsf\b/i },
  { name: 'Oropouche', pattern: /\boropouche\b/i },
  { name: 'Japanese encephalitis', pattern: /\bjapanese encephalitis\b/i },
  { name: 'Anthrax', pattern: /\banthrax\b/i },
  { name: 'Rabies', pattern: /\brabies\b/i },
  { name: 'Pertussis', pattern: /\bpertussis\b|\bwhooping cough\b/i },
  { name: "Legionnaires' disease", pattern: /\blegionnaires|\blegionell/i },
  { name: 'Salmonellosis', pattern: /\bsalmonell/i },
  { name: 'Shigellosis', pattern: /\bshigell/i },
  { name: 'Listeriosis', pattern: /\blisteri/i },
  { name: 'E. coli (STEC)', pattern: /\be\. ?coli\b|\bstec\b/i },
  { name: 'Botulism', pattern: /\bbotulism\b/i },
  { name: 'Leptospirosis', pattern: /\bleptospirosis\b/i },
  { name: 'Guinea worm', pattern: /\bguinea worm\b|\bdracuncul/i },
  { name: 'Undiagnosed illness', pattern: /\b(?:pneumonia|illness|disease) of (?:undetermined|unknown) (?:etiology|origin|cause)|\bundiagnosed (?:illness|disease)\b/i },
];

/** The disease mentioned first in the text. */
export function matchDisease(text: string): string | null {
  let best: { name: string; at: number } | null = null;
  for (const d of DISEASES) {
    const at = text.search(d.pattern);
    if (at >= 0 && (!best || at < best.at)) best = { name: d.name, at };
  }
  return best?.name ?? null;
}

/** The text with every disease name blanked, so "Sudan virus" cannot be read as Sudan. */
export function blankDiseases(text: string): string {
  return DISEASES.reduce(
    (t, d) => t.replace(new RegExp(d.pattern.source, 'gi'), m => ' '.repeat(m.length)),
    text,
  );
}
