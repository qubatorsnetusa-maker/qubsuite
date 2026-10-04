import type { AnswerValue, FormFieldDto, FormFieldType } from '@qub/shared';
import { scaleBounds } from '@qub/shared/forms';
import {
  AlignLeft,
  Building2,
  Calendar,
  CalendarClock,
  ChevronDown,
  CircleDot,
  Clock,
  DoorOpen,
  EyeOff,
  Flag,
  Gauge,
  Grid3x3,
  Hash,
  Image,
  Images,
  Link,
  ListChecks,
  ListOrdered,
  Mail,
  MapPin,
  MessageSquare,
  Minus,
  PenLine,
  Phone,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Star,
  ToggleLeft,
  TrendingUp,
  Type,
  Upload,
  Video,
} from 'lucide-react';
import { ChoiceList, displayOptions, DropdownInput, ImageChoiceInput, YesNoInput } from './choice-inputs';
import { FileInput } from './file-input';
import { MatrixInput } from './matrix-input';
import { AddressInput, ConsentInput, LocationInput } from './misc-inputs';
import { RankingInput } from './ranking-input';
import { EmojiRating, ScaleInput, SliderInput, StarRating } from './rating-inputs';
import { SignatureInput } from './signature-input';
import { ParagraphInput, TextLikeInput } from './text-inputs';
import type { FieldUi } from './types';

export * from './types';
export { displayOptions, letterFor } from './choice-inputs';
export { ContentBlock, videoEmbedUrl } from './content-blocks';

const letterIndex = (key: string) => (/^[a-z]$/i.test(key) ? key.toLowerCase().charCodeAt(0) - 97 : -1);

const singleChoiceKey = (f: FormFieldDto, key: string) => displayOptions(f)[letterIndex(key)]?.id;
function multiChoiceKey(f: FormFieldDto, key: string, current: AnswerValue | undefined) {
  const id = displayOptions(f)[letterIndex(key)]?.id;
  if (!id) return undefined;
  const set = new Set(Array.isArray(current) ? current : []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return f.options.filter((o) => set.has(o.id)).map((o) => o.id);
}
function digitKey(f: FormFieldDto, key: string) {
  if (!/^\d$/.test(key)) return undefined;
  const n = Number(key);
  const [lo, hi] = scaleBounds(f) ?? [0, -1];
  return n >= lo && n <= hi ? n : undefined;
}
const always = () => true;

export const FIELD_UI: Record<FormFieldType, FieldUi> = {
  SHORT_ANSWER: { icon: Type, Input: TextLikeInput },
  PARAGRAPH: { icon: AlignLeft, Input: ParagraphInput },
  EMAIL: { icon: Mail, Input: TextLikeInput },
  NUMBER: { icon: Hash, Input: TextLikeInput },
  PHONE: { icon: Phone, Input: TextLikeInput },
  URL: { icon: Link, Input: TextLikeInput },
  DATE: { icon: Calendar, Input: TextLikeInput },
  TIME: { icon: Clock, Input: TextLikeInput },
  DATETIME: { icon: CalendarClock, Input: TextLikeInput },
  HIDDEN: { icon: EyeOff },
  MULTIPLE_CHOICE: { icon: CircleDot, Input: ChoiceList, keyToValue: singleChoiceKey, autoAdvance: always },
  CHECKBOXES: { icon: ListChecks, Input: ChoiceList, keyToValue: multiChoiceKey },
  DROPDOWN: { icon: ChevronDown, Input: DropdownInput, keyToValue: (f, k) => (f.settings.searchable ? undefined : singleChoiceKey(f, k)), autoAdvance: (f) => !f.settings.searchable },
  IMAGE_CHOICE: {
    icon: Images,
    Input: ImageChoiceInput,
    keyToValue: (f, k, cur) => (f.settings.allowMultiple ? multiChoiceKey(f, k, cur) : (() => { const id = singleChoiceKey(f, k); return id ? [id] : undefined; })()),
    autoAdvance: (f) => !f.settings.allowMultiple,
  },
  RANKING: { icon: ListOrdered, Input: RankingInput },
  MATRIX: { icon: Grid3x3, Input: MatrixInput },
  YES_NO: { icon: ToggleLeft, Input: YesNoInput, keyToValue: (_f, k) => (k.toLowerCase() === 'y' ? true : k.toLowerCase() === 'n' ? false : undefined), autoAdvance: always },
  RATING: { icon: Star, Input: StarRating, keyToValue: digitKey, autoAdvance: always },
  LINEAR_SCALE: { icon: SlidersHorizontal, Input: ScaleInput, keyToValue: digitKey, autoAdvance: always },
  OPINION_SCALE: { icon: Gauge, Input: ScaleInput, keyToValue: digitKey, autoAdvance: always },
  NPS: { icon: TrendingUp, Input: ScaleInput, keyToValue: digitKey, autoAdvance: always },
  EMOJI_RATING: { icon: Smile, Input: EmojiRating, keyToValue: digitKey, autoAdvance: always },
  SLIDER: { icon: SlidersHorizontal, Input: SliderInput },
  FILE_UPLOAD: { icon: Upload, Input: FileInput },
  SIGNATURE: { icon: PenLine, Input: SignatureInput },
  ADDRESS: { icon: Building2, Input: AddressInput },
  LOCATION: { icon: MapPin, Input: LocationInput },
  CONSENT: { icon: ShieldCheck, Input: ConsentInput, keyToValue: (_f, k) => (k.toLowerCase() === 'y' ? true : undefined) },
  SECTION: { icon: Minus },
  STATEMENT: { icon: MessageSquare },
  IMAGE_BLOCK: { icon: Image },
  VIDEO_BLOCK: { icon: Video },
  WELCOME: { icon: DoorOpen },
  ENDING: { icon: Flag },
};
