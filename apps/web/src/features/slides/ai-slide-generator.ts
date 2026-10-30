import type { PresentationDeck, SlideItem, SlideLayout, SlideTheme } from './slides-types';
import { SLIDE_THEMES } from './slides-types';

export interface GenerateSlidesOptions {
  rawText: string;
  slideCount?: number;
  theme?: SlideTheme;
  tone?: 'professional' | 'inspirational' | 'executive' | 'creative';
  includeImages?: boolean;
}

/** Curated high-resolution Unsplash image library for presentations */
const CURATED_SLIDE_IMAGES = [
  {
    category: 'tech',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    alt: 'Technology and circuit architecture',
  },
  {
    category: 'workspace',
    url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80',
    alt: 'Modern collaborative workspace',
  },
  {
    category: 'data',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
    alt: 'Data analytics and dashboards',
  },
  {
    category: 'growth',
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    alt: 'Business strategy and growth visualization',
  },
  {
    category: 'team',
    url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
    alt: 'Creative team collaborating',
  },
  {
    category: 'innovation',
    url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    alt: 'Glowing digital innovation',
  },
  {
    category: 'architecture',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    alt: 'Clean minimalist architectural design',
  },
  {
    category: 'faith',
    url: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1200&q=80',
    alt: 'Light streaming through sanctuary window',
  },
  {
    category: 'horizon',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    alt: 'Inspirational ocean horizon',
  },
];

/** Selects an appropriate image from the curated library based on keywords in text */
function selectImageForText(text: string, index: number): { url: string; alt: string } {
  const lower = text.toLowerCase();
  if (lower.includes('god') || lower.includes('jesus') || lower.includes('scripture') || lower.includes('prayer') || lower.includes('church') || lower.includes('pastor')) {
    return CURATED_SLIDE_IMAGES.find((img) => img.category === 'faith')!;
  }
  if (lower.includes('data') || lower.includes('chart') || lower.includes('analytics') || lower.includes('metric')) {
    return CURATED_SLIDE_IMAGES.find((img) => img.category === 'data')!;
  }
  if (lower.includes('grow') || lower.includes('revenue') || lower.includes('market') || lower.includes('scale')) {
    return CURATED_SLIDE_IMAGES.find((img) => img.category === 'growth')!;
  }
  if (lower.includes('team') || lower.includes('people') || lower.includes('collaborat') || lower.includes('partner')) {
    return CURATED_SLIDE_IMAGES.find((img) => img.category === 'team')!;
  }
  if (lower.includes('tech') || lower.includes('code') || lower.includes('software') || lower.includes('engine') || lower.includes('ai')) {
    return CURATED_SLIDE_IMAGES.find((img) => img.category === 'tech')!;
  }
  // Fall back to round-robin
  const fallback = CURATED_SLIDE_IMAGES[index % CURATED_SLIDE_IMAGES.length]!;
  return { url: fallback.url, alt: fallback.alt };
}

/**
 * Intelligent client-side AI heuristic slide generator.
 * Analyzes structure, headings, bullet patterns, numbers and quotes in raw text.
 */
export function generateSlidesLocally(options: GenerateSlidesOptions): PresentationDeck {
  const { rawText, slideCount = 5, theme = 'royal-executive', includeImages = true } = options;
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const cleanTitle = lines[0]?.replace(/^[#*\s-]+/, '').slice(0, 60) || 'AI Generated Presentation';
  const subtitle = lines[1]?.slice(0, 80) || 'Designed automatically from your document with QubSlides AI';

  const slides: SlideItem[] = [];

  // Slide 1: Keynote Title Slide
  slides.push({
    id: `slide-1-${Date.now()}`,
    layout: 'title',
    title: cleanTitle,
    subtitle,
    speakerNotes: 'Welcome everyone. Today we are presenting key findings and strategic insights.',
  });

  // Extract substantive paragraphs and bullets
  const contentParagraphs = lines.slice(1).filter((l) => l.length > 25);
  const targetContentSlides = Math.max(2, slideCount - 1);

  // Distribute content chunks
  const chunkSize = Math.max(1, Math.floor(contentParagraphs.length / targetContentSlides));

  for (let s = 0; s < targetContentSlides; s++) {
    const chunk = contentParagraphs.slice(s * chunkSize, (s + 1) * chunkSize);
    const chunkText = chunk.join(' ');
    const slideNum = s + 2;

    // Check if chunk contains numeric metrics (e.g. 40%, $10M, 99.9%)
    const metricMatch = chunkText.match(/(\$?\d+(?:\.\d+)?%?|\b\d+[xX]\b|\b\d+M\b|\b\d+K\b)/);

    // Check if chunk contains a quote
    const quoteMatch = chunkText.match(/["“]([^"”]{15,140})["”]/);

    let layout: SlideLayout = 'title-content';
    let slideTitle = `Key Topic ${s + 1}`;
    let bullets: string[] | undefined;
    let metric: { value: string; label: string } | undefined;
    let quote: { text: string; author: string } | undefined;

    if (s === targetContentSlides - 1 && targetContentSlides > 3) {
      // Last slide: conclusion / next steps
      layout = 'section';
      slideTitle = 'Conclusion & Strategic Next Steps';
    } else if (metricMatch && s === 2) {
      // Metric slide
      layout = 'big-metric';
      slideTitle = 'Key Performance Metric';
      metric = {
        value: metricMatch[1]!,
        label: chunk[0]?.slice(0, 90) || 'Significant milestone achieved in this cycle',
      };
    } else if (quoteMatch && s === 3) {
      // Quote slide
      layout = 'quote';
      slideTitle = 'Guiding Perspective';
      quote = {
        text: quoteMatch[1]!,
        author: 'Executive Statement',
      };
    } else {
      // Standard title-content
      layout = 'title-content';
      const firstLine = chunk[0] || `Strategic Insight ${s + 1}`;
      slideTitle = firstLine.slice(0, 45).replace(/[.:]+$/, '');

      // Create 2-4 clean bullets
      bullets = chunk.length > 1
        ? chunk.slice(0, 4).map((c) => c.slice(0, 110))
        : [
            chunkText.slice(0, 90),
            'Optimizing operational efficiency and engagement across all channels',
            'Sustained continuous improvements and measurable user impact',
          ];
    }

    const img = includeImages ? selectImageForText(chunkText + ' ' + slideTitle, s) : undefined;

    slides.push({
      id: `slide-${slideNum}-${Date.now()}-${s}`,
      layout,
      title: slideTitle,
      subtitle: layout === 'section' ? 'Summary of recommendations and execution timeline' : undefined,
      bullets,
      metric,
      quote,
      imageUrl: layout === 'title-content' ? img?.url : undefined,
      imageAlt: img?.alt,
      speakerNotes: `Elaborate on ${slideTitle} and address practical audience takeaways.`,
    });
  }

  return {
    id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: cleanTitle,
    theme,
    aspectRatio: '16:9',
    slides,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Primary entry point: calls API `/api/ai/slides/generate` if online,
 * otherwise transparently falls back to local high-intelligence heuristic engine.
 */
export async function generateSlidesWithAi(options: GenerateSlidesOptions): Promise<PresentationDeck> {
  const { rawText, slideCount = 5, theme = 'royal-executive', tone = 'professional', includeImages = true } = options;

  try {
    const res = await fetch('/api/ai/slides/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        text: rawText.slice(0, 30000),
        slideCount,
        theme,
        tone,
        includeImages,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.data?.slides) {
        return {
          id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: data.data.title || 'AI Generated Presentation',
          theme: data.data.theme || theme,
          aspectRatio: '16:9',
          slides: data.data.slides.map((s: any, idx: number) => ({
            id: `slide-${idx + 1}-${Date.now()}`,
            layout: s.layout || 'title-content',
            title: s.title || `Slide ${idx + 1}`,
            subtitle: s.subtitle,
            bullets: s.bullets,
            columnLeft: s.columnLeft,
            columnRight: s.columnRight,
            metric: s.metric,
            quote: s.quote,
            imageUrl: s.imageUrl || (includeImages ? selectImageForText(s.title + ' ' + (s.bullets?.join(' ') || ''), idx).url : undefined),
            imageAlt: s.imageAlt,
            speakerNotes: s.speakerNotes,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }
  } catch {
    // API not reachable or offline; proceed to local engine
  }

  // Local AI engine
  return generateSlidesLocally(options);
}
