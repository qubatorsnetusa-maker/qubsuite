import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { displayOptions } from './choice-inputs';
import type { InputProps } from './types';

function Row({ id, label, rank, color, onUp, onDown, disabled }: { id: string; label: string; rank: number; color: string; onUp?(): void; onDown?(): void; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex items-center gap-2 rounded-md border border-border bg-white px-2 py-2">
      <button type="button" {...attributes} {...listeners} aria-label={`Drag ${label}`} className="cursor-grab p-1 text-subtle">
        <GripVertical className="size-4" />
      </button>
      <span className="grid size-6 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: color }}>
        {rank}
      </span>
      <span className="flex-1 text-sm">{label}</span>
      <Button type="button" variant="subtle" size="icon-sm" disabled={!onUp || disabled} onClick={onUp} aria-label={`Move ${label} up`}>
        <ArrowUp />
      </Button>
      <Button type="button" variant="subtle" size="icon-sm" disabled={!onDown || disabled} onClick={onDown} aria-label={`Move ${label} down`}>
        <ArrowDown />
      </Button>
    </li>
  );
}

export function RankingInput({ field, value, onChange, disabled, labelledBy, color }: InputProps) {
  const base = displayOptions(field).map((o) => o.id);
  const order = Array.isArray(value) && value.length === base.length ? value : base;
  const label = (id: string) => field.options.find((o) => o.id === id)?.label ?? id;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const move = (from: number, to: number) => onChange(arrayMove(order, from, to));
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) move(order.indexOf(String(e.active.id)), order.indexOf(String(e.over.id)));
  };
  return (
    <div className="max-w-md space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol aria-labelledby={labelledBy} className="space-y-1.5">
            {order.map((id, i) => (
              <Row key={id} id={id} label={label(id)} rank={i + 1} color={color} disabled={disabled} onUp={i > 0 ? () => move(i, i - 1) : undefined} onDown={i < order.length - 1 ? () => move(i, i + 1) : undefined} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {!Array.isArray(value) && (
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange(order)}>
          Keep this order
        </Button>
      )}
    </div>
  );
}
