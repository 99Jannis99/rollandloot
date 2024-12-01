import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { 
  getAllGroupInventories, 
  getPlayerInventory,
  isDungeonMaster,
  GroupInventory as GroupInventoryType,
  addItemToPlayerInventory,
  removeItemFromInventory,
  getInventoryCurrencies,
  updateInventoryCurrencies,
  Currency
} from '../services/groupService';
import { syncUser } from '../services/userService';
import { ItemList } from './ItemList';
import { AddItemModal } from './AddItemModal';
import { CreateCustomItemModal } from './CreateCustomItemModal';
import { ManageCustomItemsModal } from './ManageCustomItemsModal';
import { CurrencyDisplay } from './CurrencyDisplay';

// Neuer Import für das Chevron Icon
import ChevronIcon from '/icons/chevron.svg';

interface GroupInventoryOverviewProps {
  groupId: string;
}

export function GroupInventoryOverview({ groupId }: GroupInventoryOverviewProps) {
  const { user } = useUser();
  const [inventories, setInventories] = useState<GroupInventoryType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDM, setIsDM] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [showManageItemsModal, setShowManageItemsModal] = useState(false);
  const [collapsedInventories, setCollapsedInventories] = useState<{ [key: string]: boolean }>({});
  const [inventoryCurrencies, setInventoryCurrencies] = useState<{ [key: string]: Currency[] }>({});

  // Funktion zum Laden der Währungen für ein Inventar
  const loadCurrencies = async (inventoryId: string) => {
    try {
      const currencies = await getInventoryCurrencies(inventoryId);
      setInventoryCurrencies(prev => ({
        ...prev,
        [inventoryId]: currencies
      }));
    } catch (error) {
      console.error('Error loading currencies:', error);
    }
  };

  const loadInventories = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      
      const supabaseUser = await syncUser(user);
      const dmCheck = await isDungeonMaster(groupId, supabaseUser.id);
      setIsDM(dmCheck);

      if (dmCheck) {
        const allInventories = await getAllGroupInventories(groupId);
        const filteredInventories = allInventories.filter(inv => inv.user_id !== supabaseUser.id);
        setInventories(filteredInventories);
        
        for (const inv of filteredInventories) {
          await loadCurrencies(inv.id);
        }
      } else {
        const playerInventory = await getPlayerInventory(groupId, supabaseUser.id);
        if (playerInventory) {
          setInventories([playerInventory]);
          await loadCurrencies(playerInventory.id);
        }
      }
    } catch (err: any) {
      console.error('Error loading inventories:', err);
      setError(err.message || 'Failed to load inventories');
    }
  }, [groupId, user]);

  useEffect(() => {
    loadInventories();
  }, [loadInventories]);

  const handleAddItem = async () => {
    if (!selectedPlayerId) return;
    setShowAddItemModal(true);
  };

  const handleItemAdded = (newItem: any) => {
    setInventories(prev => prev.map(inv => {
      if (inv.user_id === selectedPlayerId) {
        return {
          ...inv,
          inventory_items: [
            ...inv.inventory_items || [],
            {
              id: newItem.id,
              item_id: newItem.item_id,
              quantity: newItem.quantity,
              item_type: newItem.item_type,
              items: newItem.items
            }
          ]
        };
      }
      return inv;
    }));
    setShowAddItemModal(false);
    setSelectedPlayerId(null);
  };

  // Hilfsfunktion zum Kürzen von Benutzernamen
  const truncateUsername = (username: string, maxLength: number = 15) => {
    return username.length > maxLength 
      ? username.slice(0, maxLength) + '...'
      : username;
  };

  // Funktion zum Umschalten des Collapse-Status
  const toggleInventory = (inventoryId: string) => {
    setCollapsedInventories(prev => ({
      ...prev,
      [inventoryId]: !prev[inventoryId]
    }));
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {isDM ? 'Group Inventories' : 'Your Inventory'}
        </h2>
        {isDM && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateItemModal(true)}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            >
              Create Custom Item
            </button>
            <button
              onClick={() => setShowManageItemsModal(true)}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            >
              Manage Custom Items
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        {inventories.map((inventory) => (
          <div
            key={inventory.id}
            className="bg-white/5 rounded-lg overflow-hidden"
          >
            <div 
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => toggleInventory(inventory.id)}
            >
              <div className="flex items-center space-x-3">
                {isDM && (
                  <>
                    <img
                      src={inventory.user?.avatar_url}
                      alt={inventory.user?.username}
                      className="w-10 h-10 rounded-full"
                    />
                    <h3 
                      className="text-lg font-semibold"
                      title={`${inventory.user?.username}'s Inventory`}
                    >
                      {inventory.user?.username 
                        ? `${truncateUsername(inventory.user.username)}'s Inventory`
                        : 'Unknown User\'s Inventory'}
                    </h3>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                {isDM && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlayerId(inventory.user_id);
                      setShowAddItemModal(true);
                    }}
                    className="px-3 py-1 text-sm bg-violet-600/10 text-violet-400 hover:bg-violet-600/20 rounded-lg"
                  >
                    Add Item
                  </button>
                )}
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className={`w-5 h-5 transition-transform duration-200 text-gray-400 ${
                    collapsedInventories[inventory.id] ? 'rotate-180' : ''
                  }`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            <div
              className={`transition-all duration-200 ease-in-out overflow-hidden ${
                collapsedInventories[inventory.id] ? 'max-h-0' : 'max-h-[2000px]'
              }`}
            >
              <div className="p-4">
                <CurrencyDisplay
                  currencies={inventoryCurrencies[inventory.id] || [
                    { type: 'copper', amount: 0 },
                    { type: 'silver', amount: 0 },
                    { type: 'gold', amount: 0 },
                    { type: 'platinum', amount: 0 }
                  ]}
                  isDM={isDM}
                  onUpdate={async (currencies) => {
                    try {
                      await updateInventoryCurrencies(inventory.id, currencies);
                      await loadCurrencies(inventory.id);
                    } catch (error) {
                      console.error('Error updating currencies:', error);
                    }
                  }}
                />
                <ItemList
                  items={inventory.inventory_items || []}
                  isDM={isDM}
                  userId={inventory.user_id}
                  onItemRemoved={() => loadInventories()}
                  onItemUpdated={() => loadInventories()}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddItemModal && selectedPlayerId && (
        <AddItemModal
          groupId={groupId}
          playerId={selectedPlayerId}
          onClose={() => {
            setShowAddItemModal(false);
            setSelectedPlayerId(null);
          }}
          onItemAdded={handleItemAdded}
        />
      )}

      {showCreateItemModal && (
        <CreateCustomItemModal
          groupId={groupId}
          userId={user?.id || ''}
          onClose={() => setShowCreateItemModal(false)}
          onItemCreated={() => {
            setShowCreateItemModal(false);
            // Optional: Aktualisieren Sie hier die Item-Liste
          }}
        />
      )}

      {showManageItemsModal && (
        <ManageCustomItemsModal
          groupId={groupId}
          userId={user?.id || ''}
          onClose={() => setShowManageItemsModal(false)}
          onItemUpdated={() => {
            setShowManageItemsModal(false);
            loadInventories();
          }}
        />
      )}
    </div>
  );
}