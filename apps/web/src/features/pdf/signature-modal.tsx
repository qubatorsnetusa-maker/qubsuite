import React, { useState, useRef, useEffect } from 'react';
import {
  PenTool,
  Type,
  Upload,
  RotateCcw,
  X,
  Check,
  Sliders,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { toast } from 'sonner';

interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (dataUrl: string, scale?: number, textFallback?: string) => void;
  title?: string;
}

export function SignatureModal({
  open,
  onClose,
  onConfirm,
  title = 'Create Your Signature or Stamp',
}: SignatureModalProps) {
  const [tab, setTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [inkColor, setInkColor] = useState<'blue' | 'black'>('blue');
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState<number>(0);
  const [drawnData, setDrawnData] = useState<string | null>(null);
  const [uploadedData, setUploadedData] = useState<string | null>(null);
  const [removeWhiteBg, setRemoveWhiteBg] = useState(true);
  const [sigScale, setSigScale] = useState<number>(1.0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setDrawnData(null);
      setUploadedData(null);
      setTypedName('');
      setSigScale(1.0);
    }
  }, [open]);

  if (!open) return null;

  const hexColor = inkColor === 'blue' ? '#1d4ed8' : '#0f172a';

  // Drawing Canvas Handlers
  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]!.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]!.clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = hexColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]!.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]!.clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => {
    if (!isDrawing.current || !canvasRef.current) return;
    isDrawing.current = false;
    setDrawnData(canvasRef.current.toDataURL('image/png'));
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setDrawnData(null);
  };

  // Type signature generator with fonts
  const fontStyles = [
    'italic 42px "Brush Script MT", "Caveat", cursive',
    'italic 38px "Dancing Script", "Segoe Script", cursive',
    'italic 40px "Great Vibes", "Apple Chancery", cursive',
  ];

  const generateTypedSignaturePng = (name: string, fontIndex: number): string => {
    const c = document.createElement('canvas');
    c.width = 500;
    c.height = 140;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    ctx.font = fontStyles[fontIndex] || fontStyles[0]!;
    ctx.fillStyle = hexColor;
    ctx.fillText(name || 'Signature', 25, 85);
    return c.toDataURL('image/png');
  };

  // Image Upload handler with optional white-background transparency filter
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, or SVG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const rawData = loadEvt.target?.result as string;
      if (!removeWhiteBg) {
        setUploadedData(rawData);
        return;
      }

      // Process white pixels to make background transparent
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        if (!ctx) {
          setUploadedData(rawData);
          return;
        }
        ctx.drawImage(img, 0, 0);
        try {
          const imgData = ctx.getImageData(0, 0, c.width, c.height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i]!;
            const g = d[i + 1]!;
            const b = d[i + 2]!;
            // Near-white pixel threshold
            if (r > 215 && g > 215 && b > 215) {
              d[i + 3] = 0; // Set alpha to 0
            }
          }
          ctx.putImageData(imgData, 0, 0);
          setUploadedData(c.toDataURL('image/png'));
          toast.success('White background automatically made transparent.');
        } catch {
          setUploadedData(rawData);
        }
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    let finalDataUrl: string | null = null;
    let fallbackText: string | undefined = undefined;

    if (tab === 'draw') {
      finalDataUrl = drawnData;
    } else if (tab === 'type') {
      if (!typedName.trim()) {
        toast.error('Please type your name first.');
        return;
      }
      finalDataUrl = generateTypedSignaturePng(typedName, selectedFont);
      fallbackText = typedName;
    } else if (tab === 'upload') {
      finalDataUrl = uploadedData;
    }

    if (!finalDataUrl) {
      toast.error('Please create or upload your signature first.');
      return;
    }

    onConfirm(finalDataUrl, sigScale, fallbackText);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-surface-2 p-6 shadow-2xl border border-border text-foreground space-y-5 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
              <PenTool className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">{title}</h3>
              <p className="text-xs text-muted">Draw, type, or import an existing signature image</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-3 gap-1.5 bg-surface-1 p-1 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setTab('draw')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'draw'
                ? 'bg-surface-2 text-red-600 dark:text-red-400 shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <PenTool className="size-3.5" />
            <span>Draw</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('type')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'type'
                ? 'bg-surface-2 text-red-600 dark:text-red-400 shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Type className="size-3.5" />
            <span>Type</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'upload'
                ? 'bg-surface-2 text-red-600 dark:text-red-400 shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Upload className="size-3.5" />
            <span>Upload Image</span>
          </button>
        </div>

        {/* Color Switcher for Draw & Type */}
        {tab !== 'upload' && (
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted">Ink Color:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInkColor('blue')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  inkColor === 'blue'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/40'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <span className="size-2.5 rounded-full bg-blue-600" />
                <span>Legal Blue</span>
              </button>
              <button
                type="button"
                onClick={() => setInkColor('black')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  inkColor === 'black'
                    ? 'bg-slate-500/10 text-slate-800 dark:text-slate-200 font-bold border border-slate-500/40'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <span className="size-2.5 rounded-full bg-slate-900 dark:bg-slate-100" />
                <span>Midnight Black</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Draw */}
        {tab === 'draw' && (
          <div className="space-y-3">
            <div className="relative rounded-xl border border-dashed border-border bg-surface-1 overflow-hidden">
              <canvas
                ref={canvasRef}
                width={480}
                height={150}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
                className="w-full h-36 cursor-crosshair touch-none"
              />
              <div className="pointer-events-none absolute bottom-3 left-4 right-4 border-b border-border/80 pb-0.5 flex justify-between text-[10px] text-muted">
                <span>Sign above line</span>
                <span>{inkColor === 'blue' ? 'Blue Ink' : 'Black Ink'}</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Draw with trackpad, mouse, or touch</span>
              <button
                type="button"
                onClick={clearCanvas}
                className="flex items-center gap-1 text-muted hover:text-red-500 transition-colors"
              >
                <RotateCcw className="size-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Type */}
        {tab === 'type' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                Full Name / Signer Name
              </label>
              <Input
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="e.g. Kelvin Odems"
                className="text-sm"
                autoFocus
              />
            </div>

            {typedName && (
              <div className="space-y-2">
                <span className="text-xs text-muted">Choose Signature Style:</span>
                <div className="grid grid-cols-1 gap-2">
                  {[0, 1, 2].map((idx) => {
                    const preview = generateTypedSignaturePng(typedName, idx);
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedFont(idx)}
                        className={`cursor-pointer rounded-xl border p-2 flex items-center justify-between transition-all ${
                          selectedFont === idx
                            ? 'border-red-500 bg-red-500/5'
                            : 'border-border bg-surface-1 hover:border-muted'
                        }`}
                      >
                        <img src={preview} alt="Style" className="h-10 object-contain" />
                        {selectedFont === idx && (
                          <div className="size-5 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0">
                            <Check className="size-3" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Upload Image */}
        {tab === 'upload' && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileChange}
              className="hidden"
            />

            {!uploadedData ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-red-500/80 bg-surface-1 p-6 flex flex-col items-center justify-center text-center space-y-2 transition-all hover:bg-surface-1/80"
              >
                <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
                  <Upload className="size-6" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground">Click to upload signature or seal</span>
                  <p className="text-xs text-muted mt-0.5">PNG, JPG, SVG or scanned signature image</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl border border-border bg-surface-1 p-4 flex items-center justify-center min-h-[120px]">
                  <img
                    src={uploadedData}
                    alt="Uploaded Signature"
                    className="max-h-24 max-w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedData(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 p-1 rounded-md bg-surface-2 text-muted hover:text-red-500 border border-border"
                    title="Change image"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs px-1">
                  <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={removeWhiteBg}
                      onChange={(e) => setRemoveWhiteBg(e.target.checked)}
                      className="rounded border-border text-red-600 focus:ring-red-500"
                    />
                    <span>Auto-remove white background (transparency)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-red-600 dark:text-red-400 font-medium hover:underline"
                  >
                    Replace Image
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Size Adjustment Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
          <div className="flex items-center gap-2">
            <Sliders className="size-3.5 text-muted" />
            <span className="text-muted">Placement Size:</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { label: 'Small', scale: 0.75 },
              { label: 'Medium', scale: 1.0 },
              { label: 'Large', scale: 1.4 },
              { label: 'XL', scale: 1.9 },
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setSigScale(s.scale)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  Math.abs(sigScale - s.scale) < 0.05
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 font-bold border border-red-500/40'
                    : 'text-muted hover:text-foreground bg-surface-1'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 gap-1.5"
          >
            <Check className="size-3.5" />
            <span>Apply Signature</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
