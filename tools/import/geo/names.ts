import { normName } from '../names';

/* Place names from event titles: "Battle of X", "Schlacht bei X", "X Muharebesi", "X之战", in the languages TAKIP indexes. */

/** A Wikipedia title without its qualifier: "Hastings, East Sussex" and "Hastings (Michigan)" are both "Hastings". */
export function titleBase(title: string): { base: string; qualified: boolean } {
  const t = title.replace(/_/g, ' ').trim();
  const paren = t.match(/^(.+?)\s*[(（][^()（）]*[)）]$/);
  if (paren) return { base: paren[1], qualified: true };
  const comma = t.match(/^([^,，]+?)\s*[,，]\s*\S.*$/);
  if (comma) return { base: comma[1], qualified: true };
  return { base: t, qualified: false };
}

/** What the pattern says about the place: a river, mountain, cape or pass narrows the feature types to look for. */
export type Hint = 'river' | 'mountain' | 'cape' | 'pass' | 'island' | 'sea' | 'lake' | 'bay' | 'fort' | null;

export type NameMatch = {
  name: string;
  /** Normalised spellings to look up; inflected languages add likely nominatives. */
  norms: string[];
  /** Language whose names the match should be looked up in first ('' when unknown). */
  lang: string;
  hint: Hint;
  /** The pattern's head word, for the benchmark's per-pattern table: battle, siege, treaty, massacre, attack… */
  head: string;
  /** Inflected-language guess: needs a name in that language to count. */
  inflected: boolean;
};

const ORD = String.raw`(?:(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th))\s+)?`;
const EN_HEADS = [
  'naval battle', 'air battle', 'battle', 'battles', 'siege', 'sieges', 'blockade', 'bombardment', 'bombing', 'bombings', 'fall', 'sack', 'capture', 'storming',
  'relief', 'defence', 'defense', 'liberation', 'occupation', 'burning', 'destruction', 'massacre', 'massacres', 'raid', 'raids', 'attack', 'attacks',
  'assault', 'skirmish', 'action', 'engagement', 'combat', 'affair', 'treaty', 'treaties', 'peace', 'convention', 'congress', 'truce', 'armistice',
  'capitulation', 'surrender', 'pogrom', 'shelling', 'encirclement', 'investment', 'rout', 'ambush', 'landing', 'landings', 'crossing', 'evacuation',
  'uprising', 'revolt', 'rebellion', 'riot', 'riots', 'mutiny', 'conquest', 'recapture', 'expulsion', 'deportation', 'pacification', 'agreement',
  'accord', 'accords', 'declaration', 'protocol', 'edict', 'diet', 'council', 'conference', 'treaty of peace', 'peace treaty', 'shootout', 'firefight',
  'clash', 'clashes', 'incident', 'explosion', 'bombardments', 'seizure', 'takeover', 'stand', 'charge', 'sinking', 'scuttling', 'coup',
];
const EN_PREP = String.raw`(?:of|at|on|for|near|in|off|over|around|outside|by|before|upon|to)`;
const EN_SUFFIX = [
  'massacre', 'massacres', 'pogrom', 'pogroms', 'bombing', 'bombings', 'attack', 'attacks', 'shooting', 'shootings', 'explosion', 'explosions',
  'riot', 'riots', 'uprising', 'revolt', 'rebellion', 'incident', 'affair', 'killings', 'raid', 'ambush', 'siege', 'offensive', 'disaster',
  'tragedy', 'airstrike', 'airstrikes', 'air raid', 'air strike', 'hostage crisis', 'insurrection', 'mutiny', 'treaty', 'accord', 'accords',
  'agreement', 'protocol', 'declaration', 'conference', 'convention', 'coup', 'coup d\'état', 'putsch', 'strike', 'fire', 'blast', 'standoff',
  'skirmish', 'engagement', 'operation', 'landing', 'landings', 'campaign', 'crisis', 'clash', 'clashes', 'stampede', 'hijacking',
];

type Rule = { lang: string; re: RegExp; head: (m: RegExpMatchArray) => string; inflected?: boolean };

const alt = (xs: string[]) => xs.sort((a, b) => b.length - a.length).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const prefixRule = (lang: string, heads: string[], prep: string, inflected = false): Rule => ({
  lang,
  re: new RegExp(String.raw`^${lang === 'en' ? ORD : ''}(${alt(heads)})\s+(${prep})\s*(.+)$`, 'iu'),
  head: m => m[1].toLowerCase(),
  inflected,
});
const suffixRule = (lang: string, heads: string[], sep = String.raw`\s+`, inflected = false): Rule => ({
  lang,
  re: new RegExp(String.raw`^(.+?)${sep}(${alt(heads)})$`, 'iu'),
  head: m => m[2].toLowerCase(),
  inflected,
});

/** Head word, then the place; captured place is the last group. */
const RULES: Rule[] = [
  prefixRule('en', EN_HEADS, `${EN_PREP}\\s+(?:the\\s+)?`),
  prefixRule('de', ['Schlacht', 'Seeschlacht', 'Belagerung', 'Gefecht', 'Erstürmung', 'Eroberung', 'Einnahme', 'Fall', 'Massaker', 'Frieden', 'Friede', 'Vertrag', 'Bombardierung', 'Bombardement', 'Luftangriff', 'Luftangriffe', 'Zerstörung', 'Pogrom', 'Aufstand', 'Sturm', 'Kampf', 'Schlachten', 'Blutbad', 'Kapitulation', 'Waffenstillstand', 'Reichstag', 'Konzil', 'Kongress', 'Entsatz', 'Anschlag', 'Anschläge', 'Brand', 'Explosion', 'Überfall', 'Plünderung', 'Treffen'],
    String.raw`(?:bei|von|vom|um|am|an\s+der|an\s+den|an\s+dem|im|in|auf|zu|zum|zur|vor|nahe|gegen)\s+(?:der\s+|dem\s+|den\s+|die\s+)?`),
  prefixRule('fr', ['Bataille', 'Batailles', 'Siège', 'Sièges', 'Combat', 'Combats', 'Prise', 'Sac', 'Chute', 'Massacre', 'Massacres', 'Traité', 'Paix', 'Bombardement', 'Bombardements', 'Blocus', 'Capitulation', 'Convention', 'Libération', 'Défense', 'Raid', 'Attaque', 'Attentat', 'Attentats', 'Incendie', 'Destruction', 'Révolte', 'Insurrection', 'Émeute', 'Émeutes', 'Pogrom', 'Tuerie', 'Fusillade', 'Conférence', 'Congrès', 'Journée', 'Affaire', 'Expédition', 'Débarquement', 'Escarmouche', 'Accords', 'Accord', 'Édit', 'Concile', 'Sièges', 'Rafle', 'Explosion', 'Naufrage', 'Reddition', 'Occupation'],
    String.raw`(?:de\s+la\s+|de\s+l['’]|des\s+|du\s+|de\s+|d['’]|à\s+la\s+|à\s+l['’]|au\s+|aux\s+|à\s+|sur\s+|près\s+de\s+|devant\s+|en\s+)`),
  prefixRule('es', ['Batalla', 'Batallas', 'Sitio', 'Asedio', 'Combate', 'Toma', 'Saqueo', 'Caída', 'Masacre', 'Matanza', 'Tratado', 'Paz', 'Bombardeo', 'Bloqueo', 'Capitulación', 'Defensa', 'Liberación', 'Ataque', 'Atentado', 'Atentados', 'Incendio', 'Destrucción', 'Revuelta', 'Rebelión', 'Motín', 'Levantamiento', 'Conquista', 'Rendición', 'Acción', 'Desembarco', 'Sublevación', 'Asalto', 'Masacres', 'Concilio', 'Acuerdo', 'Acuerdos', 'Explosión', 'Hundimiento', 'Convención', 'Pacto'],
    String.raw`(?:de\s+la\s+|del\s+|de\s+los\s+|de\s+las\s+|de\s+|en\s+(?:el\s+|la\s+)?|a\s+|al\s+)`),
  prefixRule('ca', ['Batalla', 'Setge', 'Combat', 'Presa', 'Saqueig', 'Massacre', 'Tractat', 'Pau', 'Bombardeig', 'Atemptat', 'Conquesta'],
    String.raw`(?:de\s+la\s+|del\s+|dels\s+|de\s+les\s+|de\s+|d['’]|a\s+)`),
  prefixRule('it', ['Battaglia', 'Battaglie', 'Assedio', 'Combattimento', 'Presa', 'Sacco', 'Caduta', 'Strage', 'Eccidio', 'Massacro', 'Trattato', 'Pace', 'Bombardamento', 'Bombardamenti', 'Blocco', 'Capitolazione', 'Difesa', 'Liberazione', 'Attacco', 'Attentato', 'Incendio', 'Distruzione', 'Rivolta', 'Insurrezione', 'Conquista', 'Resa', 'Scontro', 'Fatto d\'arme', 'Concilio', 'Dieta', 'Congresso', 'Convenzione', 'Armistizio', 'Sbarco', 'Esplosione', 'Naufragio', 'Rastrellamento', 'Rappresaglia', 'Pogrom', 'Moti', 'Sommossa'],
    String.raw`(?:del\s+|della\s+|dello\s+|dei\s+|degli\s+|delle\s+|di\s+|d['’]|a\s+|al\s+|alla\s+|ad\s+|presso\s+|in\s+|nel\s+|nella\s+|sul\s+|sulla\s+|su\s+)`),
  prefixRule('pt', ['Batalha', 'Batalhas', 'Cerco', 'Sítio', 'Combate', 'Tomada', 'Saque', 'Queda', 'Massacre', 'Chacina', 'Tratado', 'Paz', 'Bombardeio', 'Bombardeamento', 'Bloqueio', 'Capitulação', 'Defesa', 'Libertação', 'Ataque', 'Atentado', 'Incêndio', 'Destruição', 'Revolta', 'Rebelião', 'Conquista', 'Rendição', 'Invasão', 'Levante', 'Motim', 'Concílio', 'Acordo', 'Convenção', 'Explosão', 'Naufrágio'],
    String.raw`(?:da\s+|do\s+|das\s+|dos\s+|de\s+|em\s+|no\s+|na\s+|a\s+|ao\s+)`),
  prefixRule('nl', ['Slag', 'Zeeslag', 'Beleg', 'Belegering', 'Inname', 'Val', 'Bloedbad', 'Vrede', 'Verdrag', 'Bombardement', 'Bestorming', 'Verovering', 'Ontzet', 'Aanslag', 'Moord', 'Opstand', 'Ramp'],
    String.raw`(?:bij|om|van|op|aan|in|te|nabij|voor)\s+(?:de\s+|het\s+)?`),
  prefixRule('sv', ['Slaget', 'Sjöslaget', 'Belägringen', 'Freden', 'Fördraget', 'Massakern', 'Stormningen', 'Erövringen', 'Bombningen', 'Branden', 'Attentatet', 'Upproret', 'Fälttåget', 'Striden', 'Striderna', 'Intagandet', 'Plundringen'],
    String.raw`(?:vid|om|av|i|på|över|mot|nära|utanför)\s+`),
  prefixRule('pl', ['Bitwa', 'Bitwy', 'Oblężenie', 'Obrona', 'Zdobycie', 'Masakra', 'Rzeź', 'Pokój', 'Traktat', 'Bombardowanie', 'Szturm', 'Bój', 'Potyczka', 'Pogrom', 'Powstanie', 'Zbrodnia', 'Zamach', 'Bitwa morska', 'Mord', 'Rozejm', 'Upadek', 'Sejm', 'Zjazd', 'Pacyfikacja', 'Spalenie', 'Wysadzenie', 'Bombardowania', 'Natarcie', 'Oblężenia', 'Bitwy morskie', 'Wyzwolenie', 'Kapitulacja', 'Katastrofa', 'Zajęcie', 'Konfederacja', 'Unia', 'Układ', 'Bitwa powietrzna'],
    String.raw`(?:pod\s+|o\s+|nad\s+|w\s+|we\s+|na\s+|przy\s+|u\s+|z\s+|koło\s+|między\s+|)`, true),
  prefixRule('ru', ['Битва', 'Сражение', 'Бой', 'Бои', 'Осада', 'Оборона', 'Штурм', 'Взятие', 'Резня', 'Погром', 'Мир', 'Договор', 'Бомбардировка', 'Блокада', 'Морское сражение', 'Разгром', 'Расстрел', 'Восстание', 'Падение', 'Сражения', 'Битвы', 'Осады', 'Теракт', 'Взрыв', 'Захват', 'Нападение', 'Трагедия', 'Массовое убийство', 'Убийство', 'Катастрофа', 'Капитуляция', 'Перемирие', 'Уния', 'Собор', 'Съезд', 'Конференция', 'Освобождение', 'Высадка', 'Набег', 'Поход', 'Сожжение', 'Разорение', 'Бомбардировки', 'Мятеж', 'Бунт'],
    String.raw`(?:при\s+|под\s+|у\s+|за\s+|на\s+|в\s+|во\s+|около\s+|возле\s+|близ\s+|над\s+|)`, true),
  prefixRule('uk', ['Битва', 'Бій', 'Бої', 'Облога', 'Оборона', 'Штурм', 'Взяття', 'Різанина', 'Погром', 'Мир', 'Договір', 'Бомбардування', 'Блокада', 'Повстання', 'Падіння', 'Теракт', 'Вибух', 'Захоплення', 'Напад', 'Трагедія', 'Масове вбивство', 'Звільнення', 'Розгром', 'Похід', 'Перемир\'я', 'Угода', 'Унія', 'Розстріл'],
    String.raw`(?:під\s+|при\s+|біля\s+|за\s+|на\s+|в\s+|у\s+|коло\s+|поблизу\s+|над\s+|)`, true),
  prefixRule('be', ['Бітва', 'Бой', 'Аблога', 'Абарона', 'Штурм', 'Узяцце', 'Пагром', 'Мір', 'Дагавор', 'Разня'],
    String.raw`(?:пры\s+|пад\s+|ля\s+|за\s+|на\s+|у\s+|каля\s+|)`, true),
  prefixRule('bg', ['Битка', 'Битката', 'Обсада', 'Обсадата', 'Клане', 'Клането', 'Договор', 'Сражение', 'Сражението', 'Мир', 'Превземане', 'Превземането', 'Бомбардировка', 'Въстание', 'Атентат', 'Падане'],
    String.raw`(?:при\s+|за\s+|край\s+|до\s+|на\s+|в\s+|във\s+|от\s+|)`, true),
  prefixRule('sr', ['Битка', 'Опсада', 'Масакр', 'Покољ', 'Мир', 'Уговор', 'Бој', 'Напад', 'Бомбардовање', 'Устанак', 'Пад', 'Злочин', 'Битка', 'Ослобођење'],
    String.raw`(?:код\s+|на\s+|за\s+|у\s+|под\s+|)`, true),
  prefixRule('sh', ['Bitka', 'Opsada', 'Masakr', 'Pokolj', 'Mir', 'Ugovor', 'Napad', 'Bombardovanje', 'Ustanak', 'Pad', 'Zločin', 'Oslobođenje'],
    String.raw`(?:kod\s+|na\s+|za\s+|u\s+|pod\s+|)`, true),
  prefixRule('cs', ['Bitva', 'Obléhání', 'Obležení', 'Dobytí', 'Masakr', 'Mír', 'Smlouva', 'Bombardování', 'Bitvy', 'Vypálení', 'Povstání', 'Útok', 'Pád', 'Osvobození', 'Námořní bitva', 'Pogrom', 'Vyhlazení', 'Tragédie'],
    String.raw`(?:u\s+|o\s+|na\s+|v\s+|ve\s+|pod\s+|při\s+|nad\s+|za\s+|)`, true),
  prefixRule('sk', ['Bitka', 'Obliehanie', 'Dobytie', 'Masaker', 'Mier', 'Zmluva', 'Bombardovanie'],
    String.raw`(?:pri\s+|o\s+|na\s+|v\s+|vo\s+|pod\s+|u\s+|)`, true),
  prefixRule('ro', ['Bătălia', 'Asediul', 'Asedierea', 'Masacrul', 'Tratatul', 'Pacea', 'Bombardamentul', 'Bombardarea', 'Cucerirea', 'Căderea', 'Lupta', 'Luptele', 'Răscoala', 'Atacul', 'Atentatul', 'Pogromul', 'Eliberarea', 'Capitularea', 'Armistițiul', 'Convenția', 'Incendiul'],
    String.raw`(?:de\s+la\s+|de\s+lângă\s+|de\s+pe\s+|din\s+|de\s+|pentru\s+|asupra\s+|)`, true),
  prefixRule('el', ['Μάχη', 'Μάχες', 'Πολιορκία', 'Σφαγή', 'Συνθήκη', 'Άλωση', 'Ναυμαχία', 'Ειρήνη', 'Βομβαρδισμός', 'Εξέγερση', 'Καταστροφή', 'Πυρπόληση', 'Ολοκαύτωμα', 'Επίθεση', 'Πτώση', 'Απελευθέρωση', 'Κατάληψη'],
    String.raw`(?:της\s+|του\s+|των\s+|στο\s+|στη\s+|στην\s+|στον\s+|στα\s+|στις\s+|στους\s+|)`, true),
  prefixRule('id', ['Pertempuran', 'Pengepungan', 'Pembantaian', 'Perjanjian', 'Serangan', 'Pengeboman', 'Penyerbuan', 'Jatuhnya', 'Pembebasan', 'Perang', 'Insiden', 'Peristiwa', 'Pemberontakan', 'Kerusuhan', 'Penyerangan', 'Pendaratan', 'Ledakan', 'Tragedi', 'Pertempuran laut', 'Pertempuran Laut', 'Penaklukan'],
    String.raw`(?:di\s+|ke\s+|)`),
  prefixRule('vi', ['Trận', 'Trận chiến', 'Chiến dịch', 'Thảm sát', 'Hiệp ước', 'Hòa ước', 'Cuộc vây hãm', 'Vây hãm', 'Hải chiến', 'Đánh chiếm', 'Đánh bom', 'Khởi nghĩa', 'Thất thủ', 'Trận đánh', 'Cuộc bao vây', 'Bao vây', 'Vụ thảm sát', 'Vụ đánh bom', 'Sự kiện', 'Hội nghị', 'Hiệp định', 'Biến cố', 'Trận vây hãm', 'Cuộc tấn công', 'Tấn công', 'Giải phóng'],
    String.raw`(?:tại\s+|ở\s+|)`),
  prefixRule('ar', ['معركة', 'معارك', 'حصار', 'مذبحة', 'مجزرة', 'معاهدة', 'اتفاقية', 'صلح', 'سقوط', 'فتح', 'غزوة', 'موقعة', 'قصف', 'تفجير', 'تفجيرات', 'هجوم', 'حريق', 'اقتحام', 'احتلال', 'تحرير', 'حادثة', 'واقعة', 'مؤتمر', 'وقعة', 'انتفاضة', 'ثورة', 'مجازر', 'حملة', 'غارة', 'كارثة', 'إنزال', 'استسلام', 'هدنة', 'نكبة'],
    String.raw`(?:في\s+|على\s+|قرب\s+|عند\s+|)`),
  prefixRule('fa', ['نبرد', 'جنگ', 'محاصره', 'کشتار', 'قتل‌عام', 'قتل عام', 'عهدنامه', 'پیمان', 'معاهده', 'فتح', 'سقوط', 'بمباران', 'حمله به', 'تسخیر', 'حمله', 'انفجار', 'شورش', 'قیام', 'واقعه', 'فاجعه', 'آزادسازی', 'نبردهای', 'محاصرهٔ', 'نبرد دریایی', 'کنفرانس', 'قرارداد'],
    String.raw`(?:در\s+|)`),
  prefixRule('he', ['קרב', 'קרבות', 'המצור על', 'מצור', 'טבח', 'הטבח ב', 'הסכם', 'חוזה', 'כיבוש', 'נפילת', 'הפצצת', 'פיגוע', 'הפיגוע ב', 'פרעות', 'מרד', 'שחרור', 'אסון', 'ועידת', 'פוגרום', 'שריפת', 'הפגזת', 'מתקפה על', 'פשיטה על', 'כיבוש'],
    String.raw`(?:ב|על\s+|ליד\s+|)`),
  prefixRule('tr', ['Muharebe', 'Kuşatma'], String.raw`(?:)`),
  suffixRule('tr', ['Muharebesi', 'Meydan Muharebesi', 'Deniz Muharebesi', 'Savaşı', 'Kuşatması', 'Muhasarası', 'Katliamı', 'Katliamları', 'Antlaşması', 'Andlaşması', 'Anlaşması', 'Barışı', 'Baskını', 'Bombalaması', 'Saldırısı', 'Saldırıları', 'Ayaklanması', 'İsyanı', 'Çarpışması', 'Fethi', 'Muharebeleri', 'Bozgunu', 'Zaferi', 'Olayları', 'Olayı', 'Pogromu', 'Kırımı', 'Yangını', 'Patlaması', 'Konferansı', 'Kongresi', 'Mütarekesi', 'Ateşkesi', 'Protokolü', 'Çıkarması', 'Harekâtı', 'Harekatı', 'Direnişi', 'Savunması', 'Kurtuluşu', 'Düşüşü', 'Bombardımanı', 'Taarruzu', 'Hücumu', 'Vakası', 'Faciası', 'Darbesi', 'Suikastı', 'Ayaklanmaları', 'Çatışması', 'Çatışmaları', 'Muharebesi (1)']),
  suffixRule('az', ['döyüşü', 'döyüşləri', 'mühasirəsi', 'qırğını', 'soyqırımı', 'müqaviləsi', 'sülhü', 'vuruşması', 'müharibəsi', 'faciəsi', 'üsyanı', 'hücumu', 'işğalı', 'azad edilməsi', 'terror aktı', 'partlayışı']),
  suffixRule('hu', ['csata', 'ostrom', 'ostroma', 'vérengzés', 'mészárlás', 'béke', 'békeszerződés', 'szerződés', 'ütközet', 'csaták', 'tűzvész', 'merénylet', 'felkelés', 'pogrom', 'bombázás', 'bombázása', 'diadal', 'vereség', 'ostromai', 'elfoglalása', 'eleste', 'csatája', 'tengeri csata', 'országgyűlés', 'zsinat']),
  suffixRule('hy', ['ճակատամարտ', 'ճակատամարտը', 'պաշարում', 'պաշարումը', 'կոտորած', 'կոտորածը', 'պայմանագիր', 'պայմանագիրը', 'ջարդ', 'ջարդերը', 'ապստամբություն'], String.raw`ի?\s+`, true),
  suffixRule('fi', ['taistelu', 'piiritys', 'verilöyly', 'rauha', 'rauhansopimus', 'meritaistelu', 'joukkomurha', 'valtaus', 'pommitus', 'kapina'], String.raw`(?::n|n)?\s+`, true),
  suffixRule('et', ['lahing', 'piiramine', 'veresaun', 'rahu', 'rahuleping'], String.raw`(?:i|a|u)?\s+`, true),
  suffixRule('lt', ['mūšis', 'apgultis', 'žudynės', 'taika', 'sutartis'], String.raw`(?:o|os|ų|io|ės)?\s+`, true),
  suffixRule('lv', ['kauja', 'aplenkums', 'slaktiņš', 'miers', 'līgums'], String.raw`(?:as|es|s)?\s+`, true),
  suffixRule('ko', ['전투', '해전', '공방전', '포위전', '학살', '조약', '사건', '폭격', '공습', '전쟁', '의 전투', '포위', '대학살', '봉기', '테러', '전역', '회전', '참사', '함락', '점령', '침공', '조약', '협정', '회담', '폭동', '항쟁', '민중항쟁', '의거', '해전', '상륙작전', '폭발 사고', '총격 사건', '테러 사건', '봉쇄'], String.raw`\s*`),
  suffixRule('ja', ['の戦い', 'の戦', 'の合戦', '合戦', '攻囲戦', '包囲戦', '攻防戦', 'の虐殺', '虐殺', '虐殺事件', '事件', '条約', 'の和約', '和約', '海戦', '会戦', 'の乱', 'の変', '空襲', 'の陣', '攻略戦', '上陸作戦', 'の役', '爆破事件', 'テロ事件', 'の包囲', '攻城戦', 'の戦闘', '戦闘', '大虐殺', 'の惨劇', '惨事', '暴動', '一揆', '城の戦い', '沖海戦', '沖の海戦', '沖海空戦', '大空襲', '爆撃', '襲撃事件', '銃乱射事件', '会議', '講和条約', '協定', '包囲', '陥落', '占領', '侵攻', '撤退戦', '防衛戦', '奪還作戦', '攻勢', '戦役'], String.raw`\s*`),
  suffixRule('zh', ['之战', '之戰', '战役', '戰役', '之役', '会战', '會戰', '海战', '海戰', '大屠杀', '大屠殺', '屠杀', '屠殺', '惨案', '慘案', '条约', '條約', '和约', '和約', '围城战', '圍城戰', '攻防战', '攻防戰', '保卫战', '保衛戰', '起义', '起義', '暴动', '暴動', '事件', '空袭', '空襲', '围攻', '圍攻', '之围', '之圍', '爆炸案', '袭击', '襲擊', '战斗', '戰鬥', '攻城战', '攻城戰', '围城', '圍城', '包围战', '包圍戰', '大轰炸', '大轟炸', '轰炸', '轟炸', '陷落', '失守', '会议', '會議', '协定', '協定', '血案', '暴乱', '暴亂', '之乱', '之亂', '之变', '之變', '登陆战', '登陸戰', '攻略战', '攻略戰', '沦陷', '淪陷', '大捷', '战', '戰', '之战役'], String.raw`\s*`),
  suffixRule('hi', ['का युद्ध', 'की लड़ाई', 'की घेराबंदी', 'का नरसंहार', 'हत्याकांड', 'नरसंहार', 'की संधि', 'का घेरा', 'युद्ध', 'की लडाई', 'का विद्रोह', 'विद्रोह', 'बम विस्फोट', 'दंगे', 'आतंकवादी हमला', 'हमला', 'आक्रमण']),
];

/** English "X massacre", "2008 Mumbai attacks": the place is the capitalised run just before the head word. */
const EN_SUFFIX_RE = new RegExp(String.raw`^(.+?)\s+(${alt(EN_SUFFIX)})$`, 'iu');

const HINTS: [RegExp, Hint, string][] = [
  [/^(?:the\s+)?(.+?)\s+(?:river|creek|brook|run)$/iu, 'river', '$1'],
  [/^(?:the\s+)?river\s+(.+)$/iu, 'river', '$1'],
  [/^(?:mount|mt\.?|monte|mont|mons)\s+(.+)$/iu, 'mountain', '$1'],
  [/^(.+?)\s+(?:hill|hills|mountain|mountains|ridge|heights|peak)$/iu, 'mountain', '$1'],
  [/^(?:cape|cap|cabo|capo)\s+(.+)$/iu, 'cape', '$1'],
  [/^(.+?)\s+(?:pass|gap|gorge|defile)$/iu, 'pass', '$1'],
  [/^(?:lake|lac|lago)\s+(.+)$/iu, 'lake', '$1'],
  [/^(.+?)\s+(?:bay|gulf|sound|strait|straits|channel|bight|harbou?r|roads)$/iu, 'bay', '$1'],
  [/^(?:the\s+)?(?:bay|gulf|strait|straits)\s+of\s+(.+)$/iu, 'bay', '$1'],
  [/^(.+?)\s+(?:island|islands|isle)$/iu, 'island', '$1'],
  [/^(?:fort|fortress|castle)\s+(.+)$/iu, 'fort', '$1'],
  [/^(.+?)\s+(?:fort|castle|fortress)$/iu, 'fort', '$1'],
];

const YEAR = /(?:^|\s)(?:\(?\d{1,4}(?:\s*(?:BC|BCE|AD|CE|v\.?\s*Chr\.?|av\.?\s*J\.?-?C\.?|a\.?\s*C\.?|до\s*н\.?\s*э\.?))?\)?)(?=$|\s)/giu;

/** Strips years, a trailing "(1805)" or ", Ohio" kept apart as a context name, ordinals and "the". */
export function cleanPlace(raw: string): { name: string; context: string | null } {
  let s = raw.replace(/\s*[(（][^()（）]*[)）]\s*/g, ' ').replace(/[«»"“”„]/g, '').trim();
  let context: string | null = null;
  const comma = s.match(/^([^,]+),\s*(.+)$/);
  if (comma) {
    s = comma[1];
    context = comma[2].replace(YEAR, ' ').trim() || null;
  }
  s = s.replace(YEAR, ' ').replace(/^the\s+/iu, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/[.:;'’-]+$/u, '');
  return { name: s, context };
}

/** Likely nominatives of a Slavic, Greek or Romanian oblique form, word by word ("под Полтавой" → "полтава"). */
export function nominatives(norm: string, lang: string): string[] {
  const words = norm.split(' ');
  if (words.length > 3) return [norm];
  const opts = words.map(w => wordForms(w, lang));
  let out = [''];
  for (const o of opts) out = out.flatMap(p => o.map(w => (p ? `${p} ${w}` : w))).slice(0, 40);
  return [...new Set([norm, ...out])];
}

// Endings as normName leaves them: й → и, ё → е, ą → a, ů → u.
const CYR: [RegExp, string[]][] = [
  [/ого$/, ['ое', 'ии', 'ыи', 'о']], [/его$/, ['ее', 'ии']], [/ои$/, ['а', 'ая', 'ои', 'ыи', 'о']], [/еи$/, ['я', 'ь', 'еи', 'а']], [/ою$/, ['а']], [/ею$/, ['я', 'ь']],
  [/ом$/, ['', 'о', 'а']], [/ем$/, ['ь', 'е', 'и', '']], [/ами$/, ['ы', 'и']], [/ями$/, ['и']], [/ах$/, ['ы', 'и', 'а']], [/ях$/, ['и', 'я']],
  [/ии$/, ['ия', 'ии', 'ь']], [/ие$/, ['ия', 'ие']], [/ье$/, ['ье', 'ья']], [/е$/, ['', 'а', 'о', 'я', 'ь', 'е']], [/и$/, ['ь', 'я', 'и', 'ы', '', 'а']],
  [/ы$/, ['а', 'ы', '']], [/а$/, ['', 'о', 'а', 'ь']], [/я$/, ['ь', 'и', 'е', 'я', 'ии']], [/у$/, ['', 'а', 'у']], [/ю$/, ['я', 'ь', 'и']], [/ов$/, ['ы', 'ов', '']], [/ев$/, ['и', 'ев', 'ы']],
];
const PL: [RegExp, string[]][] = [
  [/iem$/, ['', 'ie']], [/em$/, ['', 'o']], [/ami$/, ['y', 'e', 'i']], [/ach$/, ['y', 'e', 'i']], [/ów$/, ['y', 'i', 'e']], [/iu$/, ['', 'ie']],
  [/ie$/, ['a', '', 'o', 'e']], [/y$/, ['a', 'y', 'e', '']], [/u$/, ['', 'o']], [/a$/, ['', 'o', 'a']], [/i$/, ['a', 'e', 'i', '']], [/ego$/, ['y', 'i']], [/ej$/, ['a']], [/e$/, ['a', 'e', '']],
];
const CS: [RegExp, string[]][] = [
  [/eho$/, ['y', 'e']], [/em$/, ['', 'o']], [/ou$/, ['a']], [/ami$/, ['y', 'e']], [/ach$/, ['y', 'e']], [/u$/, ['', 'a', 'o', 'y']], [/a$/, ['', 'o']], [/y$/, ['a', 'y', 'e']],
  [/e$/, ['a', 'e', '']], [/i$/, ['', 'a', 'e']],
];
const EL: [RegExp, string[]][] = [[/ου$/, ['ος', 'ο', 'ου', 'ον']], [/ας$/, ['α', 'ας']], [/ης$/, ['η', 'ης']], [/ων$/, ['α', 'ες', 'οι']], [/ς$/, ['', 'ς']], [/ν$/, ['', 'ν']]];
const RO: [RegExp, string[]][] = [[/ului$/, ['', 'ul']], [/ei$/, ['a', 'ea']], [/ii$/, ['ia']], [/lor$/, ['i', 'e']]];

function wordForms(w: string, lang: string): string[] {
  const table = ['ru', 'uk', 'be', 'bg', 'sr'].includes(lang) ? CYR : lang === 'pl' ? PL : lang === 'cs' || lang === 'sk' || lang === 'sh' ? CS : lang === 'el' ? EL : lang === 'ro' ? RO : lang === 'hy' ? [] : null;
  if (!table || w.length < 4) return [w];
  for (const [re, ends] of table) if (re.test(w)) return [...new Set([w, ...ends.map(e => w.replace(re, e))])].filter(x => x.length >= 3);
  return [w];
}

/** The feature word a name carries, and the name without it as a second spelling ("Bunker Hill" is a hill's whole name). */
function withHint(name: string): { bare: string | null; hint: Hint } {
  for (const [re, hint, rep] of HINTS) if (re.test(name)) return { bare: name.replace(re, rep).trim(), hint };
  return { bare: null, hint: null };
}

const STOP = new Set([
  'the', 'world', 'war', 'wars', 'first', 'second', 'great', 'battle', 'siege', 'operation', 'new', 'north', 'south', 'east', 'west', 'central', 'national',
  'international', 'civil', 'revolution', 'independence', 'peace', 'liberation', 'army', 'forces', 'front', 'line', 'campaign', 'offensive', 'hill', 'river',
  'mountain', 'island', 'bay', 'cape', 'fort', 'castle', 'bridge', 'ford', 'field', 'farm', 'wood', 'woods', 'creek', 'station', 'pass', 'lake', 'harbor',
  'harbour', 'point', 'camp', 'valley', 'ridge', 'plain', 'plains', 'heights', 'sea', 'ocean', 'city', 'town', 'village', 'capital', 'empire', 'kingdom',
]);

/** Words that say the "place" in an English title is not one: "Bombing of Pan Am Flight 103", "Massacre of the Innocents". */
const NOT_PLACE = /\b(?:flight|ship|hms|uss|ss|rms|sms|hmas|hmcs|train|bus|embassy|consulate|airliner|innocents|jews|christians|muslims|armenians|greeks|serbs|poles|prisoners|hostages|family|king|queen|emperor|president|general|tsar|sultan|shah|pope|sir|brigade|regiment|division|army|corps|fleet|squadron|friendship|commerce|navigation|alliance|cooperation|non-aggression|neutrality|guarantee|accession|extradition|amity|trade|mutual|establishment|limitation|reduction|prohibition|partnership|arbitration|boundary|boundaries|union|rights|nations|league|convoy)\b/iu;

/** The first capitalised run (≤ 4 words), from the end for suffix titles: "2008 Mumbai attacks" → "Mumbai". */
function capitalRun(s: string, fromEnd: boolean): string | null {
  const words = s.split(/\s+/).filter(Boolean);
  const isCap = (w: string) => /^[\p{Lu}]/u.test(w) || /^(?:de|del|la|le|di|da|do|van|von|al|el|upon|on|en|sur|am|im|an|der|of)$/u.test(w);
  if (fromEnd) {
    while (words.length > 1 && !/^[\p{Lu}]/u.test(words[words.length - 1]) && /^[\p{Lu}]/u.test(words[0])) words.pop();
    let i = words.length;
    while (i > 0 && isCap(words[i - 1]) && words.length - i < 4) i--;
    const run = words.slice(i);
    while (run.length && !/^[\p{Lu}]/u.test(run[0])) run.shift();
    return run.length ? run.join(' ') : null;
  }
  const run: string[] = [];
  for (const w of words) {
    if (!isCap(w) || run.length >= 4) break;
    run.push(w);
  }
  while (run.length && !/^[\p{Lu}]/u.test(run[run.length - 1])) run.pop();
  return run.length ? run.join(' ') : null;
}

function emit(out: NameMatch[], raw: string, lang: string, head: string, inflected: boolean) {
  const { name: cleaned, context } = cleanPlace(raw);
  if (!cleaned || cleaned.length < 2 || NOT_PLACE.test(cleaned)) return;
  const name = cleaned;
  const { bare, hint } = withHint(name);
  const norm = normName(name);
  if (!norm || STOP.has(norm) || /^\d+$/.test(norm)) return;
  const bareNorm = bare ? normName(bare) : '';
  const base = [norm, ...(bareNorm && !STOP.has(bareNorm) ? [bareNorm] : [])];
  const norms = inflected ? [...new Set(base.flatMap(n => nominatives(n, lang)))] : base;
  out.push({ name, norms, lang, hint, head, inflected });
  if (context) {
    const c = normName(context);
    if (c && !STOP.has(c)) out.push({ name: context, norms: [c], lang, hint: null, head: `${head}:context`, inflected: false });
  }
}

/** Splits "X and Y" / "X und Y" place lists only for treaty-like heads, where both are places. */
const AND = /\s+(?:and|und|et|y|e|i|и|та|og|och|en)\s+/iu;

/**
 * Place names a title names, best first. `lang` is the title's language when known; titles of unknown language
 * (Wikidata's fallback label) try every language's patterns. Patterns that capture a stretch of words keep only a
 * capitalised run, so "Battle of Hastings in 1066" gives "Hastings".
 */
export function placeNames(title: string, lang = ''): NameMatch[] {
  const t = title.replace(/\s+/g, ' ').replace(/\s*[(（][^()（）]*[)）]\s*$/, '').trim();
  const out: NameMatch[] = [];
  for (const rule of RULES) {
    if (lang && rule.lang !== lang && !(lang === 'sh' && rule.lang === 'sr')) continue;
    const m = t.match(rule.re);
    if (!m) continue;
    const head = rule.head(m);
    const suffix = rule.re.source.startsWith('^(.+?)');
    let rest = (suffix ? m[1] : m[m.length - 1]).trim();
    // "Siège de La Rochelle", "Batalla de El Alamein": a capitalised article the preposition swallowed is part of the name.
    const art = suffix ? null : m[2]?.match(/(?:^|\s)(La|Le|Les|L['’]|El|Los|Las|Il|Lo|Gli|Os|As|De|Den|Het|The)\s*$/u);
    if (art) rest = /['’]$/.test(art[1]) ? art[1] + rest : `${art[1]} ${rest}`;
    if (rule.lang === 'en' || rule.lang === 'de' || rule.lang === 'nl' || rule.lang === 'sv') {
      const run = capitalRun(rest, false);
      if (!run) continue;
      rest = run;
    }
    if (rule.lang === 'tr') rest = rest.replace(/['’](?:n?[ıiuü]n|n?[ıiuü]|d[ae]|t[ae])$/u, '');
    if (rule.lang === 'hu') rest = rest.replace(/i$/u, '');
    if (rule.lang === 'ar') {
      emit(out, rest, rule.lang, head, false);
      if (rest.startsWith('ال')) emit(out, rest.slice(2), rule.lang, head, false);
      continue;
    }
    if (rule.lang === 'zh') rest = rest.replace(/^第[一二三四五六七八九十]+次/u, '');
    const parts = /treat|peace|accord|agreement|traité|tratado|vertrag|frieden|paix|pace/iu.test(head) ? rest.split(AND) : [rest];
    for (const p of parts) emit(out, p, rule.lang, head, !!rule.inflected);
  }
  if (!lang || lang === 'en') {
    const m = t.match(EN_SUFFIX_RE);
    if (m) {
      const run = capitalRun(m[1].replace(YEAR, ' ').trim(), true);
      if (run) emit(out, run, 'en', m[2].toLowerCase(), false);
    }
  }
  const seen = new Set<string>();
  return out.filter(x => {
    const k = `${x.norms[0]}|${x.hint}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** English description places: "1879 battle near Novšiće, Montenegro" → Novšiće (context Montenegro). */
const DESC_RE = /\b(?:in|at|near|outside|off|around|on)\s+((?:[\p{Lu}][\p{L}'’.-]*)(?:\s+(?:de|del|la|le|di|da|upon|on|am|an|der|sur|en)?\s*[\p{Lu}][\p{L}'’.-]*){0,3})(?:,\s*((?:[\p{Lu}][\p{L}'’.-]*)(?:\s+[\p{Lu}][\p{L}'’.-]*){0,2}))?/gu;

export function descriptionPlaces(desc: string): NameMatch[] {
  const out: NameMatch[] = [];
  for (const m of desc.matchAll(DESC_RE)) {
    const name = m[1].trim();
    if (/^(?:World|War|Battle|Siege|The|Operation|First|Second|Great|Civil|Revolution|Wars|Campaign|January|February|March|April|May|June|July|August|September|October|November|December)\b/u.test(name)) continue;
    emit(out, m[2] ? `${name}, ${m[2]}` : name, 'en', 'description', false);
  }
  return out;
}
