import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { createCustomItem, getAvailableCategories } from '../services/groupService';

interface CreateCustomItemModalProps {
  groupId: string;
  userId: string;
  onClose: () => void;
  onItemCreated: () => void;
}

interface CustomItem {
  name: string;
  description: string;
  category: string;
  weight: number;
}

export function CreateCustomItemModal({ groupId, userId, onClose, onItemCreated }: CreateCustomItemModalProps) {
  const [formData, setFormData] = useState<CustomItem>({
    name: '',
    description: '',
    category: '',
    weight: 0
  });

  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const availableCategories = await getAvailableCategories(groupId);
        setCategories(availableCategories);
      } catch (error) {
        console.error('Failed to load categories:', error);
        setError('Failed to load categories');
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [groupId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      await createCustomItem(groupId, userId, formData);
      onItemCreated();
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to create custom item');
      console.error('Failed to create custom item:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-300"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold mb-4">Create Custom Item</h2>

        {error && (
          <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-700/50 rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none text-gray-200"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-700/50 rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none text-gray-200 min-h-[100px]"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-700/50 rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none text-gray-200"
              required
            >
              <option value="">Select Category</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Weight</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={formData.weight || 0}
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                setFormData(prev => ({ ...prev, weight: value }));
              }}
              className="w-full px-4 py-2 bg-gray-700/50 rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none text-gray-200"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            Create Item
          </button>
        </form>
      </div>
    </div>
  );
} 