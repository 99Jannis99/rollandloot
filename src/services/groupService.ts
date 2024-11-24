import { supabase } from '../lib/supabase';

export interface Group {
  id: string;
  name: string;
  description: string;
  created_at: string;
  created_by: string;
}

export type Role = 'admin' | 'member' | 'dm' | 'player';

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  is_active: boolean;
}

export interface GroupInventory {
  id: string;
  user_id: string;
  group_id: string;
  user?: {
    username: string;
    avatar_url: string;
  };
  inventory_items: {
    id: string;
    item_id: string;
    quantity: number;
    items: {
      id: string;
      name: string;
      description: string;
      category: string;
      weight: number;
    };
  }[];
}

export async function getAllGroupInventories(groupId: string): Promise<GroupInventory[]> {
  const { data: members, error: membersError } = await supabase
    .from('group_members')
    .select(`
      user_id,
      users (
        username,
        avatar_url
      )
    `)
    .eq('group_id', groupId);

  if (membersError) throw membersError;

  const inventories = await Promise.all((members || []).map(async (member) => {
    // First get the inventory ID for this user in this group
    const { data: inventoryData } = await supabase
      .from('group_inventories')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', member.user_id)
      .single();

    const inventoryId = inventoryData?.id || member.user_id;

    // Then get all items for this inventory
    const { data: inventoryItems, error: itemsError } = await supabase
      .from('inventory_items')
      .select(`
        id,
        quantity,
        item_id,
        items (
          id,
          name,
          description,
          category,
          weight
        )
      `)
      .eq('inventory_id', inventoryId);

    if (itemsError) throw itemsError;

    return {
      id: member.user_id,
      user_id: member.user_id,
      group_id: groupId,
      user: member.users,
      inventory_items: inventoryItems || []
    };
  }));

  return inventories;
}

export async function getPlayerInventory(groupId: string, userId: string): Promise<GroupInventory | null> {
  // First get or create the inventory
  let { data: inventory } = await supabase
    .from('group_inventories')
    .select(`
      id,
      user_id,
      group_id,
      users (
        username,
        avatar_url
      )
    `)
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (!inventory) {
    const { data: newInventory, error: createError } = await supabase
      .from('group_inventories')
      .insert([{
        group_id: groupId,
        user_id: userId
      }])
      .select(`
        id,
        user_id,
        group_id,
        users (
          username,
          avatar_url
        )
      `)
      .single();

    if (createError) throw createError;
    inventory = newInventory;
  }

  // Then get all items for this inventory
  const { data: items, error: itemsError } = await supabase
    .from('inventory_items')
    .select(`
      id,
      quantity,
      item_id,
      items (
        id,
        name,
        description,
        category,
        weight
      )
    `)
    .eq('inventory_id', inventory.id);

  if (itemsError) throw itemsError;

  return {
    ...inventory,
    inventory_items: items || []
  };
}

export async function addItemToPlayerInventory(
  groupId: string,
  playerId: string,
  itemData: {
    itemId: string;
    quantity: number;
  }
): Promise<void> {
  try {
    // First get or create the inventory
    let { data: inventory } = await supabase
      .from('group_inventories')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', playerId)
      .single();

    if (!inventory) {
      const { data: newInventory, error: createError } = await supabase
        .from('group_inventories')
        .insert([{
          group_id: groupId,
          user_id: playerId,
        }])
        .select('id')
        .single();

      if (createError) throw createError;
      inventory = newInventory;
    }

    // Then add the item to the inventory
    const { error: addError } = await supabase
      .from('inventory_items')
      .insert([{
        inventory_id: inventory.id,
        item_id: itemData.itemId,
        quantity: itemData.quantity,
        added_by: playerId,
        item_type: 'custom'
      }]);

    if (addError) throw addError;
  } catch (error) {
    console.error('Error adding item:', error);
    throw error;
  }
}

export async function removeItemFromInventory(
  itemId: string,
  userId: string,
  isDM: boolean
): Promise<void> {
  const query = supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId);

  if (!isDM) {
    query.eq('added_by', userId);
  }

  const { error } = await query;
  if (error) throw error;
}

export async function createGroup(name: string, description: string, userId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert([{
      name,
      description,
      created_by: userId
    }])
    .select()
    .single();

  if (error) throw error;

  // Add creator as dungeon master
  await supabase
    .from('group_members')
    .insert([{
      group_id: data.id,
      user_id: userId,
      role: 'dm',
      joined_at: new Date().toISOString()
    }]);

  return data;
}

export async function updateGroup(
  groupId: string,
  data: { name?: string; description?: string }
): Promise<Group> {
  const { data: updatedGroup, error } = await supabase
    .from('groups')
    .update(data)
    .eq('id', groupId)
    .select()
    .single();

  if (error) throw error;
  return updatedGroup;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_group_with_dependencies', {
    p_group_id: groupId
  });

  if (error) throw error;
}

export async function inviteToGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .insert([{
      group_id: groupId,
      user_id: userId,
      role: 'player'
    }]);

  if (error) {
    if (error.code === '23505') {
      throw new Error('User is already a member of this group');
    }
    throw error;
  }
}

export async function getGroupMembers(groupId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      *,
      users (
        id,
        username,
        avatar_url
      )
    `)
    .eq('group_id', groupId);

  if (error) throw error;
  return data || [];
}

export async function isDungeonMaster(groupId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error) return false;
  return data.role === 'dm';
}