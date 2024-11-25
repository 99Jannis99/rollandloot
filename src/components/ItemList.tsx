import { useState, useEffect } from 'react';
import { removeItemFromInventory, updateItemQuantity } from '../services/groupService';

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
  onItemUpdated: () => void;
}

export function ItemList({ items, isDM, userId, onItemRemoved, onItemUpdated }: ItemListProps) {
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [quantityInputs, setQuantityInputs] = useState<{ [key: string]: string }>(() => {
    const initialInputs: { [key: string]: string } = {};
    items.forEach(item => {
      initialInputs[item.id] = "1";
    });
    return initialInputs;
  });
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    setQuantityInputs(prev => {
      const newInputs = { ...prev };
      items.forEach(item => {
        if (!newInputs[item.id]) {
          newInputs[item.id] = "1";
        }
      });
      return newInputs;
    });
  }, [items]);

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

  async function handleQuantityChange(itemId: string, change: number) {
    try {
      const quantity = parseInt(quantityInputs[itemId] || '1');
      if (isNaN(quantity) || quantity <= 0) return;

      setUpdating(itemId);
      await updateItemQuantity(itemId, change, userId, isDM);
      
      setQuantityInputs(prev => ({ ...prev, [itemId]: "1" }));
      
      onItemUpdated();
    } catch (error) {
      console.error('Failed to update quantity:', error);
    } finally {
      setUpdating(null);
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

            <div className="flex items-center gap-2 ml-4">
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="1"
                  value={quantityInputs[item.id] || "1"}
                  onChange={(e) => setQuantityInputs(prev => ({
                    ...prev,
                    [item.id]: e.target.value
                  }))}
                  className="w-16 px-2 py-1 bg-black/30 border border-white/10 rounded text-sm"
                  placeholder="1"
                />
                {isDM && (
                  <button
                    onClick={() => handleQuantityChange(item.id, parseInt(quantityInputs[item.id] || '0'))}
                    disabled={updating === item.id}
                    className="px-2 py-1 bg-green-600/10 text-green-400 hover:bg-green-600/20 rounded text-sm"
                  >
                    +
                  </button>
                )}
                <button
                  onClick={() => handleQuantityChange(item.id, -parseInt(quantityInputs[item.id] || '1'))}
                  disabled={updating === item.id}
                  className="px-2 py-1 bg-yellow-600/10 text-yellow-400 hover:bg-yellow-600/20 rounded text-sm"
                >
                  -
                </button>
              </div>

              <button
                onClick={() => handleRemoveItem(item.id)}
                disabled={deletingItemId === item.id}
                className="px-3 py-1 text-sm bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {deletingItemId === item.id ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}