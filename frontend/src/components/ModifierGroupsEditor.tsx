import { Plus, Trash2, X } from 'lucide-react';
import { FieldInput } from './Field';
import { MoneyField } from './MoneyField';
import { ReorderableList } from './ReorderableList';
import {
  type EditorGroup, type EditorOption, blankEditorGroup, blankEditorOption,
} from '../lib/modifiers';

interface ModifierGroupsEditorProps {
  groups: EditorGroup[];
  onChange: (groups: EditorGroup[]) => void;
  currency: string;
  /** Disable all controls (e.g. while the product row is already saved). */
  disabled?: boolean;
}

/**
 * Merchant editor for a product's add-ons / modifiers. Works in a shop-owner
 * shape (a Required toggle + choose-one/choose-many switch); the parent maps it
 * to the API via editorGroupsToInputs on save. The whole set replaces the
 * product's groups on save (nested replace-on-save).
 */
export function ModifierGroupsEditor({ groups, onChange, currency, disabled }: ModifierGroupsEditorProps) {
  const patchGroup = (gi: number, changes: Partial<EditorGroup>) =>
    onChange(groups.map((g, i) => (i === gi ? { ...g, ...changes } : g)));

  // Options are addressed by their stable client id so drag-reordering never
  // mixes up which row an edit or remove applies to.
  const patchOption = (gi: number, id: string, changes: Partial<EditorOption>) =>
    onChange(groups.map((g, i) => i !== gi ? g : {
      ...g, options: g.options.map((o) => (o.id === id ? { ...o, ...changes } : o)),
    }));
  const removeOption = (gi: number, id: string) =>
    onChange(groups.map((g, i) => (i === gi ? { ...g, options: g.options.filter((o) => o.id !== id) } : g)));
  const reorderOptions = (gi: number, options: EditorOption[]) =>
    onChange(groups.map((g, i) => (i === gi ? { ...g, options } : g)));

  const addGroup = () => onChange([...groups, blankEditorGroup()]);
  const removeGroup = (gi: number) => onChange(groups.filter((_, i) => i !== gi));
  const addOption = (gi: number) =>
    onChange(groups.map((g, i) => (i === gi ? { ...g, options: [...g.options, blankEditorOption()] } : g)));

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
      <div style={{ marginBottom: '4px', fontWeight: 600, fontSize: '14px' }}>Add-ons &amp; options</div>
      <p className="text-xs" style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
        Let customers customise this item, e.g. a required “Size”, or optional “Add-ons”. Prices add on top of the base price.
      </p>

      {/* Whole groups reorder by dragging the card's grip; order is saved with the product. */}
      <ReorderableList
        items={groups}
        getKey={(g) => g.id ?? g.serverId ?? g.name}
        disabled={disabled}
        onReorder={onChange}
        renderRow={(group, { index: gi, handle: groupHandle, setNodeRef: setGroupRef, dragging: groupDragging }) => (
          <div
            ref={setGroupRef as (el: HTMLDivElement | null) => void}
            style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)', padding: '14px', background: 'var(--bg-card-subtle)', marginBottom: '12px', opacity: groupDragging ? 0.6 : 1 }}
          >
            {/* Grip + group name + remove */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <span style={{ marginBottom: '2px' }}>{groupHandle}</span>
              <div style={{ flex: 1 }}>
                <FieldInput label="Group name" placeholder="e.g. Size, Sauce, Add-ons"
                  value={group.name} onChange={(v) => patchGroup(gi, { name: v })} maxLength={40} disabled={disabled} />
              </div>
              <button type="button" aria-label="Remove group" disabled={disabled}
                onClick={() => removeGroup(gi)}
                style={{ ...iconBtn, color: 'var(--error-color)', marginBottom: '2px' }}>
                <Trash2 size={16} />
              </button>
            </div>

            {/* Selection rule */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
              <Segmented
                disabled={disabled}
                value={group.multiple ? 'many' : 'one'}
                onChange={(v) => patchGroup(gi, v === 'one'
                  ? { multiple: false, maxSelect: null }
                  : { multiple: true })}
                options={[{ value: 'one', label: 'Choose one' }, { value: 'many', label: 'Choose multiple' }]}
              />
              <CheckPill
                disabled={disabled}
                checked={group.required}
                onChange={(c) => patchGroup(gi, { required: c })}
                label="Required"
              />
              {group.multiple && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Max
                  <input
                    type="number" min={1} disabled={disabled}
                    value={group.maxSelect ?? ''}
                    placeholder="∞"
                    onChange={(e) => patchGroup(gi, { maxSelect: e.target.value === '' ? null : Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    style={{ width: '64px', padding: '6px 8px', borderRadius: 'var(--radius-field)', border: '1px solid var(--border-strong)', fontSize: '13px' }}
                  />
                </label>
              )}
            </div>

            {/* Options - drag the grip to reorder; order is saved with the product. */}
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ReorderableList
                items={group.options}
                getKey={(o) => o.id ?? o.name}
                disabled={disabled}
                onReorder={(options) => reorderOptions(gi, options)}
                renderRow={(opt, { index, handle, setNodeRef, dragging }) => (
                  <div
                    ref={setNodeRef as (el: HTMLDivElement | null) => void}
                    style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', opacity: dragging ? 0.6 : 1 }}
                  >
                    <span style={{ marginBottom: '2px' }}>{handle}</span>
                    <div style={{ flex: 1 }}>
                      <FieldInput label={index === 0 ? 'Option' : undefined} placeholder="e.g. Large"
                        value={opt.name} onChange={(v) => patchOption(gi, opt.id!, { name: v })} maxLength={40} disabled={disabled} />
                    </div>
                    <div style={{ width: '130px' }}>
                      <MoneyField label={index === 0 ? '+ Price' : undefined} currency={currency}
                        value={opt.priceDelta} onChange={(v) => patchOption(gi, opt.id!, { priceDelta: v })}
                        min={0} placeholder="0" />
                    </div>
                    <button type="button" aria-label="Remove option" disabled={disabled}
                      onClick={() => removeOption(gi, opt.id!)}
                      style={{ ...iconBtn, color: 'var(--text-muted)', marginBottom: '2px' }}>
                      <X size={15} />
                    </button>
                  </div>
                )}
              />
              <button type="button" disabled={disabled} onClick={() => addOption(gi)}
                style={{ ...linkBtn, alignSelf: 'flex-start' }}>
                <Plus size={14} /> Add option
              </button>
            </div>
          </div>
        )}
      />

      <button type="button" disabled={disabled} onClick={addGroup}
        style={{ ...linkBtn, marginTop: groups.length > 0 ? '12px' : '0' }}>
        <Plus size={15} /> Add modifier group
      </button>
    </div>
  );
}

function Segmented({ value, onChange, options, disabled }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean;
}) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-field)', overflow: 'hidden' }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" disabled={disabled}
            onClick={() => onChange(o.value)}
            style={{
              padding: '7px 12px', fontSize: '13px', fontWeight: on ? 600 : 500, cursor: disabled ? 'default' : 'pointer',
              border: 'none', borderLeft: i > 0 ? '1px solid var(--border-strong)' : 'none',
              background: on ? 'var(--primary-solid)' : 'var(--bg-card)', color: on ? 'white' : 'var(--text-secondary)',
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CheckPill({ checked, onChange, label, disabled }: {
  checked: boolean; onChange: (c: boolean) => void; label: string; disabled?: boolean;
}) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 12px', fontSize: '13px',
        cursor: disabled ? 'default' : 'pointer', borderRadius: 'var(--radius-field)',
        border: checked ? '1px solid var(--primary-solid)' : '1px solid var(--border-strong)',
        background: checked ? 'var(--bg-card-subtle)' : 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: checked ? 600 : 500,
      }}>
      <span style={{
        width: '16px', height: '16px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: checked ? 'var(--primary-solid)' : 'transparent', border: checked ? 'none' : '2px solid var(--border-strong)',
        color: 'white', fontSize: '11px', fontWeight: 900,
      }}>{checked ? '✓' : ''}</span>
      {label}
    </button>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'inline-flex', alignItems: 'center',
};

const linkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none',
  cursor: 'pointer', color: 'var(--primary-solid)', fontSize: '13px', fontWeight: 600, padding: '4px 0',
};
