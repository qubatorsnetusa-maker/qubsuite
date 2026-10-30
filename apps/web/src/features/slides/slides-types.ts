export type SlideLayout =
  | 'title'
  | 'title-content'
  | 'two-column'
  | 'three-column'
  | 'timeline'
  | 'metrics-grid'
  | 'comparison-table'
  | 'chart-slide'
  | 'section'
  | 'big-metric'
  | 'quote'
  | 'blank';

export type SlideTheme =
  | 'clean-corporate'
  | 'royal-executive'
  | 'indigo-studio'
  | 'editorial-warm'
  | 'emerald-growth'
  | 'dark-modern'
  | 'gradient-vibrant';

export type SlideFontFamily = 'sans' | 'serif' | 'mono' | 'display';
export type SlideFontSize = 'sm' | 'md' | 'lg' | 'xl';
export type SlideTextAlign = 'left' | 'center' | 'right';
export type SlideImagePosition = 'right' | 'left' | 'top' | 'background';
export type SlideImageFit = 'cover' | 'contain';
export type SlideImageRounded = 'none' | 'md' | '2xl' | 'full';
export type SlideTransition = 'none' | 'fade' | 'slide' | 'zoom';
export type SlideIconName =
  | 'none'
  | 'briefcase'
  | 'trending-up'
  | 'shield-check'
  | 'compass'
  | 'globe'
  | 'award'
  | 'target'
  | 'layers'
  | 'users'
  | 'bar-chart'
  | 'book-open'
  | 'check-circle'
  | 'file-text'
  | 'bookmark';

export interface SlideMetric {
  value: string;
  label: string;
  delta?: string;
}

export interface SlideQuote {
  text: string;
  author: string;
}

export interface SlideCardItem {
  title: string;
  body: string;
}

export interface SlideTimelineStep {
  step: string;
  title: string;
  description: string;
}

export interface SlideTableData {
  headers: string[];
  rows: string[][];
}

export interface SlideChartData {
  chartType: 'bar' | 'horizontal-bar' | 'donut';
  labels: string[];
  values: number[];
  unit?: string;
}

export type SlideElementType = 'text-box' | 'callout' | 'pill-badge' | 'rectangle' | 'divider';

export interface SlideCanvasElement {
  id: string;
  type: SlideElementType;
  text: string;
  x: number;
  y: number;
  color?: string;
}

export interface SlideCustomStyle {
  fontFamily?: SlideFontFamily;
  titleSize?: SlideFontSize;
  bodySize?: SlideFontSize;
  textAlign?: SlideTextAlign;
  backgroundColor?: string;
  accentColor?: string;
  textColor?: string;
  imagePosition?: SlideImagePosition;
  imageFit?: SlideImageFit;
  imageRounded?: SlideImageRounded;
  imageShadow?: boolean;
  badgeText?: string;
  iconName?: SlideIconName;
  transition?: SlideTransition;
  showFooter?: boolean;
}

export interface SlideItem {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  columnLeft?: string;
  columnRight?: string;
  cards?: SlideCardItem[];
  steps?: SlideTimelineStep[];
  metricsList?: SlideMetric[];
  tableData?: SlideTableData;
  chartData?: SlideChartData;
  elements?: SlideCanvasElement[];
  metric?: SlideMetric;
  quote?: SlideQuote;
  imageUrl?: string;
  imageAlt?: string;
  speakerNotes?: string;
  background?: string;
  style?: SlideCustomStyle;
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

/** Theme styling definition (all light, high-contrast, modern typography) */
export interface SlideThemeConfig {
  name: string;
  canvasBg: string;
  cardBg: string;
  textColor: string;
  titleColor: string;
  accentColor: string;
  accentBg: string;
  badgeBg: string;
  mutedColor: string;
  fontFamily: string;
  swatchColor: string;
}

export const SLIDE_THEMES: Record<SlideTheme, SlideThemeConfig> = {
  'clean-corporate': {
    name: 'Clean Corporate',
    canvasBg: 'bg-slate-100',
    cardBg: 'bg-white border-slate-200/90 shadow-xl',
    textColor: 'text-slate-600',
    titleColor: 'text-slate-900 font-extrabold',
    accentColor: 'text-blue-600',
    accentBg: 'bg-blue-600',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    mutedColor: 'text-slate-400',
    fontFamily: 'font-sans',
    swatchColor: '#2563eb',
  },
  'royal-executive': {
    name: 'Executive Sapphire',
    canvasBg: 'bg-sky-50/70',
    cardBg: 'bg-gradient-to-br from-white via-slate-50/90 to-blue-50/50 border-blue-200/80 shadow-xl',
    textColor: 'text-slate-700',
    titleColor: 'text-slate-950 font-extrabold',
    accentColor: 'text-indigo-600',
    accentBg: 'bg-indigo-600',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    mutedColor: 'text-slate-400',
    fontFamily: 'font-sans',
    swatchColor: '#4f46e5',
  },
  'indigo-studio': {
    name: 'Violet Studio Light',
    canvasBg: 'bg-purple-50/50',
    cardBg: 'bg-gradient-to-br from-white via-purple-50/30 to-indigo-50/40 border-purple-200/80 shadow-xl',
    textColor: 'text-slate-700',
    titleColor: 'text-slate-950 font-extrabold',
    accentColor: 'text-purple-600',
    accentBg: 'bg-purple-600',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    mutedColor: 'text-slate-400',
    fontFamily: 'font-sans',
    swatchColor: '#9333ea',
  },
  'editorial-warm': {
    name: 'Editorial Ivory',
    canvasBg: 'bg-[#f5f2eb]',
    cardBg: 'bg-[#fffdfa] border-[#e6dec8] shadow-xl',
    textColor: 'text-[#4a3f35]',
    titleColor: 'text-[#1c1612] font-serif font-bold',
    accentColor: 'text-[#b45309]',
    accentBg: 'bg-[#b45309]',
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
    mutedColor: 'text-[#8c7e70]',
    fontFamily: 'font-serif',
    swatchColor: '#b45309',
  },
  'emerald-growth': {
    name: 'Emerald Horizon',
    canvasBg: 'bg-emerald-50/50',
    cardBg: 'bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/40 border-emerald-200/80 shadow-xl',
    textColor: 'text-slate-700',
    titleColor: 'text-slate-950 font-extrabold',
    accentColor: 'text-emerald-600',
    accentBg: 'bg-emerald-600',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    mutedColor: 'text-slate-400',
    fontFamily: 'font-sans',
    swatchColor: '#059669',
  },
  // Legacy keys mapped to crisp light themes so existing saved decks never render dark
  'dark-modern': {
    name: 'Executive Sapphire',
    canvasBg: 'bg-sky-50/70',
    cardBg: 'bg-gradient-to-br from-white via-slate-50/90 to-blue-50/50 border-blue-200/80 shadow-xl',
    textColor: 'text-slate-700',
    titleColor: 'text-slate-950 font-extrabold',
    accentColor: 'text-indigo-600',
    accentBg: 'bg-indigo-600',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    mutedColor: 'text-slate-400',
    fontFamily: 'font-sans',
    swatchColor: '#4f46e5',
  },
  'gradient-vibrant': {
    name: 'Violet Studio Light',
    canvasBg: 'bg-purple-50/50',
    cardBg: 'bg-gradient-to-br from-white via-purple-50/30 to-indigo-50/40 border-purple-200/80 shadow-xl',
    textColor: 'text-slate-700',
    titleColor: 'text-slate-950 font-extrabold',
    accentColor: 'text-purple-600',
    accentBg: 'bg-purple-600',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    mutedColor: 'text-slate-400',
    fontFamily: 'font-sans',
    swatchColor: '#9333ea',
  },
};

export const VISIBLE_SLIDE_THEMES: SlideTheme[] = [
  'clean-corporate',
  'royal-executive',
  'indigo-studio',
  'editorial-warm',
  'emerald-growth',
];

export const LAYOUT_DESCRIPTIONS: Record<SlideLayout, { label: string; description: string }> = {
  title: { label: 'Title Slide', description: 'Hero presentation title, badge, and visual cover' },
  'title-content': { label: 'Title & Content', description: 'Structured points with optional side visual' },
  'two-column': { label: 'Two Columns', description: 'Side-by-side comparison cards' },
  'three-column': { label: 'Three Pillars (3-Card Grid)', description: 'Three feature or strategic pillar cards' },
  timeline: { label: 'Roadmap & Process Diagram', description: '4-step horizontal process or milestone timeline' },
  'metrics-grid': { label: 'KPI Dashboard (3 Metrics)', description: 'Multi-metric executive performance grid' },
  'comparison-table': { label: 'Data & Comparison Table', description: 'Structured multi-row editable slide table' },
  'chart-slide': { label: 'Visual Data Chart', description: 'Interactive bar, horizontal bar, or donut chart' },
  section: { label: 'Section Header', description: 'Milestone transition slide with accent bar' },
  'big-metric': { label: 'Single Hero KPI', description: 'High-impact statistic callout and context' },
  quote: { label: 'Executive Quote', description: 'Editorial statement and attribution' },
  blank: { label: 'Blank Canvas', description: 'Open canvas for custom visual storytelling' },
};

export const DEFAULT_THREE_CARDS: SlideCardItem[] = [
  {
    title: '01. Unified Architecture',
    body: 'Connect documents, spreadsheets, forms, and presentations in a single workspace.',
  },
  {
    title: '02. Real-Time Collaboration',
    body: 'Co-author with sub-50ms synchronization, inline comments, and role-based access.',
  },
  {
    title: '03. Enterprise Governance',
    body: 'End-to-end audit trails, granular permissions, and automated compliance controls.',
  },
];

export const DEFAULT_TIMELINE_STEPS: SlideTimelineStep[] = [
  {
    step: 'Phase 1',
    title: 'Discovery & Alignment',
    description: 'Audit workflows, establish baseline KPIs, and align stakeholders.',
  },
  {
    step: 'Phase 2',
    title: 'Core Architecture',
    description: 'Deploy unified workspace templates and integrate data sources.',
  },
  {
    step: 'Phase 3',
    title: 'Pilot Rollout',
    description: 'Onboard initial cross-functional teams and benchmark velocity.',
  },
  {
    step: 'Phase 4',
    title: 'Global Scale',
    description: 'Expand organization-wide with automated reporting and AI workflows.',
  },
];

export const DEFAULT_METRICS_LIST: SlideMetric[] = [
  { value: '99.99%', label: 'Global Service Availability SLA', delta: '+0.4% YoY' },
  { value: '3.8x', label: 'Faster Cross-Team Delivery Velocity', delta: '+140% QoQ' },
  { value: '42%', label: 'Reduction in Software Licensing Cost', delta: '-\$180K/yr' },
];

export const DEFAULT_TABLE_DATA: SlideTableData = {
  headers: ['Capability', 'QubSuite Enterprise', 'Legacy Desktop Tools', 'Strategic Impact'],
  rows: [
    ['Real-Time Co-Editing', 'Native Sub-50ms Sync', 'Manual File Attachments', 'Eliminates version conflicts'],
    ['Cross-Suite AI Assist', 'Built-in across 5 Apps', 'Fragmented Add-ons', '3x faster content creation'],
    ['Mobile & Web Parity', '100% Unified Codebase', 'Desktop-bound features', 'Approve & edit from anywhere'],
  ],
};

export const DEFAULT_CHART_DATA: SlideChartData = {
  chartType: 'bar',
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  values: [48, 65, 84, 112],
  unit: 'M',
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
        subtitle: 'Add a supporting subtitle, team name, or date',
        speakerNotes: 'Introduce the core premise of this presentation.',
        style: {
          badgeText: 'KEYNOTE PRESENTATION',
          iconName: 'briefcase',
          textAlign: 'left',
          showFooter: true,
        },
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
        imageUrl: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1000&q=80',
        imageAlt: 'Modern collaborative workspace',
        speakerNotes: 'Walk through each objective clearly.',
        style: {
          badgeText: 'STRATEGIC OVERVIEW',
          iconName: 'target',
          imagePosition: 'right',
          showFooter: true,
        },
      };
    case 'two-column':
      return {
        id,
        layout,
        title: 'Strategic Comparison',
        columnLeft: 'Legacy Workflows:\n• Disconnected desktop files\n• Manual version attachments\n• Delayed team feedback loops',
        columnRight: 'Unified QubSuite Cloud:\n• Real-time collaborative editing\n• Instant browser & mobile access\n• Integrated AI design assistance',
        speakerNotes: 'Highlight the contrast between legacy tools and Qub.',
        style: {
          badgeText: 'COMPARISON',
          iconName: 'layers',
          showFooter: true,
        },
      };
    case 'three-column':
      return {
        id,
        layout,
        title: 'Core Strategic Pillars',
        cards: DEFAULT_THREE_CARDS.map((c) => ({ ...c })),
        speakerNotes: 'Present the three foundational pillars supporting our strategy.',
        style: {
          badgeText: 'STRATEGIC PILLARS',
          iconName: 'layers',
          showFooter: true,
        },
      };
    case 'timeline':
      return {
        id,
        layout,
        title: 'Execution Roadmap & Milestones',
        steps: DEFAULT_TIMELINE_STEPS.map((s) => ({ ...s })),
        speakerNotes: 'Walk through the four phases of execution and timeline milestones.',
        style: {
          badgeText: 'EXECUTION ROADMAP',
          iconName: 'compass',
          showFooter: true,
        },
      };
    case 'metrics-grid':
      return {
        id,
        layout,
        title: 'Executive Performance Dashboard',
        metricsList: DEFAULT_METRICS_LIST.map((m) => ({ ...m })),
        speakerNotes: 'Highlight the three primary KPIs from the quarter.',
        style: {
          badgeText: 'KEY PERFORMANCE INDICATORS',
          iconName: 'trending-up',
          showFooter: true,
        },
      };
    case 'comparison-table':
      return {
        id,
        layout,
        title: 'Feature & Capability Matrix',
        tableData: {
          headers: [...DEFAULT_TABLE_DATA.headers],
          rows: DEFAULT_TABLE_DATA.rows.map((r) => [...r]),
        },
        speakerNotes: 'Compare capabilities side by side across key evaluation criteria.',
        style: {
          badgeText: 'CAPABILITY MATRIX',
          iconName: 'file-text',
          showFooter: true,
        },
      };
    case 'chart-slide':
      return {
        id,
        layout,
        title: 'Quarterly Revenue & Adoption Growth',
        chartData: {
          ...DEFAULT_CHART_DATA,
          labels: [...DEFAULT_CHART_DATA.labels],
          values: [...DEFAULT_CHART_DATA.values],
        },
        speakerNotes: 'Discuss the upward growth trajectory across quarters.',
        style: {
          badgeText: 'DATA INSIGHTS',
          iconName: 'bar-chart',
          showFooter: true,
        },
      };
    case 'section':
      return {
        id,
        layout,
        title: 'Part 2: Strategic Execution',
        subtitle: 'A deep dive into architecture, roadmap, and measurable outcomes',
        speakerNotes: 'Pause for quick audience questions before the next section.',
        style: {
          badgeText: 'SECTION 02',
          iconName: 'compass',
          textAlign: 'center',
          showFooter: true,
        },
      };
    case 'big-metric':
      return {
        id,
        layout,
        title: 'Key Performance Highlight',
        metric: {
          value: '99.98%',
          label: 'Sustained platform availability and real-time responsiveness across global teams',
        },
        speakerNotes: 'Explain the methodology behind this metric.',
        style: {
          badgeText: 'IMPACT METRIC',
          iconName: 'trending-up',
          textAlign: 'center',
          showFooter: true,
        },
      };
    case 'quote':
      return {
        id,
        layout,
        title: 'Guiding Perspective',
        quote: {
          text: 'Simplicity is about subtracting the obvious and adding the meaningful.',
          author: 'John Maeda — Laws of Simplicity',
        },
        speakerNotes: 'Reflect on how this quote guides our team.',
        style: {
          badgeText: 'PERSPECTIVE',
          iconName: 'award',
          textAlign: 'center',
          showFooter: true,
        },
      };
    case 'blank':
    default:
      return {
        id,
        layout: 'blank',
        title: 'Visual Canvas Slide',
        subtitle: 'Add an image, custom notes, or switch layout from the ribbon above',
        style: {
          showFooter: true,
        },
      };
  }
}
