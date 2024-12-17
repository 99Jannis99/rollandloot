import { supabase } from "../lib/supabase";

export interface Trade {
  id: string;
  group_id: string;
  initiator_id: string;
  receiver_id: string;
  status: 'pending' | 'counter_offered' | 'accepted' | 'completed' | 'cancelled';
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
  offeredCoins?: { copper: number; silver: number; gold: number; platinum: number }
): Promise<Trade> {
  const tradeData = {
    group_id: groupId,
    initiator_id: initiatorId,
    receiver_id: receiverId,
    offered_item_id: offeredItem?.id || null,
    offered_item_quantity: offeredItem?.quantity || null,
    offered_coins: offeredCoins || null,
    status: 'pending'
  };

  console.log('Creating trade with data:', tradeData);

  const { data, error } = await supabase
    .from('trades')
    .insert([tradeData])
    .select()
    .single();

  if (error) {
    console.error('Supabase error:', error);
    console.error('Error details:', error.details);
    console.error('Error hint:', error.hint);
    throw error;
  }

  console.log('Trade created successfully:', data);
  return data;
}

// Mache ein Gegenangebot
export async function makeCounterOffer(
  tradeId: string,
  counterItemId?: string,
  counterItemQuantity?: number,
  counterCoins?: { copper: number; silver: number; gold: number; platinum: number }
): Promise<Trade> {
  // Zuerst den bestehenden Trade laden
  const { data: existingTrade } = await supabase
    .from('trades')
    .select('*')
    .eq('id', tradeId)
    .single();

  if (!existingTrade) {
    throw new Error('Trade not found');
  }

  // Dann Update mit allen bestehenden Werten
  const { data, error } = await supabase
    .from('trades')
    .upsert({
      ...existingTrade,
      status: 'counter_offered',
      counter_item_id: counterItemId || null,
      counter_item_quantity: counterItemQuantity || null,
      counter_coins: counterCoins || null
    })
    .select(`
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
    `)
    .single();

  if (error) {
    console.error('Error in makeCounterOffer:', error);
    throw error;
  }

  return {
    ...data,
    offered_item: data.offered_item?.all_items,
    counter_item: data.counter_item?.all_items
  };
}

// Funktion zum Ausführen des Trades
async function executeTradeTransfer(trade: Trade) {
  const { data: initiatorInventory } = await supabase
    .from('group_inventories')
    .select('id')
    .eq('group_id', trade.group_id)
    .eq('user_id', trade.initiator_id)
    .single();

  const { data: receiverInventory } = await supabase
    .from('group_inventories')
    .select('id')
    .eq('group_id', trade.group_id)
    .eq('user_id', trade.receiver_id)
    .single();

  // Starte eine Transaktion
  const { error } = await supabase.rpc('execute_trade', {
    p_trade_id: trade.id,
    p_initiator_inventory_id: initiatorInventory.id,
    p_receiver_inventory_id: receiverInventory.id
  });

  if (error) throw error;
}

// Aktualisiere die acceptTrade Funktion
export async function acceptTrade(tradeId: string): Promise<void> {
  const { data: existingTrade } = await supabase
    .from('trades')
    .select('*')
    .eq('id', tradeId)
    .single();

  if (!existingTrade) {
    throw new Error('Trade not found');
  }

  try {
    // Zuerst den Trade als akzeptiert markieren
    const { error: updateError } = await supabase
      .from('trades')
      .upsert({
        ...existingTrade,
        status: 'accepted'
      });

    if (updateError) throw updateError;

    // Dann den Transfer ausführen
    await executeTradeTransfer(existingTrade);

    // Nach erfolgreichem Transfer den Trade löschen
    const { error: deleteError } = await supabase
      .from('trades')
      .delete()
      .eq('id', tradeId);

    if (deleteError) {
      console.error('Fehler beim Löschen des Trades:', deleteError);
      throw deleteError;
    }

  } catch (error) {
    console.error('Error in acceptTrade:', error);
    throw error;
  }
}

// Schließe einen Handel ab
export async function completeTrade(tradeId: string): Promise<Trade> {
  const { data, error } = await supabase
    .from('trades')
    .upsert({
      id: tradeId,
      status: 'completed'
    })
    .select(`
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
    `)
    .single();

  if (error) {
    console.error('Error in completeTrade:', error);
    throw error;
  }

  return {
    ...data,
    offered_item: data.offered_item?.all_items,
    counter_item: data.counter_item?.all_items
  };
}

// Breche einen Handel ab
export async function cancelTrade(tradeId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', tradeId);

    if (error) {
      console.error('Error in cancelTrade:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in cancelTrade:', error);
    throw error;
  }
}

// Hole alle aktiven Handelsangebote für einen Benutzer in einer Gruppe
export async function getActiveTrades(groupId: string, userId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select(`
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
    `)
    .eq('group_id', groupId)
    .or(`initiator_id.eq.${userId},receiver_id.eq.${userId}`)
    .in('status', ['pending', 'counter_offered', 'accepted'])
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Transformiere die Daten in das erwartete Format
  return data.map(trade => ({
    ...trade,
    offered_item: trade.offered_item?.all_items,
    counter_item: trade.counter_item?.all_items
  }));
}

// Neue Funktion zum Abrufen aktiver eingehender Trades
export async function getIncomingTrades(userId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select(`
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
    `)
    .eq('receiver_id', userId)
    .in('status', ['pending'])
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Transformiere die Daten in das erwartete Format
  return data.map(trade => ({
    ...trade,
    offered_item: trade.offered_item?.all_items,
    counter_item: trade.counter_item?.all_items
  }));
}

// Hole alle Counter-Offers für einen Benutzer
export async function getCounterOffers(userId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select(`
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
    `)
    .eq('initiator_id', userId)
    .eq('status', 'counter_offered')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return data.map(trade => ({
    ...trade,
    offered_item: trade.offered_item?.all_items,
    counter_item: trade.counter_item?.all_items
  }));
} 