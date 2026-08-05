import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Package } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { categoriesApi, ApiError, type CategoryResponse } from '../../lib/api';

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#F97316'];
const DEFAULT_COLOR = COLORS[0];

interface CategoriesProps {
  storeId: number;
}

export function Categories({ storeId }: CategoriesProps) {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryResponse | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryResponse | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setCategories(await categoriesApi.list(storeId));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const openAdd = () => {
    setName('');
    setColor(DEFAULT_COLOR);
    setFormError(null);
    setShowAddModal(true);
  };

  const openEdit = (category: CategoryResponse) => {
    setEditingCategory(category);
    setName(category.name);
    setColor(category.color || DEFAULT_COLOR);
    setFormError(null);
  };

  const closeForm = () => {
    setShowAddModal(false);
    setEditingCategory(null);
    setFormError(null);
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await categoriesApi.create(storeId, { name: name.trim(), color });
      closeForm();
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add category.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await categoriesApi.update(storeId, editingCategory.id, { name: name.trim(), color });
      closeForm();
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    setSaving(true);
    try {
      await categoriesApi.remove(storeId, deletingCategory.id);
      setDeletingCategory(null);
      await load();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to delete category.');
      setDeletingCategory(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Categories</h1>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Organize products into categories
          </p>
        </div>
        <Button onClick={openAdd}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} />
            Add Category
          </div>
        </Button>
      </div>

      {loadError && (
        <p className="text-small" style={{ color: '#DC2626', marginBottom: '16px' }}>{loadError}</p>
      )}

      {loading ? (
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading categories…</p>
      ) : categories.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <Package size={28} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
            <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
              No categories yet. Add one to start organizing your products.
            </p>
          </div>
        </Card>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {categories.map((category) => {
            const c = category.color || DEFAULT_COLOR;
            return (
              <Card key={category.id}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Color Badge & Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: `${c}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Package size={24} style={{ color: c }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginBottom: '4px' }}>{category.name}</h3>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {category.productCount} {category.productCount === 1 ? 'product' : 'products'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      onClick={() => openEdit(category)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-field)',
                        background: 'var(--bg-card)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingCategory(category)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-field)',
                        background: 'var(--bg-card)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        color: '#DC2626',
                      }}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {(showAddModal || editingCategory) && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeForm}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '16px' }}>{editingCategory ? 'Edit Category' : 'Add New Category'}</h2>

            <div style={{ marginBottom: '16px' }}>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Category Name
              </label>
              <input
                type="text"
                placeholder="Enter category name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%', height: '40px', padding: '0 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: 'var(--bg-base)', fontSize: '13px', outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: formError ? '12px' : '24px' }}>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Category Color
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    onClick={() => setColor(swatch)}
                    style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: swatch,
                      border: color === swatch ? '3px solid var(--primary-solid)' : '2px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>

            {formError && (
              <p className="text-xs" style={{ color: '#DC2626', marginBottom: '16px' }}>{formError}</p>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" fullWidth onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button fullWidth onClick={editingCategory ? handleSaveEdit : handleAdd} disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : editingCategory ? 'Save Changes' : 'Add Category'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingCategory && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setDeletingCategory(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '12px' }}>Delete “{deletingCategory.name}”?</h2>
            <p className="text-small" style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {deletingCategory.productCount > 0
                ? `${deletingCategory.productCount} ${deletingCategory.productCount === 1 ? 'product' : 'products'} will be moved to “No category”. The products themselves are not deleted.`
                : 'This category has no products. It will be removed.'}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" fullWidth onClick={() => setDeletingCategory(null)} disabled={saving}>
                Cancel
              </Button>
              <Button fullWidth onClick={handleDelete} disabled={saving}>
                {saving ? 'Deleting…' : 'Delete Category'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
