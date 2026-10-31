import { describe, expect, it } from 'vitest';
import {
  DICTIONARY_ENTRIES,
  formatExactDefinition,
  isSummarizeOrExpandQuery,
  lookupDictionary,
} from './index';

describe('Dictionary Module', () => {
  it('loads dictionary entries properly', () => {
    expect(DICTIONARY_ENTRIES.length).toBeGreaterThan(800);
    const affliction = DICTIONARY_ENTRIES.find((d) => d.term === 'AFFLICTION');
    expect(affliction).toBeDefined();
    expect(affliction?.def).toContain('A cause of persistent pain or distress');
  });

  it('matches exact definitions for various natural query patterns', () => {
    const queries = [
      'What does affliction mean?',
      'Define affliction',
      'What is righteousness?',
      'What is the definition of faith?',
      'Can you define grace for me?',
      'According to the dictionary, what is sanctification?',
      'Tell me what allos parakletos is',
      'affliction',
      'What is abomination of desolation?',
      'What does the dictionary say about eternal life?',
    ];

    for (const q of queries) {
      const hits = lookupDictionary(q);
      expect(hits.length, `Expected hit for query: "${q}"`).toBeGreaterThan(0);
      expect(hits[0]?.def.length).toBeGreaterThan(5);
    }
  });

  it('detects summarize and expand modes correctly', () => {
    expect(isSummarizeOrExpandQuery('What is righteousness?')).toBeNull();
    expect(isSummarizeOrExpandQuery('Define grace')).toBeNull();
    expect(isSummarizeOrExpandQuery('Summarize what the dictionary says about grace')).toBe('summarize');
    expect(isSummarizeOrExpandQuery('Give me a brief summary of faith')).toBe('summarize');
    expect(isSummarizeOrExpandQuery('Expand on the definition of righteousness')).toBe('expand');
    expect(isSummarizeOrExpandQuery('Please elaborate in depth on sanctification')).toBe('expand');
    expect(isSummarizeOrExpandQuery('Anything', 'summarize')).toBe('summarize');
    expect(isSummarizeOrExpandQuery('Anything', 'expand')).toBe('expand');
  });

  it('formats exact definitions without paraphrasing', () => {
    const hits = lookupDictionary('What does affliction mean?');
    expect(hits.length).toBeGreaterThan(0);
    const html = formatExactDefinition(hits);
    expect(html).toContain('<strong>AFFLICTION</strong>: A cause of persistent pain or distress. A state of great suffering of body or mind.');
    expect(html.startsWith('<p>')).toBe(true);
    expect(html.endsWith('</p>')).toBe(true);
  });

  it('returns updated exact definitions for Loveworld Expansionism and Loveworld Exceptionalism', () => {
    const expHits = lookupDictionary('Loveworld Expansionism');
    expect(expHits.length).toBeGreaterThan(0);
    expect(expHits[0]?.def).toBe(
      'This is the doctrine and endeavor of expanding our reach, our influence, and territories, through the relentless spreading of our message by all available and innovative means . Where the means are not available, we create them. We have the licence to grow.'
    );

    const excHits = lookupDictionary('What is Loveworld Exceptionalism?');
    expect(excHits.length).toBeGreaterThan(0);
    expect(excHits[0]?.def).toBe(
      'The idea and ideology that we have been called uniquely with a divine and definite message for the world and the church of Christ. We have a calling to lead and blaze new trails in doctrine, music and arts, education, organization, administration, products, and services.'
    );

    // Also verify subterms match
    expect(lookupDictionary('expansionism')[0]?.term).toBe('LOVEWORLD EXPANSIONISM');
    expect(lookupDictionary('exceptionalism')[0]?.term).toBe('LOVEWORLD EXCEPTIONALISM');
  });
});

