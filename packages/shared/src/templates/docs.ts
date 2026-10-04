import type { DocNode, DocTemplate } from './types';

// ---------- small builders for Tiptap JSON ----------

type Mark = NonNullable<DocNode['marks']>[number];
type Inline = DocNode | string;

const bold: Mark = { type: 'bold' };
const italic: Mark = { type: 'italic' };
const style = (attrs: { color?: string; fontSize?: string; backgroundColor?: string }): Mark => ({ type: 'textStyle', attrs });

const t = (text: string, ...marks: Mark[]): DocNode => (marks.length ? { type: 'text', text, marks } : { type: 'text', text });
const inline = (parts: Inline[]): DocNode[] => parts.filter((p) => p !== '').map((p) => (typeof p === 'string' ? t(p) : p));

const p = (...parts: Inline[]): DocNode => (parts.length ? { type: 'paragraph', content: inline(parts) } : { type: 'paragraph' });
const pAlign = (textAlign: 'left' | 'center' | 'right', ...parts: Inline[]): DocNode => ({ type: 'paragraph', attrs: { textAlign }, ...(parts.length ? { content: inline(parts) } : {}) });
const h = (level: 1 | 2 | 3 | 4, ...parts: Inline[]): DocNode => ({ type: 'heading', attrs: { level }, content: inline(parts) });
const hAlign = (level: 1 | 2 | 3 | 4, textAlign: 'left' | 'center' | 'right', ...parts: Inline[]): DocNode => ({ type: 'heading', attrs: { level, textAlign }, content: inline(parts) });
const hr: DocNode = { type: 'horizontalRule' };
const list = (type: 'bulletList' | 'orderedList', items: Inline[][]): DocNode => ({
  type,
  content: items.map((parts) => ({ type: 'listItem', content: [p(...parts)] })),
});
const ul = (...items: (Inline | Inline[])[]) => list('bulletList', items.map((i) => (Array.isArray(i) ? i : [i])));
const ol = (...items: (Inline | Inline[])[]) => list('orderedList', items.map((i) => (Array.isArray(i) ? i : [i])));
const quote = (...parts: Inline[]): DocNode => ({ type: 'blockquote', content: [p(...parts)] });
const cell = (type: 'tableHeader' | 'tableCell', parts: Inline[]): DocNode => ({ type, content: [p(...parts)] });
const table = (header: Inline[], rows: Inline[][]): DocNode => ({
  type: 'table',
  content: [
    { type: 'tableRow', content: header.map((c) => cell('tableHeader', [c])) },
    ...rows.map((r) => ({ type: 'tableRow', content: r.map((c) => cell('tableCell', [c])) })),
  ],
});
const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });

// ---------- templates ----------

const SWISS = '#d93025';
const SPEARMINT = '#0b8043';
const TEAM = '#1a73e8';
const INK = '#3c4043';
const GEOMETRIC = '#7b1fa2';
const CORAL = '#e8710a';
const ACADEMIC = '#1f3a5f';
const LESSON = '#00796b';

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: 'doc-resume',
    app: 'DOCUMENT',
    name: 'Resume',
    subtitle: 'Swiss style',
    category: 'Resumes & letters',
    content: doc(
      p(t('Your Name', bold, style({ fontSize: '32px' }))),
      p(t('Job title or professional headline', style({ color: SWISS, fontSize: '16px' }))),
      p('email@example.com  ·  (555) 555-0123  ·  City, State  ·  linkedin.com/in/yourname'),
      hr,
      h(2, t('Summary', style({ color: SWISS }))),
      p('Two or three sentences about who you are, what you do best and the kind of role you are looking for. Lead with your strongest, most relevant achievement.'),
      h(2, t('Experience', style({ color: SWISS }))),
      h(3, 'Company Name', t(' — Job Title', italic)),
      p(t('Month Year – Present  ·  City, State', style({ color: '#5f6368' }))),
      ul('Describe an accomplishment with a measurable result (for example, "cut onboarding time by 30%").', 'Name the tools, teams or customers you worked with.', 'Show the scope of your responsibility.'),
      h(3, 'Company Name', t(' — Job Title', italic)),
      p(t('Month Year – Month Year  ·  City, State', style({ color: '#5f6368' }))),
      ul('Accomplishment with a measurable result.', 'Another highlight that shows growth or leadership.'),
      h(2, t('Education', style({ color: SWISS }))),
      h(3, 'School Name', t(' — Degree, Field of Study', italic)),
      p(t('Month Year – Month Year', style({ color: '#5f6368' }))),
      h(2, t('Skills', style({ color: SWISS }))),
      ul('Skill or area of expertise', 'Tools and technologies', 'Languages'),
    ),
  },
  {
    id: 'doc-project-proposal',
    app: 'DOCUMENT',
    name: 'Project Proposal',
    subtitle: 'Spearmint accent',
    category: 'Work',
    content: doc(
      p(t('PROJECT PROPOSAL', bold, style({ color: SPEARMINT, fontSize: '12px' }))),
      h(1, 'Project Name'),
      p(t('Prepared by Your Name  ·  Date', style({ color: '#5f6368' }))),
      h(2, t('Overview', style({ color: SPEARMINT }))),
      p('Summarize the problem this project solves, who it is for and why now. Keep it to one short paragraph that a busy reader can take in at a glance.'),
      h(2, t('Goals', style({ color: SPEARMINT }))),
      ol('The primary outcome, stated so it can be measured.', 'A secondary outcome.', 'What success looks like at the end of the project.'),
      h(2, t('Scope and timeline', style({ color: SPEARMINT }))),
      table(
        ['Phase', 'Deliverable', 'Owner', 'Due'],
        [
          ['Discovery', 'Requirements and research summary', 'Name', 'Date'],
          ['Design', 'Approved design and plan', 'Name', 'Date'],
          ['Build', 'Working release', 'Name', 'Date'],
          ['Launch', 'Rollout and review', 'Name', 'Date'],
        ],
      ),
      h(2, t('Budget', style({ color: SPEARMINT }))),
      p('List the main costs (people, tools, services) and the total amount requested.'),
      h(2, t('Risks', style({ color: SPEARMINT }))),
      ul('A risk, its likelihood and how you will reduce it.', 'A dependency on another team or vendor.'),
      h(2, t('Next steps', style({ color: SPEARMINT }))),
      p('What you need from the reader — a decision, approval or feedback — and by when.'),
    ),
  },
  {
    id: 'doc-meeting-notes',
    app: 'DOCUMENT',
    name: 'Meeting Notes',
    subtitle: 'Team agenda',
    category: 'Work',
    content: doc(
      h(1, t('Meeting name', style({ color: TEAM }))),
      p(t('Date  ·  Time  ·  Location or call link', style({ color: '#5f6368' }))),
      h(3, 'Attendees'),
      p('Names of the people who attended'),
      h(3, 'Agenda'),
      ol('Review of action items from the last meeting', 'Topic one', 'Topic two', 'Open discussion'),
      h(3, 'Notes'),
      ul('Key points, questions raised and answers given.', 'Decisions and the reasoning behind them.'),
      h(3, 'Decisions'),
      ul('Decision and who made it'),
      h(3, 'Action items'),
      table(
        ['Task', 'Owner', 'Due'],
        [
          ['Action item', 'Name', 'Date'],
          ['Action item', 'Name', 'Date'],
        ],
      ),
    ),
  },
  {
    id: 'doc-letter',
    app: 'DOCUMENT',
    name: 'Letter',
    subtitle: 'Modern writer',
    category: 'Resumes & letters',
    content: doc(
      pAlign('right', t('Your Name', bold, style({ color: INK, fontSize: '20px' }))),
      pAlign('right', t('Street Address, City, State ZIP  ·  email@example.com', style({ color: '#5f6368' }))),
      p(),
      p('Date'),
      p(),
      p('Recipient Name'),
      p('Title, Company'),
      p('Street Address, City, State ZIP'),
      p(),
      p('Dear Recipient Name,'),
      p('Open with the reason you are writing. Keep the first paragraph short and specific so the reader knows immediately what the letter is about.'),
      p('Use the middle paragraphs to give the details, context or evidence the reader needs. One idea per paragraph keeps a letter easy to follow.'),
      p('Close by saying what you would like to happen next and how the reader can reach you. Thank them for their time.'),
      p(),
      p('Sincerely,'),
      p(),
      p(t('Your Name', bold)),
    ),
  },
  {
    id: 'doc-brochure',
    app: 'DOCUMENT',
    name: 'Brochure',
    subtitle: 'Geometric format',
    category: 'Work',
    content: doc(
      hAlign(1, 'center', t('Business Name', style({ color: GEOMETRIC }))),
      pAlign('center', t('A short tagline that says what you do', italic, style({ fontSize: '16px' }))),
      hr,
      h(2, t('About us', style({ color: GEOMETRIC }))),
      p('Tell readers who you are, who you serve and what makes you different. Two or three sentences are enough.'),
      h(2, t('What we offer', style({ color: GEOMETRIC }))),
      table(
        ['Service', 'Description'],
        [
          ['Service one', 'What it is and who it helps'],
          ['Service two', 'What it is and who it helps'],
          ['Service three', 'What it is and who it helps'],
        ],
      ),
      h(2, t('Why choose us', style({ color: GEOMETRIC }))),
      ul('A benefit customers care about', 'A proof point, such as years in business or a result', 'Something only you can offer'),
      quote('“Add a short quote from a happy customer.” — Customer Name'),
      h(2, t('Contact', style({ color: GEOMETRIC }))),
      p('Street Address, City, State ZIP'),
      p('(555) 555-0123  ·  hello@example.com  ·  example.com'),
    ),
  },
  {
    id: 'doc-cover-letter',
    app: 'DOCUMENT',
    name: 'Cover Letter',
    subtitle: 'Coral',
    category: 'Resumes & letters',
    content: doc(
      p(t('Your Name', bold, style({ color: CORAL, fontSize: '28px' }))),
      p('email@example.com  ·  (555) 555-0123  ·  City, State'),
      hr,
      p('Date'),
      p('Hiring Manager Name, Company Name'),
      p(),
      p('Dear Hiring Manager Name,'),
      p('Name the role you are applying for and where you found it, then say in one sentence why you are a strong fit.'),
      p('Describe one or two achievements that match what the role needs. Be concrete: what you did, how you did it and the result.'),
      p('Explain why this company in particular — its product, mission or team — and what you would bring in your first months.'),
      p('Thank the reader and say you look forward to talking. Mention that your resume is attached.'),
      p(),
      p('Sincerely,'),
      p(t('Your Name', bold)),
    ),
  },
  {
    id: 'doc-report',
    app: 'DOCUMENT',
    name: 'Report',
    subtitle: 'Academic',
    category: 'Education',
    content: doc(
      hAlign(1, 'center', t('Report Title', style({ color: ACADEMIC }))),
      pAlign('center', t('Subtitle or course name', style({ color: '#5f6368', fontSize: '16px' }))),
      pAlign('center', 'Author Name  ·  Date'),
      hr,
      h(2, t('Abstract', style({ color: ACADEMIC }))),
      p('Summarize the question, the approach, the main findings and why they matter in about 150 words.'),
      h(2, t('1. Introduction', style({ color: ACADEMIC }))),
      p('Introduce the topic, the question you are answering and the structure of the report.'),
      h(2, t('2. Method', style({ color: ACADEMIC }))),
      p('Describe how you gathered and analysed information, in enough detail that someone could repeat it.'),
      h(2, t('3. Results', style({ color: ACADEMIC }))),
      p('Present what you found. Tables work well for comparisons:'),
      table(
        ['Measure', 'Group A', 'Group B'],
        [
          ['Measure one', 'Value', 'Value'],
          ['Measure two', 'Value', 'Value'],
        ],
      ),
      h(2, t('4. Discussion', style({ color: ACADEMIC }))),
      p('Interpret the results, note limitations and suggest further work.'),
      h(2, t('5. Conclusion', style({ color: ACADEMIC }))),
      p('Restate the answer to your question in a few sentences.'),
      h(2, t('References', style({ color: ACADEMIC }))),
      ol('Author, A. (Year). Title of work. Publisher.', 'Author, B. (Year). Title of article. Journal, volume(issue), pages.'),
    ),
  },
  {
    id: 'doc-lesson-plan',
    app: 'DOCUMENT',
    name: 'Lesson Plan',
    subtitle: 'Classroom',
    category: 'Education',
    content: doc(
      h(1, t('Lesson title', style({ color: LESSON }))),
      table(
        ['Subject', 'Grade', 'Duration', 'Teacher'],
        [['Subject', 'Grade level', '45 minutes', 'Name']],
      ),
      h(2, t('Learning objectives', style({ color: LESSON }))),
      p('By the end of this lesson, students will be able to:'),
      ul('Objective one', 'Objective two'),
      h(2, t('Materials', style({ color: LESSON }))),
      ul('Material or resource', 'Handout or slide deck'),
      h(2, t('Lesson outline', style({ color: LESSON }))),
      ol(
        [t('Warm-up (5 min): ', bold), 'a question or activity that connects to prior knowledge.'],
        [t('Instruction (15 min): ', bold), 'introduce the new concept with examples.'],
        [t('Practice (20 min): ', bold), 'students work individually or in groups.'],
        [t('Wrap-up (5 min): ', bold), 'review the objectives and check understanding.'],
      ),
      h(2, t('Assessment', style({ color: LESSON }))),
      p('How you will know students met the objectives — an exit ticket, quiz or observation.'),
      h(2, t('Notes', style({ color: LESSON }))),
      p('Differentiation, follow-up ideas and reflections after teaching.'),
    ),
  },
];
