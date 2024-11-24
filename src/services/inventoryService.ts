import { supabase } from '../lib/supabase';

export interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  weight: number;
}

export interface InventoryItem {
  id: string;
  inventory_id: string;
  item_id: string;
  quantity: number;
  item?: Item;
}

export async function getGroupInventory(groupId: string): Promise<InventoryItem[]> {
  try {
    // Hole zuerst das Inventar für die Gruppe
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('group_inventories')
      .select('inventory_id')
      .eq('group_id', groupId)
      .single();

    if (inventoryError) {
      if (inventoryError.code === 'PGRST116') {
        return []; // Kein Inventar gefunden
      }
      throw inventoryError;
    }

    // Dann hole die Items aus dem Inventar
    const { data, error } = await supabase
      .from('inventory_items')
      .select(`
        id,
        inventory_id,
        item_id,
        quantity,
        items:item_id (
          id,
          name,
          description,
          category,
          weight
        )
      `)
      .eq('inventory_id', inventoryData.inventory_id);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching inventory:', error);
    throw error;
  }
}

export async function addItemToInventory(
  inventoryId: string,
  itemId: string,
  quantity: number,
  userId: string
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert([{
      inventory_id: inventoryId,
      item_id: itemId,
      quantity,
      added_by: userId
    }])
    .select(`
      *,
      items (*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateItemQuantity(
  inventoryItemId: string,
  quantity: number
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .update({ quantity })
    .eq('id', inventoryItemId)
    .select(`
      *,
      items (*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function removeItemFromInventory(inventoryItemId: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', inventoryItemId);

  if (error) throw error;
}