import type { Template } from '@qub/shared/templates';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemplateGalleryPage } from './gallery-page';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock('./app-header', () => ({
  AppHeader: () => null,
}));

vi.mock('./template-tiles', () => ({
  BlankTile: () => null,
  TemplateTile: ({ template }: { template: { name: string } }) => <span>{template.name}</span>,
}));

const conversationalFeatured = {
  title: 'Conversational',
  filter: (t: Template): boolean => {
    if (t.app !== 'FORM') return false;
    return !!t.conversational;
  },
};

describe('TemplateGalleryPage featured prop', () => {
  it('without featured prop, no Conversational section heading appears', () => {
    render(<TemplateGalleryPage type="FORM" />);
    expect(screen.queryByRole('heading', { name: 'Conversational' })).not.toBeInTheDocument();
  });

  it('with featured prop, the Conversational section heading appears', () => {
    render(<TemplateGalleryPage type="FORM" featured={conversationalFeatured} />);
    expect(screen.getByRole('heading', { name: 'Conversational' })).toBeInTheDocument();
  });

  it('with featured prop, the featured section appears before the normal category sections', () => {
    render(<TemplateGalleryPage type="FORM" featured={conversationalFeatured} />);
    const headings = screen.getAllByRole('heading', { level: 2 });
    const texts = headings.map((h) => h.textContent ?? '');
    const convIdx = texts.indexOf('Conversational');
    const workIdx = texts.indexOf('Work');
    expect(convIdx).toBeGreaterThan(-1);
    expect(convIdx).toBeLessThan(workIdx);
  });

  it('with featured prop, templates matching the filter appear inside the featured section', () => {
    render(<TemplateGalleryPage type="FORM" featured={conversationalFeatured} />);
    const section = screen.getByRole('region', { name: 'Conversational' });
    expect(within(section).getByText('NPS Survey')).toBeInTheDocument();
    expect(within(section).getByText('Lead Capture')).toBeInTheDocument();
  });

  it('with featured prop, templates not matching the filter still appear in their regular categories', () => {
    render(<TemplateGalleryPage type="FORM" featured={conversationalFeatured} />);
    const workSection = screen.getByRole('region', { name: 'Work' });
    expect(within(workSection).getByText('Customer Feedback')).toBeInTheDocument();
  });
});
