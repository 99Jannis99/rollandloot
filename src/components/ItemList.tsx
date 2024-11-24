import { useState } from 'react';
import { removeItemFromInventory } from '../services/groupService';

interface Item {
  id: string;
  item_id: string;
  quantity: number;
  items: {
    id: string;
    name: string;
    description: string;
    category: string;
    weight: number;
  };
}

interface ItemListProps {
  items: Item[];
  isDM: boolean;
  userId: string;
  onItemRemoved: (itemId: string) => void;
}

export function ItemList({ items, isDM, userId, onItemRemoved }: ItemListProps) {
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  async function handleRemoveItem(itemId: string) {
    try {
      setDeletingItemId(itemId);
      await removeItemFromInventory(itemId, userId, isDM);
      onItemRemoved(itemId);
    } catch (error) {
      console.error('Failed to remove item:', error);
    } finally {
      setDeletingItemId(null);
    }
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-gray-400 text-center py-4">No items in inventory</p>
      ) : (
        items.map(item => (
          <div 
            key={item.id}
            className="flex items-center justify-between p-3 bg-black/20 rounded-lg"
          >
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{item.items?.name || 'Unknown Item'}</span>
                <span className="text-sm text-gray-400">Quantity: {item.quantity}</span>
              </div>
              <p className="text-sm text-gray-300 mt-1">{item.items?.description}</p>
              <div className="flex gap-4 mt-1 text-xs text-gray-400">
                <span>Category: {item.items?.category}</span>
                <span>Weight: {item.items?.weight}</span>
              </div>
            </div>
            <button
              onClick={() => handleRemoveItem(item.id)}
              disabled={deletingItemId === item.id}
              className="ml-4 px-3 py-1 text-sm bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {deletingItemId === item.id ? 'Removing...' : 'Remove'}
            </button>
          </div>
        ))
      )}
    </div>
  );
}