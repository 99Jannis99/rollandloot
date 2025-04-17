import { useState, useEffect, useCallback } from "react";
import { Trade, getActiveTrades, cancelTrade } from "../services/tradeService";
import { useUser } from "@clerk/clerk-react";
import { syncUser } from "../services/userService";
import { CurrencyDisplay } from "./CurrencyDisplay";
import { supabase } from "../lib/supabase";

interface ActiveTradesProps {
  groupId: string;
}

export function ActiveTrades({ groupId }: ActiveTradesProps) {
  const { user } = useUser();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<any>(null);

  // Initialisiere Supabase User
  useEffect(() => {
    const initSupabaseUser = async () => {
      if (!user) return;
      try {
        const supabaseUserData = await syncUser(user);
        setSupabaseUser(supabaseUserData);
      } catch (error) {
        console.error("Error syncing user:", error);
      }
    };

    initSupabaseUser();
  }, [user]);

  const loadTrades = useCallback(async () => {
    if (!user || !supabaseUser) return;
    try {
      const activeTrades = await getActiveTrades(groupId, supabaseUser.id);
      setTrades(activeTrades);
    } catch (err) {
      setError("Failed to load active trades");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [groupId, user, supabaseUser]);

  // Initiales Laden der Trades
  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  // Realtime Subscription
  useEffect(() => {
    if (!user?.id || !supabaseUser) {
      return;
    }

    let isSubscribed = true;
    const channelId = `active_trades_${user.id}_${Math.random()}`;

    try {
      const channel = supabase.channel(channelId).on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trades",
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            if (isSubscribed) {
              setTrades((prevTrades) =>
                prevTrades.filter((trade) => trade.id !== payload.old.id)
              );
            }
            return;
          }

          const tradeData = payload.new as Trade;

          // Prüfe ob der Trade für diesen User relevant ist
          if (
            tradeData.initiator_id === supabaseUser.id ||
            tradeData.receiver_id === supabaseUser.id
          ) {
            if (isSubscribed) {
              await loadTrades();
            }
          }
        }
      );

      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Fehler bei der Active-Trades-Subscription");
        }
      });

      return () => {
        isSubscribed = false;
        channel.unsubscribe();
      };
    } catch (error) {
      console.error("Fehler beim Setup der Active-Trades-Subscription:", error);
    }
  }, [user?.id, groupId, loadTrades, supabaseUser]);

  const handleCancelTrade = async (tradeId: string) => {
    try {
      await cancelTrade(tradeId);
      await loadTrades();
    } catch (err) {
      console.error("Error cancelling trade:", err);
      setError("Failed to cancel trade");
    }
  };

  if (loading) return <div className="text-gray-400">Loading trades...</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (trades.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4">Active Trades</h3>
      <div className="space-y-4">
        {trades.map((trade) => (
          <div
            key={trade.id}
            className="bg-gray-800/50 rounded-lg p-4 border border-white/10"
          >
            <div className="flex flex-col space-y-3">
              <div className="text-sm text-gray-400 truncate">
                {trade.initiator?.username?.length > 20
                  ? `${trade.initiator.username.slice(0, 20)}...`
                  : trade.initiator?.username}{" "}
                →{" "}
                {trade.receiver?.username?.length > 20
                  ? `${trade.receiver.username.slice(0, 20)}...`
                  : trade.receiver?.username}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  {trade.offered_item && (
                    <div className="text-sm">
                      <div className="mb-4">
                        <div className="flex flex-wrap justify-between gap-2">
                          Offering:
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div className="flex items-center gap-2 bg-black/20 rounded-lg p-3">
                            {trade.offered_item.name} (x
                            {trade.offered_item_quantity})
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {trade.offered_coins && (
                    <div>
                      <CurrencyDisplay
                        currencies={[
                          {
                            type: "copper",
                            amount: trade.offered_coins.copper,
                          },
                          {
                            type: "silver",
                            amount: trade.offered_coins.silver,
                          },
                          { type: "gold", amount: trade.offered_coins.gold },
                          {
                            type: "platinum",
                            amount: trade.offered_coins.platinum,
                          },
                        ]}
                        isDM={false}
                        readOnly={true}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {trade.counter_item && (
                    <div className="text-sm">
                      Counter Offer: {trade.counter_item.name} (x
                      {trade.counter_item_quantity})
                    </div>
                  )}
                  {trade.counter_coins && (
                    <div>
                      <CurrencyDisplay
                        currencies={[
                          {
                            type: "copper",
                            amount: trade.counter_coins.copper,
                          },
                          {
                            type: "silver",
                            amount: trade.counter_coins.silver,
                          },
                          { type: "gold", amount: trade.counter_coins.gold },
                          {
                            type: "platinum",
                            amount: trade.counter_coins.platinum,
                          },
                        ]}
                        isDM={false}
                        readOnly={true}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => handleCancelTrade(trade.id)}
                  className="px-3 py-1 text-sm bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
