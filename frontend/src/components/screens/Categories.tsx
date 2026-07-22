import { useState } from 'react';
import { Plus, Edit2, Trash2, Package } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';

interface Category {
  id: string;
  name: string;
  productCount: number;
  color: string;
}

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([
    { id: '1', name: 'Coffee', productCount: 12, color: '#8B5CF6' },
    { id: '2', name: 'Tea', productCount: 8, color: '#10B981' },
    { id: '3', name: 'Pastries', productCount: 15, color: '#F59E0B' },
    { id: '4', name: 'Merchandise', productCount: 5, color: '#3B82F6' },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#8B5CF6');

  const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#F97316'];

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const newCategory: Category = {
        id: String(Date.now()),
        name: newCategoryName,
        productCount: 0,
        color: newCategoryColor,
      };
      setCategories([...categories, newCategory]);
      setNewCategoryName('');
      setShowAddModal(false);
    }
  };

  const handleDeleteCategory = (id: string) => {
    setCategories(categories.filter(cat => cat.id !== id));
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryColor(category.color);
    setShowEditModal(true);
  };

  const handleSaveEditCategory = () => {
    if (editingCategory && newCategoryName.trim()) {
      const updatedCategory: Category = {
        ...editingCategory,
        name: newCategoryName,
        color: newCategoryColor,
      };
      setCategories(categories.map(cat => cat.id === editingCategory.id ? updatedCategory : cat));
      setEditingCategory(null);
      setNewCategoryName('');
      setShowEditModal(false);
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
        <Button onClick={() => setShowAddModal(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} />
            Add Category
          </div>
        </Button>
      </div>

      {/* Categories Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px',
      }}>
        {categories.map((category) => (
          <Card key={category.id}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Color Badge & Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div 
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: `${category.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Package size={24} style={{ color: category.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ marginBottom: '4px' }}>{category.name}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {category.productCount} products
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => handleEditCategory(category)}
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
                  onClick={() => handleDeleteCategory(category.id)}
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
        ))}
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowAddModal(false)}
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
            <h2 style={{ marginBottom: '16px' }}>Add New Category</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Category Name
              </label>
              <input
                type="text"
                placeholder="Enter category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: 'var(--bg-base)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Category Color
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewCategoryColor(color)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: color,
                      border: newCategoryColor === color ? '3px solid var(--primary-solid)' : '2px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" fullWidth onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button fullWidth onClick={handleAddCategory}>
                Add Category
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {showEditModal && editingCategory && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowEditModal(false)}
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
            <h2 style={{ marginBottom: '16px' }}>Edit Category</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Category Name
              </label>
              <input
                type="text"
                placeholder="Enter category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: 'var(--bg-base)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Category Color
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewCategoryColor(color)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: color,
                      border: newCategoryColor === color ? '3px solid var(--primary-solid)' : '2px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" fullWidth onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button fullWidth onClick={handleSaveEditCategory}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}