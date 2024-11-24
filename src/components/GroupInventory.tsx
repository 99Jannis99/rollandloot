import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PlusIcon } from './icons';

interface InventoryItem {
  id: string;
  quantity: number;
  item_id: string;
  item: {
    name: string;
    description: string;
    category: string;
    weight: number;
  };
}

interface GroupInventoryProps {
  groupId: string;
  userRole: string;
}

export function GroupInventory({ groupId, userRole }: GroupInventoryProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInventory() {
      try {
        // First get group_inventories for the group_id
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('group_inventories')
          .select('inventory_id')
          .eq('group_id', groupId)
          .single();

        if (inventoryError) {
          // If no inventory was found, show empty list
          if (inventoryError.code === 'PGRST116') {
            setItems([]);
            return;
          }
          throw inventoryError;
        }

        // Then get inventory_items with linked items
        const { data, error } = await supabase
          .from('inventory_items')
          .select(`
            id,
            quantity,
            item_id,
            items (
              name,
              description,
              category,
              weight
            )
          `)
          .eq('inventory_id', inventoryData.inventory_id);

        if (error) throw error;
        
        // Transform data to match interface
        const transformedData = data.map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          item_id: item.item_id,
          item: item.items
        }));

        setItems(transformedData);
      } catch (error) {
        console.error('Error fetching inventory:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchInventory();
  }, [groupId]);

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
        <h2 className="text-2xl font-semibold mb-4">Group Inventory</h2>
        <div className="text-gray-300">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Group Inventory</h2>
        {(userRole === 'admin' || userRole === 'dm') && (
          <button className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            <PlusIcon className="w-4 h-4" />
            Add Item
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-300">
          <p>No items in inventory yet.</p>
          {(userRole === 'admin' || userRole === 'dm') && (
            <p className="mt-2">Click "Add Item" to start building your inventory!</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-black/20 rounded-lg p-4 border border-white/5"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium">{item.item.name}</h3>
                  <p className="text-sm text-gray-300 mt-1">
                    {item.item.description}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-400">
                    <span>Category: {item.item.category}</span>
                    <span>Weight: {item.item.weight}</span>
                    <span>Quantity: {item.quantity}</span>
                  </div>
                </div>
                {(userRole === 'admin' || userRole === 'dm') && (
                  <button className="text-gray-400 hover:text-white">
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}