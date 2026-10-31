import rawDictionary from './pastor-chris-dictionary.json';

export interface DictionaryEntry {
  term: string;
  def: string;
}

export const DICTIONARY_ENTRIES: DictionaryEntry[] = Array.isArray(rawDictionary)
  ? (rawDictionary as DictionaryEntry[])
  : [];

function cleanTerm(term: string): string {
  return term.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
}

// Build precomputed map of term lookup keys
const termMap = new Map<string, DictionaryEntry[]>();

for (const entry of DICTIONARY_ENTRIES) {
  const clean = cleanTerm(entry.term);
  if (!termMap.has(clean)) {
    termMap.set(clean, []);
  }
  termMap.get(clean)!.push(entry);

  if (clean.startsWith('loveworld ')) {
    const sub = clean.slice('loveworld '.length).trim();
    if (sub && !termMap.has(sub)) {
      termMap.set(sub, []);
    }
    if (sub && !termMap.get(sub)!.includes(entry)) {
      termMap.get(sub)!.push(entry);
    }
  }

  const fullLower = entry.term.trim().toLowerCase();
  if (fullLower !== clean) {
    if (!termMap.has(fullLower)) {
      termMap.set(fullLower, []);
    }
    const list = termMap.get(fullLower)!;
    if (!list.includes(entry)) {
      list.push(entry);
    }
  }
}

// Sort unique keys in descending order of length so compound terms match first
const sortedTermKeys = Array.from(termMap.keys()).sort((a, b) => b.length - a.length);

/**
 * Detects whether the query or task asks to summarize or expand the dictionary definition.
 */
export function isSummarizeOrExpandQuery(
  text: string,
  task?: string
): 'summarize' | 'expand' | null {
  if (task === 'summarize') return 'summarize';
  if (task === 'expand') return 'expand';
  if (!text) return null;

  const t = text.toLowerCase();
  if (/\b(summarize|summary|in short|briefly|condense|overview|bullet points?)\b/i.test(t)) {
    return 'summarize';
  }
  if (/\b(expand|elaborate|deep dive|explain further|in depth|detailed|details|examples?|unpack)\b/i.test(t)) {
    return 'expand';
  }
  return null;
}

/**
 * Searches the dictionary for matches corresponding to a user's question or search query.
 */
export function lookupDictionary(query: string): DictionaryEntry[] {
  if (!query || DICTIONARY_ENTRIES.length === 0) return [];

  const q = query.trim().toLowerCase();
  const qClean = q.replace(/[\r\n\t]+/g, ' ');
  const qWords = qClean.replace(/[?!.,;:"'`]+/g, ' ').trim();

  // Pattern 1: Explicit definition inquiry patterns
  const patterns = [
    /\b(?:what is the definition of|what is the meaning of|definition of|meaning of)\s+(?:the\s+)?([a-z0-9\- ]+)/i,
    /\b(?:what does)\s+(?:the\s+)?([a-z0-9\- ]+?)\s+(?:mean|signify)\b/i,
    /\b(?:define|explain|what is|who is)\s+(?:the\s+)?([a-z0-9\- ]+)/i,
    /\b(?:what is meant by)\s+(?:the\s+)?([a-z0-9\- ]+)/i,
    /\b([a-z0-9\- ]+?)\s+(?:definition|meaning)\b/i,
    /\b(?:dictionary definition of)\s+(?:the\s+)?([a-z0-9\- ]+)/i,
    /\b(?:what does the dictionary say about)\s+(?:the\s+)?([a-z0-9\- ]+)/i,
  ];

  let extracted: string | null = null;
  for (const pattern of patterns) {
    const m = qWords.match(pattern);
    if (m && m[1]) {
      let cand = m[1].trim();
      // Remove trailing meta/qualifier phrases
      cand = cand.replace(/\b(in|from|according to)?\s+(the\s+)?(pastor chris\s+)?(dictionary|bible)\b.*/i, '').trim();
      cand = cand.replace(/\b(for me|to me|please|exactly)\b.*/i, '').trim();
      if (cand && cand.length >= 2) {
        extracted = cand;
        break;
      }
    }
  }

  if (extracted) {
    if (termMap.has(extracted)) {
      return termMap.get(extracted)!;
    }
    for (const t of sortedTermKeys) {
      if (t === extracted) {
        return termMap.get(t)!;
      }
    }
    for (const t of sortedTermKeys) {
      if (t.length < 3) continue;
      const regex = new RegExp(`\\b${escapeRegExp(t)}\\b`, 'i');
      if (regex.test(extracted)) {
        return termMap.get(t)!;
      }
    }
  }

  // Pattern 2: Direct match on the entire query (short phrase or single word)
  if (termMap.has(qWords)) {
    return termMap.get(qWords)!;
  }

  // Pattern 3: Check if the query is an inquiry containing a known dictionary term
  const isInquiry =
    /\b(what|define|meaning|definition|dictionary|explain|tell|who|significance|is|does)\b/i.test(qWords) ||
    qWords.split(/\s+/).length <= 4;

  if (isInquiry) {
    for (const t of sortedTermKeys) {
      if (t.length < 3) continue;
      const regex = new RegExp(`\\b${escapeRegExp(t)}\\b`, 'i');
      if (regex.test(qWords)) {
        return termMap.get(t)!;
      }
    }
  }

  return [];
}

/**
 * Formats one or more dictionary entries into an exact HTML definition string.
 * Strictly preserves verbatim definitions without paraphrasing.
 */
export function formatExactDefinition(entries: DictionaryEntry[]): string {
  if (!entries || entries.length === 0) return '';
  return entries
    .map((e) => `<p><strong>${e.term}</strong>: ${e.def}</p>`)
    .join('\n');
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

