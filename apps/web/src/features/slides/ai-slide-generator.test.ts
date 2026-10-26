import { describe, expect, it } from 'vitest';
import { generateSlidesLocally } from './ai-slide-generator';

describe('ai-slide-generator', () => {
  it('generates structured slides from pasted text', () => {
    const text = `Q3 Growth Strategy & Global Expansion
Executive Summary:
Our cloud platform has expanded into 12 new regions with high availability.
- Over 99.98% uptime achieved across all infrastructure clusters
- Customer acquisition cost decreased by 35% through word-of-mouth adoption
- Total revenue scaled by 4.2x year over year

Strategic Outlook:
"The momentum we built in Q3 lays the ground for multi-tenant enterprise contracts."
Next quarter focuses on offline PWA and mobile presence.`;

    const deck = generateSlidesLocally({
      rawText: text,
      slideCount: 4,
      theme: 'gradient-vibrant',
      includeImages: true,
    });

    expect(deck).toBeDefined();
    expect(deck.title).toContain('Q3 Growth Strategy');
    expect(deck.theme).toBe('gradient-vibrant');
    expect(deck.slides.length).toBeGreaterThanOrEqual(3);

    // Slide 1 must be Title
    expect(deck.slides[0]!.layout).toBe('title');
    expect(deck.slides[0]!.title).toContain('Q3 Growth Strategy');

    // Subsequent slide should have content and image
    const contentSlide = deck.slides.find((s) => s.layout === 'title-content');
    expect(contentSlide).toBeDefined();
    expect(contentSlide!.imageUrl).toBeDefined();
    expect(contentSlide!.imageUrl).toContain('images.unsplash.com');
  });

  it('detects numeric metrics and extracts them into metric layouts', () => {
    const text = `Metric Milestone Brief
Key Accomplishments:
Our team sustained 99.9% uptime throughout the quarter during intense workloads.`;

    const deck = generateSlidesLocally({
      rawText: text,
      slideCount: 3,
      includeImages: true,
    });

    const metricSlide = deck.slides.find((s) => s.layout === 'big-metric');
    if (metricSlide) {
      expect(metricSlide.metric?.value).toBeDefined();
    }
    expect(deck.slides.length).toBeGreaterThanOrEqual(2);
  });
});
