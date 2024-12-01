import { useState, useEffect, useRef } from 'react';
import { removeItemFromInventory, updateItemQuantity } from '../services/groupService';
import { PlusIcon, MinusIcon, TrashIcon } from '@heroicons/react/24/outline';
import InfoIcon from '/icons/info.svg';

interface Item {
  id: string;
  item_id: string;
  quantity: number;
  item_type: 'standard' | 'custom';
  items: {
    id: string;
    name: string;
    description: string;
    category: string;
    weight: number;
    icon_url: string | null;
  };
}

interface ItemWithShowInfo extends Item {
  showInfo?: boolean;
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
  const [quantityInputs, setQuantityInputs] = useState<{ [key: string]: string }>({});
  const [updating, setUpdating] = useState<string | null>(null);
  const [itemsState, setItemsState] = useState<ItemWithShowInfo[]>([]);
  const [animatingItemId, setAnimatingItemId] = useState<string | null>(null);
  const prevItemsRef = useRef<Item[]>([]);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  useEffect(() => {
    setItemsState(items.map(item => ({ ...item, showInfo: false })));
  }, [items]);

  useEffect(() => {
    setQuantityInputs(prev => {
      const newInputs: { [key: string]: string } = {};
      items.forEach(item => {
        newInputs[item.id] = prev[item.id] || "1";
      });
      return newInputs;
    });
  }, [items]);

  useEffect(() => {
    const newItems = items.filter(item => 
      !prevItemsRef.current.find(prevItem => prevItem.id === item.id)
    );
    
    if (newItems.length > 0) {
      setAnimatingItemId(newItems[0].id);
      setTimeout(() => setAnimatingItemId(null), 500);
    }

    prevItemsRef.current = items;
  }, [items]);

  async function handleRemoveItem(itemId: string) {
    try {
      setDeletingItemId(itemId);
      setRemovingItemId(itemId);
      
      // Optimistic update
      onItemRemoved(itemId);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await removeItemFromInventory(itemId, userId, isDM);
    } catch (error) {
      console.error('Failed to remove item:', error);
      setRemovingItemId(null);
      // Bei Fehler UI zurücksetzen
      onItemUpdated();
    } finally {
      setDeletingItemId(null);
    }
  }

  async function handleQuantityChange(itemId: string, change: number) {
    try {
      const quantity = parseInt(quantityInputs[itemId] || '1');
      if (isNaN(quantity) || quantity <= 0) return;

      setUpdating(itemId);
      
      // Optimistic update
      const updatedItems = items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            quantity: Math.max(0, item.quantity + change)
          };
        }
        return item;
      });
      
      // Update UI sofort
      onItemUpdated();

      // Dann Update in der Datenbank
      await updateItemQuantity(itemId, change, userId, isDM);
    } catch (error) {
      console.error('Failed to update quantity:', error);
      // Bei Fehler UI zurücksetzen
      onItemUpdated();
    } finally {
      setUpdating(null);
    }
  }

  const toggleItemInfo = (index: number) => {
    setItemsState(prevItems => 
      prevItems.map((item, i) => 
        i === index ? { ...item, showInfo: !item.showInfo } : item
      )
    );
  };

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-gray-400 text-center py-4">No items in inventory</p>
      ) : (
        items.map((item, index) => {
          const itemStateData = itemsState.find(state => state.id === item.id) || { ...item, showInfo: false };
          return (
            <div 
              key={item.id}
              className={`flex items-start gap-4 p-3 bg-black/20 rounded-lg transition-all duration-300 ${
                animatingItemId === item.id ? 'animate-[slideDown_0.5s_ease-out]' : ''
              } ${
                removingItemId === item.id ? 'animate-[slideOut_0.5s_ease-out] opacity-0 transform translate-x-full' : ''
              }`}
            >
              <div className="flex-shrink-0 mt-1">
                {item.items?.icon_url && (
                  <>
                    <img
                      src={item.items.icon_url}
                      alt={item.items?.name}
                      className="w-8 h-8 text-white"
                      style={{ filter: 'invert(1)' }}
                      onError={(e) => {
                        console.error(`Failed to load icon: ${item.items.icon_url}`);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="hidden">{`Icon URL: ${item.items.icon_url}`}</div>
                  </>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.items?.name || 'Unknown Item'}</span>
                  <div className="flex items-center gap-2">
                    {item.items?.description && (
                      <button 
                        onClick={() => toggleItemInfo(index)}
                        className="info-icon-button"
                      >
                        <img
                          src={InfoIcon}
                          alt="Info"
                          className="w-5 h-5"
                          style={{ filter: 'invert(0.6)' }}
                        />
                      </button>
                    )}
                    <span className={`text-sm text-gray-400 ${
                      prevItemsRef.current.find(prev => 
                        prev.id === item.id && prev.quantity !== item.quantity
                      ) ? 'animate-[countUp_0.3s_ease-out]' : ''
                    }`}>
                      Quantity: {item.quantity}
                    </span>
                  </div>
                </div>
                {itemStateData.showInfo && (
                  <p className="text-sm text-gray-300 mt-1">{item.items?.description}</p>
                )}
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
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleQuantityChange(item.id, -parseInt(quantityInputs[item.id] || '1'))}
                    disabled={updating === item.id}
                    className="px-2 py-1 bg-yellow-600/10 text-yellow-400 hover:bg-yellow-600/20 rounded text-sm"
                  >
                    <MinusIcon className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={deletingItemId === item.id}
                  className="px-3 py-1 text-sm bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deletingItemId === item.id ? 'Removing...' : <TrashIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}