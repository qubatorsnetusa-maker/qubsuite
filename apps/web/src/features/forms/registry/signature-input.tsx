import { useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/form-controls';
import { errorMessage } from '@/lib/api';
import type { InputProps } from './types';

/** Draw (or type) a signature; saved as a PNG through the normal respondent upload endpoint. */
export function SignatureInput({ field, value, onChange, onUploaded, upload, disabled, color, labelledBy }: InputProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signed = Array.isArray(value) && value.length > 0;
  const ctx = () => canvas.current?.getContext('2d') ?? null;

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width, y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height };
  };
  const clear = () => {
    const c = ctx();
    if (c && canvas.current) c.clearRect(0, 0, canvas.current.width, canvas.current.height);
    setDirty(false);
    setTyped('');
    onUploaded([]);
    onChange(null);
  };
  const drawTyped = (name: string) => {
    setTyped(name);
    const c = ctx();
    if (!c || !canvas.current) return;
    c.clearRect(0, 0, canvas.current.width, canvas.current.height);
    c.font = 'italic 48px "Brush Script MT", cursive';
    c.fillStyle = '#1f1f1f';
    c.fillText(name, 24, canvas.current.height / 2 + 16);
    setDirty(name.trim() !== '');
  };
  const save = () => {
    if (!canvas.current) return;
    if (!upload) {
      // Builder preview: nothing is uploaded, but the question counts as answered.
      onChange(['preview-signature']);
      return;
    }
    setBusy(true);
    setError(null);
    canvas.current.toBlob(async (blob) => {
      try {
        if (!blob) throw new Error('Could not capture the signature.');
        const meta = await upload(field.id, new File([blob], 'signature.png', { type: 'image/png' }), () => {});
        onUploaded([meta]);
        onChange([meta.id]);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    }, 'image/png');
  };

  if (signed) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span style={{ color }}>Signed ✓</span>
        <Button type="button" variant="subtle" size="sm" onClick={clear} disabled={disabled}>
          Sign again
        </Button>
      </div>
    );
  }
  return (
    <div className="max-w-lg space-y-2">
      <canvas
        ref={canvas}
        width={600}
        height={180}
        aria-labelledby={labelledBy}
        role="img"
        className="w-full touch-none rounded-md border-2 border-dashed border-border bg-white"
        onPointerDown={(e) => {
          const c = ctx();
          if (!c || disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const p = point(e);
          c.lineWidth = 3;
          c.lineCap = 'round';
          c.strokeStyle = '#1f1f1f';
          c.beginPath();
          c.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          const c = ctx();
          if (!c || !drawing.current) return;
          const p = point(e);
          c.lineTo(p.x, p.y);
          c.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          setDirty(true);
        }}
      />
      <Input aria-label="Or type your name to sign" placeholder="Or type your name" value={typed} disabled={disabled} onChange={(e) => drawTyped(e.target.value)} className="max-w-xs" />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={!dirty || busy || disabled} loading={busy} style={{ background: color }}>
          Use this signature
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={disabled}>
          Clear
        </Button>
      </div>
      <FieldError message={error ?? undefined} />
    </div>
  );
}
