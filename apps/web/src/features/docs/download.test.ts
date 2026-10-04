import { documentExtensions } from '@qub/editor-schema';
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { buildStandaloneHtml, documentFile, embedImages, sanitizeFilename } from './download';

let editor: Editor | null = null;
afterEach(() => editor?.destroy());

describe('sanitizeFilename', () => {
  it('replaces characters that file systems reject and falls back when empty', () => {
    expect(sanitizeFilename('Q3: plan / budget?')).toBe('Q3_ plan _ budget_');
    expect(sanitizeFilename('   ')).toBe('Untitled document');
    expect(sanitizeFilename('...hidden')).toBe('hidden');
    expect(sanitizeFilename('x'.repeat(300))).toHaveLength(150);
  });
});

describe('buildStandaloneHtml', () => {
  it('escapes the title and makes root-relative image URLs absolute', () => {
    const html = buildStandaloneHtml('A <b> & "c"', '<p>x</p><img src="/api/files/1"><img src="https://cdn.x/y.png"><img src="//cdn.x/z.png">', 'https://qub.test');
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<title>A &lt;b&gt; &amp; &quot;c&quot;</title>');
    expect(html).toContain('src="https://qub.test/api/files/1"');
    expect(html).toContain('src="https://cdn.x/y.png"');
    expect(html).toContain('src="//cdn.x/z.png"');
    expect(html).toContain('<p>x</p>');
  });
});

describe('documentFile', () => {
  it('builds each format from the live editor', async () => {
    editor = new Editor({
      extensions: documentExtensions(),
      content: '<h1>Plan</h1><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Buy milk</p></li></ul>',
    });
    const md = await documentFile(editor, 'My: plan', 'md', 'https://qub.test');
    expect(md).toMatchObject({ filename: 'My_ plan.md', mime: 'text/markdown;charset=utf-8' });
    expect(md.content).toBe('# Plan\n\n- [x] Buy milk\n');
    expect((await documentFile(editor, 'My: plan', 'txt')).content).toBe('Plan\n\n☑ Buy milk');
    const html = await documentFile(editor, 'My: plan', 'html', 'https://qub.test');
    expect(html.filename).toBe('My_ plan.html');
    expect(html.content).toContain('<h1>Plan</h1>');
    expect(html.content).toContain('<title>My: plan</title>');
  });
});

describe('embedImages', () => {
  const png = new Uint8Array([137, 80, 78, 71]);
  const doc = {
    type: 'doc',
    content: [
      { type: 'image', attrs: { src: '/api/docs/1/assets/a', alt: 'mine' } },
      { type: 'image', attrs: { src: 'https://cdn.example/x.png', alt: 'external' } },
    ],
  };

  it('inlines Qub-hosted images as data URIs (so downloads work offline) and leaves external ones alone', async () => {
    const requested: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      requested.push(`${url} ${init?.credentials}`);
      return new Response(png, { headers: { 'content-type': 'image/png' } });
    }) as typeof fetch;
    const { doc: out, failed } = await embedImages(doc, 'https://qub.test', fetchImpl);
    expect(failed).toBe(0);
    expect(requested).toEqual(['https://qub.test/api/docs/1/assets/a include']);
    expect(out.content?.[0]?.attrs?.src).toBe('data:image/png;base64,iVBORw==');
    expect(out.content?.[1]?.attrs?.src).toBe('https://cdn.example/x.png');
    expect(doc.content[0]!.attrs.src).toBe('/api/docs/1/assets/a'); // input untouched
  });

  it('reports images it could not fetch and links them absolutely instead', async () => {
    const fetchImpl = (async () => new Response('no', { status: 401 })) as typeof fetch;
    const { doc: out, failed } = await embedImages(doc, 'https://qub.test', fetchImpl);
    expect(failed).toBe(1);
    expect(out.content?.[0]?.attrs?.src).toBe('https://qub.test/api/docs/1/assets/a');
  });

  it('embeds images in the HTML and Markdown downloads', async () => {
    editor = new Editor({ extensions: documentExtensions(), content: '<p>x</p><img src="/api/docs/1/assets/a" alt="pic">' });
    const fetchImpl = (async () => new Response(png, { headers: { 'content-type': 'image/png' } })) as typeof fetch;
    const html = await documentFile(editor, 'Doc', 'html', 'https://qub.test', fetchImpl);
    expect(html.content).toContain('src="data:image/png;base64,iVBORw=="');
    const md = await documentFile(editor, 'Doc', 'md', 'https://qub.test', fetchImpl);
    expect(md.content).toContain('![pic](data:image/png;base64,iVBORw==)');
  });
});
