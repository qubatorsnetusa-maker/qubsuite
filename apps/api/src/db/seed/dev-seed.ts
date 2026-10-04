/**
 * DEVELOPMENT SEED DATA ONLY.
 * Creates demo users, folders, documents, spreadsheets and a form through the real services, so every row goes
 * through the same validation, transactions and permission checks as production traffic.
 * Refuses to run when NODE_ENV is staging or production.
 */
import { eq } from 'drizzle-orm';
import { buildApp } from '../../app';
import { env } from '../../config/env';
import { UserRepository } from '../../modules/users/user.repository';
import { createDb } from '../index';
import { users } from '../schema';

const PASSWORD = 'Password123';

async function main() {
  if (env.isProduction) {
    console.error('Refusing to seed: NODE_ENV is staging/production. Seed data is for development only.');
    process.exit(1);
  }
  const db = createDb(env.DATABASE_URL, { max: 4 });
  const app = await buildApp({ env, db, jobs: false, logger: { level: 'warn' } });
  const s = app.services;
  const ctx = { actorId: null, ip: '127.0.0.1', userAgent: 'seed', requestId: 'seed' };

  try {
    if (await UserRepository.findByEmail(db.db, 'alice@qub.dev')) {
      console.log('Seed data already present (alice@qub.dev exists). Reset the database to reseed.');
      return;
    }

    const register = async (email: string, name: string) => {
      const r = await s.auth.register({ email, name, password: PASSWORD }, ctx);
      if ('requiresVerification' in r) throw new Error('Disable REQUIRE_EMAIL_VERIFICATION to seed');
      return r.user;
    };
    const alice = await register('alice@qub.dev', 'Alice Johnson');
    const bob = await register('bob@qub.dev', 'Bob Smith');
    const carol = await register('carol@qub.dev', 'Carol Diaz');
    // Alice administers the organization (admin console at /admin).
    await db.db.update(users).set({ platformRole: 'SUPER_ADMIN' }).where(eq(users.id, alice.id));

    // My Drive → Work/{Projects/{Qub, Website}, Reports}, Personal, Shared
    const folder = async (name: string, parentId?: string) => (await s.folders.create(alice.id, { name, parentId })).id;
    const work = await folder('Work');
    const projects = await folder('Projects', work);
    const qub = await folder('Qub', projects);
    await folder('Website', projects);
    const reports = await folder('Reports', work);
    await folder('Personal');
    const shared = await folder('Shared');
    await s.folders.create(alice.id, { name: 'Finance', parentId: work });

    const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
    const h = (level: number, text: string) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
    await s.docs.create(alice.id, { title: 'Qub Product Brief', folderId: qub }, {
      type: 'doc',
      content: [
        h(1, 'Qub Product Brief'),
        p('Qub unifies Drive, Docs, Sheets and Forms on a single storage and permission foundation.'),
        h(2, 'Goals'),
        {
          type: 'bulletList',
          content: ['Real-time collaboration everywhere', 'One sharing model', 'Fast, server-side search'].map((t) => ({ type: 'listItem', content: [p(t)] })),
        },
        h(2, 'Milestones'),
        {
          type: 'orderedList',
          attrs: { start: 1 },
          content: ['Infrastructure', 'Drive', 'Docs', 'Sheets', 'Forms', 'Platform hardening'].map((t) => ({ type: 'listItem', content: [p(t)] })),
        },
        { type: 'blockquote', content: [p('Drive is the foundation; the apps are built on top of it.')] },
      ],
    });
    const notes = await s.docs.create(alice.id, { title: 'Weekly Meeting Notes', folderId: work }, {
      type: 'doc',
      content: [h(1, 'Weekly Meeting Notes'), p('Attendees: Alice, Bob, Carol'), p('Decisions: ship the sharing dialog this sprint.')],
    });
    await s.docs.create(bob.id, { title: "Bob's Ideas" }, { type: 'doc', content: [h(1, 'Ideas'), p('Offline mode for Sheets.')] });

    // Budget spreadsheet with real formulas across several sheets.
    const budget = await s.sheets.create(alice.id, { title: 'Qub Budget', folderId: reports });
    const sheet1 = budget.sheets[0]!.id;
    await s.sheets.updateSheet(alice.id, budget.id, sheet1, { name: 'Summary', frozenRows: 1 });
    const months = ['January', 'February', 'March'];
    const monthIds: string[] = [];
    for (const m of months) {
      const sheets = await s.sheets.addSheet(alice.id, budget.id, m);
      monthIds.push(sheets.find((x) => x.name === m)!.id);
    }
    const lines = [
      ['Hosting', 1200, 1250, 1300],
      ['Salaries', 42000, 42000, 45500],
      ['Marketing', 3500, 4100, 3900],
      ['Software', 890, 890, 940],
    ] as const;
    for (const [i, id] of monthIds.entries()) {
      await s.sheets.applyOps(alice.id, budget.id, [
        {
          type: 'setCells',
          sheetId: id,
          cells: [
            { row: 0, col: 0, input: 'Category' },
            { row: 0, col: 1, input: 'Amount' },
            ...lines.flatMap(([name, ...amounts], r) => [
              { row: r + 1, col: 0, input: name },
              { row: r + 1, col: 1, input: String(amounts[i]) },
            ]),
            { row: lines.length + 1, col: 0, input: 'Total' },
            { row: lines.length + 1, col: 1, input: `=SUM(B2:B${lines.length + 1})` },
          ],
        },
        { type: 'setStyle', sheetId: id, range: { startRow: 0, endRow: 0, startCol: 0, endCol: 1 }, style: { bold: true, background: '#e8f0fe' } },
        { type: 'setStyle', sheetId: id, range: { startRow: 1, endRow: lines.length + 1, startCol: 1, endCol: 1 }, style: { numberFormat: 'currency' } },
      ]);
    }
    const totalRow = lines.length + 2;
    await s.sheets.applyOps(alice.id, budget.id, [
      {
        type: 'setCells',
        sheetId: sheet1,
        cells: [
          { row: 0, col: 0, input: 'Month' },
          { row: 0, col: 1, input: 'Total spend' },
          { row: 0, col: 2, input: 'Over 50k?' },
          ...months.flatMap((m, i) => [
            { row: i + 1, col: 0, input: m },
            { row: i + 1, col: 1, input: `=${m}!B${totalRow}` },
            { row: i + 1, col: 2, input: `=IF(B${i + 2}>50000,"Yes","No")` },
          ]),
          { row: 5, col: 0, input: 'Quarter total' },
          { row: 5, col: 1, input: '=SUM(B2:B4)' },
          { row: 6, col: 0, input: 'Monthly average' },
          { row: 6, col: 1, input: '=AVERAGE(B2:B4)' },
          { row: 7, col: 0, input: 'Highest month' },
          { row: 7, col: 1, input: '=MAX(B2:B4)' },
        ],
      },
      { type: 'setStyle', sheetId: sheet1, range: { startRow: 0, endRow: 0, startCol: 0, endCol: 2 }, style: { bold: true, background: '#e8f0fe' } },
      { type: 'setStyle', sheetId: sheet1, range: { startRow: 1, endRow: 7, startCol: 1, endCol: 1 }, style: { numberFormat: 'currency' } },
    ]);

    // A published form with branching, plus a few responses submitted through the real pipeline.
    let form = await s.forms.create(alice.id, { title: 'Team Offsite Survey', folderId: work });
    await s.forms.update(alice.id, form.id, { description: 'Help us plan the Q3 offsite.' });
    const q1 = form.fields[0]!;
    form = await s.forms.updateField(alice.id, form.id, q1.id, {
      label: 'Will you attend?',
      required: true,
      options: [{ id: q1.options[0]!.id, label: 'Yes' }, { label: 'No' }],
    });
    form = await s.forms.addField(alice.id, form.id, { type: 'SECTION', label: 'Travel details' });
    form = await s.forms.addField(alice.id, form.id, { type: 'DROPDOWN', label: 'How will you travel?' });
    const travel = form.fields.at(-1)!;
    form = await s.forms.updateField(alice.id, form.id, travel.id, { options: [{ label: 'Train' }, { label: 'Car' }, { label: 'Plane' }], required: true });
    form = await s.forms.addField(alice.id, form.id, { type: 'DATE', label: 'Arrival date' });
    const arrival = form.fields.at(-1)!;
    form = await s.forms.addField(alice.id, form.id, { type: 'SECTION', label: 'Feedback' });
    const feedback = form.fields.at(-1)!;
    form = await s.forms.addField(alice.id, form.id, { type: 'RATING', label: 'How excited are you?' });
    const rating = form.fields.at(-1)!;
    form = await s.forms.addField(alice.id, form.id, { type: 'PARAGRAPH', label: 'Anything else?' });
    const comments = form.fields.at(-1)!;
    const fresh = form.fields.find((f) => f.id === q1.id)!;
    const yes = fresh.options.find((o) => o.label === 'Yes')!.id;
    const no = fresh.options.find((o) => o.label === 'No')!.id;
    form = await s.forms.setLogic(alice.id, form.id, q1.id, [{ operator: 'EQUALS', value: no, action: 'GO_TO_SECTION', targetSectionId: feedback.id }]);
    form = await s.forms.setPublished(alice.id, form.id, true);
    const travelOpts = form.fields.find((f) => f.id === travel.id)!.options;
    const respondent = (userId: string | null, email: string | null) => ({ userId, email, ip: '127.0.0.1', userAgent: 'seed' });
    await s.responses.submit(form.publicId, { answers: { [q1.id]: yes, [travel.id]: travelOpts[0]!.id, [arrival.id]: '2026-10-12', [rating.id]: 5, [comments.id]: 'Vegetarian options please' } }, respondent(bob.id, bob.email));
    await s.responses.submit(form.publicId, { answers: { [q1.id]: yes, [travel.id]: travelOpts[2]!.id, [arrival.id]: '2026-10-13', [rating.id]: 4 } }, respondent(carol.id, carol.email));
    await s.responses.submit(form.publicId, { answers: { [q1.id]: no, [rating.id]: 2, [comments.id]: 'Conflicts with a conference' } }, respondent(null, null));

    // Sharing: Bob edits the notes, Carol views the Shared folder.
    await s.sharing.share(alice.id, { type: 'FILE', id: notes.fileId }, { email: bob.email, role: 'EDITOR', canShare: true, notify: true }, ctx);
    await s.sharing.share(alice.id, { type: 'FOLDER', id: shared }, { email: carol.email, role: 'VIEWER', notify: true }, ctx);
    await s.sharing.share(alice.id, { type: 'FILE', id: budget.fileId }, { email: bob.email, role: 'COMMENTER', notify: false }, ctx);

    console.log(`Seeded development data. Sign in as alice@qub.dev, bob@qub.dev or carol@qub.dev (password: ${PASSWORD}).`);
  } finally {
    await app.close();
    await db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
