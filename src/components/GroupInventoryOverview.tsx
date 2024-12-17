import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "../lib/supabase";
import {
  getAllGroupInventories,
  getPlayerInventory,
  isDungeonMaster,
  GroupInventory as GroupInventoryType,
  addItemToPlayerInventory,
  removeItemFromInventory,
  getInventoryCurrencies,
  updateInventoryCurrencies,
  Currency,
} from "../services/groupService";
import { syncUser } from "../services/userService";
import { ItemList } from "./ItemList";
import { AddItemModal } from "./AddItemModal";
import { CreateCustomItemModal } from "./CreateCustomItemModal";
import { ManageCustomItemsModal } from "./ManageCustomItemsModal";
import { CurrencyDisplay } from "./CurrencyDisplay";
import { TradeMenu } from "./TradeMenu";
import { SelectTradePartnerModal } from "./SelectTradePartnerModal";

// Neuer Import für das Chevron Icon
import ChevronIcon from "/icons/chevron.svg";

interface GroupInventoryOverviewProps {
  groupId: string;
}

export function GroupInventoryOverview({
  groupId,
}: GroupInventoryOverviewProps) {
  const { user } = useUser();
  const [inventories, setInventories] = useState<GroupInventoryType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDM, setIsDM] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [showManageItemsModal, setShowManageItemsModal] = useState(false);
  const [collapsedInventories, setCollapsedInventories] = useState<{
    [key: string]: boolean;
  }>({});
  const [inventoryCurrencies, setInventoryCurrencies] = useState<{
    [key: string]: Currency[];
  }>({});
  const [showTradeMenu, setShowTradeMenu] = useState(false);
  const [selectedTradePartnerId, setSelectedTradePartnerId] = useState<
    string | null
  >(null);

  // Funktion zum Laden der Währungen für ein Inventar
  const loadCurrencies = useCallback(async (inventoryId: string) => {
    try {
      const currencies = await getInventoryCurrencies(inventoryId);
      setInventoryCurrencies((prev) => ({
        ...prev,
        [inventoryId]: currencies,
      }));
    } catch (error) {
      setError("Failed to load currencies");
    }
  }, []);

  // Zuerst die reloadInventoryData Funktion anpassen
  const reloadInventoryData = useCallback(async () => {
    if (!user) return;

    try {
      const supabaseUser = await syncUser(user);

      if (isDM) {
        const allInventories = await getAllGroupInventories(groupId);
        const filteredInventories = allInventories.filter(
          (inv) => inv.user_id !== supabaseUser.id
        );
        setInventories(filteredInventories);

        // Lade Währungen für alle Inventare
        for (const inv of filteredInventories) {
          await loadCurrencies(inv.id);
        }
      } else {
        const playerInventory = await getPlayerInventory(
          groupId,
          supabaseUser.id
        );
        if (playerInventory) {
          setInventories([playerInventory]);
          // Lade Währungen für das Spieler-Inventar
          await loadCurrencies(playerInventory.id);
        }
      }
    } catch (error) {
      setError("Failed to reload inventory data");
    }
  }, [user, groupId, isDM, loadCurrencies]);

  // Dann die Realtime-Subscription anpassen
  useEffect(() => {
    if (!user) {
      console.log("Keine Realtime-Subscription erstellt - kein User vorhanden");
      return;
    }

    let isSubscribed = true;

    const channel = supabase
      .channel("inventory_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_items",
        },
        (payload) => {
          if (isSubscribed) {
            requestAnimationFrame(() => {
              if (isSubscribed) {
                reloadInventoryData();
              }
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_currencies",
        },
        (payload) => {
          if (isSubscribed && payload.new) {
            const inventoryId = payload.new.inventory_id;
            if (inventoryId) {
              requestAnimationFrame(() => {
                if (isSubscribed) {
                  loadCurrencies(inventoryId);
                }
              });
            } else {
              console.warn("Keine inventory_id in payload gefunden:", payload);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "group_members",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          if (isSubscribed) {
            requestAnimationFrame(() => {
              if (isSubscribed) {
                reloadInventoryData();
              }
            });
          }
        }
      );

    // Subscription aktivieren
    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Fehler bei der Realtime-Subscription");
      }
    });

    // Initiales Laden
    const initializeData = async () => {
      try {
        const supabaseUser = await syncUser(user);
        const dmCheck = await isDungeonMaster(groupId, supabaseUser.id);
        setIsDM(dmCheck);
        await reloadInventoryData();
      } catch (error) {
        console.error("Fehler beim initialen Laden:", error);
        setError("Failed to load initial data");
      }
    };

    requestAnimationFrame(() => {
      if (isSubscribed) {
        initializeData();
      }
    });

    return () => {
      isSubscribed = false;
      channel.unsubscribe();
    };
  }, [user?.id, groupId, reloadInventoryData, loadCurrencies]);

  const handleAddItem = async () => {
    if (!selectedPlayerId) return;
    setShowAddItemModal(true);
  };

  const handleItemAdded = (newItem: any) => {
    reloadInventoryData();
    setShowAddItemModal(false);
    setSelectedPlayerId(null);
  };

  // Hilfsfunktion zum Kürzen von Benutzernamen
  const truncateUsername = (username: string, maxLength: number = 15) => {
    return username.length > maxLength
      ? username.slice(0, maxLength) + "..."
      : username;
  };

  // Funktion zum Umschalten des Collapse-Status
  const toggleInventory = (inventoryId: string) => {
    setCollapsedInventories((prev) => ({
      ...prev,
      [inventoryId]: !prev[inventoryId],
    }));
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {isDM ? "Group Inventories" : "Your Inventory"}
        </h2>
        <div className="flex gap-2">
          {!isDM && (
            <button
              onClick={() => setShowTradeMenu(true)}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            >
              New Trade
            </button>
          )}
          {isDM && (
            <>
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
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-6 backdrop-blur-sm bg-white/5 rounded-xl border border-white/10">
        {inventories.map((inventory) => (
          <div key={inventory.id} className="rounded-lg overflow-hidden">
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
                      {inventory.member?.nickname ||
                        inventory.user?.username ||
                        "Unknown User"}
                      's Inventory
                    </h3>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                {isDM ? (
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
                ) : null}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`w-5 h-5 transition-transform duration-200 text-gray-400 ${
                    collapsedInventories[inventory.id] ? "rotate-180" : ""
                  }`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            <div
              className={`transition-all duration-200 ease-in-out overflow-hidden ${
                collapsedInventories[inventory.id]
                  ? "max-h-0"
                  : "max-h-[2000px]"
              }`}
            >
              <div className="p-4">
                <CurrencyDisplay
                  currencies={
                    inventoryCurrencies[inventory.id] || [
                      { type: "copper", amount: 0 },
                      { type: "silver", amount: 0 },
                      { type: "gold", amount: 0 },
                      { type: "platinum", amount: 0 },
                    ]
                  }
                  isDM={isDM}
                  onUpdate={async (currencies) => {
                    try {
                      await updateInventoryCurrencies(inventory.id, currencies);
                      await loadCurrencies(inventory.id);
                    } catch (error) {
                      console.error("Error updating currencies:", error);
                    }
                  }}
                />
                <ItemList
                  items={inventory.inventory_items || []}
                  isDM={isDM}
                  userId={inventory.user_id}
                  onItemRemoved={reloadInventoryData}
                  onItemUpdated={reloadInventoryData}
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
          userId={user?.id || ""}
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
          userId={user?.id || ""}
          onClose={() => setShowManageItemsModal(false)}
          onItemUpdated={() => {
            setShowManageItemsModal(false);
            reloadInventoryData();
          }}
        />
      )}

      {showTradeMenu && (
        <SelectTradePartnerModal
          groupId={groupId}
          onClose={() => setShowTradeMenu(false)}
          onPartnerSelected={(partnerId) => {
            setSelectedTradePartnerId(partnerId);
          }}
        />
      )}

      {selectedTradePartnerId && (
        <TradeMenu
          groupId={groupId}
          partnerId={selectedTradePartnerId}
          onClose={() => {
            setSelectedTradePartnerId(null);
          }}
          onTradeComplete={() => {
            setSelectedTradePartnerId(null);
            reloadInventoryData();
          }}
        />
      )}
    </div>
  );
}
