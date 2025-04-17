import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const subscriptionRef = useRef<any>(null);

  // Memoized channel ID
  const channelId = useMemo(() => `trades_${user?.id}`, [user?.id]);

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
    }
  }, [user, groupId, supabaseUser]);

  // Initialisiere SupabaseUser und lade Trades
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

  useEffect(() => {
    if (supabaseUser && user) {
      loadTrades();
    }
  }, [supabaseUser, user, loadTrades]);

  // Subscription Setup
  useEffect(() => {
    if (!user?.id || !supabaseUser) {
      console.log("Subscription nicht gestartet: Kein User oder SupabaseUser");
      return;
    }

    console.log("Starte Subscription Setup für User:", user.id);
    const setupSubscription = async () => {
      try {
        const channel = supabase.channel(channelId);
        subscriptionRef.current = channel;

        const handleTradeUpdate = (payload: any) => {
          if (!subscriptionRef.current) return;
          
          const tradeData = payload.new as Trade;
          if (
            tradeData.group_id === groupId &&
            (tradeData.receiver_id === supabaseUser.id || tradeData.initiator_id === supabaseUser.id)
          ) {
            loadTrades();
          }
        };

        const handleDelete = (payload: any) => {
          if (!subscriptionRef.current) return;
          
          setIncomingTrades(prevTrades => prevTrades.filter(trade => trade.id !== payload.old.id));
          setCounterOffers(prevOffers => prevOffers.filter(trade => trade.id !== payload.old.id));
        };

        channel
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "trades" }, handleTradeUpdate)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trades" }, handleTradeUpdate)
          .on("postgres_changes", { event: "DELETE", schema: "public", table: "trades" }, handleDelete);

        await channel.subscribe();
      } catch (error) {
        console.error("Fehler beim Setup der Subscription:", error);
      }
    };

    setupSubscription();

    return () => {
      if (subscriptionRef.current) {
        console.log("Cleanup: Unsubscribe Channel");
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [user?.id, groupId, supabaseUser, channelId, loadTrades]);

  async function handleAcceptTrade(tradeId: string) {
    try {
      await acceptTrade(tradeId);
      loadTrades();
    } catch (err) {
      console.error("Error accepting trade:", err);
    }
  }

  async function handleDeclineTrade(tradeId: string) {
    try {
      await cancelTrade(tradeId);
      loadTrades();
    } catch (err) {
      console.error("Error declining trade:", err);
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
