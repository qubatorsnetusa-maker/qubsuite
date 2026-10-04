import type { AnswerValue, LocationValue } from '@qub/shared';
import { ADDRESS_PARTS, type AddressPart } from '@qub/shared/forms';
import { LocateFixed } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/form-controls';
import { asRecord, type InputProps } from './types';

const PART_LABEL: Record<AddressPart, string> = { line1: 'Street address', line2: 'Apartment, suite, etc.', city: 'City', region: 'State / region', postalCode: 'Postal code', country: 'Country' };
const PART_AUTOCOMPLETE: Record<AddressPart, string> = { line1: 'address-line1', line2: 'address-line2', city: 'address-level2', region: 'address-level1', postalCode: 'postal-code', country: 'country-name' };

export function AddressInput({ field, value, onChange, disabled }: InputProps) {
  const current = asRecord(value);
  return (
    <div className="grid max-w-lg gap-2 sm:grid-cols-2">
      {ADDRESS_PARTS.map((part) => {
        const id = `${field.id}-${part}`;
        return (
          <div key={part} className={part === 'line1' || part === 'line2' ? 'sm:col-span-2' : undefined}>
            <label htmlFor={id} className="mb-1 block text-xs text-muted">
              {PART_LABEL[part]}
            </label>
            <Input
              id={id}
              autoComplete={PART_AUTOCOMPLETE[part]}
              disabled={disabled}
              value={current[part] ?? ''}
              onChange={(e) => {
                const next = { ...current, [part]: e.target.value };
                if (!e.target.value) delete next[part];
                onChange(next);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

const asLocation = (v: AnswerValue | undefined): LocationValue | null => (v && typeof v === 'object' && !Array.isArray(v) && 'label' in v ? (v as LocationValue) : null);

export function LocationInput({ field, value, onChange, disabled, labelledBy }: InputProps) {
  const current = asLocation(value);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locate = () => {
    if (!navigator.geolocation) return setError('Your browser can’t share its location.');
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = Math.round(pos.coords.latitude * 1e5) / 1e5;
        const lng = Math.round(pos.coords.longitude * 1e5) / 1e5;
        onChange({ label: current?.label || `${lat}, ${lng}`, lat, lng });
      },
      () => {
        setLocating(false);
        setError('We couldn’t get your location. Type it instead.');
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };
  return (
    <div className="max-w-md space-y-2">
      <Input
        aria-labelledby={labelledBy}
        disabled={disabled}
        placeholder={field.placeholder ?? 'City, place or address'}
        value={current?.label ?? ''}
        onChange={(e) => onChange(e.target.value ? { label: e.target.value } : null)}
      />
      {field.settings.allowGeolocation !== false && (
        <Button type="button" variant="subtle" size="sm" onClick={locate} loading={locating} disabled={disabled}>
          <LocateFixed /> Use my location
        </Button>
      )}
      {current?.lat != null && (
        <p className="text-xs text-muted">
          {current.lat}, {current.lng}
        </p>
      )}
      <FieldError message={error ?? undefined} />
    </div>
  );
}

export function ConsentInput({ field, value, onChange, disabled, color }: InputProps) {
  return (
    <label className="flex max-w-xl cursor-pointer items-start gap-3 text-sm">
      <input type="checkbox" className="mt-0.5 size-4" disabled={disabled} checked={value === true} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: color }} />
      <span className="whitespace-pre-wrap">{field.settings.consentText ?? 'I agree'}</span>
    </label>
  );
}
