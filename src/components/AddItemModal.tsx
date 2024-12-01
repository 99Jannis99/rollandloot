import { useState, useEffect, useRef } from 'react';
import { searchItems, addItemToPlayerInventory, getAvailableCategories } from '../services/groupService';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';

interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  weight: number;
  is_custom: boolean;
}

interface AddItemModalProps {
  groupId: string;
  playerId: string;
  onClose: () => void;
  onItemAdded: (newItem: any) => void;
}

export function AddItemModal({ groupId, playerId, onClose, onItemAdded }: AddItemModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [itemsByCategory, setItemsByCategory] = useState<Item[]>([]);
  const searchTimeout = useRef<NodeJS.Timeout>();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (searchTerm.length >= 2) {
      setLoading(true);
      searchTimeout.current = setTimeout(async () => {
        try {
          const results = await searchItems(searchTerm, groupId);
          setSearchResults(results);
        } catch (error) {
          console.error('Failed to search items:', error);
        } finally {
          setLoading(false);
        }
      }, 300);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, groupId]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const availableCategories = await getAvailableCategories(groupId);
        setCategories(availableCategories);
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };
    loadCategories();
  }, [groupId]);

  useEffect(() => {
    const loadItemsByCategory = async () => {
      if (!selectedCategory) {
        setItemsByCategory([]);
        return;
      }

      try {
        const { data: standardItems } = await supabase
          .from('items')
          .select('*')
          .eq('category', selectedCategory)
          .order('name');

        const { data: customItems } = await supabase
          .from('custom_items')
          .select('*')
          .eq('group_id', groupId)
          .eq('category', selectedCategory)
          .order('name');

        const allItems = [
          ...(standardItems || []),
          ...(customItems || []).map(item => ({
            ...item,
            is_custom: true
          }))
        ].sort((a, b) => a.name.localeCompare(b.name));

        setItemsByCategory(allItems);
      } catch (error) {
        console.error('Failed to load items:', error);
      }
    };
    loadItemsByCategory();
  }, [selectedCategory, groupId]);

  const handleItemSelect = (item: Item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      const newItem = await addItemToPlayerInventory(
        groupId,
        playerId,
        selectedItem.id,
        parseInt(quantity),
        selectedItem.is_custom || false
      );
      
      onItemAdded(newItem);
      onClose();
    } catch (error) {
      console.error('Failed to add item:', error);
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

        <h2 className="text-xl font-bold mb-4">Add Item</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (selectedItem?.name !== e.target.value) {
                  setSelectedItem(null);
                }
              }}
              placeholder="Search for an item..."
              className="w-full px-4 py-2 bg-black/20 rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none"
            />
            
            {/* Live Search Results Dropdown */}
            {searchResults.length > 0 && !selectedItem && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 rounded-lg border border-white/10 shadow-lg max-h-60 overflow-y-auto z-10">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemSelect(item)}
                    className="w-full px-4 py-2 text-left hover:bg-white/10 focus:bg-white/10 focus:outline-none transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-400">{item.category}</div>
                      </div>
                      {item.is_custom && (
                        <span className="text-xs px-2 py-1 bg-violet-500/20 text-violet-300 rounded">
                          Custom
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-violet-500 border-t-transparent"></div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedItem(null);
                  }}
                  className="w-full px-4 py-2 bg-gray-700/50 rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none appearance-none cursor-pointer text-gray-200"
                >
                  <option value="" className="bg-gray-800">Select Category</option>
                  {categories.map(category => (
                    <option key={category} value={category} className="bg-gray-800">
                      {category}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    className="w-4 h-4"
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Item</label>
              <div className="relative">
                <select
                  value={selectedItem?.id || ''}
                  onChange={(e) => {
                    const item = itemsByCategory.find(i => i.id === e.target.value);
                    if (item) {
                      handleItemSelect(item);
                    }
                  }}
                  disabled={!selectedCategory}
                  className="w-full px-4 py-2 bg-gray-700/50 rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-gray-200"
                >
                  <option value="" className="bg-gray-800">Select Item</option>
                  {itemsByCategory.map(item => (
                    <option key={item.id} value={item.id} className="bg-gray-800">
                      {item.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    className="w-4 h-4"
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Item Details */}
          {selectedItem && (
            <div className="p-3 bg-black/20 rounded-lg">
              <div className="font-medium">{selectedItem.name}</div>
              <div className="text-sm text-gray-400 mt-1">{selectedItem.description}</div>
              <div className="text-sm text-gray-400">
                Category: {selectedItem.category} | Weight: {selectedItem.weight}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-2 bg-black/20 rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!selectedItem}
            className="w-full px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:hover:bg-violet-600 transition-colors"
          >
            Add to Inventory
          </button>
        </form>
      </div>
    </div>
  );
} 