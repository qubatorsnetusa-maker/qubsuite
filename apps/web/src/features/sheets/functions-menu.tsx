import { Sigma } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/menu';
import { Tooltip } from '@/components/ui/misc';
import { AUTOSUM_FUNCTIONS, FUNCTION_CATEGORIES, type AutoSumFunction } from './function-catalog';

interface Props {
  /** SUM / AVERAGE / … applied to the selection (AutoSum). */
  onAutoSum(fn: AutoSumFunction): void;
  /** Any function: the active cell opens for editing with `=NAME(`. */
  onInsert(name: string): void;
  /** Called once the menu has closed, to give focus back to the sheet (or the cell editor it opened). */
  onClosed(): void;
}

/** The Σ toolbar button: quick AutoSum picks, then every function by category. */
export function FunctionsMenu({ onAutoSum, onInsert, onClosed }: Props) {
  return (
    <DropdownMenu>
      <Tooltip content="Functions">
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Functions" className="flex h-8 shrink-0 items-center justify-center rounded px-1.5 text-[#444746] hover:bg-black/5 [&_svg]:size-[18px]">
            <Sigma />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        className="w-56"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          onClosed();
        }}
      >
        <FunctionItems onAutoSum={onAutoSum} onInsert={onInsert} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Menu items shared by the Σ button and Insert → Function. */
export function FunctionItems({ onAutoSum, onInsert }: Pick<Props, 'onAutoSum' | 'onInsert'>) {
  return (
    <>
      {AUTOSUM_FUNCTIONS.map((fn) => (
        <DropdownMenuItem key={fn} onSelect={() => onAutoSum(fn)}>
          {fn}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      {FUNCTION_CATEGORIES.map((cat) => (
        <DropdownMenuSub key={cat.name}>
          <DropdownMenuSubTrigger>{cat.name}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[min(70vh,28rem)] w-72 overflow-y-auto">
            {cat.functions.map((f) => (
              <DropdownMenuItem key={f.name} title={f.syntax} onSelect={() => onInsert(f.name)}>
                <span className="block font-mono text-xs">{f.name}</span>
                <span className="block text-xs text-muted">{f.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ))}
    </>
  );
}
