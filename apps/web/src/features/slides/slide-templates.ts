import type { PresentationDeck } from './slides-types';

export const STARTER_TEMPLATES: Record<string, { name: string; description: string; deck: PresentationDeck }> = {
  pitch: {
    name: 'Executive Pitch Deck',
    description: 'Crisp 5-slide venture or client pitch deck with problem, solution, metrics & team ask.',
    deck: {
      id: 'template-pitch',
      title: 'Series A Pitch Deck',
      theme: 'gradient-vibrant',
      aspectRatio: '16:9',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slides: [
        {
          id: 'slide-1',
          layout: 'title',
          title: 'Next-Generation Collaboration',
          subtitle: 'QubSuite — Unifying Documents, Spreadsheets, and Presentations',
          speakerNotes: 'Welcome the investors and state our mission.',
        },
        {
          id: 'slide-2',
          layout: 'title-content',
          title: 'The Problem: Workspace Fragmentation',
          bullets: [
            'Teams constantly switch across 5+ disconnected productivity apps',
            'Siloed file versions result in lost hours and lost context',
            'Enterprise license costs continue to spiral upward each quarter',
          ],
          speakerNotes: 'Establish the core pain point that every team experiences.',
        },
        {
          id: 'slide-3',
          layout: 'two-column',
          title: 'The Solution: One Cohesive Foundation',
          columnLeft: 'Old Way:\n- Fragmented standalone tools\n- Manual export/import roundtrips\n- Disconnected notifications',
          columnRight: 'The QubSuite Way:\n- Native Docs, Sheets, Slides & Forms\n- Zero-lag real-time collaboration\n- Instant browser presentations',
          speakerNotes: 'Contrast the legacy status quo with our unified approach.',
        },
        {
          id: 'slide-4',
          layout: 'big-metric',
          title: 'Unprecedented Growth & Traction',
          metric: {
            value: '4.8x',
            label: 'Year-over-year organic user expansion across organizations',
          },
          speakerNotes: 'Emphasize strong retention and organic referral loops.',
        },
        {
          id: 'slide-5',
          layout: 'quote',
          title: 'Customer Endorsement',
          quote: {
            text: 'Switching our team to QubSuite cut our meeting prep time in half.',
            author: 'VP of Product Engineering',
          },
          speakerNotes: 'Conclude with customer validation and invite Q&A.',
        },
      ],
    },
  },

  strategy: {
    name: 'Quarterly Business Review',
    description: 'Executive quarterly review covering milestones, performance data and next steps.',
    deck: {
      id: 'template-strategy',
      title: 'Q3 Business Review',
      theme: 'dark-modern',
      aspectRatio: '16:9',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slides: [
        {
          id: 'slide-1',
          layout: 'title',
          title: 'Q3 Business Performance Review',
          subtitle: 'Key Milestones, Strategic Wins, and Q4 Roadmap',
          speakerNotes: 'Set the tone for a high-energy quarterly review.',
        },
        {
          id: 'slide-2',
          layout: 'title-content',
          title: 'Executive Summary',
          bullets: [
            'Achieved all primary product and reliability targets for Q3',
            'Deployed Pivot Tables, Conditional Formatting, and Global Omnisearch',
            'PWA Offline support rolled out to 100% of desktop users',
          ],
          speakerNotes: 'Highlight the speed of engineering execution.',
        },
        {
          id: 'slide-3',
          layout: 'big-metric',
          title: 'Platform Reliability',
          metric: {
            value: '99.99%',
            label: 'Service availability maintained throughout the quarter',
          },
          speakerNotes: 'Acknowledge the infrastructure team’s accomplishments.',
        },
        {
          id: 'slide-4',
          layout: 'section',
          title: 'Part 2: Q4 Strategic Priorities',
          subtitle: 'Expanding into Presentations and Advanced Data Integrations',
          speakerNotes: 'Transition into the upcoming quarter’s roadmap.',
        },
      ],
    },
  },

  sermon: {
    name: 'Ministry & Teaching Outline',
    description: 'Formatted for sermon notes, scripture study, and ministry keynote presentations.',
    deck: {
      id: 'template-sermon',
      title: 'Walking in Divine Purpose',
      theme: 'editorial-warm',
      aspectRatio: '16:9',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slides: [
        {
          id: 'slide-1',
          layout: 'title',
          title: 'Walking in Divine Purpose',
          subtitle: 'Living by Design, Not by Default',
          speakerNotes: 'Welcome the congregation and open with prayer.',
        },
        {
          id: 'slide-2',
          layout: 'quote',
          title: 'Scripture Anchor',
          quote: {
            text: 'For I know the plans I have for you, plans to prosper you and not to harm you, plans to give you hope and a future.',
            author: 'Jeremiah 29:11',
          },
          speakerNotes: 'Read the scripture aloud with passion and authority.',
        },
        {
          id: 'slide-3',
          layout: 'title-content',
          title: 'Key Pillars of Purpose',
          bullets: [
            'Clarity: Understand the calling on your life through prayer and the Word',
            'Conviction: Stand firm against distractions and doubts',
            'Commitment: Daily discipline to cultivate your gifts and serve others',
          ],
          speakerNotes: 'Elaborate on each pillar with personal testimonies.',
        },
        {
          id: 'slide-4',
          layout: 'section',
          title: 'Call to Action & Prayer',
          subtitle: 'Dedicate this week to walking intentionally in your calling',
          speakerNotes: 'Lead the closing prayer and fellowship dismissal.',
        },
      ],
    },
  },

  blank: {
    name: 'Blank Presentation',
    description: 'Start from a clean slate and build your custom presentation slide by slide.',
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
          title: 'Untitled Presentation',
          subtitle: 'Click to edit title or add content',
          speakerNotes: '',
        },
      ],
    },
  },
};
