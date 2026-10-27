import { Fragment, useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { arrayMove } from '../lib/reorder';

export interface ReorderRowArgs {
  /** True for the row currently being dragged (style it as lifted). */
  dragging: boolean;
  /** Position in the current (live) order, for e.g. "first row" affordances. */
  index: number;
  /** A ready-made grip handle. Place it in the row; pressing it starts the drag. */
  handle: React.ReactNode;
  /** Attach to the row's root element (any tag) so the list can hit-test it. */
  setNodeRef: (el: HTMLElement | null) => void;
}

interface ReorderableListProps<T> {
  items: T[];
  getKey: (item: T) => string | number;
  onReorder: (items: T[]) => void;
  renderRow: (item: T, args: ReorderRowArgs) => React.ReactNode;
  disabled?: boolean;
}

/**
 * A dependency-free, reusable drag-to-reorder list. The consumer renders each row
 * (a <div>, <tr>, card, whatever) and drops in the provided grip `handle` and
 * `setNodeRef`. Dragging the handle moves that row to a new position while the
 * others shift to make room (see {@link arrayMove}); the new order is committed
 * on release via `onReorder`. Pointer-based, so it works with mouse and touch.
 */
export function ReorderableList<T>({ items, getKey, onReorder, renderRow, disabled }: ReorderableListProps<T>) {
  const [order, setOrder] = useState<T[]>(items);
  const [draggingKey, setDraggingKey] = useState<string | number | null>(null);
  const nodes = useRef(new Map<string | number, HTMLElement>());
  const orderRef = useRef(order);
  orderRef.current = order;

  // Mirror the source list whenever it changes (add/remove/edit/external), but
  // never mid-drag so a live reorder isn't clobbered by a stale prop.
  useEffect(() => {
    if (draggingKey == null) setOrder(items);
  }, [items, draggingKey]);

  const beginDrag = (key: string | number) => (e: React.PointerEvent) => {
    if (disabled || (e.button != null && e.button !== 0)) return;
    e.preventDefault();
    setDraggingKey(key);

    const onMove = (ev: PointerEvent) => {
      const cur = orderRef.current;
      const from = cur.findIndex((it) => getKey(it) === key);
      if (from < 0) return;
      // Target = first row whose vertical midpoint is below the pointer; past the
      // last midpoint means the end. Layout reflects the live order, so this
      // converges as the pointer moves.
      let target = cur.length - 1;
      for (let i = 0; i < cur.length; i++) {
        const node = nodes.current.get(getKey(cur[i]));
        if (!node) continue;
        const r = node.getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { target = i; break; }
      }
      if (target !== from) setOrder((o) => arrayMove(o, from, target));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDraggingKey(null);
      onReorder(orderRef.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <>
      {order.map((item, index) => {
        const key = getKey(item);
        const dragging = key === draggingKey;
        const handle = (
          <button
            type="button"
            aria-label="Drag to reorder"
            disabled={disabled}
            onPointerDown={beginDrag(key)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', padding: '4px',
              cursor: disabled ? 'default' : 'grab', color: 'var(--text-muted)',
              touchAction: 'none', // let the handle drag on touch without scrolling
            }}
          >
            <GripVertical size={16} />
          </button>
        );
        const setNodeRef = (el: HTMLElement | null) => {
          if (el) nodes.current.set(key, el);
          else nodes.current.delete(key);
        };
        return <Fragment key={key}>{renderRow(item, { dragging, index, handle, setNodeRef })}</Fragment>;
      })}
    </>
  );
}
