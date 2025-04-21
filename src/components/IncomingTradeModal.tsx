import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Trade, makeCounterOffer } from '../services/tradeService';
import { getUserInventoryItems } from '../services/groupService';
import { useUser } from '@clerk/clerk-react';
import { syncUser } from '../services/userService';
import { supabase } from '../lib/supabase';

interface IncomingTradeModalProps {
  trade: Trade;
  onClose: () => void;
  onTradeUpdated: () => void;
}

interface SelectedItemData {
  id: string | null;
  quantity: number;
  maxQuantity: number;
}

export function IncomingTradeModal({ trade, onClose, onTradeUpdated }: IncomingTradeModalProps) {
  const { user } = useUser();
  const [selectedItemData, setSelectedItemData] = useState<SelectedItemData>({
    id: null,
    quantity: 1,
    maxQuantity: 1
  });
  const [counterCoins, setCounterCoins] = useState({
    copper: 0,
    silver: 0,
    gold: 0,
    platinum: 0
  });
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [coins, setCoins] = useState<{ copper: number; silver: number; gold: number; platinum: number }>({
    copper: 0,
    silver: 0,
    gold: 0,
    platinum: 0
  });
  const [currentCoins, setCurrentCoins] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    async function loadInventoryItems() {
      if (!user) return;
      
      try {
        setLoading(true);
        const supabaseUser = await syncUser(user);
        const items = await getUserInventoryItems(trade.group_id, supabaseUser.id);
        setInventoryItems(items);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadInventoryItems();
  }, [user, trade.group_id]);

  useEffect(() => {
    const loadCurrentCoins = async () => {
      const { data: inventory } = await supabase
        .from('group_inventories')
        .select('id')
        .eq('group_id', trade.group_id)
        .eq('user_id', trade.receiver_id)
        .single();

      if (inventory) {
        const { data: currencies } = await supabase
          .from('inventory_currencies')
          .select('copper, silver, gold, platinum')
          .eq('inventory_id', inventory.id)
          .single();

        if (currencies) {
          setCurrentCoins(currencies);
        }
      }
    };

    loadCurrentCoins();
  }, [trade.group_id, trade.receiver_id]);

  async function handleMakeCounterOffer() {
    try {
      await makeCounterOffer(
        trade.id,
        selectedItemData.id,
        selectedItemData.quantity,
        counterCoins
      );
      onTradeUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error making counter offer:', err);
      setError(err.message);
    }
  }

  const hasCounterOffer = selectedItemData.id || Object.values(counterCoins).some(value => value > 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-500/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-500/70">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-300"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold mb-4">Incoming Trade Offer</h2>

        {error && (
          <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Zeige angebotene Items/Münzen */}
        <div className="mb-6">
          {trade.offered_item_id && trade.offered_item && (
            <>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Offered Items:</h3>
              <div className="p-3 bg-black/20 rounded-lg">
                <div className="font-medium">{trade.offered_item.name}</div>
                <div className="text-sm text-gray-400 mt-1">
                  {trade.offered_item.description}
                </div>
                <div className="text-sm text-gray-400">
                  Category: {trade.offered_item.category} | Weight: {trade.offered_item.weight}
                </div>
                <div className="text-sm text-violet-400 mt-1">
                  Quantity: {trade.offered_item_quantity}
                </div>
              </div>
            </>
          )}
          {/* Angebotene Coins */}
          {trade.offered_coins && (
            <div className="mt-2">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Offered Coins:</h4>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(trade.offered_coins)
                  .filter(([_, amount]) => amount > 0)
                  .map(([type, amount]) => (
                    <div key={type} className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <img 
                          src={`/public/icons/${type}.svg`} 
                          alt={type} 
                          className="w-6 h-6"
                        />
                        <span className="text-sm text-gray-300 capitalize">{type}</span>
                      </div>
                      <span className="text-sm text-gray-300">{amount}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Counter Offer UI */}
        <div className="space-y-4">
          {/* Item Selection */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Select Item to Offer:</h3>
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
              className="w-full px-3 py-2 bg-black/20 rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none transition-all duration-200 ease-in-out transform hover:scale-[1.02]"
            >
              <option value="" className="bg-gray-800 text-gray-300">Select an item...</option>
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id} className="bg-gray-800 text-gray-300">
                  {item.items.name} (Available: {item.quantity})
                </option>
              ))}
            </select>

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
                    className="w-full px-3 py-2 bg-black/20 rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none"
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
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 text-sm text-gray-400 bg-gray-800">OR</span>
            </div>
          </div>

          {/* Coin Selection */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">Offer Coins</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(counterCoins).map(([type, amount]) => (
                <div key={type}>
                  <label className="block text-sm text-gray-400 mb-1 capitalize">
                    {type} ({currentCoins[type as keyof typeof currentCoins] || 0})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={currentCoins[type as keyof typeof currentCoins] || 0}
                    value={amount}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      const maxValue = currentCoins[type as keyof typeof currentCoins] || 0;
                      setCounterCoins(prev => ({
                        ...prev,
                        [type]: Math.min(value, maxValue)
                      }));
                    }}
                    className="w-full px-3 py-2 bg-black/20 rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleMakeCounterOffer}
              disabled={!hasCounterOffer}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              Make Counter Offer
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded-lg"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 