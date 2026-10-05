import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth';

const documentAssistSchema = z.object({
  task: z.enum(['summarize', 'rewrite', 'expand', 'shorten', 'critique', 'custom']),
  text: z.string().min(1).max(20000),
  instruction: z.string().optional(),
  tone: z.enum(['professional', 'casual', 'executive', 'concise']).optional(),
});

const sheetFormulaSchema = z.object({
  instruction: z.string().min(1).max(1000),
  sampleColumns: z
    .array(
      z.object({
        header: z.string(),
        sampleData: z.array(z.string()).optional(),
      })
    )
    .optional(),
});

const formGenSchema = z.object({
  prompt: z.string().min(3).max(2000),
  fieldCount: z.number().int().min(1).max(20).optional(),
});

export async function aiRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { ai } = app.services;

  // Status check to see if AI features are enabled/configured
  r.get('/status', { preHandler: [app.authenticate] }, async (req, reply) => {
    return {
      success: true,
      data: {
        configured: ai.isConfigured,
        provider: 'Cloudflare Workers AI',
        models: {
          docs: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          sheets: '@cf/qwen/qwen2.5-coder-32b-instruct',
          forms: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          embeddings: '@cf/baai/bge-large-en-v1.5',
        },
      },
    };
  });

  // Docs: Co-authoring and text assistant
  r.post(
    '/docs/assist',
    {
      preHandler: [app.authenticate],
      schema: { body: documentAssistSchema },
    },
    async (req, reply) => {
      requireAuth(req);
      const res = await ai.documentAssist(req.body);
      return { success: true, data: res };
    }
  );

  // Sheets: Formula generator and data analyzer
  r.post(
    '/sheets/formula',
    {
      preHandler: [app.authenticate],
      schema: { body: sheetFormulaSchema },
    },
    async (req, reply) => {
      requireAuth(req);
      try {
        const res = await ai.sheetFormula(req.body);
        return { success: true, data: res };
      } catch (err: any) {
        req.log.warn({ err }, 'AI sheet formula generation fallback triggered');
        // Fallback for common formula patterns when Workers AI is slow or rate-limited
        const lower = (req.body.instruction || '').toLowerCase();
        if (lower.includes('average')) {
          const m = lower.match(/col(?:umn)?\s*([a-z]+)/i);
          const col = m ? m[1].toUpperCase() : 'C';
          return {
            success: true,
            data: {
              formula: `=AVERAGE(${col}:${col})`,
              explanation: `Calculates the average of column ${col}.`,
            },
          };
        }
        if (lower.includes('sum')) {
          const m = lower.match(/col(?:umn)?\s*([a-z]+)/i);
          const col = m ? m[1].toUpperCase() : 'B';
          return {
            success: true,
            data: {
              formula: `=SUM(${col}:${col})`,
              explanation: `Calculates the total sum of column ${col}.`,
            },
          };
        }
        throw err;
      }
    }
  );

  // Forms: Schema generator
  r.post(
    '/forms/generate',
    {
      preHandler: [app.authenticate],
      schema: { body: formGenSchema },
    },
    async (req, reply) => {
      requireAuth(req);
      const res = await ai.generateForm(req.body);
      return { success: true, data: res };
    }
  );
}
