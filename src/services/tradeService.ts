import { supabase } from "../lib/supabase";

export interface Trade {
  id: string;
  group_id: string;
  initiator_id: string;
  receiver_id: string;
  status:
    | "pending"
    | "counter_offered"
    | "accepted"
    | "completed"
    | "cancelled";
  offered_item_id: string | null;
  offered_item_quantity: number | null;
  offered_coins: {
    copper: number;
    silver: number;
    gold: number;
    platinum: number;
  } | null;
  counter_item_id: string | null;
  counter_item_quantity: number | null;
  counter_coins: {
    copper: number;
    silver: number;
    gold: number;
    platinum: number;
  } | null;
  created_at: string;
  updated_at: string;
  // Neue Felder für die Beziehungen
  initiator?: {
    username: string;
    avatar_url: string;
  };
  receiver?: {
    username: string;
    avatar_url: string;
  };
  offered_item?: {
    name: string;
    description: string;
    category: string;
    weight: number;
  };
  counter_item?: {
    name: string;
    description: string;
    category: string;
    weight: number;
  };
}

// Erstelle ein neues Handelsangebot
export async function createTradeOffer(
  groupId: string,
  initiatorId: string,
  receiverId: string,
  offeredItem?: { id: string; quantity: number },
  offeredCoins?: {
    copper: number;
    silver: number;
    gold: number;
    platinum: number;
  }
): Promise<Trade> {
  try {
    // 1. Hole das Inventar des Initiators
    const {
      data: initiatorInventory,
      error: inventoryError,
    } = await supabase
      .from("group_inventories")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", initiatorId)
      .single();

    if (inventoryError) throw inventoryError;

    // 2. Wenn ein Item angeboten wird, ziehe die Menge ab
    if (offeredItem) {
      // Hole zuerst die aktuelle Menge und item_type
      const { data: currentItem, error: fetchError } = await supabase
        .from("inventory_items")
        .select("quantity, item_id, item_type, inventory_id")
        .eq("id", offeredItem.id)
        .single();

      if (fetchError) throw fetchError;

      // Berechne die neue Menge
      const newQuantity = currentItem.quantity - offeredItem.quantity;

      // Aktualisiere die Menge mit upsert
      const { error: itemError } = await supabase
        .from("inventory_items")
        .upsert({
          id: offeredItem.id,
          inventory_id: currentItem.inventory_id,
          item_id: currentItem.item_id,
          item_type: currentItem.item_type,
          quantity: newQuantity,
        });

      if (itemError) throw itemError;
    }

    // 3. Wenn Coins angeboten werden, ziehe die Beträge ab
    if (offeredCoins) {
      // Hole zuerst die aktuellen Coins
      const { data: currentCoins, error: fetchError } = await supabase
        .from("inventory_currencies")
        .select("copper, silver, gold, platinum")
        .eq("inventory_id", initiatorInventory.id)
        .single();

      if (fetchError) throw fetchError;

      // Berechne die neuen Werte
      const newCoins = {
        inventory_id: initiatorInventory.id,
        copper: currentCoins.copper - (offeredCoins.copper || 0),
        silver: currentCoins.silver - (offeredCoins.silver || 0),
        gold: currentCoins.gold - (offeredCoins.gold || 0),
        platinum: currentCoins.platinum - (offeredCoins.platinum || 0),
      };

      // Aktualisiere die Coins mit upsert
      const { error: coinsError } = await supabase
        .from("inventory_currencies")
        .upsert(newCoins, {
          onConflict: "inventory_id",
        });

      if (coinsError) throw coinsError;
    }

    // 4. Erstelle den Trade
    const tradeData = {
      group_id: groupId,
      initiator_id: initiatorId,
      receiver_id: receiverId,
      offered_item_id: offeredItem?.id || null,
      offered_item_quantity: offeredItem?.quantity || null,
      offered_coins: offeredCoins || null,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("trades")
      .insert([tradeData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error in createTradeOffer:", error);
    throw error;
  }
}

// Mache ein Gegenangebot
export async function makeCounterOffer(
  tradeId: string,
  counterItemId?: string,
  counterItemQuantity?: number,
  counterCoins?: {
    copper: number;
    silver: number;
    gold: number;
    platinum: number;
  }
): Promise<Trade> {
  try {
    // 1. Hole den bestehenden Trade
    const { data: existingTrade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .single();

    if (tradeError) throw tradeError;
    if (!existingTrade) throw new Error("Trade not found");
    if (existingTrade.status !== "pending")
      throw new Error("Trade is not in pending state");

    // 2. Hole das Inventar des Empfängers
    const {
      data: receiverInventory,
      error: inventoryError,
    } = await supabase
      .from("group_inventories")
      .select("id")
      .eq("group_id", existingTrade.group_id)
      .eq("user_id", existingTrade.receiver_id)
      .single();

    if (inventoryError) throw inventoryError;

    // 3. Wenn ein Item angeboten wird, prüfe die Verfügbarkeit und ziehe es ab
    if (counterItemId && counterItemQuantity) {
      // Prüfe, ob das Item im Inventar existiert und genügend Menge vorhanden ist
      const { data: currentItem, error: fetchError } = await supabase
        .from("inventory_items")
        .select("quantity, item_id, item_type, inventory_id")
        .eq("id", counterItemId)
        .eq("inventory_id", receiverInventory.id)
        .single();

      if (fetchError) throw fetchError;
      if (!currentItem) throw new Error("Item not found in inventory");
      if (currentItem.quantity < counterItemQuantity)
        throw new Error("Not enough items available");

      // Berechne die neue Menge
      const newQuantity = currentItem.quantity - counterItemQuantity;

      // Aktualisiere die Menge mit upsert
      const { error: itemError } = await supabase
        .from("inventory_items")
        .upsert({
          id: counterItemId,
          inventory_id: receiverInventory.id,
          item_id: currentItem.item_id,
          item_type: currentItem.item_type,
          quantity: newQuantity,
        });

      if (itemError) throw itemError;
    }

    // 4. Wenn Coins angeboten werden, prüfe die Verfügbarkeit und ziehe sie ab
    if (
      counterCoins &&
      (counterCoins.copper > 0 ||
        counterCoins.silver > 0 ||
        counterCoins.gold > 0 ||
        counterCoins.platinum > 0)
    ) {
      // Hole zuerst die aktuellen Coins
      const { data: currentCoins, error: fetchError } = await supabase
        .from("inventory_currencies")
        .select("copper, silver, gold, platinum")
        .eq("inventory_id", receiverInventory.id)
        .single();

      if (fetchError) throw fetchError;

      // Prüfe, ob genügend Coins vorhanden sind
      if (
        currentCoins.copper < (counterCoins.copper || 0) ||
        currentCoins.silver < (counterCoins.silver || 0) ||
        currentCoins.gold < (counterCoins.gold || 0) ||
        currentCoins.platinum < (counterCoins.platinum || 0)
      ) {
        throw new Error("Not enough coins available");
      }

      // Berechne die neuen Werte
      const newCoins = {
        inventory_id: receiverInventory.id,
        copper: currentCoins.copper - (counterCoins.copper || 0),
        silver: currentCoins.silver - (counterCoins.silver || 0),
        gold: currentCoins.gold - (counterCoins.gold || 0),
        platinum: currentCoins.platinum - (counterCoins.platinum || 0),
      };

      // Aktualisiere die Coins
      const { error: coinsError } = await supabase
        .from("inventory_currencies")
        .upsert(newCoins, {
          onConflict: "inventory_id",
        });

      if (coinsError) throw coinsError;
    }

    // 5. Aktualisiere den Trade mit dem Gegenangebot
    const { data, error } = await supabase
      .from("trades")
      .upsert({
        ...existingTrade,
        status: "counter_offered",
        counter_item_id: counterItemId || null,
        counter_item_quantity: counterItemQuantity || null,
        counter_coins: counterCoins
          ? {
              copper: counterCoins.copper || 0,
              silver: counterCoins.silver || 0,
              gold: counterCoins.gold || 0,
              platinum: counterCoins.platinum || 0,
            }
          : null,
      })
      .select(
        `
        *,
        initiator:initiator_id(username, avatar_url),
        receiver:receiver_id(username, avatar_url),
        offered_item:inventory_items!offered_item_id(
          all_items (
            name,
            description,
            category,
            weight
          )
        ),
        counter_item:inventory_items!counter_item_id(
          all_items (
            name,
            description,
            category,
            weight
          )
        )
      `
      )
      .single();

    if (error) throw error;

    return {
      ...data,
      offered_item: data.offered_item?.all_items,
      counter_item: data.counter_item?.all_items,
    };
  } catch (error) {
    console.error("Error in makeCounterOffer:", error);
    throw error;
  }
}

// Funktion zum Ausführen des Trades
async function executeTradeTransfer(trade: Trade) {
  const { data: initiatorInventory } = await supabase
    .from("group_inventories")
    .select("id")
    .eq("group_id", trade.group_id)
    .eq("user_id", trade.initiator_id)
    .single();

  const { data: receiverInventory } = await supabase
    .from("group_inventories")
    .select("id")
    .eq("group_id", trade.group_id)
    .eq("user_id", trade.receiver_id)
    .single();

  // Nur den Trade ausführen
  const { error: tradeError } = await supabase.rpc("execute_trade", {
    p_trade_id: trade.id,
    p_initiator_inventory_id: initiatorInventory.id,
    p_receiver_inventory_id: receiverInventory.id,
  });

  if (tradeError) throw tradeError;
}

// Aktualisiere die acceptTrade Funktion
export async function acceptTrade(tradeId: string): Promise<void> {
  try {
    // 1. Hole den Trade
    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .single();

    if (tradeError) throw tradeError;
    if (!trade) throw new Error("Trade not found");

    // 2. Hole die Inventare beider Spieler
    const {
      data: initiatorInventory,
      error: initiatorError,
    } = await supabase
      .from("group_inventories")
      .select("id")
      .eq("group_id", trade.group_id)
      .eq("user_id", trade.initiator_id)
      .single();

    if (initiatorError) throw initiatorError;

    const {
      data: receiverInventory,
      error: receiverError,
    } = await supabase
      .from("group_inventories")
      .select("id")
      .eq("group_id", trade.group_id)
      .eq("user_id", trade.receiver_id)
      .single();

    if (receiverError) throw receiverError;

    // 3. Übertrage das angebotene Item an den Empfänger
    if (trade.offered_item_id && trade.offered_item_quantity) {
      // Hole zuerst das ursprüngliche Item
      const { data: originalItem, error: itemError } = await supabase
        .from("inventory_items")
        .select("item_id, item_type")
        .eq("id", trade.offered_item_id)
        .single();

      if (itemError) throw itemError;

      // Prüfe, ob das Item bereits im Inventar des Empfängers existiert
      const { data: existingItem, error: checkError } = await supabase
        .from("inventory_items")
        .select("id, quantity")
        .eq("inventory_id", receiverInventory.id)
        .eq("item_id", originalItem.item_id)
        .single();

      if (checkError && checkError.code !== "PGRST116") throw checkError;

      if (existingItem) {
        // Aktualisiere die Menge des bestehenden Items
        const { error: updateError } = await supabase
          .from("inventory_items")
          .upsert({
            id: existingItem.id,
            inventory_id: receiverInventory.id,
            item_id: originalItem.item_id,
            item_type: originalItem.item_type,
            quantity: existingItem.quantity + trade.offered_item_quantity,
          });

        if (updateError) throw updateError;
      } else {
        // Erstelle ein neues Item im Inventar des Empfängers
        const { error: insertError } = await supabase
          .from("inventory_items")
          .insert({
            inventory_id: receiverInventory.id,
            item_id: originalItem.item_id,
            item_type: originalItem.item_type,
            quantity: trade.offered_item_quantity,
          });

        if (insertError) throw insertError;
      }
    }

    // 4. Übertrage die angebotenen Coins an den Empfänger
    if (trade.offered_coins) {
      // Hole die aktuellen Coins des Empfängers
      const { data: receiverCoins, error: coinsError } = await supabase
        .from("inventory_currencies")
        .select("copper, silver, gold, platinum")
        .eq("inventory_id", receiverInventory.id)
        .single();

      if (coinsError) throw coinsError;

      // Berechne die neuen Werte
      const newReceiverCoins = {
        inventory_id: receiverInventory.id,
        copper:
          (receiverCoins?.copper || 0) + (trade.offered_coins.copper || 0),
        silver:
          (receiverCoins?.silver || 0) + (trade.offered_coins.silver || 0),
        gold: (receiverCoins?.gold || 0) + (trade.offered_coins.gold || 0),
        platinum:
          (receiverCoins?.platinum || 0) + (trade.offered_coins.platinum || 0),
      };

      // Aktualisiere die Coins des Empfängers
      const { error: updateError } = await supabase
        .from("inventory_currencies")
        .upsert(newReceiverCoins, {
          onConflict: "inventory_id",
        });

      if (updateError) throw updateError;
    }

    // 5. Übertrage das Gegenangebot-Item an den Initiator
    if (trade.counter_item_id && trade.counter_item_quantity) {
      // Hole zuerst das ursprüngliche Item
      const { data: originalItem, error: itemError } = await supabase
        .from("inventory_items")
        .select("item_id, item_type")
        .eq("id", trade.counter_item_id)
        .single();

      if (itemError) throw itemError;

      // Prüfe, ob das Item bereits im Inventar des Initiators existiert
      const { data: existingItem, error: checkError } = await supabase
        .from("inventory_items")
        .select("id, quantity")
        .eq("inventory_id", initiatorInventory.id)
        .eq("item_id", originalItem.item_id)
        .single();

      if (checkError && checkError.code !== "PGRST116") throw checkError;

      if (existingItem) {
        // Aktualisiere die Menge des bestehenden Items
        const { error: updateError } = await supabase
          .from("inventory_items")
          .upsert({
            id: existingItem.id,
            inventory_id: initiatorInventory.id,
            item_id: originalItem.item_id,
            item_type: originalItem.item_type,
            quantity: existingItem.quantity + trade.counter_item_quantity,
          });

        if (updateError) throw updateError;
      } else {
        // Erstelle ein neues Item im Inventar des Initiators
        const { error: insertError } = await supabase
          .from("inventory_items")
          .insert({
            inventory_id: initiatorInventory.id,
            item_id: originalItem.item_id,
            item_type: originalItem.item_type,
            quantity: trade.counter_item_quantity,
          });

        if (insertError) throw insertError;
      }
    }

    // 6. Übertrage die Counter-Coins an den Initiator
    if (trade.counter_coins) {
      // Hole die aktuellen Coins des Initiators
      const { data: initiatorCoins, error: coinsError } = await supabase
        .from("inventory_currencies")
        .select("copper, silver, gold, platinum")
        .eq("inventory_id", initiatorInventory.id)
        .single();

      if (coinsError) throw coinsError;

      // Berechne die neuen Werte
      const newInitiatorCoins = {
        inventory_id: initiatorInventory.id,
        copper:
          (initiatorCoins?.copper || 0) + (trade.counter_coins.copper || 0),
        silver:
          (initiatorCoins?.silver || 0) + (trade.counter_coins.silver || 0),
        gold: (initiatorCoins?.gold || 0) + (trade.counter_coins.gold || 0),
        platinum:
          (initiatorCoins?.platinum || 0) + (trade.counter_coins.platinum || 0),
      };

      // Aktualisiere die Coins des Initiators
      const { error: updateError } = await supabase
        .from("inventory_currencies")
        .upsert(newInitiatorCoins, {
          onConflict: "inventory_id",
        });

      if (updateError) throw updateError;
    }

    // 7. Markiere den Trade als akzeptiert und lösche ihn
    const { error: deleteError } = await supabase
      .from("trades")
      .delete()
      .eq("id", tradeId);

    if (deleteError) throw deleteError;
  } catch (error) {
    console.error("Error in acceptTrade:", error);
    throw error;
  }
}

// Schließe einen Handel ab
export async function completeTrade(tradeId: string): Promise<Trade> {
  const { data, error } = await supabase
    .from("trades")
    .upsert({
      id: tradeId,
      status: "completed",
    })
    .select(
      `
      *,
      initiator:initiator_id(username, avatar_url),
      receiver:receiver_id(username, avatar_url),
      offered_item:inventory_items!offered_item_id(
        all_items (
          name,
          description,
          category,
          weight
        )
      ),
      counter_item:inventory_items!counter_item_id(
        all_items (
          name,
          description,
          category,
          weight
        )
      )
    `
    )
    .single();

  if (error) {
    console.error("Error in completeTrade:", error);
    throw error;
  }

  return {
    ...data,
    offered_item: data.offered_item?.all_items,
    counter_item: data.counter_item?.all_items,
  };
}

// Breche einen Handel ab
export async function cancelTrade(tradeId: string): Promise<void> {
  try {
    console.log("Attempting to cancel trade:", tradeId);

    // 1. Trade laden
    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .single();

    if (tradeError)
      throw new Error("Failed to fetch trade: " + tradeError.message);
    if (!trade) throw new Error("Trade not found");

    // 2. Trade-Status auf 'cancelled' setzen
    const { error: updateError } = await supabase.rpc("cancel_trade", {
      trade_id: tradeId,
    });
    if (updateError)
      throw new Error("Failed to update trade status: " + updateError.message);

    // Hilfsfunktion: Inventory-ID holen
    const getInventoryId = async (userId: string) => {
      const { data, error } = await supabase
        .from("group_inventories")
        .select("id")
        .eq("group_id", trade.group_id)
        .eq("user_id", userId)
        .single();
      if (error || !data)
        throw new Error("Inventory not found for user " + userId);
      return data.id;
    };

    const initiatorInventoryId = await getInventoryId(trade.initiator_id);
    const receiverInventoryId = await getInventoryId(trade.receiver_id);

    // Hilfsfunktion: Item zurückgeben via upsert
    const returnItem = async (
      inventoryId: string,
      itemId: string,
      quantity: number
    ) => {
      await supabase.from("inventory_items").upsert(
        {
          inventory_id: inventoryId,
          item_id: itemId,
          quantity,
          item_type: "standard",
        },
        { onConflict: "inventory_id,item_id" }
      );
    };

    // Hilfsfunktion: Coins addieren
    const addCoins = async (
      inventoryId: string,
      coins: { copper: number; silver: number; gold: number; platinum: number }
    ) => {
      const { data: currentCoins, error: fetchError } = await supabase
        .from("inventory_currencies")
        .select("copper, silver, gold, platinum")
        .eq("inventory_id", inventoryId)
        .single();
      if (fetchError || !currentCoins) throw fetchError;

      const updatedCoins = {
        copper: currentCoins.copper + (coins.copper || 0),
        silver: currentCoins.silver + (coins.silver || 0),
        gold: currentCoins.gold + (coins.gold || 0),
        platinum: currentCoins.platinum + (coins.platinum || 0),
      };

      const { error: updateError } = await supabase
        .from("inventory_currencies")
        .update(updatedCoins)
        .eq("inventory_id", inventoryId);
      if (updateError) throw updateError;
    };

    // 3. Rückgabe an Initiator
    if (trade.offered_item_id && trade.offered_item_quantity) {
      await returnItem(
        initiatorInventoryId,
        trade.offered_item_id,
        trade.offered_item_quantity
      );
    }
    if (trade.offered_coins) {
      await addCoins(initiatorInventoryId, trade.offered_coins);
    }

    // 4. Rückgabe an Empfänger
    if (trade.counter_item_id && trade.counter_item_quantity) {
      await returnItem(
        receiverInventoryId,
        trade.counter_item_id,
        trade.counter_item_quantity
      );
    }
    if (trade.counter_coins) {
      await addCoins(receiverInventoryId, trade.counter_coins);
    }

    console.log("Successfully cancelled trade:", tradeId);
  } catch (error) {
    console.error("Error in cancelTrade:", error);
    throw new Error(
      "Failed to cancel trade: " +
        (error instanceof Error ? error.message : "Unknown error")
    );
  }
}

// Hole alle aktiven Handelsangebote für einen Benutzer in einer Gruppe
export async function getActiveTrades(
  groupId: string,
  userId: string
): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(
      `
      *,
      initiator:initiator_id(username, avatar_url),
      receiver:receiver_id(username, avatar_url),
      offered_item:inventory_items!offered_item_id(
        all_items (
          name,
          description,
          category,
          weight
        )
      ),
      counter_item:inventory_items!counter_item_id(
        all_items (
          name,
          description,
          category,
          weight
        )
      )
    `
    )
    .eq("group_id", groupId)
    .or(`initiator_id.eq.${userId},receiver_id.eq.${userId}`)
    .in("status", ["pending", "counter_offered", "accepted"])
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Transformiere die Daten in das erwartete Format
  return data.map((trade) => ({
    ...trade,
    offered_item: trade.offered_item?.all_items,
    counter_item: trade.counter_item?.all_items,
  }));
}

// Neue Funktion zum Abrufen aktiver eingehender Trades
export async function getIncomingTrades(userId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(
      `
      *,
      initiator:initiator_id(username, avatar_url),
      receiver:receiver_id(username, avatar_url),
      offered_item:inventory_items!offered_item_id(
        all_items (
          name,
          description,
          category,
          weight
        )
      ),
      counter_item:inventory_items!counter_item_id(
        all_items (
          name,
          description,
          category,
          weight
        )
      )
    `
    )
    .eq("receiver_id", userId)
    .in("status", ["pending"])
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Transformiere die Daten in das erwartete Format
  return data.map((trade) => ({
    ...trade,
    offered_item: trade.offered_item?.all_items,
    counter_item: trade.counter_item?.all_items,
  }));
}

// Hole alle Counter-Offers für einen Benutzer
export async function getCounterOffers(userId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(
      `
      *,
      initiator:initiator_id(username, avatar_url),
      receiver:receiver_id(username, avatar_url),
      offered_item:inventory_items!offered_item_id(
        all_items (
          name,
          description,
          category,
          weight
        )
      ),
      counter_item:inventory_items!counter_item_id(
        all_items (
          name,
          description,
          category,
          weight
        )
      )
    `
    )
    .eq("initiator_id", userId)
    .eq("status", "counter_offered")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return data.map((trade) => ({
    ...trade,
    offered_item: trade.offered_item?.all_items,
    counter_item: trade.counter_item?.all_items,
  }));
}
