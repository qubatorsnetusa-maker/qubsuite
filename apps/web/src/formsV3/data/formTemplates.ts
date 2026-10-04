import type { FormConfig, FormStep } from '../types'

export interface FormTemplatePreset {
  id: string
  title: string
  description: string
  badge: string
  folder: string
  themeId: string
  iconName: 'sparkles' | 'user-check' | 'calendar' | 'bug' | 'heart' | 'briefcase'
  starterSteps: FormStep[]
  thankYouTitle: string
  thankYouMessage: string
}

export const FORM_TEMPLATE_PRESETS: FormTemplatePreset[] = [
  {
    id: 'nps_feedback',
    title: 'Customer Satisfaction & NPS Survey',
    description: 'Measure Net Promoter Score, satisfaction rating, and qualitative improvement feedback.',
    badge: 'Popular',
    folder: 'Feedback',
    themeId: 'nordic-paper',
    iconName: 'sparkles',
    starterSteps: [
      {
        id: 'step-nps-welcome',
        type: 'welcome',
        title: 'We value your honest feedback.',
        description: 'Help us improve by answering 4 brief questions. Takes under 60 seconds.',
        buttonLabel: 'Start Survey',
      },
      {
        id: 'step-nps-rating',
        type: 'rating',
        title: 'How satisfied are you with our product and service?',
        description: '1 is poor, 5 is stellar.',
        validation: { required: true },
      },
      {
        id: 'step-nps-scale',
        type: 'opinion_scale',
        title: 'How likely are you to recommend Qubator to a colleague?',
        description: '0 is Not at all likely, 10 is Extremely likely (NPS).',
        validation: { required: true },
      },
      {
        id: 'step-nps-feature',
        type: 'multiple_choice',
        title: 'Which feature do you find most valuable?',
        options: [
          { id: 'opt-sheets', label: 'Collaborative Spreadsheets' },
          { id: 'opt-forms', label: 'Conversational Forms' },
          { id: 'opt-docs', label: 'Knowledge Base Docs' },
          { id: 'opt-conf', label: 'Video Conferencing' },
        ],
        validation: { required: true },
      },
      {
        id: 'step-nps-feedback',
        type: 'long_text',
        title: 'What is one thing we could do to make your experience exceptional?',
        placeholder: 'Share your ideas or suggestions here...',
        validation: { required: false },
      },
    ],
    thankYouTitle: 'Thank you for your feedback!',
    thankYouMessage: 'Your insights directly influence our product roadmap.',
  },
  {
    id: 'lead_capture',
    title: 'Inbound Sales & Lead Qualification',
    description: 'High-converting contact intake asking name, work email, company size, and project budget.',
    badge: 'High Conversion',
    folder: 'Sales',
    themeId: 'indigo-craft',
    iconName: 'user-check',
    starterSteps: [
      {
        id: 'step-lead-welcome',
        type: 'welcome',
        title: 'Let’s build something remarkable together.',
        description: 'Tell us a bit about your organization and requirements to get a custom demo.',
        buttonLabel: 'Get Started',
      },
      {
        id: 'step-lead-name',
        type: 'short_text',
        title: 'What is your full name?',
        placeholder: 'Alex Morgan',
        validation: { required: true },
      },
      {
        id: 'step-lead-email',
        type: 'email',
        title: 'What is your work email address?',
        placeholder: 'alex@company.com',
        validation: { required: true },
      },
      {
        id: 'step-lead-size',
        type: 'multiple_choice',
        title: 'What is the size of your team or organization?',
        options: [
          { id: 'size-1', label: '1 - 10 people' },
          { id: 'size-2', label: '11 - 50 people' },
          { id: 'size-3', label: '51 - 250 people' },
          { id: 'size-4', label: '250+ Enterprise' },
        ],
        validation: { required: true },
      },
      {
        id: 'step-lead-budget',
        type: 'multiple_choice',
        title: 'What is your planned monthly investment budget?',
        options: [
          { id: 'b-under1k', label: 'Under $1,000 / mo' },
          { id: 'b-1k-5k', label: '$1,000 - $5,000 / mo' },
          { id: 'b-5k-20k', label: '$5,000 - $20,000 / mo' },
          { id: 'b-20k-plus', label: '$20,000+ / mo' },
        ],
        validation: { required: true },
      },
      {
        id: 'step-lead-notes',
        type: 'long_text',
        title: 'Briefly describe your use case or core challenge.',
        placeholder: 'e.g. Migrating customer intake from static PDFs to conversational web forms...',
        validation: { required: false },
      },
    ],
    thankYouTitle: 'We’ve received your inquiry!',
    thankYouMessage: 'A solutions architect will reach out within 1 business day.',
  },
  {
    id: 'event_rsvp',
    title: 'Summit RSVP & Attendee Registration',
    description: 'Register conference attendees with attendance mode, session track selection, and dietary preferences.',
    badge: 'Events',
    folder: 'Events',
    themeId: 'sunset-coral',
    iconName: 'calendar',
    starterSteps: [
      {
        id: 'step-rsvp-welcome',
        type: 'welcome',
        title: 'Qubator Innovation Summit 2026',
        description: 'Reserve your attendee seat in under 90 seconds.',
        buttonLabel: 'Reserve My Seat',
      },
      {
        id: 'step-rsvp-name',
        type: 'short_text',
        title: 'What name should appear on your badge?',
        placeholder: 'Sarah Jenkins',
        validation: { required: true },
      },
      {
        id: 'step-rsvp-mode',
        type: 'multiple_choice',
        title: 'How will you attend the summit?',
        options: [
          { id: 'mode-person', label: 'In Person (San Francisco HQ)' },
          { id: 'mode-virtual', label: 'Virtual Live Stream' },
        ],
        validation: { required: true },
      },
      {
        id: 'step-rsvp-track',
        type: 'multiple_choice',
        title: 'Which keynote track are you most excited for?',
        options: [
          { id: 'track-ai', label: 'AI & Autonomous Agent Systems' },
          { id: 'track-data', label: 'Realtime Data Pipelines & Lakehouses' },
          { id: 'track-dx', label: 'Modern Frontend Architecture' },
        ],
        validation: { required: true },
      },
      {
        id: 'step-rsvp-email',
        type: 'email',
        title: 'Where should we send your calendar invite and ticket QR code?',
        placeholder: 'sarah@domain.com',
        validation: { required: true },
      },
      {
        id: 'step-rsvp-dietary',
        type: 'short_text',
        title: 'Any dietary restrictions or accessibility requests?',
        placeholder: 'Vegetarian, Halal, Gluten-Free, None',
        validation: { required: false },
      },
    ],
    thankYouTitle: 'Your seat is reserved!',
    thankYouMessage: 'We sent confirmation details and your digital badge to your email.',
  },
  {
    id: 'product_feedback',
    title: 'Feature Request & Bug Report Intake',
    description: 'Structured engineering intake separating bug reports from feature suggestions with severity ranking.',
    badge: 'Product',
    folder: 'Product',
    themeId: 'sky-cloud',
    iconName: 'bug',
    starterSteps: [
      {
        id: 'step-bug-welcome',
        type: 'welcome',
        title: 'Product Feedback & Issue Tracker',
        description: 'Submit an issue report or request new platform capabilities directly to our engineering team.',
        buttonLabel: 'Submit Report',
      },
      {
        id: 'step-bug-type',
        type: 'multiple_choice',
        title: 'What category best describes this submission?',
        options: [
          { id: 'type-feature', label: 'New Feature Request' },
          { id: 'type-bug', label: 'Bug or Glitch' },
          { id: 'type-perf', label: 'Performance / Speed Issue' },
          { id: 'type-ux', label: 'UI / Design Polish' },
        ],
        validation: { required: true },
      },
      {
        id: 'step-bug-title',
        type: 'short_text',
        title: 'Give this issue or feature a concise title.',
        placeholder: 'e.g. Inbound webhooks occasionally timeout on large payloads',
        validation: { required: true },
      },
      {
        id: 'step-bug-desc',
        type: 'long_text',
        title: 'Provide details, reproduction steps, or desired behavior.',
        placeholder: '1. Go to settings\n2. Click generate key\n3. Observed behavior...',
        validation: { required: true },
      },
      {
        id: 'step-bug-urgency',
        type: 'multiple_choice',
        title: 'How severely does this affect your day-to-day operations?',
        options: [
          { id: 'urgency-low', label: 'Low - Nice to have improvement' },
          { id: 'urgency-med', label: 'Medium - Workaround is available' },
          { id: 'urgency-high', label: 'High - Significantly slows down team' },
          { id: 'urgency-crit', label: 'Critical - System blocker' },
        ],
        validation: { required: true },
      },
      {
        id: 'step-bug-email',
        type: 'email',
        title: 'Your contact email address for follow-up questions',
        placeholder: 'engineer@company.com',
        validation: { required: true },
      },
    ],
    thankYouTitle: 'Report logged successfully!',
    thankYouMessage: 'Our engineering team triages submissions every weekday.',
  },
  {
    id: 'employee_pulse',
    title: 'Quarterly Team Sentiment & Pulse',
    description: 'Anonymous pulse survey capturing employee motivation, workload balance, and team dynamics.',
    badge: 'People Ops',
    folder: 'HR & Ops',
    themeId: 'sage-minimal',
    iconName: 'heart',
    starterSteps: [
      {
        id: 'step-pulse-welcome',
        type: 'welcome',
        title: 'Quarterly Team Pulse Survey',
        description: 'Your responses are anonymous and help shape company culture and resources.',
        buttonLabel: 'Begin Pulse',
      },
      {
        id: 'step-pulse-energy',
        type: 'rating',
        title: 'How energized and motivated do you feel in your current role?',
        description: '1 is completely drained, 5 is deeply fulfilled and motivated.',
        validation: { required: true },
      },
      {
        id: 'step-pulse-workload',
        type: 'rating',
        title: 'How manageable is your current workload and work-life balance?',
        description: '1 is overwhelming, 5 is healthy and sustainable.',
        validation: { required: true },
      },
      {
        id: 'step-pulse-strategy',
        type: 'opinion_scale',
        title: 'How confident are you in our product strategy and company direction?',
        description: '0 is Not confident, 10 is Extremely confident.',
        validation: { required: true },
      },
      {
        id: 'step-pulse-feedback',
        type: 'long_text',
        title: 'What is one concrete change leadership could make to better support you?',
        placeholder: 'Share your candid suggestions...',
        validation: { required: false },
      },
    ],
    thankYouTitle: 'Thank you for your candid feedback!',
    thankYouMessage: 'Executive team reviews aggregated pulse survey themes quarterly.',
  },
  {
    id: 'job_application',
    title: 'Career Application & Candidate Screening',
    description: 'Streamlined candidate application with resume portfolio link, target role, and key achievements.',
    badge: 'Hiring',
    folder: 'HR & Ops',
    themeId: 'midnight',
    iconName: 'briefcase',
    starterSteps: [
      {
        id: 'step-job-welcome',
        type: 'welcome',
        title: 'Join the Engineering & Design Team',
        description: 'We are looking for creative thinkers to shape the future of collaborative workspaces.',
        buttonLabel: 'Apply Now',
      },
      {
        id: 'step-job-name',
        type: 'short_text',
        title: 'What is your full legal name?',
        placeholder: 'Elena Rostova',
        validation: { required: true },
      },
      {
        id: 'step-job-email',
        type: 'email',
        title: 'What is your primary contact email?',
        placeholder: 'elena@gmail.com',
        validation: { required: true },
      },
      {
        id: 'step-job-role',
        type: 'multiple_choice',
        title: 'Which position are you applying for?',
        options: [
          { id: 'role-fullstack', label: 'Senior Full-Stack Engineer' },
          { id: 'role-frontend', label: 'Lead Frontend / Design Systems Engineer' },
          { id: 'role-infra', label: 'Cloud & Database Infrastructure Specialist' },
          { id: 'role-product', label: 'Senior Product Designer' },
        ],
        validation: { required: true },
      },
      {
        id: 'step-job-portfolio',
        type: 'website',
        title: 'Link to your GitHub, Portfolio, or LinkedIn profile',
        placeholder: 'https://github.com/username',
        validation: { required: true },
      },
      {
        id: 'step-job-story',
        type: 'long_text',
        title: 'Tell us about a challenging technical or design problem you solved recently.',
        placeholder: 'Describe the context, your approach, and the impact...',
        validation: { required: true },
      },
    ],
    thankYouTitle: 'Application submitted successfully!',
    thankYouMessage: 'Our recruiting team reviews applications within 3 to 5 business days.',
  },
]

export function buildFormFromTemplate(
  preset: FormTemplatePreset,
  workspaceId: string,
  overrides?: Partial<FormConfig>
): FormConfig {
  const formId = `form-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`
  return {
    id: formId,
    title: preset.title,
    description: preset.description,
    folder: preset.folder,
    themeId: preset.themeId,
    status: 'published',
    isFavorite: false,
    showProgressBar: true,
    showQuestionNumbers: true,
    allowKeyboardShortcuts: true,
    createdAt: new Date().toISOString(),
    updatedAt: 'Just now',
    steps: preset.starterSteps.map((s, idx) => ({
      ...s,
      id: `${formId}-step-${idx + 1}`,
    })),
    thankYou: {
      title: preset.thankYouTitle,
      message: preset.thankYouMessage,
      buttonLabel: 'Submit Another Response',
      showRestartButton: true,
      badgeIcon: 'check',
    },
    ...overrides,
  }
}
