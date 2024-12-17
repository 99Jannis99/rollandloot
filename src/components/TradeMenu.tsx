import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Trade, getActiveTrades, createTradeOffer } from '../services/tradeService';
import { getUserInventoryItems } from '../services/groupService';
import { syncUser } from '../services/userService';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';

interface InventoryItem {
  id: string;
  quantity: number;
  items: {
    id: string;
    name: string;
    description: string;
    category: string;
    weight: number;
  };
}

interface TradeMenuProps {
  groupId: string;
  partnerId: string;
  onClose: () => void;
  onTradeComplete: () => void;
}

interface SelectedItemData {
  id: string | null;
  quantity: number;
  maxQuantity: number;
}

export function TradeMenu({ groupId, partnerId, onClose, onTradeComplete }: TradeMenuProps) {
  const { user } = useUser();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemData, setSelectedItemData] = useState<SelectedItemData>({
    id: null,
    quantity: 1,
    maxQuantity: 1
  });
  const [offeredCoins, setOfferedCoins] = useState({
    copper: 0,
    silver: 0,
    gold: 0,
    platinum: 0
  });
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const loadTrades = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const supabaseUser = await syncUser(user);
      const activeTrades = await getActiveTrades(groupId, supabaseUser.id);
      setTrades(activeTrades);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, groupId]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  useEffect(() => {
    async function loadInventoryItems() {
      if (!user) return;
      
      try {
        setLoadingItems(true);
        const supabaseUser = await syncUser(user);
        const items = await getUserInventoryItems(groupId, supabaseUser.id);
        setInventoryItems(items);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingItems(false);
      }
    }

    loadInventoryItems();
  }, [groupId, user]);

  async function handleCreateTrade() {
    if (!user) return;

    try {
      const supabaseUser = await syncUser(user);
      
      if (supabaseUser.id === partnerId) {
        setError("You cannot trade with yourself");
        return;
      }

      await createTradeOffer(
        groupId,
        supabaseUser.id,
        partnerId,
        selectedItemData.id ? {
          id: selectedItemData.id,
          quantity: selectedItemData.quantity
        } : undefined,
        hasOfferedCoins ? offeredCoins : undefined
      );
      onTradeComplete();
    } catch (err: any) {
      console.error('Trade creation error:', err);
      setError(err.message);
    }
  }

  const hasOfferedCoins = Object.values(offeredCoins).some(value => value > 0);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel('trade-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
          filter: `initiator_id=eq.${user.id},receiver_id=eq.${user.id}`
        },
        () => {
          loadTrades();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, loadTrades]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-300"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold mb-4">Create Trade Offer</h2>

        {error && (
          <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Item-Auswahl */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Select Item to Trade</h3>
            <select
              value={selectedItemData.id || ''}
              onChange={(e) => {
                const itemId = e.target.value;
                const selectedItem = inventoryItems.find(item => item.id === itemId);
                setSelectedItemData({
                  id: itemId,
                  quantity: 1,
                  maxQuantity: selectedItem?.quantity || 1
                });
              }}
              className="w-full px-3 py-2 bg-black/20 rounded-lg border border-white/10"
            >
              <option value="">Select an item...</option>
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.items.name} (Available: {item.quantity})
                </option>
              ))}
            </select>

            {/* Mengenauswahl (nur sichtbar wenn ein Item ausgewählt ist) */}
            {selectedItemData.id && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Quantity (max: {selectedItemData.maxQuantity})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={selectedItemData.maxQuantity}
                    value={selectedItemData.quantity}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value)) {
                        setSelectedItemData(prev => ({
                          ...prev,
                          quantity: Math.min(Math.max(1, value), prev.maxQuantity)
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-black/20 rounded-lg border border-white/10"
                  />
                  <button
                    onClick={() => setSelectedItemData(prev => ({
                      ...prev,
                      quantity: prev.maxQuantity
                    }))}
                    className="px-2 py-1 text-sm bg-violet-600/10 text-violet-400 hover:bg-violet-600/20 rounded"
                  >
                    Max
                  </button>
                </div>
              </div>
            )}

            {/* Zeige Details des ausgewählten Items */}
            {selectedItemData.id && (
              <div className="p-3 bg-black/20 rounded-lg">
                {(() => {
                  const item = inventoryItems.find(i => i.id === selectedItemData.id)?.items;
                  if (!item) return null;
                  return (
                    <>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-400 mt-1">{item.description}</div>
                      <div className="text-sm text-gray-400">
                        Category: {item.category} | Weight: {item.weight}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 text-sm text-gray-400 bg-gray-800">OR</span>
            </div>
          </div>

          {/* Münzauswahl */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">Offer Coins</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(offeredCoins).map(([type, amount]) => (
                <div key={type}>
                  <label className="block text-sm text-gray-400 mb-1 capitalize">
                    {type}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setOfferedCoins(prev => ({
                      ...prev,
                      [type]: parseInt(e.target.value) || 0
                    }))}
                    className="w-full px-3 py-2 bg-black/20 rounded-lg border border-white/10"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => handleCreateTrade()}
            disabled={(!selectedItemData.id && !hasOfferedCoins)}
            className="w-full px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            Create Trade Offer
          </button>
        </div>
      </div>
    </div>
  );
} 