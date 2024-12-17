import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import {
  Trade,
  getIncomingTrades,
  getCounterOffers,
  acceptTrade,
  cancelTrade,
} from "../services/tradeService";
import { syncUser } from "../services/userService";
import { supabase } from "../lib/supabase";
import { IncomingTradeModal } from "./IncomingTradeModal";

interface TradeNotificationsProps {
  groupId: string;
}

export function TradeNotifications({ groupId }: TradeNotificationsProps) {
  const { user } = useUser();
  const [incomingTrades, setIncomingTrades] = useState<Trade[]>([]);
  const [counterOffers, setCounterOffers] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<any>(null);

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
      const [trades, offers] = await Promise.all([
        getIncomingTrades(supabaseUser.id),
        getCounterOffers(supabaseUser.id)
      ]);

      const filteredTrades = trades.filter(trade => trade.group_id === groupId);
      const filteredOffers = offers.filter(trade => trade.group_id === groupId);

      setIncomingTrades(filteredTrades);
      setCounterOffers(filteredOffers);
    } catch (error) {
      console.error("Error loading trades:", error);
      setError(error instanceof Error ? error.message : "Failed to load trades");
    }
  }, [user, groupId, supabaseUser]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  useEffect(() => {
    if (!user?.id || !supabaseUser) {
      return;
    }

    let isSubscribed = true;
    const channelId = `trades_${user.id}_${Math.random()}`;

    try {
      const channel = supabase.channel(channelId)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "trades",
          },
          async (payload) => {
            if (payload.new?.status === "pending") {
              const tradeData = payload.new as Trade;
              
              if (tradeData.group_id === groupId && 
                 (tradeData.receiver_id === supabaseUser.id || 
                  tradeData.initiator_id === supabaseUser.id)) {
                
                if (isSubscribed) {
                  await loadTrades();
                }
              }
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "trades",
          },
          async (payload) => {
            const tradeData = payload.new as Trade;
            
            if (tradeData.group_id === groupId && 
               (tradeData.receiver_id === supabaseUser.id || 
                tradeData.initiator_id === supabaseUser.id)) {
              
              if (tradeData.status === "counter_offered") {
                if (isSubscribed) {
                  await loadTrades();
                }
              }
            }
          }
        );

      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Fehler bei der Trade-Subscription");
        }
      });

      return () => {
        isSubscribed = false;
        channel.unsubscribe();
      };
    } catch (error) {
      console.error("Fehler beim Setup der Trade-Subscription:", error);
    }
  }, [user?.id, groupId, loadTrades, supabaseUser]);

  async function handleAcceptTrade(tradeId: string) {
    try {
      await acceptTrade(tradeId);
      loadTrades();
    } catch (err) {
      console.error('Error accepting trade:', err);
    }
  }

  async function handleDeclineTrade(tradeId: string) {
    try {
      await cancelTrade(tradeId);
      loadTrades();
    } catch (err) {
      console.error('Error declining trade:', err);
    }
  }

  if (incomingTrades.length === 0 && counterOffers.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {/* Eingehende Handelsangebote */}
      {incomingTrades.map((trade) => (
        <div
          key={trade.id}
          className="bg-gray-800 rounded-lg p-4 border border-white/10 shadow-lg animate-slide-in"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">New Trade Offer</h3>
              <p className="text-sm text-gray-400">
                From: {trade.initiator?.username}
              </p>
            </div>
            <button
              onClick={() => setSelectedTrade(trade)}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
            >
              View Offer
            </button>
          </div>
        </div>
      ))}

      {/* Counter-Offers */}
      {counterOffers.map((trade) => (
        <div
          key={trade.id}
          className="bg-gray-800 rounded-lg p-4 border border-white/10 shadow-lg animate-slide-in"
        >
          <div className="space-y-3">
            <div>
              <h3 className="font-medium">Counter Offer Received</h3>
              <p className="text-sm text-gray-400">
                From: {trade.receiver?.username}
              </p>
            </div>

            {/* Zeige Counter-Offer Details */}
            {trade.counter_item && (
              <div className="p-2 bg-black/20 rounded">
                <p className="text-sm">
                  Item: {trade.counter_item.name} (x
                  {trade.counter_item_quantity})
                </p>
              </div>
            )}
            {trade.counter_coins && (
              <div className="p-2 bg-black/20 rounded">
                <p className="text-sm">
                  Coins:{" "}
                  {Object.entries(trade.counter_coins)
                    .filter(([_, amount]) => amount > 0)
                    .map(([type, amount]) => `${amount} ${type}`)
                    .join(", ")}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleAcceptTrade(trade.id)}
                className="flex-1 px-3 py-1 bg-green-600/20 text-green-400 rounded hover:bg-green-600/30"
              >
                Accept
              </button>
              <button
                onClick={() => handleDeclineTrade(trade.id)}
                className="flex-1 px-3 py-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Füge das Modal wieder hinzu */}
      {selectedTrade && (
        <IncomingTradeModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onTradeUpdated={() => {
            loadTrades();
            setSelectedTrade(null);
          }}
        />
      )}
    </div>
  );
}
