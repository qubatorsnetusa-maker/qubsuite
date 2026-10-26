import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  FONT_SIZE_OPTIONS,
  TEXT_COLOR_OPTIONS,
  SIGNATURE_SCALE_PRESETS,
  type PdfAnnotation,
} from './pdf-types';

describe('PDF Types & Studio Constants', () => {
  it('provides comprehensive font size options for text annotations', () => {
    expect(FONT_SIZE_OPTIONS).toContain(14);
    expect(FONT_SIZE_OPTIONS).toContain(20);
    expect(FONT_SIZE_OPTIONS).toContain(36);
    expect(FONT_SIZE_OPTIONS.length).toBeGreaterThanOrEqual(8);
  });

  it('provides standard legal ink and annotation colors', () => {
    const colors = TEXT_COLOR_OPTIONS.map((c) => c.value);
    expect(colors).toContain('#0f172a'); // Black
    expect(colors).toContain('#1d4ed8'); // Legal Blue
    expect(colors).toContain('#dc2626'); // Red
  });

  it('defines signature scale multipliers', () => {
    const small = SIGNATURE_SCALE_PRESETS.find((p) => p.label === 'S');
    const medium = SIGNATURE_SCALE_PRESETS.find((p) => p.label === 'M');
    const large = SIGNATURE_SCALE_PRESETS.find((p) => p.label === 'L');

    expect(small?.scale).toBeLessThan(1.0);
    expect(medium?.scale).toBe(1.0);
    expect(large?.scale).toBeGreaterThan(1.0);
  });

  it('can create and draw borderless text and signatures with pdf-lib', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const annotation: PdfAnnotation = {
      id: 'test-ann-1',
      type: 'text',
      pageIndex: 0,
      xPercent: 10,
      yPercent: 20,
      text: 'Sample borderless text',
      fontSize: 16,
      color: '#0f172a',
    };

    page.drawText(annotation.text!, {
      x: (annotation.xPercent / 100) * 600,
      y: 800 - (annotation.yPercent / 100) * 800,
      size: annotation.fontSize,
      font,
    });

    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);
  });
});
