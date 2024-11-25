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
      role,
      users (
        username,
        avatar_url
      )
    `)
    .eq('group_id', groupId)
    .neq('role', 'dm');

  if (membersError) throw membersError;

  const inventories = await Promise.all((members || []).map(async (member) => {
    if (member.role === 'dm') {
      return null;
    }

    const { data: inventoryData } = await supabase
      .from('group_inventories')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', member.user_id)
      .single();

    const inventoryId = inventoryData?.id;

    if (!inventoryId) {
      return null;
    }

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

  return inventories.filter((inv): inv is GroupInventory => inv !== null);
}

export async function getPlayerInventory(groupId: string, userId: string): Promise<GroupInventory | null> {
  try {
    // 1. Prüfe zuerst, ob der Benutzer DM ist
    const isDM = await isDungeonMaster(groupId, userId);
    if (isDM) {
      // 2. Wenn DM, lösche alle vorhandenen Inventare
      await supabase
        .from('group_inventories')
        .delete()
        .match({
          group_id: groupId,
          user_id: userId
        });
      return null;
    }

    // 3. Für Nicht-DMs: Hole das vorhandene Inventar
    const { data: inventory, error } = await supabase
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

    if (error || !inventory) {
      return null;
    }

    // 4. Hole die Inventar-Items
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
  } catch (error) {
    console.error('Error in getPlayerInventory:', error);
    throw error;
  }
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
    // Prüfe zuerst, ob der Spieler DM ist
    const isDM = await isDungeonMaster(groupId, playerId);
    if (isDM) {
      throw new Error("DMs cannot have inventory items");
    }

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
  try {
    // 1. Erstelle die Gruppe
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .insert([{
        name,
        description,
        created_by: userId
      }])
      .select()
      .single();

    if (groupError) throw groupError;

    // 2. Warte einen Moment
    await new Promise(resolve => setTimeout(resolve, 100));

    // 3. Füge den DM hinzu
    const { error: memberError } = await supabase
      .from('group_members')
      .insert([{
        group_id: groupData.id,
        user_id: userId,
        role: 'dm',
        joined_at: new Date().toISOString(),
        is_active: true
      }]);

    if (memberError) {
      // Wenn das Hinzufügen fehlschlägt, lösche die Gruppe
      await supabase.from('groups').delete().eq('id', groupData.id);
      throw memberError;
    }

    // 4. Warte einen Moment
    await new Promise(resolve => setTimeout(resolve, 100));

    // 5. Lösche ALLE Inventare für diesen Benutzer in dieser Gruppe
    const { error: deleteError } = await supabase
      .from('group_inventories')
      .delete()
      .match({
        group_id: groupData.id,
        user_id: userId
      });

    if (deleteError) {
      console.error('Error deleting inventory:', deleteError);
    }

    return groupData;
  } catch (error) {
    console.error('Error in group creation process:', error);
    throw error;
  }
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

export async function inviteToGroup(groupId: string, userId: string) {
  try {
    // Prüfe zuerst, ob der Benutzer bereits DM ist
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (existingMember?.role === 'dm') {
      throw new Error('User is already a DM in this group');
    }

    // Füge das Mitglied zur Gruppe hinzu
    const { data: memberData, error: memberError } = await supabase
      .from('group_members')
      .insert([{
        group_id: groupId,
        user_id: userId,
        role: 'player'
      }])
      .select()
      .single();

    if (memberError) throw memberError;

    // Nur für Spieler ein Inventar erstellen
    if (memberData.role === 'player') {
      const { error: inventoryError } = await supabase
        .from('group_inventories')
        .insert([{
          group_id: groupId,
          user_id: userId,
        }]);

      if (inventoryError) throw inventoryError;
    }

    return memberData;
  } catch (error) {
    console.error('Error inviting to group:', error);
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

export async function updateUserRole(groupId: string, userId: string, newRole: 'player' | 'dm') {
  try {
    const { error: updateError } = await supabase
      .from('group_members')
      .update({ role: newRole })
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // Wenn der Benutzer zum DM wird, lösche sein Inventar
    if (newRole === 'dm') {
      const { error: deleteError } = await supabase
        .from('group_inventories')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;
    } else {
      // Wenn der Benutzer zum Spieler wird, erstelle ein Inventar
      const { error: createError } = await supabase
        .from('group_inventories')
        .insert([{
          group_id: groupId,
          user_id: userId,
        }]);

      if (createError) throw createError;
    }
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}