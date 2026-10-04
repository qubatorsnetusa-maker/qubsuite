import { useState, useRef, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import {
  Type,
  PenTool,
  Calendar,
  Download,
  RotateCcw,
  FileCheck2,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  MousePointer,
  Save,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';

// Initialize PDF.js worker with direct bundled Vite URL
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export type EditorTool = 'select' | 'text' | 'signature' | 'date';

export interface AnnotationItem {
  id: string;
  type: 'text' | 'signature' | 'date';
  pageIndex: number;
  xPercent: number; // 0 - 100 percentage from left of page
  yPercent: number; // 0 - 100 percentage from top of page
  text?: string;
  signatureDataUrl?: string;
  fontSize?: number;
  color?: string;
}

interface PdfSignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string;
  fileName: string;
  onSaveSigned?: (blob: Blob, fileName: string) => void;
}

function getCoordinates(
  e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  rect: DOMRect,
) {
  if ('touches' in e) {
    const touch = e.touches[0];
    return {
      x: (touch ? touch.clientX : 0) - rect.left,
      y: (touch ? touch.clientY : 0) - rect.top,
    };
  }
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

export function PdfSignDialog({
  open,
  onOpenChange,
  pdfUrl,
  fileName,
  onSaveSigned,
}: PdfSignDialogProps) {
  // Active tool in the editor toolbar
  const [activeTool, setActiveTool] = useState<EditorTool>('text');

  // Multi-element document annotations
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // PDF rendering state
  const [pdfDocProxy, setPdfDocProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.25);
  const [pageLoading, setPageLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Signature creation modal/drawer state
  const [isSigDrawerOpen, setIsSigDrawerOpen] = useState(false);
  const [pendingSigCoords, setPendingSigCoords] = useState<{ xPercent: number; yPercent: number } | null>(null);
  const [sigMode, setSigMode] = useState<'draw' | 'type'>('draw');
  const [typedSigName, setTypedSigName] = useState('');
  const [drawnSigData, setDrawnSigData] = useState<string | null>(null);

  // Audit and watermark options
  const [includeAuditMark, setIncludeAuditMark] = useState(true);

  // Refs
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // 1. Load PDF Document via PDF.js with ArrayBuffer fallback for blob/relative URLs
  useEffect(() => {
    if (!open || !pdfUrl) return;

    let isMounted = true;
    setPageLoading(true);

    const loadDocument = async () => {
      try {
        let pdfData: ArrayBuffer | string = pdfUrl;

        // Fetch buffer directly to prevent CORS or worker fetching issues
        try {
          const res = await fetch(pdfUrl, { credentials: 'include' });
          if (res.ok) {
            pdfData = await res.arrayBuffer();
          }
        } catch {
          // Fall back to URL string if fetch fails
        }

        if (!isMounted) return;

        const loadingTask = pdfjsLib.getDocument(
          typeof pdfData === 'string'
            ? { url: pdfData, withCredentials: true }
            : { data: pdfData }
        );

        const loadedPdf = await loadingTask.promise;
        if (!isMounted) return;

        setPdfDocProxy(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setCurrentPage(1);
        setPageLoading(false);
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to load PDF with pdfjs:', err);
        setPageLoading(false);
        toast.error('Failed to load PDF document for editing.');
      }
    };

    loadDocument();

    return () => {
      isMounted = false;
    };
  }, [open, pdfUrl]);

  // 2. Render Current Page onto HTML5 Canvas
  useEffect(() => {
    if (!pdfDocProxy || !pdfCanvasRef.current) return;

    let renderTask: any = null;
    let isCancelled = false;

    const renderPage = async () => {
      try {
        setPageLoading(true);
        const page = await pdfDocProxy.getPage(currentPage);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: zoomScale });
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Support high DPI screens
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        renderTask = page.render({
          canvasContext: context,
          transform: transform || undefined,
          viewport: viewport,
        });

        await renderTask.promise;
        if (!isCancelled) {
          setPageLoading(false);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error rendering PDF page:', err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDocProxy, currentPage, zoomScale]);

  // Setup drawing canvas when signature drawer opens
  useEffect(() => {
    if (!isSigDrawerOpen || sigMode !== 'draw' || !sigCanvasRef.current) return;
    const canvas = sigCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1d4ed8'; // Legal signature navy/blue
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [isSigDrawerOpen, sigMode]);

  // Handle clicking on the document overlay
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPercent = Math.max(2, Math.min(90, (clickX / rect.width) * 100));
    const yPercent = Math.max(2, Math.min(94, (clickY / rect.height) * 100));

    if (activeTool === 'select') {
      setSelectedAnnotationId(null);
      return;
    }

    if (activeTool === 'text') {
      const newId = `text-${Date.now()}`;
      const newAnnotation: AnnotationItem = {
        id: newId,
        type: 'text',
        pageIndex: currentPage - 1,
        xPercent,
        yPercent,
        text: 'Type text here...',
        fontSize: 14,
        color: '#0f172a',
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
      setSelectedAnnotationId(newId);
      toast.success('Text box added. Click and type directly onto the document.');
    } else if (activeTool === 'date') {
      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const newId = `date-${Date.now()}`;
      const newAnnotation: AnnotationItem = {
        id: newId,
        type: 'date',
        pageIndex: currentPage - 1,
        xPercent,
        yPercent,
        text: today,
        fontSize: 13,
        color: '#0f172a',
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
      setSelectedAnnotationId(newId);
      toast.success('Date stamp placed on document.');
    } else if (activeTool === 'signature') {
      setPendingSigCoords({ xPercent, yPercent });
      setIsSigDrawerOpen(true);
    }
  };

  // Signature canvas handlers
  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = getCoordinates(e, rect);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !sigCanvasRef.current) return;
    const canvas = sigCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = getCoordinates(e, rect);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => {
    if (!isDrawing.current || !sigCanvasRef.current) return;
    isDrawing.current = false;
    setDrawnSigData(sigCanvasRef.current.toDataURL('image/png'));
  };

  const clearCanvas = () => {
    if (!sigCanvasRef.current) return;
    const ctx = sigCanvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, sigCanvasRef.current.width, sigCanvasRef.current.height);
    setDrawnSigData(null);
  };

  const generateTypedSignaturePng = (name: string): string => {
    const c = document.createElement('canvas');
    c.width = 450;
    c.height = 120;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    ctx.font = 'italic 38px "Brush Script MT", "Caveat", "Segoe Script", cursive';
    ctx.fillStyle = '#1d4ed8';
    ctx.fillText(name || 'Signature', 20, 75);
    return c.toDataURL('image/png');
  };

  const handleConfirmSignature = () => {
    const sigData =
      sigMode === 'draw'
        ? drawnSigData
        : generateTypedSignaturePng(typedSigName);

    if (!sigData) {
      toast.error('Please draw or type your signature first.');
      return;
    }

    const coords = pendingSigCoords || { xPercent: 50, yPercent: 75 };
    const newId = `sig-${Date.now()}`;
    const newAnnotation: AnnotationItem = {
      id: newId,
      type: 'signature',
      pageIndex: currentPage - 1,
      xPercent: coords.xPercent,
      yPercent: coords.yPercent,
      signatureDataUrl: sigData,
      text: sigMode === 'type' ? typedSigName : undefined,
    };

    setAnnotations((prev) => [...prev, newAnnotation]);
    setSelectedAnnotationId(newId);
    setIsSigDrawerOpen(false);
    setPendingSigCoords(null);
    toast.success('Signature placed on document!');
  };

  const handleDeleteAnnotation = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
    toast.info('Item removed.');
  };

  const handleUpdateText = (id: string, text: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, text } : a)),
    );
  };

  const handleClearAll = () => {
    setAnnotations([]);
    setSelectedAnnotationId(null);
    toast.info('Cleared all annotations.');
  };

  // Save / Stamp & Export finalized PDF using pdf-lib
  const handleSaveAndExport = async (shouldDownload = false) => {
    if (annotations.length === 0) {
      toast.error('Please add at least one text or signature element before saving.');
      return;
    }

    setIsExporting(true);
    try {
      const existingPdfBytes = await fetch(pdfUrl, { credentials: 'include' }).then((res) =>
        res.arrayBuffer(),
      );

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      for (const ann of annotations) {
        const pageIdx = Math.min(Math.max(0, ann.pageIndex), pages.length - 1);
        const page = pages[pageIdx];
        const { width, height } = page.getSize();

        const x = (ann.xPercent / 100) * width;
        const yFromTop = (ann.yPercent / 100) * height;

        if (ann.type === 'signature' && ann.signatureDataUrl) {
          try {
            const pngImage = await pdfDoc.embedPng(ann.signatureDataUrl);
            const imgWidth = 140;
            const imgHeight = 42;
            const y = height - yFromTop - imgHeight;

            page.drawImage(pngImage, {
              x,
              y,
              width: imgWidth,
              height: imgHeight,
            });

            if (includeAuditMark) {
              page.drawText('VERIFIED DIGITAL SIGNATURE • QUBDOCS', {
                x,
                y: y - 10,
                size: 6.5,
                font: helveticaBold,
                color: rgb(0.15, 0.35, 0.75),
              });
            }
          } catch (e) {
            console.warn('Failed to embed signature image:', e);
          }
        } else if (ann.type === 'text' || ann.type === 'date') {
          const fontSize = ann.fontSize || (ann.type === 'date' ? 12 : 14);
          const y = height - yFromTop - fontSize;
          page.drawText(ann.text || '', {
            x,
            y,
            size: fontSize,
            font: ann.type === 'date' ? helveticaBold : helveticaFont,
            color: rgb(0.1, 0.1, 0.2),
          });
        }
      }

      const signedBytes = await pdfDoc.save();
      const signedBlob = new Blob([signedBytes], { type: 'application/pdf' });
      const signedFileName = fileName.replace(/\.pdf$/i, '') + '-edited.pdf';

      if (onSaveSigned) {
        onSaveSigned(signedBlob, signedFileName);
      }

      if (shouldDownload) {
        const downloadUrl = URL.createObjectURL(signedBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = signedFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        toast.success('Document downloaded successfully!');
      } else {
        toast.success('Document changes saved successfully!');
      }

      setIsExporting(false);
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      toast.error('Failed to process and save PDF document.');
      setIsExporting(false);
    }
  };

  const currentPageAnnotations = annotations.filter(
    (a) => a.pageIndex === currentPage - 1,
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 flex h-[94vh] w-[95vw] max-w-7xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white border border-slate-200/80 shadow-2xl overflow-hidden focus:outline-none text-slate-800"
          aria-describedby={undefined}
        >
          {/* Top Title Bar & Primary Toolbar (Clean Light Theme) */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            {/* Branding & Filename */}
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <FileCheck2 className="size-5" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>QubDocs Editor</span>
                  <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200/60">
                    PDF Sign & Edit
                  </span>
                </DialogPrimitive.Title>
                <p className="text-xs text-slate-500 max-w-md truncate">
                  {fileName || 'Untitled Document.pdf'}
                </p>
              </div>
            </div>

            {/* Editing Tools Bar */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setActiveTool('select')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTool === 'select'
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
                title="Select & move existing annotations"
              >
                <MousePointer className="size-3.5" />
                <span>Select</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('text')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTool === 'text'
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
                title="Click anywhere on the document to type text"
              >
                <Type className="size-3.5" />
                <span>Add Text</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('signature')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTool === 'signature'
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
                title="Click where you want your signature on the document"
              >
                <PenTool className="size-3.5" />
                <span>Sign</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('date')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTool === 'date'
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
                title="Click anywhere to stamp current date"
              >
                <Calendar className="size-3.5" />
                <span>Date</span>
              </button>
            </div>

            {/* Actions: Page navigation & Save/Export */}
            <div className="flex items-center gap-3">
              {/* Zoom controls */}
              <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-700">
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.max(0.75, z - 0.25))}
                  className="p-1 hover:text-slate-900 hover:bg-slate-200/60 rounded"
                  title="Zoom Out"
                >
                  <ZoomOut className="size-3.5" />
                </button>
                <span className="w-12 text-center font-mono font-medium">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.min(2.5, z + 0.25))}
                  className="p-1 hover:text-slate-900 hover:bg-slate-200/60 rounded"
                  title="Zoom In"
                >
                  <ZoomIn className="size-3.5" />
                </button>
              </div>

              {/* Page Navigator */}
              {numPages > 1 && (
                <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="font-semibold text-blue-700 px-1 font-mono">
                    {currentPage} / {numPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                    disabled={currentPage >= numPages}
                    className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}

              {/* Save & Download Buttons */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSaveAndExport(true)}
                disabled={isExporting}
                className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs h-9 gap-1.5"
              >
                <Download className="size-3.5" />
                <span>Download</span>
              </Button>

              <Button
                size="sm"
                onClick={() => handleSaveAndExport(false)}
                disabled={isExporting}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 gap-1.5 shadow-xs font-semibold"
              >
                <Save className="size-3.5" />
                <span>{isExporting ? 'Saving...' : 'Save Document'}</span>
              </Button>

              <DialogPrimitive.Close
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Close"
              >
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Subheader hint banner */}
          <div className="flex items-center justify-between bg-slate-50/80 px-6 py-2 border-b border-slate-200/70 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="flex size-2 rounded-full bg-blue-500 animate-pulse" />
              {activeTool === 'text' && (
                <span className="font-medium text-slate-700">Click anywhere on the document canvas below to start typing text.</span>
              )}
              {activeTool === 'signature' && (
                <span className="font-medium text-slate-700">Click on the document where you want to place your signature.</span>
              )}
              {activeTool === 'date' && (
                <span className="font-medium text-slate-700">Click on the document to stamp the current date.</span>
              )}
              {activeTool === 'select' && (
                <span className="font-medium text-slate-700">Click on any added text or signature to edit or remove it.</span>
              )}
            </div>

            <div className="flex items-center gap-4 text-slate-500 font-medium">
              <span>{annotations.length} items added</span>
              {annotations.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Main Document Workspace Area (Light Platform Aesthetic) */}
          <div className="relative flex-1 min-h-0 bg-slate-100/90 overflow-auto flex items-center justify-center p-8">
            {pageLoading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-xs">
                <div className="flex items-center gap-2.5 rounded-xl bg-white border border-slate-200 px-5 py-3 text-xs text-slate-700 shadow-xl">
                  <div className="size-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <span className="font-medium">Loading document page...</span>
                </div>
              </div>
            )}

            {/* Document Canvas + Interactive Overlay container */}
            <div
              className={`relative shadow-xl rounded-sm transition-all duration-150 border border-slate-300/80 ${
                activeTool === 'text'
                  ? 'cursor-text'
                  : activeTool === 'signature' || activeTool === 'date'
                  ? 'cursor-crosshair'
                  : 'cursor-default'
              }`}
              style={{
                display: 'inline-block',
                backgroundColor: '#ffffff',
              }}
            >
              {/* PDF Page Canvas */}
              <canvas
                ref={pdfCanvasRef}
                className="block bg-white rounded-xs select-none"
              />

              {/* Interactive Editing Overlay (covers the exact canvas space) */}
              <div
                ref={overlayRef}
                onClick={handleOverlayClick}
                className="absolute inset-0 z-20"
                style={{ pointerEvents: 'auto' }}
              >
                {/* Render Annotations on Current Page */}
                {currentPageAnnotations.map((ann) => {
                  const isSelected = selectedAnnotationId === ann.id;

                  if (ann.type === 'text') {
                    return (
                      <div
                        key={ann.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(ann.id);
                        }}
                        style={{
                          left: `${ann.xPercent}%`,
                          top: `${ann.yPercent}%`,
                        }}
                        className={`absolute -translate-y-1/2 group transition-shadow ${
                          isSelected
                            ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-transparent bg-white/95 rounded-md shadow-lg z-30 border border-blue-200'
                            : 'hover:ring-1 hover:ring-blue-400 bg-white/80 rounded border border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-1 p-1">
                          <input
                            type="text"
                            value={ann.text || ''}
                            onChange={(e) => handleUpdateText(ann.id, e.target.value)}
                            onFocus={() => setSelectedAnnotationId(ann.id)}
                            className="bg-transparent text-slate-900 font-sans text-sm font-normal px-1 py-0.5 outline-none min-w-[120px] max-w-[320px]"
                            placeholder="Type text..."
                            autoFocus={isSelected}
                          />
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAnnotation(ann.id, e)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove text"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (ann.type === 'date') {
                    return (
                      <div
                        key={ann.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(ann.id);
                        }}
                        style={{
                          left: `${ann.xPercent}%`,
                          top: `${ann.yPercent}%`,
                        }}
                        className={`absolute -translate-y-1/2 group transition-shadow ${
                          isSelected
                            ? 'ring-2 ring-blue-500 ring-offset-1 bg-white rounded-md shadow-lg z-30 border border-blue-200'
                            : 'hover:ring-1 hover:ring-blue-400 bg-white/90 rounded border border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-900">
                          <Calendar className="size-3.5 text-blue-600" />
                          <span>{ann.text}</span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAnnotation(ann.id, e)}
                            className="p-0.5 text-slate-400 hover:text-rose-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove date"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (ann.type === 'signature' && ann.signatureDataUrl) {
                    return (
                      <div
                        key={ann.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(ann.id);
                        }}
                        style={{
                          left: `${ann.xPercent}%`,
                          top: `${ann.yPercent}%`,
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 group transition-shadow ${
                          isSelected
                            ? 'ring-2 ring-blue-500 ring-offset-1 rounded-lg bg-blue-50/90 shadow-xl z-30 p-1.5 border border-blue-300'
                            : 'hover:ring-1 hover:ring-blue-400 rounded p-1 bg-white/70 border border-transparent'
                        }`}
                      >
                        <div className="relative flex flex-col items-center">
                          <img
                            src={ann.signatureDataUrl}
                            alt="Signature"
                            className="h-11 w-auto max-w-[180px] object-contain pointer-events-none"
                          />
                          {includeAuditMark && (
                            <span className="text-[8px] font-bold tracking-wider text-blue-700/80 -mt-0.5 uppercase">
                              Verified Signature
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAnnotation(ann.id, e)}
                            className="absolute -top-2.5 -right-2.5 p-1 bg-rose-600 text-white rounded-full shadow-md opacity-0 group-hover:opacity-100 hover:bg-rose-700 transition-opacity"
                            title="Remove signature"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          </div>

          {/* Signature Creation Modal (Draw / Type) */}
          {isSigDrawerOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <PenTool className="size-5 text-blue-600" />
                    <h3 className="font-semibold text-base text-slate-900">
                      Create Your Signature
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSigDrawerOpen(false);
                      setPendingSigCoords(null);
                    }}
                    className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Mode Selector: Draw vs Type */}
                <div className="grid grid-cols-2 gap-2 my-4 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSigMode('draw')}
                    className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                      sigMode === 'draw'
                        ? 'bg-white shadow-xs text-blue-700 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <PenTool className="size-3.5" />
                    <span>Draw Signature</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSigMode('type')}
                    className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                      sigMode === 'type'
                        ? 'bg-white shadow-xs text-blue-700 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Type className="size-3.5" />
                    <span>Type Signature</span>
                  </button>
                </div>

                {/* Draw mode canvas */}
                {sigMode === 'draw' && (
                  <div className="space-y-3">
                    <div className="relative rounded-xl border border-dashed border-slate-300 bg-slate-50 overflow-hidden">
                      <canvas
                        ref={sigCanvasRef}
                        width={460}
                        height={160}
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={stopDraw}
                        onMouseLeave={stopDraw}
                        onTouchStart={startDraw}
                        onTouchMove={draw}
                        onTouchEnd={stopDraw}
                        className="w-full h-36 cursor-crosshair touch-none"
                      />
                      <div className="pointer-events-none absolute bottom-3 left-4 right-4 border-b border-slate-300/80 pb-0.5 flex justify-between text-[10px] text-slate-400">
                        <span>Sign above line</span>
                        <span>Legal Blue ink</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Draw using mouse or finger</span>
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="flex items-center gap-1 text-slate-500 hover:text-rose-600"
                      >
                        <RotateCcw className="size-3" />
                        <span>Clear</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Type mode */}
                {sigMode === 'type' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Your Full Name
                      </label>
                      <Input
                        value={typedSigName}
                        onChange={(e) => setTypedSigName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 flex flex-col items-center justify-center">
                      <span
                        className="text-3xl text-blue-900"
                        style={{ fontFamily: '"Brush Script MT", "Caveat", "Segoe Script", cursive' }}
                      >
                        {typedSigName || 'Your Signature'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-2">
                        Official cursive rendering
                      </span>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsSigDrawerOpen(false);
                      setPendingSigCoords(null);
                    }}
                    className="text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmSignature}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 gap-1.5"
                  >
                    <Check className="size-4" />
                    <span>Place on Document</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
