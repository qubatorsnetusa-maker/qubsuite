import type { PresentationDeck } from './slides-types';

export const STARTER_TEMPLATES: Record<string, { name: string; description: string; deck: PresentationDeck }> = {
  pitch: {
    name: 'Executive Pitch Deck',
    description: 'Polished venture & client pitch deck with photography, iconography, and bold typography.',
    deck: {
      id: 'template-pitch',
      title: 'Series A Executive Pitch',
      theme: 'royal-executive',
      aspectRatio: '16:9',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slides: [
        {
          id: 'slide-1',
          layout: 'title',
          title: 'Next-Generation Cloud Workspace',
          subtitle: 'Unifying Documents, Spreadsheets, Forms & Presentations in One Seamless Platform',
          imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
          imageAlt: 'Modern executive boardroom workspace',
          speakerNotes: 'Welcome investors and partners. State our core mission clearly.',
          style: {
            badgeText: 'SERIES A PITCH DECK',
            iconName: 'briefcase',
            textAlign: 'left',
            showFooter: true,
          },
        },
        {
          id: 'slide-2',
          layout: 'title-content',
          title: 'The Challenge: Disconnected Productivity',
          bullets: [
            'Modern teams switch across 6+ fragmented tools daily, losing critical context',
            'Manual file exports and incompatible formats slow down executive decision-making',
            'Enterprise software licensing costs continue to compound every single year',
          ],
          imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1000&q=80',
          imageAlt: 'Team aligning on strategy around a table',
          speakerNotes: 'Establish the core pain point that every growing organization experiences.',
          style: {
            badgeText: 'MARKET PROBLEM',
            iconName: 'target',
            imagePosition: 'right',
            showFooter: true,
          },
        },
        {
          id: 'slide-3',
          layout: 'comparison-table',
          title: 'The Solution: One Cohesive Foundation',
          tableData: {
            headers: ['Workflow Dimension', 'QubSuite Cloud', 'Legacy Desktop Suites', 'Customer Outcome'],
            rows: [
              ['Suite Unification', 'Docs, Sheets, Slides, PDF & Forms', 'Fragmented standalone apps', 'Single source of truth'],
              ['Real-Time Collaboration', 'Sub-50ms live synchronization', 'Attachment version chaos', '2.4x faster team sign-off'],
              ['Mobile & Web Experience', '100% native-grade parity', 'Desktop-first, slow on mobile', 'Review & present anywhere'],
            ],
          },
          speakerNotes: 'Contrast the legacy status quo with our unified cloud architecture.',
          style: {
            badgeText: 'PRODUCT ARCHITECTURE',
            iconName: 'layers',
            showFooter: true,
          },
        },
        {
          id: 'slide-4',
          layout: 'metrics-grid',
          title: 'Accelerating Enterprise Adoption',
          metricsList: [
            { value: '4.8x', label: 'Year-over-year organic seat expansion across workspaces', delta: '+380% YoY' },
            { value: '99.99%', label: 'Global cloud uptime across all collaborative suites', delta: 'Enterprise SLA' },
            { value: '52%', label: 'Average reduction in weekly document & deck prep time', delta: '-11 hrs/wk' },
          ],
          speakerNotes: 'Emphasize strong net dollar retention and viral team adoption.',
          style: {
            badgeText: 'TRACTION & GROWTH',
            iconName: 'trending-up',
            textAlign: 'left',
            showFooter: true,
          },
        },
        {
          id: 'slide-5',
          layout: 'quote',
          title: 'Customer Validation',
          quote: {
            text: 'Consolidating our documentation, forms, and executive presentations into QubSuite cut our weekly preparation time in half.',
            author: 'VP of Operations — Global Enterprise Partner',
          },
          speakerNotes: 'Conclude with customer validation and open the floor for Q&A.',
          style: {
            badgeText: 'CUSTOMER VOICE',
            iconName: 'award',
            textAlign: 'center',
            showFooter: true,
          },
        },
      ],
    },
  },

  strategy: {
    name: 'Quarterly Business Review',
    description: 'Clean corporate review covering KPIs, engineering milestones, visuals, and Q4 roadmap.',
    deck: {
      id: 'template-strategy',
      title: 'Q3 Executive Business Review',
      theme: 'clean-corporate',
      aspectRatio: '16:9',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slides: [
        {
          id: 'slide-1',
          layout: 'title',
          title: 'Q3 Business Performance Review',
          subtitle: 'Key Operational Milestones, Financial Highlights & Q4 Strategic Roadmap',
          imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
          imageAlt: 'Business analytics dashboard',
          speakerNotes: 'Set a clear, data-driven tone for the quarterly review.',
          style: {
            badgeText: 'QUARTERLY REVIEW',
            iconName: 'bar-chart',
            textAlign: 'left',
            showFooter: true,
          },
        },
        {
          id: 'slide-2',
          layout: 'title-content',
          title: 'Q3 Executive Summary & Wins',
          bullets: [
            'Exceeded quarterly active workspace growth target by 24% across all regions',
            'Launched unified PDF Studio, conversational forms, and real-time spreadsheet pivots',
            'Reduced mobile application cold-start time by 62% with native caching',
          ],
          imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1000&q=80',
          imageAlt: 'Performance metrics visualization',
          speakerNotes: 'Highlight the speed and quality of cross-functional execution.',
          style: {
            badgeText: 'KEY HIGHLIGHTS',
            iconName: 'check-circle',
            imagePosition: 'right',
            showFooter: true,
          },
        },
        {
          id: 'slide-3',
          layout: 'chart-slide',
          title: 'Quarterly Active Workspace Growth',
          chartData: {
            chartType: 'bar',
            labels: ['Q4', 'Q1', 'Q2', 'Q3'],
            values: [42, 61, 88, 124],
            unit: 'K',
          },
          speakerNotes: 'Highlight our consistent quarter-over-quarter workspace growth.',
          style: {
            badgeText: 'GROWTH TRAJECTORY',
            iconName: 'bar-chart',
            textAlign: 'left',
            showFooter: true,
          },
        },
        {
          id: 'slide-4',
          layout: 'timeline',
          title: 'Q4 Strategic Execution Roadmap',
          steps: [
            {
              step: 'October',
              title: 'Enterprise Controls',
              description: 'Launch granular RBAC, audit logs, and custom domain branding.',
            },
            {
              step: 'November',
              title: 'Cross-Suite Automation',
              description: 'Connect QubForms submissions directly to QubSheets & PDF workflows.',
            },
            {
              step: 'December',
              title: 'AI Studio 2.0',
              description: 'Roll out multi-page document & presentation synthesis.',
            },
            {
              step: 'Q1 Preview',
              title: 'Global Partner API',
              description: 'Open webhooks and SDK integrations for enterprise ecosystems.',
            },
          ],
          speakerNotes: 'Transition into the upcoming quarter roadmap and resource allocation.',
          style: {
            badgeText: 'LOOKING AHEAD',
            iconName: 'globe',
            textAlign: 'left',
            showFooter: true,
          },
        },
      ],
    },
  },

  product: {
    name: 'Product Launch Keynote',
    description: 'Vibrant light studio keynote with product photography, feature comparisons, and launch metrics.',
    deck: {
      id: 'template-product',
      title: 'Product Launch Keynote',
      theme: 'indigo-studio',
      aspectRatio: '16:9',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slides: [
        {
          id: 'slide-1',
          layout: 'title',
          title: 'Introducing QubSuite 2.0',
          subtitle: 'Designed for Speed, Crafted for Clarity, Built for Modern Teams',
          imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
          imageAlt: 'Product design team collaborating',
          speakerNotes: 'Welcome everyone to our flagship product launch keynote.',
          style: {
            badgeText: 'PRODUCT KEYNOTE',
            iconName: 'compass',
            textAlign: 'left',
            showFooter: true,
          },
        },
        {
          id: 'slide-2',
          layout: 'three-column',
          title: 'Three Pillars of the 2.0 Release',
          cards: [
            {
              title: '01. Instant AI Assist',
              body: 'Generate structured forms, executive documents, and multi-slide decks in seconds.',
            },
            {
              title: '02. Tactile Light Design',
              body: 'High-contrast editorial typography, clean iconography, and zero visual clutter.',
            },
            {
              title: '03. Universal Continuity',
              body: 'Start authoring on desktop web, review and present seamlessly on mobile.',
            },
          ],
          speakerNotes: 'Walk through the three core pillars of the release.',
          style: {
            badgeText: 'RELEASE PILLARS',
            iconName: 'layers',
            showFooter: true,
          },
        },
        {
          id: 'slide-3',
          layout: 'big-metric',
          title: 'Benchmarking Workflow Velocity',
          metric: {
            value: '3.2x',
            label: 'Faster document-to-presentation creation compared to traditional office suites',
          },
          speakerNotes: 'Share our internal and beta customer benchmark results.',
          style: {
            badgeText: 'SPEED BENCHMARK',
            iconName: 'trending-up',
            textAlign: 'center',
            showFooter: true,
          },
        },
      ],
    },
  },

  sermon: {
    name: 'Ministry & Teaching Outline',
    description: 'Warm editorial typography with imagery and scripture callouts for teaching and keynotes.',
    deck: {
      id: 'template-sermon',
      title: 'Walking in Purpose & Excellence',
      theme: 'editorial-warm',
      aspectRatio: '16:9',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slides: [
        {
          id: 'slide-1',
          layout: 'title',
          title: 'Walking in Purpose & Excellence',
          subtitle: 'Living Intentionally by Design, Equipped for Every Good Work',
          imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
          imageAlt: 'Sunrise over calm ocean horizon',
          speakerNotes: 'Welcome the audience and open with an inspiring introduction.',
          style: {
            badgeText: 'KEYNOTE TEACHING',
            iconName: 'book-open',
            textAlign: 'left',
            showFooter: true,
          },
        },
        {
          id: 'slide-2',
          layout: 'quote',
          title: 'Foundational Scripture',
          quote: {
            text: 'For I know the plans I have for you, plans to prosper you and not to harm you, plans to give you hope and a future.',
            author: 'Jeremiah 29:11',
          },
          speakerNotes: 'Read the anchor verse clearly and pause for reflection.',
          style: {
            badgeText: 'SCRIPTURE ANCHOR',
            iconName: 'book-open',
            textAlign: 'center',
            showFooter: true,
          },
        },
        {
          id: 'slide-3',
          layout: 'title-content',
          title: 'Three Pillars of Purposeful Living',
          bullets: [
            'Clarity of Vision: Align your daily priorities with eternal principles',
            'Stewardship & Diligence: Cultivate excellence in every assignment',
            'Community Impact: Empower and uplift everyone within your sphere',
          ],
          imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1000&q=80',
          imageAlt: 'Sunlight streaming through bright architecture',
          speakerNotes: 'Elaborate on each pillar with practical illustrations.',
          style: {
            badgeText: 'CORE PRINCIPLES',
            iconName: 'bookmark',
            imagePosition: 'right',
            showFooter: true,
          },
        },
        {
          id: 'slide-4',
          layout: 'section',
          title: 'Action Steps & Reflection',
          subtitle: 'Commit this week to walking intentionally in wisdom and excellence',
          speakerNotes: 'Close with practical takeaways and prayer.',
          style: {
            badgeText: 'CONCLUSION',
            iconName: 'users',
            textAlign: 'center',
            showFooter: true,
          },
        },
      ],
    },
  },

  blank: {
    name: 'Blank Presentation',
    description: 'Start from a crisp light canvas and customize layouts, images, icons, and typography.',
    deck: {
      id: 'template-blank',
      title: 'Untitled Presentation',
      theme: 'clean-corporate',
      aspectRatio: '16:9',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slides: [
        {
          id: 'slide-1',
          layout: 'title',
          title: 'Presentation Title',
          subtitle: 'Click to add subtitle, presenter name, or organization',
          speakerNotes: '',
          style: {
            badgeText: 'PRESENTATION',
            iconName: 'briefcase',
            textAlign: 'left',
            showFooter: true,
          },
        },
      ],
    },
  },
};
