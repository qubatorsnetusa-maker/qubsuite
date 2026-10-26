import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import {
  FileText,
  Type,
  PenTool,
  Image as ImageIcon,
  Calendar,
  Check,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Save,
  Printer,
  MousePointer,
  RotateCcw,
  ArrowLeft,
  Sliders,
  Move,
  Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SignatureModal } from './signature-modal';
import type { PdfAnnotation, EditorTool } from './pdf-types';
import { FONT_SIZE_OPTIONS, TEXT_COLOR_OPTIONS, SIGNATURE_SCALE_PRESETS } from './pdf-types';
import { cn } from '@/lib/utils';
import { setPageMetadata } from '@/lib/meta';

// Ensure PDF.js worker is initialized
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface PdfStudioProps {
  pdfUrl: string;
  fileName?: string;
  onBack?: () => void;
  onSaveToDrive?: (blob: Blob, fileName: string) => void;
}

export function PdfStudio({
  pdfUrl,
  fileName = 'Document.pdf',
  onBack,
  onSaveToDrive,
}: PdfStudioProps) {
  const [docName, setDocName] = useState(fileName);

  useEffect(() => {
    if (docName) {
      setPageMetadata({
        title: docName,
        suiteName: 'PDF',
        description: 'View, edit, and sign PDF documents with Qub PDF Studio',
      });
    }
  }, [docName]);
  const [activeTool, setActiveTool] = useState<EditorTool>('text');
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Active formatting states for new or selected elements
  const [activeFontSize, setActiveFontSize] = useState<number>(14);
  const [activeTextColor, setActiveTextColor] = useState<string>('#0f172a');
  const [activeScale, setActiveScale] = useState<number>(1.0);

  // PDF Rendering States
  const [pdfProxy, setPdfProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.2);
  const [pageLoading, setPageLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [includeAuditMark, setIncludeAuditMark] = useState(true);

  // Signature & Image Modals
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ xPercent: number; yPercent: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // 1. Load PDF document
  useEffect(() => {
    let isCancelled = false;
    async function loadPdf() {
      setPageLoading(true);
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          withCredentials: true,
        });
        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfProxy(doc);
          setNumPages(doc.numPages);
          setCurrentPage(1);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load PDF document:', err);
          toast.error('Could not load PDF document.');
        }
      } finally {
        if (!isCancelled) setPageLoading(false);
      }
    }
    void loadPdf();
    return () => {
      isCancelled = true;
    };
  }, [pdfUrl]);

  // 2. Render current page to canvas
  useEffect(() => {
    if (!pdfProxy || !canvasRef.current) return;
    let renderTask: pdfjsLib.RenderTask | null = null;
    let isCancelled = false;

    async function renderPage() {
      setPageLoading(true);
      try {
        const page = await pdfProxy!.getPage(currentPage);
        if (isCancelled) return;
        const viewport = page.getViewport({ scale: zoomScale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        } as any);
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Page render error:', err);
        }
      } finally {
        if (!isCancelled) setPageLoading(false);
      }
    }

    void renderPage();
    return () => {
      isCancelled = true;
      if (renderTask) renderTask.cancel();
    };
  }, [pdfProxy, currentPage, zoomScale]);

  // Selected annotation helper
  const selectedAnnotation = annotations.find((a) => a.id === selectedId);

  // Update selected annotation when active styles change
  const updateSelectedAnnotation = useCallback(
    (patch: Partial<PdfAnnotation>) => {
      if (!selectedId) return;
      setAnnotations((prev) =>
        prev.map((a) => (a.id === selectedId ? { ...a, ...patch } : a))
      );
    },
    [selectedId]
  );

  const handleFontSizeChange = (size: number) => {
    setActiveFontSize(size);
    if (selectedAnnotation && selectedAnnotation.type === 'text') {
      updateSelectedAnnotation({ fontSize: size });
    }
  };

  const handleTextColorChange = (color: string) => {
    setActiveTextColor(color);
    if (selectedAnnotation && selectedAnnotation.type === 'text') {
      updateSelectedAnnotation({ color });
    }
  };

  const handleScaleChange = (scale: number) => {
    setActiveScale(scale);
    if (
      selectedAnnotation &&
      (selectedAnnotation.type === 'signature' || selectedAnnotation.type === 'image')
    ) {
      updateSelectedAnnotation({ scale });
    }
  };

  // Canvas Click: Place annotations with ZERO bounding boxes!
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, (y / rect.height) * 100));

    if (activeTool === 'select') {
      setSelectedId(null);
      return;
    }

    if (activeTool === 'text') {
      const newId = `text-${Date.now()}`;
      const newAnnotation: PdfAnnotation = {
        id: newId,
        type: 'text',
        pageIndex: currentPage - 1,
        xPercent,
        yPercent,
        text: '', // Start empty with no bounding box or placeholder clutter!
        fontSize: activeFontSize,
        color: activeTextColor,
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
      setSelectedId(newId);
    } else if (activeTool === 'signature') {
      setPendingCoords({ xPercent, yPercent });
      setIsSigModalOpen(true);
    } else if (activeTool === 'image') {
      setPendingCoords({ xPercent, yPercent });
      imageInputRef.current?.click();
    } else if (activeTool === 'date') {
      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const newId = `date-${Date.now()}`;
      const newAnnotation: PdfAnnotation = {
        id: newId,
        type: 'date',
        pageIndex: currentPage - 1,
        xPercent,
        yPercent,
        text: today,
        fontSize: activeFontSize,
        color: activeTextColor,
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
      setSelectedId(newId);
      toast.success('Date stamp placed.');
    } else if (activeTool === 'checkmark') {
      const newId = `chk-${Date.now()}`;
      const newAnnotation: PdfAnnotation = {
        id: newId,
        type: 'checkmark',
        pageIndex: currentPage - 1,
        xPercent,
        yPercent,
        text: '✓',
        fontSize: 18,
        color: '#16a34a',
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
      setSelectedId(newId);
    } else if (activeTool === 'cross') {
      const newId = `cross-${Date.now()}`;
      const newAnnotation: PdfAnnotation = {
        id: newId,
        type: 'cross',
        pageIndex: currentPage - 1,
        xPercent,
        yPercent,
        text: '✕',
        fontSize: 16,
        color: '#dc2626',
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
      setSelectedId(newId);
    }
  };

  // Signature creation confirmation
  const handleConfirmSignature = (dataUrl: string, scale = 1.0, textFallback?: string) => {
    const coords = pendingCoords || { xPercent: 50, yPercent: 75 };
    const newId = `sig-${Date.now()}`;
    const newAnnotation: PdfAnnotation = {
      id: newId,
      type: 'signature',
      pageIndex: currentPage - 1,
      xPercent: coords.xPercent,
      yPercent: coords.yPercent,
      signatureDataUrl: dataUrl,
      scale,
      width: 140,
      height: 42,
      text: textFallback,
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    setSelectedId(newId);
    setPendingCoords(null);
    toast.success('Signature applied to document!');
  };

  // Direct Image Placement handler
  const handleImageFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const dataUrl = loadEvt.target?.result as string;
      const coords = pendingCoords || { xPercent: 50, yPercent: 50 };
      const newId = `img-${Date.now()}`;
      const newAnnotation: PdfAnnotation = {
        id: newId,
        type: 'image',
        pageIndex: currentPage - 1,
        xPercent: coords.xPercent,
        yPercent: coords.yPercent,
        imageDataUrl: dataUrl,
        scale: activeScale,
        width: 160,
        height: 100,
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
      setSelectedId(newId);
      setPendingCoords(null);
      toast.success('Image placed on document!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteAnnotation = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleUpdateText = (id: string, text: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, text } : a))
    );
  };

  // Export Flattened PDF using pdf-lib
  const handleExportPdf = async (shouldDownload = true) => {
    if (annotations.length === 0) {
      toast.info('No changes were made. Exporting original document.');
    }

    setIsExporting(true);
    try {
      const existingBytes = await fetch(pdfUrl, { credentials: 'include' }).then((r) =>
        r.arrayBuffer()
      );
      const pdfDoc = await PDFDocument.load(existingBytes);
      const pages = pdfDoc.getPages();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      for (const ann of annotations) {
        const pageIdx = Math.min(Math.max(0, ann.pageIndex), pages.length - 1);
        const page = pages[pageIdx];
        if (!page) continue;
        const { width, height } = page.getSize();

        const x = (ann.xPercent / 100) * width;
        const yFromTop = (ann.yPercent / 100) * height;

        if (
          (ann.type === 'signature' && ann.signatureDataUrl) ||
          (ann.type === 'image' && ann.imageDataUrl)
        ) {
          try {
            const dataUrl = ann.signatureDataUrl || ann.imageDataUrl!;
            const isPng = dataUrl.startsWith('data:image/png');
            const embeddedImg = isPng
              ? await pdfDoc.embedPng(dataUrl)
              : await pdfDoc.embedJpg(dataUrl);

            const baseW = ann.width || (ann.type === 'image' ? 160 : 140);
            const baseH = ann.height || (ann.type === 'image' ? 100 : 42);
            const scale = ann.scale || 1.0;
            const w = baseW * scale;
            const h = baseH * scale;
            const y = height - yFromTop - h / 2;

            page.drawImage(embeddedImg, {
              x: x - w / 2,
              y,
              width: w,
              height: h,
            });

            if (ann.type === 'signature' && includeAuditMark) {
              page.drawText('VERIFIED DIGITAL SIGNATURE • QUBDOCS', {
                x: x - w / 2,
                y: y - 8,
                size: 6,
                font: helveticaBold,
                color: rgb(0.15, 0.35, 0.75),
              });
            }
          } catch (imgErr) {
            console.warn('Could not embed signature/image:', imgErr);
          }
        } else if (
          ann.type === 'text' ||
          ann.type === 'date' ||
          ann.type === 'checkmark' ||
          ann.type === 'cross'
        ) {
          const fontSize = ann.fontSize || 14;
          const y = height - yFromTop - fontSize / 2;

          // Parse hex color into RGB (0-1)
          let colorRgb = rgb(0.06, 0.09, 0.16);
          if (ann.color?.startsWith('#')) {
            const hex = ann.color.replace('#', '');
            if (hex.length === 6) {
              const r = parseInt(hex.substring(0, 2), 16) / 255;
              const g = parseInt(hex.substring(2, 4), 16) / 255;
              const b = parseInt(hex.substring(4, 6), 16) / 255;
              colorRgb = rgb(r, g, b);
            }
          }

          page.drawText(ann.text || '', {
            x,
            y,
            size: fontSize,
            font:
              ann.type === 'date' || ann.type === 'checkmark' || ann.type === 'cross'
                ? helveticaBold
                : helvetica,
            color: colorRgb,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const finalName = docName.endsWith('.pdf') ? docName : `${docName}.pdf`;

      if (shouldDownload) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = finalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Downloaded "${finalName}"`);
      }

      if (onSaveToDrive) {
        onSaveToDrive(blob, finalName);
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const currentPageAnnotations = annotations.filter(
    (a) => a.pageIndex === currentPage - 1
  );

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden select-none">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleImageFilePicked}
        className="hidden"
      />

      {/* Top Acrobat-Style Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-950 px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}

          {/* Adobe Acrobat Red Brand Badge */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-600 text-white shadow-md shadow-red-600/30">
              <FileText className="size-4 font-bold" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs tracking-wider uppercase text-red-500 leading-none">
                Qub PDF
              </span>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-200 hover:text-white border-0 outline-none p-0 focus:ring-0 w-44 sm:w-64 truncate"
                title="Rename document"
              />
            </div>
          </div>
        </div>

        {/* Primary PDF Tools Center Toolbar */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTool('select')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTool === 'select'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            )}
            title="Select & move items (V)"
          >
            <MousePointer className="size-3.5" />
            <span className="hidden sm:inline">Select</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('text')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTool === 'text'
                ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            )}
            title="Click to add seamless text without bounding boxes (T)"
          >
            <Type className="size-3.5" />
            <span className="hidden sm:inline">Text</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTool('signature');
              setIsSigModalOpen(true);
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTool === 'signature'
                ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            )}
            title="Add signature or seal (S)"
          >
            <PenTool className="size-3.5" />
            <span className="hidden sm:inline">Sign</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTool('image');
              imageInputRef.current?.click();
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTool === 'image'
                ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            )}
            title="Import an image signature or stamp (I)"
          >
            <ImageIcon className="size-3.5" />
            <span className="hidden sm:inline">Image</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('date')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTool === 'date'
                ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            )}
            title="Stamp current date (D)"
          >
            <Calendar className="size-3.5" />
            <span className="hidden md:inline">Date</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('checkmark')}
            className={cn(
              'p-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTool === 'checkmark'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50'
            )}
            title="Form Checkmark (✓)"
          >
            <Check className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('cross')}
            className={cn(
              'p-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTool === 'cross'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800/50'
            )}
            title="Form Cross (✕)"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Export & Save Actions */}
        <div className="flex items-center gap-2">
          {onSaveToDrive && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExportPdf(false)}
              disabled={isExporting}
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white text-xs h-8 gap-1.5"
            >
              <Save className="size-3.5" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handleExportPdf(true)}
            disabled={isExporting}
            className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 font-semibold shadow-md shadow-red-600/30 gap-1.5"
          >
            <Download className="size-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Download PDF'}</span>
          </Button>
        </div>
      </header>

      {/* Secondary Properties & Contextual Toolbar */}
      <div className="h-10 bg-slate-950/80 border-b border-slate-800/80 px-6 flex items-center justify-between text-xs shrink-0 z-20">
        {/* Context-aware item controls: Text Font Size or Signature Scale */}
        <div className="flex items-center gap-4">
          {/* Text Controls */}
          {(activeTool === 'text' || selectedAnnotation?.type === 'text') && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px] font-medium">Font Size:</span>
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => handleFontSizeChange(Math.max(10, activeFontSize - 2))}
                  className="px-1.5 py-0.5 text-slate-300 hover:text-white rounded hover:bg-slate-800 font-bold"
                  title="Smaller"
                >
                  A-
                </button>
                <select
                  value={activeFontSize}
                  onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                  aria-label="Text font size"
                  className="bg-transparent text-slate-200 font-mono text-xs px-1 border-0 outline-none"
                >
                  {FONT_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size} className="bg-slate-900 text-white">
                      {size} pt
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleFontSizeChange(Math.min(44, activeFontSize + 2))}
                  className="px-1.5 py-0.5 text-slate-300 hover:text-white rounded hover:bg-slate-800 font-bold"
                  title="Larger"
                >
                  A+
                </button>
              </div>

              {/* Color Switcher */}
              <div className="flex items-center gap-1 ml-2">
                {TEXT_COLOR_OPTIONS.map((col) => (
                  <button
                    key={col.value}
                    type="button"
                    onClick={() => handleTextColorChange(col.value)}
                    style={{ backgroundColor: col.value }}
                    className={cn(
                      'size-4 rounded-full border border-slate-700 transition-transform',
                      activeTextColor === col.value && 'scale-125 ring-2 ring-white/50'
                    )}
                    title={col.name}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Signature / Image Scale Controls */}
          {(activeTool === 'signature' ||
            activeTool === 'image' ||
            selectedAnnotation?.type === 'signature' ||
            selectedAnnotation?.type === 'image') && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px] font-medium">Size:</span>
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                {SIGNATURE_SCALE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleScaleChange(preset.scale)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-semibold transition-all',
                      Math.abs(activeScale - preset.scale) < 0.1
                        ? 'bg-red-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    )}
                    title={preset.title}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Annotation Actions */}
          {selectedId && (
            <button
              type="button"
              onClick={() => handleDeleteAnnotation(selectedId)}
              className="flex items-center gap-1 text-rose-400 hover:text-rose-300 text-xs px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20"
            >
              <Trash2 className="size-3" />
              <span>Delete Item</span>
            </button>
          )}
        </div>

        {/* View & Zoom Controls */}
        <div className="flex items-center gap-3">
          {/* Page Navigator */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
              title="Previous Page"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="font-mono text-slate-200 px-1">
              Page {currentPage} of {numPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
              title="Next Page"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.2))}
              className="p-1 text-slate-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="w-10 text-center font-mono text-slate-300">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.min(2.5, z + 0.2))}
              className="p-1 text-slate-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Acrobat Page Thumbnails strip */}
        <aside className="w-20 sm:w-28 bg-slate-950 border-r border-slate-800 p-2 flex flex-col items-center gap-3 overflow-y-auto shrink-0 select-none">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Pages
          </span>
          {Array.from({ length: numPages }).map((_, idx) => {
            const pageNum = idx + 1;
            const isCurrent = pageNum === currentPage;
            return (
              <div
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={cn(
                  'w-16 h-22 rounded border flex flex-col items-center justify-between p-1.5 cursor-pointer transition-all',
                  isCurrent
                    ? 'border-red-500 bg-red-500/10 shadow-md ring-1 ring-red-500'
                    : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                )}
              >
                <div className="flex-1 w-full bg-white/90 rounded-xs flex items-center justify-center text-[10px] font-bold text-slate-700">
                  {pageNum}
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-1">
                  {pageNum}
                </span>
              </div>
            );
          })}
        </aside>

        {/* Center PDF Canvas Viewport */}
        <main className="flex-1 bg-slate-900/90 overflow-auto flex items-center justify-center p-6 sm:p-10 relative">
          {pageLoading && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 rounded-xl bg-slate-900 border border-slate-800 px-5 py-3 text-xs text-slate-200 shadow-2xl">
                <div className="size-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                <span className="font-medium">Rendering PDF page...</span>
              </div>
            </div>
          )}

          {/* Document Canvas + Interactive Overlay container */}
          <div
            className={cn(
              'relative shadow-2xl transition-all duration-150',
              activeTool === 'text'
                ? 'cursor-text'
                : activeTool === 'signature' || activeTool === 'image' || activeTool === 'date'
                ? 'cursor-crosshair'
                : 'cursor-default'
            )}
            style={{
              display: 'inline-block',
              backgroundColor: '#ffffff',
            }}
          >
            {/* Underlying PDF Canvas */}
            <canvas ref={canvasRef} className="block bg-white shadow-2xl select-none" />

            {/* Interactive Annotation Overlay */}
            <div
              ref={overlayRef}
              onClick={handleOverlayClick}
              className="absolute inset-0 z-20"
              style={{ pointerEvents: 'auto' }}
            >
              {currentPageAnnotations.map((ann) => {
                const isSelected = selectedId === ann.id;

                /* 1. TEXT ANNOTATION: ZERO BOUNDING BOX! Seamless borderless text */
                if (ann.type === 'text') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(ann.id);
                        if (ann.fontSize) setActiveFontSize(ann.fontSize);
                        if (ann.color) setActiveTextColor(ann.color);
                      }}
                      style={{
                        left: `${ann.xPercent}%`,
                        top: `${ann.yPercent}%`,
                      }}
                      className="absolute -translate-y-1/2 group z-30 bg-transparent border-0 outline-none ring-0 shadow-none"
                    >
                      <div className="relative inline-flex items-center">
                        <input
                          ref={(el) => {
                            if (isSelected && el && document.activeElement !== el) {
                              el.focus();
                            }
                          }}
                          type="text"
                          value={ann.text ?? ''}
                          onChange={(e) => handleUpdateText(ann.id, e.target.value)}
                          onFocus={() => {
                            setSelectedId(ann.id);
                            if (ann.fontSize) setActiveFontSize(ann.fontSize);
                            if (ann.color) setActiveTextColor(ann.color);
                          }}
                          onBlur={() => {
                            // If user clicked away without entering text, automatically remove it
                            if (!ann.text || !ann.text.trim()) {
                              handleDeleteAnnotation(ann.id);
                            }
                          }}
                          style={{
                            fontSize: `${ann.fontSize || 14}px`,
                            color: ann.color || '#0f172a',
                          }}
                          className="bg-transparent font-sans font-normal border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus:border-0 shadow-none p-0 m-0 min-w-[20px] max-w-[500px]"
                          placeholder={isSelected ? 'Type text...' : ''}
                          autoFocus={isSelected}
                        />

                        {/* Minimalist delete icon on hover when selected */}
                        {isSelected && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAnnotation(ann.id, e)}
                            className="absolute -top-6 -right-2 p-0.5 text-slate-400 hover:text-rose-600 bg-white rounded shadow-xs border border-slate-200"
                            title="Remove text"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                /* 2. SIGNATURE & IMAGE ANNOTATIONS */
                if (
                  (ann.type === 'signature' && ann.signatureDataUrl) ||
                  (ann.type === 'image' && ann.imageDataUrl)
                ) {
                  const dataUrl = ann.signatureDataUrl || ann.imageDataUrl!;
                  const baseW = ann.width || (ann.type === 'image' ? 160 : 140);
                  const scale = ann.scale || 1.0;
                  const currentWidth = baseW * scale;

                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(ann.id);
                        if (ann.scale) setActiveScale(ann.scale);
                      }}
                      style={{
                        left: `${ann.xPercent}%`,
                        top: `${ann.yPercent}%`,
                        width: `${currentWidth}px`,
                      }}
                      className={cn(
                        'absolute -translate-x-1/2 -translate-y-1/2 group z-30 transition-shadow',
                        isSelected
                          ? 'ring-1 ring-red-500 rounded p-1 bg-red-500/5 shadow-md'
                          : 'hover:ring-1 hover:ring-slate-400/40 rounded p-0.5'
                      )}
                    >
                      <div className="relative flex flex-col items-center w-full">
                        <img
                          src={dataUrl}
                          alt={ann.type}
                          className="w-full h-auto object-contain pointer-events-none"
                        />
                        {ann.type === 'signature' && includeAuditMark && (
                          <span className="text-[7.5px] font-bold tracking-wider text-blue-700/80 -mt-0.5 uppercase pointer-events-none">
                            Verified Signature
                          </span>
                        )}

                        {/* Floating Quick Resize buttons when selected */}
                        {isSelected && (
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded shadow-lg">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleScaleChange(Math.max(0.5, scale - 0.25));
                              }}
                              className="px-1 text-[10px] text-slate-300 hover:text-white"
                              title="Smaller"
                            >
                              -
                            </button>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {Math.round(scale * 100)}%
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleScaleChange(Math.min(2.5, scale + 0.25));
                              }}
                              className="px-1 text-[10px] text-slate-300 hover:text-white"
                              title="Larger"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteAnnotation(ann.id, e)}
                              className="p-0.5 text-rose-400 hover:text-rose-300 ml-1"
                              title="Remove"
                            >
                              <Trash2 className="size-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                /* 3. DATE STAMP */
                if (ann.type === 'date') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(ann.id);
                      }}
                      style={{
                        left: `${ann.xPercent}%`,
                        top: `${ann.yPercent}%`,
                      }}
                      className="absolute -translate-y-1/2 group z-30"
                    >
                      <div className="flex items-center gap-1 text-slate-900 font-semibold text-xs bg-transparent">
                        <span>{ann.text}</span>
                        {isSelected && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAnnotation(ann.id, e)}
                            className="p-0.5 text-slate-400 hover:text-rose-600 bg-white rounded shadow-xs"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                /* 4. CHECKMARK & CROSS */
                if (ann.type === 'checkmark' || ann.type === 'cross') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(ann.id);
                      }}
                      style={{
                        left: `${ann.xPercent}%`,
                        top: `${ann.yPercent}%`,
                        color: ann.color,
                        fontSize: `${ann.fontSize || 16}px`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 font-bold cursor-pointer group"
                    >
                      <span>{ann.text}</span>
                      {isSelected && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteAnnotation(ann.id, e)}
                          className="absolute -top-4 -right-3 p-0.5 text-slate-400 hover:text-rose-600 bg-white rounded shadow-xs"
                        >
                          <Trash2 className="size-2.5" />
                        </button>
                      )}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Signature Modal with Draw / Type / Upload Image */}
      <SignatureModal
        open={isSigModalOpen}
        onClose={() => {
          setIsSigModalOpen(false);
          setPendingCoords(null);
        }}
        onConfirm={handleConfirmSignature}
      />
    </div>
  );
}
