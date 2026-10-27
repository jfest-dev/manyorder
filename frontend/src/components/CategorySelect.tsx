import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { FieldSelect } from './Field';
import { categoriesApi, ApiError, type CategoryResponse } from '../lib/api';

// Same palette as the Categories management screen, so a quick-added category
// looks identical whether it's created here or there.
const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#F97316'];
const DEFAULT_COLOR = COLORS[0];

interface CategorySelectProps {
  storeId: number;
  /** Selected category id as a string; '' = no category. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** Fires with the selected category's name (or null) whenever it resolves -
   *  used by callers that show the name somewhere (e.g. a live-preview badge). */
  onCategoryName?: (name: string | null) => void;
}

/**
 * Category dropdown with inline "quick-add" - create a new category without
 * leaving the form. Owns the category list for its store, so every surface that
 * picks a category (Add Product, Edit Product, and onboarding step 2 via
 * AddProducts) shares this one implementation.
 */
export function CategorySelect({ storeId, value, onChange, label = 'Category', onCategoryName }: CategorySelectProps) {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    categoriesApi.list(storeId).then(setCategories).catch(() => setCategories([]));
  }, [storeId]);

  // Surface the selected category's name to the caller when it changes.
  useEffect(() => {
    if (!onCategoryName) return;
    const match = categories.find((c) => String(c.id) === value);
    onCategoryName(match ? match.name : null);
  }, [value, categories, onCategoryName]);

  const options = categories.map((c) => ({ value: String(c.id), label: c.name }));

  const openAdd = () => {
    setName('');
    setColor(DEFAULT_COLOR);
    setError(null);
    setAdding(true);
  };

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const created = await categoriesApi.create(storeId, { name: trimmed, color });
      setCategories((prev) => [...prev, created]);
      onChange(String(created.id)); // auto-select the new category
      setAdding(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <FieldSelect
        label={label}
        placeholder="No category"
        options={options}
        value={value}
        onChange={onChange}
      />

      {!adding ? (
        <button
          type="button"
          onClick={openAdd}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            marginTop: '8px', padding: 0, background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-primary)', font: 'inherit', fontSize: '12px',
          }}
        >
          <Plus size={13} /> New category
        </button>
      ) : (
        <div style={{ marginTop: '10px', padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-field)', background: 'var(--bg-base)' }}>
          <input
            type="text"
            autoFocus
            placeholder="New category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            style={{
              width: '100%', height: '36px', padding: '0 10px',
              border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-field)',
              background: 'var(--bg-card)', fontSize: '13px', outline: 'none',
            }}
          />

          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            {COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Colour ${swatch}`}
                onClick={() => setColor(swatch)}
                style={{
                  width: '26px', height: '26px', borderRadius: '50%', background: swatch,
                  border: color === swatch ? '3px solid var(--primary-solid)' : '2px solid var(--border-subtle)',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>

          {error && <p className="text-xs" style={{ color: '#DC2626', marginTop: '8px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !name.trim()}
              style={{
                flex: 1, height: '34px', border: 'none', borderRadius: 'var(--radius-field)',
                background: 'var(--primary-solid)', color: 'white', fontSize: '13px', fontWeight: 600,
                cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', opacity: saving || !name.trim() ? 0.5 : 1,
              }}
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              disabled={saving}
              style={{
                flex: 1, height: '34px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-field)',
                background: 'var(--bg-card)', fontSize: '13px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
