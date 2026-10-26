export type SlideLayout =
  | 'title'
  | 'title-content'
  | 'two-column'
  | 'section'
  | 'big-metric'
  | 'quote'
  | 'blank';

export type SlideTheme = 'dark-modern' | 'clean-corporate' | 'gradient-vibrant' | 'editorial-warm';

export interface SlideMetric {
  value: string;
  label: string;
}

export interface SlideQuote {
  text: string;
  author: string;
}

export interface SlideItem {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  columnLeft?: string;
  columnRight?: string;
  metric?: SlideMetric;
  quote?: SlideQuote;
  imageUrl?: string;
  imageAlt?: string;
  speakerNotes?: string;
  background?: string;
}

export interface PresentationDeck {
  id: string;
  title: string;
  theme: SlideTheme;
  aspectRatio: '16:9' | '4:3';
  slides: SlideItem[];
  createdAt: string;
  updatedAt: string;
}

/** Theme styling definition */
export interface SlideThemeConfig {
  name: string;
  canvasBg: string;
  cardBg: string;
  textColor: string;
  titleColor: string;
  accentColor: string;
  mutedColor: string;
  fontFamily: string;
}

export const SLIDE_THEMES: Record<SlideTheme, SlideThemeConfig> = {
  'dark-modern': {
    name: 'Dark Modern',
    canvasBg: 'bg-[#0a0e17]',
    cardBg: 'bg-[#111827] border-slate-800 shadow-2xl',
    textColor: 'text-slate-300',
    titleColor: 'text-white font-bold',
    accentColor: 'text-blue-400',
    mutedColor: 'text-slate-500',
    fontFamily: 'font-sans',
  },
  'clean-corporate': {
    name: 'Clean Corporate',
    canvasBg: 'bg-[#f4f6fa]',
    cardBg: 'bg-white border-slate-200 shadow-xl',
    textColor: 'text-slate-700',
    titleColor: 'text-slate-950 font-bold',
    accentColor: 'text-blue-600',
    mutedColor: 'text-slate-400',
    fontFamily: 'font-sans',
  },
  'gradient-vibrant': {
    name: 'Gradient Vibrant',
    canvasBg: 'bg-gradient-to-br from-[#120b24] via-[#090d1f] to-[#04060d]',
    cardBg: 'bg-[#161333]/90 border-purple-900/40 shadow-2xl backdrop-blur-md',
    textColor: 'text-slate-200',
    titleColor: 'text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-pink-100 to-indigo-200 font-bold',
    accentColor: 'text-pink-400',
    mutedColor: 'text-purple-300/60',
    fontFamily: 'font-sans',
  },
  'editorial-warm': {
    name: 'Editorial Warm',
    canvasBg: 'bg-[#f0ece1]',
    cardBg: 'bg-[#faf8f4] border-[#ded5c5] shadow-xl',
    textColor: 'text-[#3b322a]',
    titleColor: 'text-[#1e1712] font-serif font-bold',
    accentColor: 'text-[#9c5a32]',
    mutedColor: 'text-[#85796f]',
    fontFamily: 'font-serif',
  },
};

export const LAYOUT_DESCRIPTIONS: Record<SlideLayout, { label: string; description: string }> = {
  title: { label: 'Title Slide', description: 'Hero presentation title and subtitle' },
  'title-content': { label: 'Title & Bullets', description: 'Standard slide with header and bullet points' },
  'two-column': { label: 'Two Columns', description: 'Side-by-side comparison or dual themes' },
  section: { label: 'Section Header', description: 'Major topic transition slide' },
  'big-metric': { label: 'Key Metric', description: 'Prominent number and KPI highlight' },
  quote: { label: 'Quote', description: 'Memorable statement and citation' },
  blank: { label: 'Blank', description: 'Uncluttered open canvas' },
};

/** Creates a fresh slide item with default placeholder content for the given layout */
export function createDefaultSlide(layout: SlideLayout, index: number): SlideItem {
  const id = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  switch (layout) {
    case 'title':
      return {
        id,
        layout,
        title: index === 0 ? 'Presentation Title' : 'Key Topic Heading',
        subtitle: 'Add a supporting subtitle or author name',
        speakerNotes: 'Introduce the core premise of this presentation.',
      };
    case 'title-content':
      return {
        id,
        layout,
        title: 'Key Objectives & Takeaways',
        bullets: [
          'High-impact strategic objective for the initiative',
          'Accelerate user adoption with seamless presentation workflows',
          'Measurable performance improvements across all devices',
        ],
        speakerNotes: 'Walk through each objective clearly.',
      };
    case 'two-column':
      return {
        id,
        layout,
        title: 'Strategic Comparison',
        columnLeft: 'Current Landscape:\n- Traditional desktop workflows\n- Fragmented collaboration\n- Manual file syncing',
        columnRight: 'With QubSuite:\n- Unified real-time cloud workspace\n- Real-time co-authoring & presence\n- Instant browser presentations',
        speakerNotes: 'Highlight the contrast between legacy tools and Qub.',
      };
    case 'section':
      return {
        id,
        layout,
        title: 'Part 2: Product Architecture',
        subtitle: 'A deep dive into performance and scale',
        speakerNotes: 'Pause for quick audience questions before the next section.',
      };
    case 'big-metric':
      return {
        id,
        layout,
        title: 'Key Metric Highlight',
        metric: {
          value: '99.98%',
          label: 'Uptime reliability across distributed clusters',
        },
        speakerNotes: 'Explain the methodology behind this metric.',
      };
    case 'quote':
      return {
        id,
        layout,
        title: 'Words of Inspiration',
        quote: {
          text: 'Innovation is the ability to see change as an opportunity, not a threat.',
          author: 'Steve Jobs',
        },
        speakerNotes: 'Reflect on how this quote guides our team.',
      };
    case 'blank':
    default:
      return {
        id,
        layout: 'blank',
        title: 'Slide Title',
      };
  }
}
