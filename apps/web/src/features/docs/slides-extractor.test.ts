import { describe, expect, it } from 'vitest';
import { extractSlidesFromDoc, extractNodeText } from './slides-extractor';

describe('slides-extractor', () => {
  it('handles empty documents with a default slide', () => {
    const slides = extractSlidesFromDoc(null, { docTitle: 'Project Proposal' });
    expect(slides).toHaveLength(1);
    expect(slides[0]!.title).toBe('Project Proposal');
  });

  it('splits slides on H1 and H2 headings', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Executive Overview' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Welcome to the keynote.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Market Opportunity' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '$10B TAM in 2026.' }] },
      ],
    };

    const slides = extractSlidesFromDoc(doc);
    expect(slides).toHaveLength(2);
    expect(slides[0]!.title).toBe('Executive Overview');
    expect(slides[1]!.title).toBe('Market Opportunity');
    expect(extractNodeText(slides[1]!.contentNodes[0]!)).toBe('$10B TAM in 2026.');
  });

  it('splits slides on horizontal rules and page breaks', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Slide 1 content' }] },
        { type: 'horizontalRule' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Slide 2 content' }] },
        { type: 'pageBreak' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Slide 3 content' }] },
      ],
    };

    const slides = extractSlidesFromDoc(doc, { splitOnHeadings: false });
    expect(slides).toHaveLength(3);
    expect(extractNodeText(slides[0]!.contentNodes[0]!)).toBe('Slide 1 content');
    expect(extractNodeText(slides[1]!.contentNodes[0]!)).toBe('Slide 2 content');
    expect(extractNodeText(slides[2]!.contentNodes[0]!)).toBe('Slide 3 content');
  });

  it('extracts speaker notes from blockquotes starting with Note:', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Product Launch' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Live demo of QubSuite.' }] },
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note: Remember to highlight the charts and offline support.' }] }],
        },
      ],
    };

    const slides = extractSlidesFromDoc(doc);
    expect(slides).toHaveLength(1);
    expect(slides[0]!.speakerNotes).toHaveLength(1);
    expect(slides[0]!.speakerNotes[0]).toContain('Remember to highlight the charts and offline support.');
  });
});
