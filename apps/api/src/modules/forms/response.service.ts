import type { Readable } from 'node:stream';
import type { AnswerValue, FieldAnalyticsDto, FormAnalyticsDto, FormFieldDto, FormResponseDto, PublicFormDto, SubmitResponseInput, SubmitResponseResult } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS, submitResponseSchema } from '@qub/shared';
import type { Answers, FormDefinition } from '@qub/shared/forms';
import { displayAnswer, evaluateForm, hiddenAnswers, isAnswered, optionsOfKind, QUESTION_TYPES, resolveOutcome, scaleBounds, validateFieldAnswer } from '@qub/shared/forms';
import { and, count, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { Database, Executor } from '../../db';
import { formResponseAnswers, formResponses, forms, formUploads } from '../../db/schema';
import type { StorageService } from '../../services/storage';
import { AppError, notFound, unauthenticated, unprocessable } from '../../utils/errors';
import { sanitizeFilename } from '../../utils/filename';
import { mimeCategory } from '../../utils/mime';
import { decodeKeysetCursor, encodeKeysetCursor } from '../../utils/pagination';
import { isUniqueViolation } from '../../utils/pg';
import type { ActivityService } from '../activity/activity.service';
import { csvCell } from '../../utils/csv';
import type { PolicyService } from '../admin/policy.service';
import type { UsageService } from '../admin/usage.service';
import type { NotificationService } from '../notifications/notification.service';
import { UserRepository } from '../users/user.repository';
import { FormRepository } from './form.repository';
import type { FormService } from './form.service';

export interface ResponseBroadcaster {
  responseReceived(formId: string, responseCount: number, submittedAt: string): void;
}

export interface Respondent {
  userId: string | null;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
}

const MAX_SAMPLES = 20;

export class ResponseService {
  private broadcaster: ResponseBroadcaster | null = null;

  constructor(
    private readonly db: Database,
    private readonly forms: FormService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationService,
    private readonly activity: ActivityService,
    private readonly policies: PolicyService,
    private readonly usage: UsageService,
  ) {}

  attachBroadcaster(b: ResponseBroadcaster): void {
    this.broadcaster = b;
  }

  private async publicForm(publicId: string) {
    const row = await FormRepository.findByPublicId(this.db, publicId);
    // Unpublished and trashed forms are indistinguishable from missing ones for respondents.
    if (!row || !row.form.isPublished || row.file.isTrashed) throw notFound('form');
    return row;
  }

  private async settingsOf(form: typeof forms.$inferSelect) {
    const orgRequiresSignIn = (await this.policies.get()).forms.requireSignIn;
    const settings = { ...DEFAULT_FORM_SETTINGS, ...form.settings };
    return orgRequiresSignIn ? { ...settings, requireSignIn: true } : settings;
  }

  async getPublic(publicId: string, respondent: Respondent, countView: boolean): Promise<PublicFormDto> {
    const { form, file } = await this.publicForm(publicId);
    const settings = await this.settingsOf(form);
    if (settings.requireSignIn && !respondent.userId) throw unauthenticated('Sign in to fill out this form.');
    if (countView) await this.db.update(forms).set({ viewCount: sql`${forms.viewCount} + 1` }).where(eq(forms.id, form.id));
    const [fields, variables, theme] = await Promise.all([
      FormRepository.fields(this.db, form.id),
      FormRepository.variables(this.db, form.id),
      FormRepository.theme(this.db, form.id),
    ]);
    let alreadyResponded = false;
    if (respondent.userId && settings.limitOneResponse) {
      const [r] = await this.db.select({ id: formResponses.id }).from(formResponses).where(and(eq(formResponses.formId, form.id), eq(formResponses.respondentId, respondent.userId))).limit(1);
      alreadyResponded = !!r;
    }
    // Quiz answers and points stay on the server.
    const publicFields = settings.quiz.enabled ? fields.map((f) => ({ ...f, scoreConfig: null })) : fields;
    return {
      publicId,
      title: file.name,
      description: form.description,
      settings,
      theme: {
        primaryColor: theme?.primaryColor ?? '#673ab7',
        backgroundColor: theme?.backgroundColor ?? '#f0ebf8',
        fontFamily: theme?.fontFamily ?? 'sans',
        headerImageUrl: theme?.headerImageUrl ?? null,
        extras: theme?.extras ?? {},
      },
      fields: publicFields,
      variables,
      acceptingResponses: form.acceptingResponses,
      alreadyResponded,
      signedInEmail: respondent.email,
    };
  }

  /** Stores a respondent upload for a FILE_UPLOAD question, enforcing the question's size and type limits. */
  async upload(publicId: string, fieldId: string, respondent: Respondent, source: { stream: Readable; filename: string }) {
    const { form, file } = await this.publicForm(publicId);
    const settings = await this.settingsOf(form);
    if (settings.requireSignIn && !respondent.userId) throw unauthenticated('Sign in to fill out this form.');
    if (!form.acceptingResponses) throw new AppError('CONFLICT', 'This form is no longer accepting responses.');
    const fields = await FormRepository.fields(this.db, form.id);
    const field = fields.find((f) => f.id === fieldId);
    if (!field || (field.type !== 'FILE_UPLOAD' && field.type !== 'SIGNATURE')) throw notFound('question');
    const isSignature = field.type === 'SIGNATURE';
    const maxBytes = (isSignature ? 2 : (field.settings.maxFileSizeMb ?? 10)) * 1024 * 1024;
    const filename = sanitizeFilename(source.filename, 'upload');
    const key = this.storage.newKey('forms', form.id);
    // Respondent uploads are stored in the form owner's storage.
    const policies = await this.policies.get();
    const budget = await this.usage.uploadBudget(file.ownerId, maxBytes, 'owner');
    const stored = await this.storage.ingest(source.stream, { filename, key, ...budget, blockedExtensions: policies.uploads.blockedExtensions });
    const allowed = isSignature ? (['image'] as const) : field.settings.allowedFileTypes;
    if (allowed?.length && !allowed.includes(mimeCategory(stored.mimeType) as never)) {
      await this.storage.safeDelete(stored.key);
      throw new AppError('UNSUPPORTED_MEDIA_TYPE', `Allowed file types: ${allowed.join(', ')}.`);
    }
    const [row] = await this.db
      .insert(formUploads)
      .values({ formId: form.id, fieldId, uploaderId: respondent.userId, storageKey: stored.key, originalName: filename, mimeType: stored.mimeType, size: stored.size, checksum: stored.checksum })
      .returning();
    return { id: row!.id, name: filename, size: stored.size, mimeType: stored.mimeType };
  }

  /**
   * Validates and stores a submission. The path is recomputed on the server with the same engine the browser uses:
   * required questions are enforced only on the path, answers off the path are discarded, and variables, score,
   * ending and redirect are computed here — client-sent values are never trusted.
   */
  async submit(publicId: string, raw: SubmitResponseInput, respondent: Respondent): Promise<SubmitResponseResult> {
    const input = submitResponseSchema.parse(raw);
    const { form, file } = await this.publicForm(publicId);
    const settings = await this.settingsOf(form);
    if (settings.requireSignIn && !respondent.userId) throw unauthenticated('Sign in to fill out this form.');
    const [fields, variables] = await Promise.all([FormRepository.fields(this.db, form.id), FormRepository.variables(this.db, form.id)]);
    const def: FormDefinition = { fields, variables };
    const byId = new Map(fields.map((f) => [f.id, f]));

    // HIDDEN fields are filled only from `hidden` (URL parameters), never from `answers`.
    const answers: Answers = {};
    for (const [id, value] of Object.entries(input.answers)) if (byId.has(id) && byId.get(id)!.type !== 'HIDDEN') answers[id] = value;
    Object.assign(answers, hiddenAnswers(def, input.hidden ?? {}));
    const result = evaluateForm(def, answers);
    const reachable = result.path.map((id) => byId.get(id)!);
    const hiddenFields = fields.filter((f) => f.type === 'HIDDEN');

    const fieldErrors: Record<string, string> = {};
    const issues: { fieldId: string; code: string; message: string }[] = [];
    for (const f of [...reachable, ...hiddenFields]) {
      const problem = validateFieldAnswer(f, answers[f.id]);
      if (problem) {
        fieldErrors[f.id] = problem.message;
        issues.push({ fieldId: f.id, ...problem });
      }
    }
    const email = settings.collectEmail ? (respondent.email ?? input.email ?? null) : respondent.email;
    if (settings.collectEmail && !email) {
      fieldErrors.email = 'Email is required';
      issues.push({ fieldId: 'email', code: 'required', message: 'Email is required' });
    }
    if (issues.length) throw unprocessable('Some answers need attention.', { fieldErrors, issues });

    const stored = [...reachable.filter((f) => QUESTION_TYPES[f.type].isInput), ...hiddenFields].filter((f) => isAnswered(answers[f.id]));
    const fileFields = stored.filter((f) => f.type === 'FILE_UPLOAD' || f.type === 'SIGNATURE');
    const uploadIds = fileFields.flatMap((f) => answers[f.id] as string[]);
    const outcome = resolveOutcome(def, answers, result, settings.confirmationMessage);
    const scored = fields.some((f) => f.scoreConfig);
    const findPrior = async (tx: Executor) => {
      if (!input.clientSubmissionId) return undefined;
      const [prior] = await tx
        .select({ id: formResponses.id })
        .from(formResponses)
        .where(and(eq(formResponses.formId, form.id), eq(formResponses.clientSubmissionId, input.clientSubmissionId)))
        .limit(1);
      return prior;
    };

    let saved: { responseId: string; total: number; submittedAt: Date | null };
    try {
      saved = await this.db.transaction(async (tx) => {
        // Lock the form row: serialises retries, the one-response check and the accepting-responses check.
        const [locked] = await tx.select().from(forms).where(eq(forms.id, form.id)).for('update');
        const prior = await findPrior(tx);
        if (prior) return { responseId: prior.id, total: 0, submittedAt: null };
        if (!locked?.isPublished || !locked.acceptingResponses) throw new AppError('CONFLICT', 'This form is no longer accepting responses.');
        if (settings.limitOneResponse && respondent.userId) {
          const [other] = await tx.select({ id: formResponses.id }).from(formResponses).where(and(eq(formResponses.formId, form.id), eq(formResponses.respondentId, respondent.userId))).limit(1);
          if (other) throw new AppError('CONFLICT', 'You have already responded to this form.');
        }
        if (uploadIds.length) {
          const uploads = await tx.select().from(formUploads).where(inArray(formUploads.id, uploadIds));
          const valid = uploads.filter((u) => u.formId === form.id && u.responseId === null && (u.uploaderId === null || u.uploaderId === respondent.userId));
          if (valid.length !== new Set(uploadIds).size) throw unprocessable('One or more uploaded files are invalid.');
          for (const f of fileFields) {
            if ((answers[f.id] as string[]).some((id) => valid.find((u) => u.id === id)?.fieldId !== f.id)) throw unprocessable('An uploaded file belongs to another question.');
          }
        }
        const [response] = await tx
          .insert(formResponses)
          .values({
            formId: form.id,
            respondentId: respondent.userId,
            respondentEmail: email,
            ipAddress: respondent.ip,
            userAgent: respondent.userAgent?.slice(0, 500) ?? null,
            score: scored ? result.score : null,
            computed: result.variables,
            endingId: outcome.endingId,
            clientSubmissionId: input.clientSubmissionId ?? null,
            startedAt: input.startedAt ? new Date(input.startedAt) : null,
          })
          .returning();
        if (stored.length) await tx.insert(formResponseAnswers).values(stored.map((f) => ({ responseId: response!.id, fieldId: f.id, ...this.typedValue(f, answers[f.id]!) })));
        if (uploadIds.length) await tx.update(formUploads).set({ responseId: response!.id }).where(inArray(formUploads.id, uploadIds));
        const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(formResponses).where(eq(formResponses.formId, form.id));
        await this.activity.record(
          { userId: respondent.userId, action: 'FORM_RESPONSE_SUBMITTED', resourceType: 'FILE', resourceId: file.id, resourceName: file.name, metadata: { responseId: response!.id } },
          tx,
        );
        return { responseId: response!.id, total: n, submittedAt: response!.submittedAt };
      });
    } catch (e) {
      // Two identical retries raced past the lock-free window: the unique index kept one; return it.
      if (!input.clientSubmissionId || !isUniqueViolation(e)) throw e;
      const prior = await findPrior(this.db);
      if (!prior) throw e;
      saved = { responseId: prior.id, total: 0, submittedAt: null };
    }

    if (saved.submittedAt) {
      await this.notifications.upsertUnread(
        { userId: file.ownerId, actorId: respondent.userId, type: 'FORM_RESPONSE', title: '', link: `/forms/${form.id}/responses`, resourceType: 'FILE', resourceId: file.id },
        (prior) => (prior > 0 ? `${prior + 1} new responses to "${file.name}"` : `New response to "${file.name}"`),
      );
      this.broadcaster?.responseReceived(form.id, saved.total, saved.submittedAt.toISOString());
    }
    return {
      id: saved.responseId,
      confirmationMessage: outcome.message,
      endingId: outcome.endingId,
      title: outcome.title,
      message: outcome.message,
      redirectUrl: outcome.redirectUrl,
      endingButtonUrl: outcome.endingButtonUrl,
      endingRedirectUrl: outcome.endingRedirectUrl,
      score: settings.quiz.enabled && settings.quiz.showScore ? result.score : null,
    };
  }

  /** Maps an answer to the typed column declared by its question type. */
  private typedValue(field: FormFieldDto, value: AnswerValue) {
    switch (QUESTION_TYPES[field.type].storage) {
      case 'number':
        return { valueNumber: Number(value) };
      case 'date':
        return { valueDate: String(value) };
      case 'json':
        return { valueJson: value };
      default:
        return { valueText: String(value) };
    }
  }

  // ---------- owner-side ----------

  async list(userId: string, formId: string, opts: { cursor?: string; limit: number }): Promise<{ items: FormResponseDto[]; nextCursor: string | null; total: number }> {
    await this.forms.access(userId, formId, 'EDITOR');
    const after = decodeKeysetCursor(opts.cursor);
    const rows = await this.db
      .select()
      .from(formResponses)
      .where(
        and(
          eq(formResponses.formId, formId),
          after ? or(lt(formResponses.submittedAt, after.at), and(eq(formResponses.submittedAt, after.at), lt(formResponses.id, after.id))) : undefined,
        ),
      )
      .orderBy(desc(formResponses.submittedAt), desc(formResponses.id))
      .limit(opts.limit + 1);
    const page = rows.slice(0, opts.limit);
    const [{ n } = { n: 0 }] = await this.db.select({ n: count() }).from(formResponses).where(eq(formResponses.formId, formId));
    return {
      items: await this.toDtos(page),
      nextCursor: rows.length > opts.limit ? encodeKeysetCursor(page.at(-1)!.submittedAt, page.at(-1)!.id) : null,
      total: n,
    };
  }

  private async toDtos(responses: (typeof formResponses.$inferSelect)[]): Promise<FormResponseDto[]> {
    if (!responses.length) return [];
    const ids = responses.map((r) => r.id);
    const [answers, uploads, users] = await Promise.all([
      this.db.select().from(formResponseAnswers).where(inArray(formResponseAnswers.responseId, ids)),
      this.db.select().from(formUploads).where(inArray(formUploads.responseId, ids)),
      UserRepository.summaries(this.db, responses.map((r) => r.respondentId!).filter(Boolean)),
    ]);
    return responses.map((r) => ({
      id: r.id,
      respondent: r.respondentId ? (users.get(r.respondentId) ?? null) : null,
      email: r.respondentEmail,
      submittedAt: r.submittedAt.toISOString(),
      score: r.score,
      computed: r.computed,
      endingId: r.endingId,
      answers: answers
        .filter((a) => a.responseId === r.id)
        .map((a) => {
          const files = uploads.filter((u) => u.responseId === r.id && u.fieldId === a.fieldId);
          return {
            fieldId: a.fieldId,
            value: a.valueNumber ?? a.valueDate ?? a.valueJson ?? a.valueText,
            files: files.length ? files.map((u) => ({ id: u.id, name: u.originalName, size: u.size })) : undefined,
          };
        }),
    }));
  }

  async getOne(userId: string, formId: string, responseId: string): Promise<FormResponseDto> {
    await this.forms.access(userId, formId, 'EDITOR');
    const [row] = await this.db.select().from(formResponses).where(and(eq(formResponses.id, responseId), eq(formResponses.formId, formId))).limit(1);
    if (!row) throw notFound('response');
    return (await this.toDtos([row]))[0]!;
  }

  async remove(userId: string, formId: string, responseId: string): Promise<void> {
    await this.forms.access(userId, formId, 'EDITOR');
    const uploads = await this.db.select({ key: formUploads.storageKey }).from(formUploads).where(eq(formUploads.responseId, responseId));
    const deleted = await this.db.delete(formResponses).where(and(eq(formResponses.id, responseId), eq(formResponses.formId, formId))).returning({ id: formResponses.id });
    if (!deleted.length) throw notFound('response');
    await this.storage.safeDelete(...uploads.map((u) => u.key));
  }

  async uploadForDownload(userId: string, formId: string, uploadId: string) {
    await this.forms.access(userId, formId, 'EDITOR');
    const [row] = await this.db.select().from(formUploads).where(and(eq(formUploads.id, uploadId), eq(formUploads.formId, formId))).limit(1);
    if (!row || !row.responseId) throw notFound('file');
    return row;
  }

  /** Streams all responses as CSV (one column per question, then score and variables), in pages. */
  async *exportCsv(userId: string, formId: string): AsyncGenerator<string> {
    await this.forms.access(userId, formId, 'EDITOR');
    const all = await FormRepository.fields(this.db, formId);
    const variables = await FormRepository.variables(this.db, formId);
    const fields = all.filter((f) => QUESTION_TYPES[f.type].isInput);
    const scored = all.some((f) => f.scoreConfig);
    const esc = csvCell;
    yield `${['Timestamp', 'Email', ...fields.map((f) => f.label || f.ref), ...(scored ? ['Score'] : []), ...variables.map((v) => v.key)].map(esc).join(',')}\n`;
    let cursor: string | undefined;
    do {
      const page = await this.list(userId, formId, { cursor, limit: 200 });
      for (const r of page.items) {
        const cells = fields.map((f) => {
          const a = r.answers.find((x) => x.fieldId === f.id);
          if (!a) return '';
          if (a.files) return a.files.map((x) => x.name).join('; ');
          return displayAnswer(f, a.value);
        });
        const extra = [...(scored ? [r.score ?? ''] : []), ...variables.map((v) => r.computed[v.key] ?? '')];
        yield `${[r.submittedAt, r.email ?? r.respondent?.email ?? '', ...cells, ...extra].map(esc).join(',')}\n`;
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }

  /** Analytics computed with SQL aggregation over stored answers — never sampled or invented. */
  async analytics(userId: string, formId: string, opts: { days: number }): Promise<FormAnalyticsDto> {
    const { form } = await this.forms.access(userId, formId, 'EDITOR');
    const fields = await FormRepository.fields(this.db, formId);
    const [totals] = (await this.db.execute(sql`
      select count(*)::int as total, min(submitted_at) as first_at, max(submitted_at) as last_at
      from form_responses where form_id = ${formId}`)) as unknown as { total: number; first_at: Date | null; last_at: Date | null }[];
    const total = totals?.total ?? 0;

    const trend = (await this.db.execute(sql`
      select to_char(d.day, 'YYYY-MM-DD') as date, coalesce(c.n, 0)::int as count
      from generate_series((current_date - ${opts.days - 1}::int)::timestamp, current_date::timestamp, interval '1 day') as d(day)
      left join (
        select date_trunc('day', submitted_at) as day, count(*) as n
        from form_responses where form_id = ${formId} and submitted_at >= current_date - ${opts.days - 1}::int
        group by 1
      ) c on c.day = d.day
      order by d.day`)) as unknown as { date: string; count: number }[];

    const answeredRows = (await this.db.execute(sql`
      select a.field_id, count(*)::int as n
      from form_response_answers a join form_responses r on r.id = a.response_id
      where r.form_id = ${formId} group by a.field_id`)) as unknown as { field_id: string; n: number }[];
    const answered = new Map(answeredRows.map((r) => [r.field_id, r.n]));

    const out: FieldAnalyticsDto[] = [];
    type Row = { key: string; n: number };
    for (const f of fields) {
      const def = QUESTION_TYPES[f.type];
      if (!def.isInput || def.analyticsKind === 'none') continue;
      const n = answered.get(f.id) ?? 0;
      const base: FieldAnalyticsDto = { fieldId: f.id, label: f.label, type: f.type, answered: n, skipped: Math.max(0, total - n) };
      const pct = (c: number) => (n === 0 ? 0 : Math.round((c / n) * 1000) / 10);
      const dist = (keys: { key: string; label: string }[], rows: Row[]) => keys.map((k) => { const c = rows.find((r) => r.key === k.key)?.n ?? 0; return { key: k.key, label: k.label, count: c, percentage: pct(c) }; });

      switch (def.analyticsKind) {
        case 'choice': {
          const rows = (await this.db.execute(sql`select value_text as key, count(*)::int as n from form_response_answers where field_id = ${f.id} group by value_text`)) as unknown as Row[];
          base.distribution = dist(optionsOfKind(f).map((o) => ({ key: o.id, label: o.label })), rows);
          break;
        }
        case 'multi': {
          const rows = (await this.db.execute(sql`
            select opt as key, count(*)::int as n from form_response_answers, jsonb_array_elements_text(value_json) as opt
            where field_id = ${f.id} group by opt`)) as unknown as Row[];
          base.distribution = dist(optionsOfKind(f).map((o) => ({ key: o.id, label: o.label })), rows);
          break;
        }
        case 'boolean': {
          const rows = (await this.db.execute(sql`select value_json::text as key, count(*)::int as n from form_response_answers where field_id = ${f.id} group by 1`)) as unknown as Row[];
          base.distribution = dist([{ key: 'true', label: def.display(f, true) }, { key: 'false', label: def.display(f, false) }], rows);
          break;
        }
        case 'numeric':
        case 'scale': {
          const [stats] = (await this.db.execute(sql`
            select avg(value_number)::float as average, min(value_number)::float as min, max(value_number)::float as max,
                   sum(value_number)::float as sum, percentile_cont(0.5) within group (order by value_number)::float as median
            from form_response_answers where field_id = ${f.id}`)) as unknown as { average: number | null; min: number | null; max: number | null; sum: number | null; median: number | null }[];
          base.numeric = {
            average: stats?.average != null ? Math.round(stats.average * 100) / 100 : null,
            min: stats?.min ?? null,
            max: stats?.max ?? null,
            median: stats?.median ?? null,
            sum: stats?.sum ?? null,
          };
          const bounds = scaleBounds(f);
          if (bounds) {
            const rows = (await this.db.execute(sql`select value_number::int::text as key, count(*)::int as n from form_response_answers where field_id = ${f.id} group by 1`)) as unknown as Row[];
            const keys = Array.from({ length: bounds[1] - bounds[0] + 1 }, (_, i) => String(bounds[0] + i));
            base.distribution = dist(keys.map((k) => ({ key: k, label: k })), rows);
            if (f.type === 'NPS') {
              const count = (lo: number, hi: number) => base.distribution!.filter((d) => Number(d.key) >= lo && Number(d.key) <= hi).reduce((s, d) => s + d.count, 0);
              const promoters = count(9, 10);
              const passives = count(7, 8);
              const detractors = count(0, 6);
              base.nps = { promoters, passives, detractors, score: n === 0 ? 0 : Math.round(((promoters - detractors) / n) * 100) };
            }
          }
          break;
        }
        case 'date': {
          const rows = (await this.db.execute(sql`
            select to_char(value_date, 'YYYY-MM-DD') as key, count(*)::int as n from form_response_answers
            where field_id = ${f.id} group by 1 order by 1 limit 60`)) as unknown as Row[];
          base.distribution = rows.map((r) => ({ key: r.key, label: r.key, count: r.n, percentage: pct(r.n) }));
          break;
        }
        case 'matrix': {
          const rows = (await this.db.execute(sql`
            select e.key as row_id, e.value as col_id, count(*)::int as n
            from form_response_answers a, jsonb_each_text(a.value_json) e where a.field_id = ${f.id} group by 1, 2`)) as unknown as { row_id: string; col_id: string; n: number }[];
          const columns = optionsOfKind(f, 'column');
          base.matrix = optionsOfKind(f, 'row').map((row) => {
            const inRow = rows.filter((r) => r.row_id === row.id);
            const rowTotal = inRow.reduce((s, r) => s + r.n, 0);
            return {
              rowId: row.id,
              label: row.label,
              distribution: columns.map((c) => {
                const count = inRow.find((r) => r.col_id === c.id)?.n ?? 0;
                return { key: c.id, label: c.label, count, percentage: rowTotal === 0 ? 0 : Math.round((count / rowTotal) * 1000) / 10 };
              }),
            };
          });
          break;
        }
        case 'ranking': {
          const rows = (await this.db.execute(sql`
            select t.opt as key, avg(t.idx)::float as avg
            from form_response_answers a, jsonb_array_elements_text(a.value_json) with ordinality as t(opt, idx)
            where a.field_id = ${f.id} group by 1`)) as unknown as { key: string; avg: number }[];
          base.ranking = optionsOfKind(f)
            .map((o) => ({ key: o.id, label: o.label, averageRank: Math.round((rows.find((r) => r.key === o.id)?.avg ?? 0) * 100) / 100 }))
            .sort((a, b) => (a.averageRank || Infinity) - (b.averageRank || Infinity));
          break;
        }
        case 'text': {
          const rows = (await this.db.execute(sql`
            select a.value_text, a.value_json from form_response_answers a join form_responses r on r.id = a.response_id
            where a.field_id = ${f.id} order by r.submitted_at desc limit ${MAX_SAMPLES}`)) as unknown as { value_text: string | null; value_json: AnswerValue }[];
          base.samples = rows.map((r) => (r.value_text ?? displayAnswer(f, r.value_json)));
          break;
        }
        case 'file':
          break;
      }
      out.push(base);
    }

    return {
      totalResponses: total,
      views: form.viewCount,
      responseRate: form.viewCount > 0 ? Math.min(1, total / form.viewCount) : null,
      firstResponseAt: totals?.first_at ? new Date(totals.first_at).toISOString() : null,
      lastResponseAt: totals?.last_at ? new Date(totals.last_at).toISOString() : null,
      trend,
      fields: out,
    };
  }

  /** Removes respondent uploads that were never attached to a submission. */
  async purgeOrphanUploads(olderThan: Date): Promise<number> {
    const rows = await this.db.delete(formUploads).where(and(isNull(formUploads.responseId), lt(formUploads.createdAt, olderThan))).returning({ key: formUploads.storageKey });
    await this.storage.safeDelete(...rows.map((r) => r.key));
    return rows.length;
  }
}
