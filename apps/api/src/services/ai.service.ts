import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../config/env';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DocumentAssistInput {
  task: 'summarize' | 'rewrite' | 'expand' | 'shorten' | 'critique' | 'custom';
  text: string;
  instruction?: string;
  tone?: 'professional' | 'casual' | 'executive' | 'concise';
}

export interface SheetFormulaInput {
  instruction: string;
  sampleColumns?: { header: string; sampleData?: string[] }[];
}

export interface FormGenInput {
  prompt: string;
  fieldCount?: number;
}

export class AIService {
  private convertToRichHtml(text: string): string {
    let cleaned = text
      .replace(/^```(?:html)?\s*/gi, '')
      .replace(/```\s*$/gi, '')
      .trim();

    // If text already has HTML table or markup, keep it
    if (cleaned.includes('<table') || cleaned.includes('<ul') || cleaned.includes('<ol')) {
      return cleaned
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    // Convert markdown tables | col1 | col2 | to HTML <table>
    const lines = cleaned.split('\n');
    const out: string[] = [];
    let inTable = false;
    let tableLines: string[] = [];

    const flushTable = () => {
      if (tableLines.length === 0) return;
      let htmlTbl = '<table style="width:100%;border-collapse:collapse;margin:1em 0;">';
      let inThead = true;
      for (const row of tableLines) {
        if (row.includes('---')) {
          inThead = false;
          continue;
        }
        const cells = row.split('|').map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (cells.length === 0) continue;
        const tag = inThead ? 'th' : 'td';
        const cellHtml = cells
          .map((c) => `<${tag} style="border:1px solid #c4c7c5;padding:8px 12px;text-align:left;">${c}</${tag}>`)
          .join('');
        if (inThead) {
          htmlTbl += `<thead><tr>${cellHtml}</tr></thead><tbody>`;
          inThead = false;
        } else {
          htmlTbl += `<tr>${cellHtml}</tr>`;
        }
      }
      htmlTbl += '</tbody></table>';
      out.push(htmlTbl);
      tableLines = [];
      inTable = false;
    };

    let inList = false;
    const flushList = () => {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
    };

    for (const line of lines) {
      const s = line.trim();
      // Markdown table row
      if (s.startsWith('|') && s.endsWith('|')) {
        flushList();
        inTable = true;
        tableLines.push(s);
      } else {
        if (inTable) flushTable();
        // Bullet list item
        if (/^[-*•]\s+/.test(s)) {
          if (!inList) {
            out.push('<ul style="padding-left:1.5em;margin:0.5em 0;">');
            inList = true;
          }
          const itemText = s.replace(/^[-*•]\s+/, '')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
          out.push(`<li>${itemText}</li>`);
        } else {
          flushList();
          if (s) {
            // Heading or paragraph
            if (s.startsWith('### ')) {
              out.push(`<h3>${s.slice(4)}</h3>`);
            } else if (s.startsWith('## ')) {
              out.push(`<h2>${s.slice(3)}</h2>`);
            } else if (s.startsWith('# ')) {
              out.push(`<h1>${s.slice(2)}</h1>`);
            } else {
              const formatted = s
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>');
              out.push(`<p>${formatted}</p>`);
            }
          }
        }
      }
    }
    if (inTable) flushTable();
    flushList();

    return out.join('\n');
  }

  private extractRawText(result: any): string {
    if (!result) return '';
    if (typeof result.response === 'string') return result.response;
    if (result.choices?.[0]?.message?.content) return result.choices[0].message.content;
    if (typeof result === 'string') return result;
    return JSON.stringify(result);
  }

  private extractText(result: any): string {
    if (!result) return '';
    if (typeof result.response === 'string') return this.convertToRichHtml(result.response);
    if (result.choices?.[0]?.message?.content) return this.convertToRichHtml(result.choices[0].message.content);
    const raw = typeof result === 'string' ? result : JSON.stringify(result);
    return this.convertToRichHtml(raw);
  }
  private accountId?: string;
  private apiToken?: string;

  constructor(
    private readonly env: Env,
    private readonly log: FastifyBaseLogger,
  ) {
    this.accountId = env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = env.CLOUDFLARE_API_TOKEN;
  }

  get isConfigured(): boolean {
    return Boolean(this.accountId && this.apiToken);
  }

  /**
   * Core runner to call Cloudflare Workers AI models directly via REST API.
   */
  async runModel<T = any>(model: string, body: Record<string, any>): Promise<T> {
    if (!this.isConfigured) {
      throw new Error('Cloudflare Workers AI is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env');
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.log.error({ status: res.status, err, model }, 'Cloudflare Workers AI request failed');
      throw new Error(`Cloudflare Workers AI error: ${res.statusText}`);
    }

    const data = (await res.json()) as { success: boolean; result: T; errors?: any[] };
    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || 'Workers AI operation failed');
    }

    return data.result;
  }

  /**
   * Generate or assist document writing (Docs).
   */
  async documentAssist(input: DocumentAssistInput): Promise<{ result: string }> {
    const tone = input.tone ?? 'professional';
    let systemPrompt = `You are an expert co-author and editor in an enterprise document suite. Maintain an ${tone} tone.
FORMATTING RULES:
1. If the user asks for a table, list, or formatted structure, respond using clean semantic HTML (<table>, <thead>, <tbody>, <tr>, <th>, <td>, <p>, <ul>, <ol>, <li>).
2. Never output markdown asterisks (**bold** or *italic*), markdown tables with pipes (|---|), or markdown hashtags (#). Use <strong>, <em>, or headings.
3. If the user asks for standard text or a summary, return clean text or HTML paragraphs.
4. Do not wrap output in code fences. Return raw HTML or text directly.`;

    let userPrompt = '';
    switch (input.task) {
      case 'summarize':
        userPrompt = `Summarize the following document excerpt clearly with bullet points where helpful:\n\n${input.text}`;
        break;
      case 'rewrite':
        userPrompt = `Rewrite the following text to make it clear, polished, and compelling:\n\n${input.text}`;
        break;
      case 'expand':
        userPrompt = `Elaborate and provide more depth, examples, and detail for the following text:\n\n${input.text}`;
        break;
      case 'shorten':
        userPrompt = `Condense the following text while preserving all critical meaning:\n\n${input.text}`;
        break;
      case 'critique':
        userPrompt = `Review this text critically. Identify logical gaps, missing context, and areas of improvement:\n\n${input.text}`;
        break;
      case 'custom': {
        const promptInstruction = (input.instruction || '').trim();
        const docContext = (input.text || '').trim();
        if (promptInstruction) {
          userPrompt = docContext && docContext !== 'New document draft' && docContext !== 'Create content based on instruction'
            ? `${promptInstruction}\n\nReference / context from document:\n${docContext}`
            : promptInstruction;
        } else {
          userPrompt = docContext || 'Write a helpful response.';
        }
        break;
      }
    }

    const result = await this.runModel<{ response: string }>('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
    });

    return { result: this.extractText(result) };
  }

  /**
   * Natural language to spreadsheet formula (Sheets).
   */
  async sheetFormula(input: SheetFormulaInput): Promise<{ formula: string; explanation: string }> {
    const systemPrompt =
      'You are a spreadsheet formula expert (Excel/Google Sheets). When given a request, respond ONLY with a JSON object: {"formula": "=...", "explanation": "..."}. No extra markdown.';

    let userPrompt = `Request: ${input.instruction}`;
    if (input.sampleColumns && input.sampleColumns.length > 0) {
      userPrompt += `\nAvailable columns: ${JSON.stringify(input.sampleColumns)}`;
    }

    const result = await this.runModel<{ response: string }>('@cf/qwen/qwen2.5-coder-32b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 512,
    });

    const raw = this.extractRawText(result);
    // 1. Try parsing direct JSON
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.formula === 'string') {
        return {
          formula: parsed.formula.startsWith('=') ? parsed.formula : `=${parsed.formula}`,
          explanation: parsed.explanation || 'Formula generated successfully.',
        };
      }
    } catch {}

    // 2. Try JSON code fences or markdown blocks
    const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed && typeof parsed.formula === 'string') {
          return {
            formula: parsed.formula.startsWith('=') ? parsed.formula : `=${parsed.formula}`,
            explanation: parsed.explanation || 'Formula generated successfully.',
          };
        }
      } catch {}
    }

    // 3. Extract formula in excel/sheets code fence
    const fenceMatch = raw.match(/```(?:excel|sheets)?\s*(=[^\n`]+)\s*```/i);
    if (fenceMatch) {
      const formula = fenceMatch[1].trim();
      const explanation = raw.replace(fenceMatch[0], '').trim() || 'Formula generated from your instructions.';
      return { formula, explanation };
    }

    // 4. Look for an explicit formula line starting with =
    const lineMatch = raw.match(/(?:^|\n)\s*(=[A-Z0-9_]+(?:\([^)]*\)|[^\n]*))/i);
    if (lineMatch) {
      const formula = lineMatch[1].trim();
      const explanation = raw.replace(lineMatch[0], '').trim() || 'Formula generated from your instructions.';
      return { formula, explanation };
    }

    // 5. Fallback rule-based common spreadsheet requests
    const lower = input.instruction.toLowerCase();
    if (lower.includes('average') && (lower.includes('col') || lower.includes('c'))) {
      const colMatch = lower.match(/col(?:umn)?\s*([a-z]+)/i);
      const col = colMatch ? colMatch[1].toUpperCase() : 'C';
      return {
        formula: `=AVERAGE(${col}:${col})`,
        explanation: `Calculates the average of all numerical entries in column ${col}.`,
      };
    }

    return {
      formula: raw.trim().startsWith('=') ? raw.trim() : `=${raw.trim()}`,
      explanation: 'Generated by AI formula assistant.',
    };
  }

  /**
   * Prompt to Form Schema (Forms).
   */
  async generateForm(input: FormGenInput): Promise<{ title: string; description: string; fields: any[] }> {
    const count = input.fieldCount || 5;
    const systemPrompt = `You are a form generation assistant. Given a prompt, create a schema with exactly ${count} questions.
Respond strictly in JSON format matching this structure:
{
  "title": "Form Title",
  "description": "Form description",
  "fields": [
    {
      "label": "Question text",
      "type": "text | number | email | select | radio | checkbox | textarea",
      "required": true,
      "options": ["Option 1", "Option 2"] // only for select/radio/checkbox
    }
  ]
}
Do not include code markdown formatting or explanation.`;

    const result = await this.runModel<{ response: string }>('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input.prompt },
      ],
      max_tokens: 2048,
    });

    try {
      const text = this.extractText(result);
      return JSON.parse(text);
    } catch {
      // Fallback clean markdown blocks if needed
      const text = this.extractText(result);
      const clean = text.replace(/^```json/i, '').replace(/```$/, '').trim();
      return JSON.parse(clean);
    }
  }

  /**
   * Embeddings for Drive semantic search & RAG (Drive).
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const result = await this.runModel<{ shape: number[]; data: number[][] }>(
      '@cf/baai/bge-large-en-v1.5',
      { text: [text] }
    );
    return result.data[0];
  }
}
