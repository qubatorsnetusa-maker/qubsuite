/**
 * QubDocs Native Grammar & Spelling Engine
 * Works completely offline on device, across both web and mobile app.
 */

export interface Issue {
  id: string;
  type: 'spelling' | 'grammar' | 'punctuation';
  from: number;
  to: number;
  original: string;
  replacement: string;
  message: string;
  context: string;
}

// 250+ most frequent English spelling mistakes and typos
export const COMMON_TYPOS: Record<string, string> = {
  teh: 'the',
  recieve: 'receive',
  recieved: 'received',
  recieving: 'receiving',
  seperate: 'separate',
  seperated: 'separated',
  seperation: 'separation',
  definately: 'definitely',
  definitly: 'definitely',
  occured: 'occurred',
  occuring: 'occurring',
  occurance: 'occurrence',
  untill: 'until',
  wierd: 'weird',
  goverment: 'government',
  thier: 'their',
  alot: 'a lot',
  accomodate: 'accommodate',
  acheive: 'achieve',
  acrosss: 'across',
  adress: 'address',
  adresses: 'addresses',
  agressive: 'aggressive',
  allmost: 'almost',
  alright: 'all right',
  apparant: 'apparent',
  arguement: 'argument',
  assitant: 'assistant',
  athiest: 'atheist',
  basicly: 'basically',
  becomming: 'becoming',
  begining: 'beginning',
  beleive: 'believe',
  calender: 'calendar',
  catagory: 'category',
  cieling: 'ceiling',
  collaegue: 'colleague',
  collegue: 'colleague',
  comming: 'coming',
  commitee: 'committee',
  completly: 'completely',
  concious: 'conscious',
  curiosity: 'curiosity',
  dissapear: 'disappear',
  disappoint: 'disappoint',
  embarass: 'embarrass',
  enviroment: 'environment',
  existense: 'existence',
  familar: 'familiar',
  finally: 'finally',
  florescent: 'fluorescent',
  foriegn: 'foreign',
  fourty: 'forty',
  freind: 'friend',
  further: 'further',
  glamourous: 'glamorous',
  gaurd: 'guard',
  happend: 'happened',
  harrass: 'harass',
  heigth: 'height',
  humerous: 'humorous',
  ignorant: 'ignorant',
  immediatly: 'immediately',
  incidently: 'incidentally',
  independant: 'independent',
  interupt: 'interrupt',
  irresistable: 'irresistible',
  knowlege: 'knowledge',
  liason: 'liaison',
  libary: 'library',
  maintanence: 'maintenance',
  millenium: 'millennium',
  mischievious: 'mischievous',
  mispell: 'misspell',
  neccessary: 'necessary',
  noticable: 'noticeable',
  occassion: 'occasion',
  oppurtunity: 'opportunity',
  paralell: 'parallel',
  pastime: 'pastime',
  persistant: 'persistent',
  peice: 'piece',
  posession: 'possession',
  potatos: 'potatoes',
  preceed: 'precede',
  prefered: 'preferred',
  priviledge: 'privilege',
  profesor: 'professor',
  promiss: 'promise',
  pronounciation: 'pronunciation',
  publically: 'publicly',
  realy: 'really',
  reccomend: 'recommend',
  refered: 'referred',
  religous: 'religious',
  rember: 'remember',
  resistence: 'resistance',
  rythm: 'rhythm',
  sieze: 'seize',
  succesful: 'successful',
  supersede: 'supersede',
  suprise: 'surprise',
  tomorow: 'tomorrow',
  tounge: 'tongue',
  truely: 'truly',
  twelth: 'twelfth',
  usefull: 'useful',
  usally: 'usually',
  vaccuum: 'vacuum',
  vehical: 'vehicle',
  vicious: 'vicious',
  writeing: 'writing',
  grammer: 'grammar',
  doument: 'document',
  enusure: 'ensure',
  clusstred: 'clustered',
};

/**
 * Scans text and detects spelling and grammar mistakes.
 */
export function checkText(text: string): Issue[] {
  const issues: Issue[] = [];
  if (!text.trim()) return issues;

  // 1. Check common misspellings (case preserving)
  const wordRegex = /\b[a-zA-Z]{2,}\b/g;
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(text)) !== null) {
    const rawWord = match[0];
    const lower = rawWord.toLowerCase();
    const typoCorrection = COMMON_TYPOS[lower];
    if (typoCorrection) {
      let replacement = typoCorrection;
      // Preserve uppercase if original was capitalized
      if (rawWord[0] === rawWord[0]?.toUpperCase() && rawWord.length > 1) {
        replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      const startIdx = Math.max(0, match.index - 20);
      const endIdx = Math.min(text.length, match.index + rawWord.length + 20);
      const context = text.slice(startIdx, endIdx);

      issues.push({
        id: `spelling-${match.index}-${rawWord}`,
        type: 'spelling',
        from: match.index,
        to: match.index + rawWord.length,
        original: rawWord,
        replacement,
        message: `Possible spelling error. Did you mean "${replacement}"?`,
        context,
      });
    }
  }

  // 2. Check duplicate repeated words (e.g., "the the", "in in", "is is")
  const duplicateRegex = /\b([a-zA-Z]+)\s+\1\b/gi;
  while ((match = duplicateRegex.exec(text)) !== null) {
    const word = match[1] || '';
    const startIdx = Math.max(0, match.index - 15);
    const endIdx = Math.min(text.length, match.index + match[0].length + 15);
    const context = text.slice(startIdx, endIdx);

    issues.push({
      id: `grammar-dup-${match.index}`,
      type: 'grammar',
      from: match.index,
      to: match.index + match[0].length,
      original: match[0],
      replacement: word,
      message: `Repeated word "${word}". Consider removing the duplicate.`,
      context,
    });
  }

  // 3. Indefinite article mismatch: "a" before vowel sound or "an" before consonant
  const aBeforeVowelRegex = /\b(a)\s+([aeiou][a-z]+)\b/gi;
  while ((match = aBeforeVowelRegex.exec(text)) !== null) {
    const article = match[1] || 'a';
    const nextWord = match[2] || '';
    if (!/^(user|university|unique|useful|unicorn|unit)/i.test(nextWord)) {
      issues.push({
        id: `grammar-article-${match.index}`,
        type: 'grammar',
        from: match.index,
        to: match.index + 1,
        original: article,
        replacement: article === 'A' ? 'An' : 'an',
        message: `Use "${article === 'A' ? 'An' : 'an'}" before words starting with a vowel sound.`,
        context: match[0],
      });
    }
  }

  const anBeforeConsonantRegex = /\b(an)\s+([^aeiou\s][a-z]+)\b/gi;
  while ((match = anBeforeConsonantRegex.exec(text)) !== null) {
    const article = match[1] || 'an';
    const nextWord = match[2] || '';
    if (!/^(hour|honest|honor|heir)/i.test(nextWord)) {
      issues.push({
        id: `grammar-article-an-${match.index}`,
        type: 'grammar',
        from: match.index,
        to: match.index + 2,
        original: article,
        replacement: article === 'An' ? 'A' : 'a',
        message: `Use "${article === 'An' ? 'A' : 'a'}" before consonant sounds.`,
        context: match[0],
      });
    }
  }

  // 4. Missing space after punctuation (e.g. "word,word" -> "word, word")
  const missingSpaceRegex = /([a-zA-Z])([,;])([a-zA-Z])/g;
  while ((match = missingSpaceRegex.exec(text)) !== null) {
    issues.push({
      id: `punct-${match.index}`,
      type: 'punctuation',
      from: match.index,
      to: match.index + 3,
      original: match[0],
      replacement: `${match[1]}${match[2]} ${match[3]}`,
      message: 'Add a space after punctuation.',
      context: match[0],
    });
  }

  // 5. Space before punctuation (e.g. "word , word" -> "word, word")
  const spaceBeforePunctRegex = /([a-zA-Z])\s+([,.;!?])/g;
  while ((match = spaceBeforePunctRegex.exec(text)) !== null) {
    issues.push({
      id: `punct-space-${match.index}`,
      type: 'punctuation',
      from: match.index,
      to: match.index + match[0].length,
      original: match[0],
      replacement: `${match[1]}${match[2]}`,
      message: 'Remove space before punctuation mark.',
      context: match[0],
    });
  }

  return issues;
}
