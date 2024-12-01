import { useState, useEffect } from 'react';
import { XMarkIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { getCustomItems, deleteCustomItem, updateCustomItem } from '../services/groupService';

interface CustomItem {
  id: string;
  name: string;
  description: string;
  category: string;
  weight: number;
}

interface ManageCustomItemsModalProps {
  groupId: string;
  userId: string;
  onClose: () => void;
  onItemUpdated: () => void;
}

export function ManageCustomItemsModal({ groupId, userId, onClose, onItemUpdated }: ManageCustomItemsModalProps) {
  const [items, setItems] = useState<CustomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<CustomItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, [groupId]);

  async function loadItems() {
    try {
      setLoading(true);
      setError(null);
      const customItems = await getCustomItems(groupId);
      setItems(customItems);
    } catch (err: any) {
      setError('Failed to load custom items');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(itemId: string) {
    try {
      setDeletingItemId(itemId);
      await deleteCustomItem(groupId, itemId);
      await loadItems();
      onItemUpdated();
    } catch (err: any) {
      setError('Failed to delete item');
      console.error(err);
    } finally {
      setDeletingItemId(null);
    }
  }

  async function handleUpdate(updatedItem: CustomItem) {
    try {
      setError(null);
      await updateCustomItem(groupId, updatedItem);
      await loadItems();
      setEditingItem(null);
      onItemUpdated();
    } catch (err: any) {
      setError('Failed to update item');
      console.error(err);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-300"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold mb-4">Manage Custom Items</h2>

        {error && (
          <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-4">Loading items...</div>
        ) : (
          <div className="space-y-4">
            {items.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No custom items found</p>
            ) : (
              <div className="grid gap-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white/5 rounded-lg p-4"
                  >
                    {editingItem?.id === item.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleUpdate(editingItem);
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Name</label>
                          <input
                            type="text"
                            value={editingItem.name}
                            onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                            className="w-full px-3 py-2 bg-black/20 rounded-lg border border-white/10"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Description</label>
                          <textarea
                            value={editingItem.description}
                            onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                            className="w-full px-3 py-2 bg-black/20 rounded-lg border border-white/10"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Category</label>
                            <input
                              type="text"
                              value={editingItem.category}
                              onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                              className="w-full px-3 py-2 bg-black/20 rounded-lg border border-white/10"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Weight</label>
                            <input
                              type="number"
                              step="0.1"
                              value={editingItem.weight}
                              onChange={(e) => setEditingItem({ ...editingItem, weight: parseFloat(e.target.value) })}
                              className="w-full px-3 py-2 bg-black/20 rounded-lg border border-white/10"
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingItem(null)}
                            className="px-3 py-1 text-gray-400 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 bg-violet-600 hover:bg-violet-700 rounded-lg"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{item.name}</h3>
                            <p className="text-sm text-gray-400 mt-1">{item.description}</p>
                            <div className="flex gap-4 mt-2 text-sm text-gray-400">
                              <span>Category: {item.category}</span>
                              <span>Weight: {item.weight}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingItem(item)}
                              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deletingItemId === item.id}
                              className="p-2 hover:bg-white/10 rounded-lg text-red-400 hover:text-red-300 disabled:opacity-50"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 