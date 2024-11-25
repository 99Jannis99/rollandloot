import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { 
  getAllGroupInventories, 
  getPlayerInventory,
  isDungeonMaster,
  GroupInventory as GroupInventoryType,
  addItemToPlayerInventory,
  removeItemFromInventory
} from '../services/groupService';
import { syncUser } from '../services/userService';
import { ItemList } from './ItemList';
import { AddItemModal } from './AddItemModal';

interface GroupInventoryOverviewProps {
  groupId: string;
}

export function GroupInventoryOverview({ groupId }: GroupInventoryOverviewProps) {
  const { user } = useUser();
  const [inventories, setInventories] = useState<GroupInventoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDM, setIsDM] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  useEffect(() => {
    loadInventories();
  }, [groupId, user]);

  async function loadInventories() {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      const supabaseUser = await syncUser(user);
      const dmCheck = await isDungeonMaster(groupId, supabaseUser.id);
      setIsDM(dmCheck);

      if (dmCheck) {
        const allInventories = await getAllGroupInventories(groupId);
        const filteredInventories = allInventories.filter(inv => inv.user_id !== supabaseUser.id);
        setInventories(filteredInventories);
      } else {
        const playerInventory = await getPlayerInventory(groupId, supabaseUser.id);
        if (playerInventory) {
          setInventories([playerInventory]);
        } else {
          setInventories([]);
        }
      }
    } catch (err: any) {
      console.error('Error loading inventories:', err);
      setError(err.message || 'Failed to load inventories');
    } finally {
      setLoading(false);
    }
  }

  const handleAddItem = async () => {
    if (!selectedPlayerId) return;
    setShowAddItemModal(true);
  };

  const handleItemAdded = () => {
    loadInventories();
    setShowAddItemModal(false);
    setSelectedPlayerId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-300">Loading inventories...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {isDM ? 'Group Inventories' : 'Your Inventory'}
        </h2>
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
            className="bg-white/5 rounded-lg p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={inventory.user?.avatar_url}
                  alt={inventory.user?.username}
                  className="w-10 h-10 rounded-full"
                />
                <h3 className="text-lg font-semibold">
                  {inventory.user?.username}'s Inventory
                </h3>
              </div>
              {isDM && (
                <button
                  onClick={() => {
                    setSelectedPlayerId(inventory.user_id);
                    setShowAddItemModal(true);
                  }}
                  className="px-3 py-1 text-sm bg-violet-600/10 text-violet-400 hover:bg-violet-600/20 rounded-lg"
                >
                  Add Item
                </button>
              )}
            </div>

            <ItemList
              items={inventory.inventory_items || []}
              isDM={isDM}
              userId={inventory.user_id}
              onItemRemoved={() => loadInventories()}
            />
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
    </div>
  );
}