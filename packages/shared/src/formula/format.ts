import { formatDateSerial } from './dates';
import { formatGeneralNumber, isError, type CellValue } from './values';

export type NumberFormat = 'general' | 'number' | 'currency' | 'percent' | 'integer' | 'date' | 'time' | 'datetime';

const groupFormat = (n: number, digits: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function formatValue(value: CellValue, format: NumberFormat = 'general'): string {
  if (value === null) return '';
  if (isError(value)) return value.code;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') return value;
  switch (format) {
    case 'number':
      return groupFormat(value, 2);
    case 'integer':
      return groupFormat(Math.round(value), 0);
    case 'currency':
      return (value < 0 ? '-$' : '$') + groupFormat(Math.abs(value), 2);
    case 'percent':
      return `${formatGeneralNumber(Number((value * 100).toFixed(2)))}%`;
    case 'date':
    case 'time':
    case 'datetime':
      return formatDateSerial(value, format) ?? formatGeneralNumber(value);
    default:
      return formatGeneralNumber(value);
  }
}
