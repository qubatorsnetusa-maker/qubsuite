import type { FormFieldType } from '@qub/shared';
import { QUESTION_TYPE_LIST, type TypeCategory } from '@qub/shared/forms';
import { Fragment, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { FIELD_UI } from '../registry';

const GROUPS: { category: TypeCategory; label: string }[] = [
  { category: 'basic', label: 'Text & contact' },
  { category: 'choice', label: 'Choice' },
  { category: 'rating', label: 'Rating & scales' },
  { category: 'advanced', label: 'Advanced' },
  { category: 'content', label: 'Content' },
];

/** "Add question" menu grouped by category. Sections and screens have their own buttons. */
export function TypePicker({ onPick, trigger }: { onPick(type: FormFieldType): void; trigger: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto">
        {GROUPS.map((g, i) => (
          <Fragment key={g.category}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
            {QUESTION_TYPE_LIST.filter((d) => d.category === g.category).map((d) => {
              const Icon = FIELD_UI[d.type].icon;
              return (
                <DropdownMenuItem key={d.type} icon={<Icon className="size-4" />} onSelect={() => onPick(d.type)}>
                  {d.label}
                </DropdownMenuItem>
              );
            })}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
