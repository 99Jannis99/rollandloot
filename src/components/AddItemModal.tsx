import { useState, useEffect } from 'react';
import { addItemToPlayerInventory } from '../services/groupService';
import { supabase } from '../lib/supabase';

interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  weight: number;
}

interface AddItemModalProps {
  groupId: string;
  playerId: string;
  onClose: () => void;
  onItemAdded: () => void;
}

export function AddItemModal({ groupId, playerId, onClose, onItemAdded }: AddItemModalProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('name');

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      setError('Failed to load items');
      console.error(err);
    }
  }

  const categories = ['all', ...new Set(items.map(item => item.category))];
  
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItemId) {
      setError('Please select an item');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await addItemToPlayerInventory(groupId, playerId, {
        itemId: selectedItemId,
        quantity
      });
      onItemAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add item');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div 
        className="relative bg-gray-900 rounded-xl p-6 w-full max-w-md border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-6">Add Item</h2>

        {error && (
          <div className="mb-4 text-red-400 text-sm p-2 bg-red-500/10 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-1">
              Search Items
            </label>
            <input
              type="text"
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or description..."
              className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-1">
              Category
            </label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem'
              }}
            >
              {categories.map(category => (
                <option 
                  key={category} 
                  value={category}
                  className="bg-gray-900 text-white"
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="item" className="block text-sm font-medium text-gray-300 mb-1">
              Select Item
            </label>
            <select
              id="item"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent appearance-none"
              required
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem'
              }}
            >
              <option value="" className="bg-gray-900 text-gray-400">Select an item...</option>
              {filteredItems.map(item => (
                <option 
                  key={item.id} 
                  value={item.id}
                  className="bg-gray-900 text-white"
                >
                  {item.name} ({item.category})
                </option>
              ))}
            </select>
          </div>

          {selectedItemId && (
            <div className="bg-black/20 p-3 rounded-lg">
              <h4 className="font-medium mb-1">Item Details</h4>
              <p className="text-sm text-gray-300">{items.find(i => i.id === selectedItemId)?.description}</p>
              <p className="text-sm text-gray-400 mt-1">Weight: {items.find(i => i.id === selectedItemId)?.weight}</p>
            </div>
          )}

          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-300 mb-1">
              Quantity
            </label>
            <input
              type="number"
              id="quantity"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              required
            />
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 