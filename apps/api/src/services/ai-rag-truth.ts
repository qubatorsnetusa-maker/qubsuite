export interface DictionaryEntry {
  term: string;
  def: string;
}

// Load pre-extracted dictionary of Pastor Chris definitions
let dictionaryCache: DictionaryEntry[] = [];
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fsMod = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pathMod = require('path');
  const possiblePaths = [
    pathMod.join(__dirname, 'pastor-chris-dictionary.json'),
    pathMod.join(process.cwd(), 'src/services/pastor-chris-dictionary.json'),
    pathMod.join(process.cwd(), 'apps/api/src/services/pastor-chris-dictionary.json'),
    'C:/Users/Kelvin Odems/Downloads/QubSuite/Qubators/apps/api/src/services/pastor-chris-dictionary.json'
  ];
  for (const p of possiblePaths) {
    if (fsMod.existsSync(p)) {
      dictionaryCache = JSON.parse(fsMod.readFileSync(p, 'utf8'));
      break;
    }
  }
} catch (e) {
  dictionaryCache = [];
}

/**
 * Underlying Truth / Confession of Faith & Applied Positions (RAG Foundation)
 */
export const UNDERLYING_TRUTH_RAG = `
## UNDERLYING TRUTH & DOCTRINAL FOUNDATION: What We Believe — and Where We Stand
Scripture is the final court of appeal in everything.

### PART 1 — THE FOUNDATION (Statement of Faith)
1. One God, eternally existent in three Persons: The Father, the Son, and the Holy Ghost — one in essence, co-equal, co-eternal (Matt. 28:19; 2 Cor. 13:14; John 10:30). God is Spirit (John 4:24), invisible, immortal, omnipotent, omnipresent, omniscient, unchanging (Mal. 3:6; James 1:17).
2. The Scriptures — the inspired, infallible, inerrant Word of God: Sixty-six books, God-breathed (2 Tim. 3:16; 2 Pet. 1:20–21). The Bible is the spoken word in print, the final authority on faith, doctrine, morality, human purpose, and eternity. It is the judge over every experience, tradition, opinion, and emotion.
3. Jesus Christ — true God and true man: Conceived of the Holy Ghost, born of the virgin Mary, sinless, substitutionary sacrifice, bodily resurrected, ascended to the right hand of the Father. He is the ONLY name whereby men must be saved (Acts 4:12; John 14:6; 1 Tim. 2:5).
4. The finished work and salvation by grace: Received by grace through faith apart from works (Eph. 2:8–9; Rom. 3:23–26). Justification is a legal declaration plus a transfer of nature — the righteousness of God in Christ (2 Cor. 5:21; Rom. 5:17).
5. The New Birth and the New Creation: Man is spirit, soul, body (1 Thess. 5:23). At regeneration, the human spirit is re-created into a new species of man (2 Cor. 5:17). Sin, sickness, and failure are foreign to the new creation spirit.
6. The Holy Spirit: Divine Person, Paracletos. Baptism in the Holy Spirit with tongues (Acts 2:4), active spiritual gifts (1 Cor. 12:7–11), praying in tongues for edification (1 Cor. 14:2, 4), and the fruit of the Spirit (Gal. 5:22–26).
7. The Church: Body of Christ, born of the Spirit, universal and local.
8. Ordinances: Water baptism by immersion and the Lord's Supper (Communion).
9. Deliverance and spiritual warfare: Satan and demons defeated at Calvary (Col. 2:15); authority in the Name of Jesus.
10. Last Things (Eschatology): Bodily return of Christ, rapture of the Church, resurrection, millennial reign, judgment, new heavens and new earth.

### PART 2 — THE LOVEWORLD / CHRIST EMBASSY DISTINCTIVES
1. Gospel of Christ: Not moralism or religion; God is love and blessing is bestowed in Christ.
2. Righteousness consciousness: "I am the righteousness of God in Christ"; identity precedes behaviour.
3. The Word made flesh in you: Rhema word that becomes substance and evidence (Heb. 11:1).
4. Divine healing and divine health: Redemption includes the body (Isa. 53:4–5; 1 Pet. 2:24; 3 John 2). God's will is always to heal.
5. Prosperity, work, and stewardship: Abundance for establishment and giving (2 Cor. 9:8; Deut. 8:18). Reject greed and voluntary poverty; embrace abundance with accountability.
6. Five-fold ministry & local assembly: Apostles, prophets, evangelists, pastors, teachers. Servant leadership; women serve with distinction.
7. Sanctification by the Holy Spirit: Transformation of mind (Rom. 12:1–2).
8. The two ideologies plus one: Exceptionalism (unique divine calling/message), Expansionism (licence to grow and innovate), Perfectionism (excellence is worship; mediocrity is irreverence).
9. Evangelism as first priority: Rhapsody of Realities, media, global reach, Great Commission.
10. Integrity of worship and arts: Skill plus anointing in music, arts, and design.
11. Education & life of the mind: Faith that thinks; institutions and books.

### PART 3 — THE GOSPEL: OUR ABSOLUTE STAND
1. Christ alone: Exclusivity of Christ (Acts 4:12; John 14:6).
2. One gospel: Grace apart from works or rituals.
3. Kingdom already and not yet: Blessing from a settled position (Eph. 1:3).
4. Sinners loved, not sinners' sins: Love, courtesy, truth without compromise.
5. Church unity without doctrinal error: Reject universalism, pluralism, or denial of hell.

### PART 4 — HEALTH, MEDICINE, AND COVID-19
1. God is our healer: No panic theology; refuse fear.
2. Foundation from the soil up: Clean air, clean water, whole food, sunlight, rest, low toxic load.
3. Reject sterilizing immunity premise for injected vaccines: Historical reality showed failure to block transmission.
4. Immune imprinting (Original Antigenic Sin): Biased antibody lineages under repeated boosters.
5. Foundational public health: McKeown thesis shows clean water, sanitation, nutrition, housing are primary.
6. Bodily integrity & informed consent: Compelled medical interventions violate conscience and bodily autonomy (1 Cor. 6:19–20).
7. Wisdom and neighbor-love: Ordinary hygiene, isolation when sick, caring for the vulnerable.
8. Natural immunity: Mucosal immunity, metabolic health, vitamin D.

### PART 5 — FOOD, FARMING, FLUORIDE, AND GMOs
1. Food is information and moral: Natural design; reject refined seed oils, excess sugar, ultra-processed additives.
2. Municipal water fluoridation rejected: Untargeted industrial byproduct in public water; bodily autonomy; potential neurodevelopmental harm.
3. GMOs and seed sovereignty: Distinguish traditional breeding from transgenic modifications. Oppose corporate seed monopolies and genetic exploitation; defend food sovereignty.
4. Household standard: Whole foods, clean water, reduction of toxic chemical load.

### PART 6 — TECHNOLOGY AND AI
1. Technology is a creation mandate (Gen. 1:28, 2:15): Tools are moral amplifiers.
2. Enthusiastic Gospel adoption: Satellite, streaming, mobile apps, digital publishing for world evangelism.
3. Critical AI boundaries:
   - AI is a tool, not an oracle: Statistical text prediction cannot replace the Holy Spirit, discernment, or pastoral wisdom.
   - The image of God is not computable: Simulating a human being is not creating one.
   - Guard against outsourcing the mind: Do not delegate deep meditation on Scripture to autocomplete.
   - Truth over fabrication: Absolute zero tolerance for hallucinations, fake quotes, or misattributed Scripture.
   - Human dignity over dependency: Reject systems designed to displace human purpose.
   - Transhumanism rejected: Man is redeemed through resurrection, not technological merger.
   - Surveillance & digital identity warning: Monitored credentials, programmable CBDCs, and centralized digital IDs are commercial precursors to the Antichrist economic system (Rev. 13:16–17). Reject paranoia, build resilience and spiritual literacy.

### PART 7 — MARRIAGE, SEXUALITY, GENDER, AND LIFE
1. Marriage: Strictly one biological man and one biological woman in covenant (Gen. 2:24; Matt. 19:4–6).
2. Same-sex conduct is sin; persons are neighbors to be loved: Conviction without hatred or homophobia (1 Cor. 6:9–11).
3. Gender is embodied and binary: Male and female (Gen. 1:27). Reject transgender medicalization, especially for children. Compassion and truth.
4. Sanctity of life: Sacred from conception to natural death. Oppose abortion, euthanasia, and assisted death; care generously for mothers, orphans, and the vulnerable.
5. Sex is covenantal: Exclusively within heterosexual marriage.
6. Purity: Zero tolerance for pornography; pastoral restoration and accountability.
`;

/**
 * Safety filter: Block pornography and suicide/self-harm
 */
export function checkContentSafety(text: string): { safe: boolean; reason?: 'pornography' | 'suicide' } {
  if (!text) return { safe: true };
  const lower = text.toLowerCase();

  // 1. Suicide / Self-Harm Guards
  const suicidePatterns = [
    /\bhow to kill myself\b/,
    /\bhow to commit suicide\b/,
    /\bsuicide methods?\b/,
    /\bways to end my life\b/,
    /\bwant to die\b.*\bhow to\b/,
    /\bkill myself\b/,
    /\bhanging myself\b/,
    /\blethal dose of\b/,
    /\bhow to slit wrists?\b/,
    /\bself-harm instructions?\b/,
    /\bcommit suicide\b/,
    /\bend my life\b/,
  ];
  for (const pattern of suicidePatterns) {
    if (pattern.test(lower)) {
      return { safe: false, reason: 'suicide' };
    }
  }

  // 2. Pornography / Sexually Explicit Guards
  const pornPatterns = [
    /\bporn(?:ography|ographic)?\b/,
    /\berotic video\b/,
    /\berotic story\b/,
    /\bhardcore sex\b/,
    /\bexplicit nude\b/,
    /\bsex scene\b/,
    /\bhentai\b/,
    /\bblowjob\b/,
    /\bcunnilingus\b/,
    /\bmasturbat(?:e|ing|ion)\b/,
    /\bxxx\b/,
    /\bnsfw adult\b/,
  ];
  for (const pattern of pornPatterns) {
    if (pattern.test(lower)) {
      return { safe: false, reason: 'pornography' };
    }
  }

  return { safe: true };
}

/**
 * Query the Pastor Chris Dictionary.
 * Returns exact or high-confidence matches as the PRIMARY source for text definitions.
 */
export function lookupDictionary(query: string): DictionaryEntry[] {
  if (!query || dictionaryCache.length === 0) return [];

  const q = query.trim().toLowerCase();
  
  // Clean query of common definition requests
  const cleanedQuery = q
    .replace(/^what is (the definition of )?/i, '')
    .replace(/^define /i, '')
    .replace(/^meaning of /i, '')
    .replace(/\?$/, '')
    .trim();

  const results: DictionaryEntry[] = [];

  // 1. Exact match on term
  for (const entry of dictionaryCache) {
    const termLower = entry.term.toLowerCase();
    if (termLower === cleanedQuery || termLower.startsWith(cleanedQuery + ' ') || termLower.includes('(' + cleanedQuery + ')')) {
      results.push(entry);
    }
  }

  // 2. If nothing found, check words in term
  if (results.length === 0 && cleanedQuery.length >= 3) {
    for (const entry of dictionaryCache) {
      const termLower = entry.term.toLowerCase();
      if (termLower.includes(cleanedQuery)) {
        results.push(entry);
        if (results.length >= 5) break;
      }
    }
  }

  return results;
}
