import { AiAssistIcon } from '@/components/ai-assist-icon';
import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Presentation,
  Plus,
  Play,
  Copy,
  Trash2,
  Clock,
  Bot,
  Search,
  HardDrive,
} from 'lucide-react';
import { toast } from 'sonner';
import { getServiceUrl } from '@/lib/ecosystem-urls';
import { getStoredDecks, createDeckFromTemplate, deleteDeck, duplicateSlideInDeck, saveDeck } from './slides-storage';
import { STARTER_TEMPLATES } from './slide-templates';
import type { PresentationDeck } from './slides-types';
import { SLIDE_THEMES } from './slides-types';
import { AiGenerateDialog } from './ai-generate-dialog';
import { cn } from '@/lib/utils';

export function SlidesHome() {
  const navigate = useNavigate();
  const [decks, setDecks] = useState<PresentationDeck[]>(() => getStoredDecks());
  const [search, setSearch] = useState('');
  const [aiOpen, setAiOpen] = useState(false);

  const refreshDecks = () => {
    setDecks(getStoredDecks());
  };

  const handleCreateFromTemplate = (templateKey: string) => {
    const newDeck = createDeckFromTemplate(templateKey);
    refreshDecks();
    toast.success(`Created "${newDeck.title}"`);
    void navigate({ to: `/slides/$deckId` as any, params: { deckId: newDeck.id } as any });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteDeck(id);
    refreshDecks();
    toast.info('Presentation deleted');
  };

  const handleDuplicate = (deck: PresentationDeck, e: React.MouseEvent) => {
    e.stopPropagation();
    const clone: PresentationDeck = {
      ...JSON.parse(JSON.stringify(deck)),
      id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${deck.title} (Copy)`,
      updatedAt: new Date().toISOString(),
    };
    saveDeck(clone);
    refreshDecks();
    toast.success(`Duplicated "${deck.title}"`);
  };

  const filteredDecks = decks.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface-1 flex flex-col">
      {/* Top App Bar */}
      <header className="h-16 border-b border-border bg-surface-2 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a
            href={getServiceUrl('drive', '/drive')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover transition-colors text-xs font-medium border border-border/60"
            title="Switch to Qub Drive"
          >
            <HardDrive className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Qub Drive</span>
          </a>
          <div className="h-5 w-px bg-border/80 mx-1 hidden sm:block" />
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <Presentation className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-none">QubSlides</h1>
            <p className="text-xs text-muted mt-0.5">Presentations & Keynotes</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-72 max-w-sm hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search presentations..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-border bg-surface-1 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm transition-all"
          >
            <AiAssistIcon className="size-3.5 text-indigo-200" />
            <span>AI Assist</span>
          </button>
          <button
            onClick={() => handleCreateFromTemplate('blank')}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Presentation</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-10">
        {/* Template Gallery Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Start a new presentation
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* AI Designer Tile */}
            <div
              onClick={() => setAiOpen(true)}
              className="group cursor-pointer rounded-xl border border-purple-500/40 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-surface-2 p-5 flex flex-col items-center justify-center text-center aspect-[16/10] transition-all hover:shadow-lg hover:border-purple-500"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-amber-500 text-white flex items-center justify-center mb-3 group-hover:scale-110 shadow-md transition-transform">
                <AiAssistIcon className="size-5 text-indigo-100" />
              </div>
              <span className="font-semibold text-xs text-foreground">AI Assist</span>
              <span className="text-[10px] text-muted mt-0.5">Upload document or paste text</span>
            </div>

            {/* Blank Tile */}
            <div
              onClick={() => handleCreateFromTemplate('blank')}
              className="group cursor-pointer rounded-xl border border-dashed border-border hover:border-blue-500 bg-surface-2 p-5 flex flex-col items-center justify-center text-center aspect-[16/10] transition-all hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <span className="font-medium text-xs">Blank</span>
              <span className="text-[10px] text-muted mt-0.5">Start from scratch</span>
            </div>

            {/* Template Tiles */}
            {Object.entries(STARTER_TEMPLATES)
              .filter(([key]) => key !== 'blank')
              .map(([key, t]) => {
                const themeDef = SLIDE_THEMES[t.deck.theme];
                return (
                  <div
                    key={key}
                    onClick={() => handleCreateFromTemplate(key)}
                    className="group cursor-pointer rounded-xl border border-border hover:border-blue-500 bg-surface-2 overflow-hidden flex flex-col aspect-[16/10] transition-all hover:shadow-md"
                  >
                    {/* Visual Deck Preview Header */}
                    <div className={cn('h-24 p-3 flex flex-col justify-between border-b text-[10px]', themeDef.cardBg)}>
                      <span className="font-bold truncate">{t.deck.title}</span>
                      <span className="text-[8px] opacity-70 truncate">{t.deck.slides[0]?.subtitle ?? ''}</span>
                    </div>
                    {/* Metadata Footer */}
                    <div className="p-3 flex-1 flex flex-col justify-between bg-surface-2">
                      <span className="font-medium text-xs text-foreground group-hover:text-blue-500 transition-colors">
                        {t.name}
                      </span>
                      <span className="text-[10px] text-muted line-clamp-1">
                        {t.description}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* Recent Presentations Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Recent Presentations ({filteredDecks.length})
            </h2>
          </div>

          {filteredDecks.length === 0 ? (
            <div className="rounded-xl border border-border p-12 text-center space-y-3 bg-surface-2">
              <Presentation className="w-10 h-10 mx-auto opacity-30 text-muted" />
              <p className="text-sm font-medium">No presentations found</p>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Create a blank deck or start from one of the templates above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filteredDecks.map((deck) => {
                const themeDef = SLIDE_THEMES[deck.theme] || SLIDE_THEMES['dark-modern'];
                const firstSlide = deck.slides[0];
                return (
                  <div
                    key={deck.id}
                    onClick={() =>
                      navigate({ to: `/slides/$deckId` as any, params: { deckId: deck.id } as any })
                    }
                    className="group cursor-pointer rounded-xl border border-border hover:border-blue-500/80 bg-surface-2 overflow-hidden flex flex-col transition-all hover:shadow-lg"
                  >
                    {/* 16:9 Thumbnail Preview */}
                    <div className={cn('aspect-[16/9] p-4 flex flex-col justify-between border-b relative select-none', themeDef.cardBg)}>
                      <div className="space-y-1">
                        <div className="font-bold text-xs line-clamp-2">{firstSlide?.title || deck.title}</div>
                        {firstSlide?.subtitle && (
                          <div className="text-[9px] opacity-70 line-clamp-1">{firstSlide.subtitle}</div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[9px] opacity-60">
                        <span>{deck.slides.length} slides</span>
                        <span className="capitalize">{themeDef.name}</span>
                      </div>
                    </div>

                    {/* Card Body & Actions */}
                    <div className="p-3.5 flex items-center justify-between bg-surface-2">
                      <div className="min-w-0 pr-2">
                        <h3 className="font-medium text-xs truncate group-hover:text-blue-500 transition-colors">
                          {deck.title}
                        </h3>
                        <p className="text-[10px] text-muted mt-0.5">
                          Edited {new Date(deck.updatedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDuplicate(deck, e)}
                          className="p-1.5 rounded hover:bg-hover text-muted hover:text-foreground"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(deck.id, e)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* AI Presentation Generator Modal */}
      <AiGenerateDialog
        isOpen={aiOpen}
        onClose={() => {
          setAiOpen(false);
          refreshDecks();
        }}
      />
    </div>
  );
}
