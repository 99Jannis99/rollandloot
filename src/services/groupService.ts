import { supabase } from '../lib/supabase';

export interface Group {
  id: string;
  name: string;
  description: string;
  created_at: string;
  created_by: string;
}

// Update role type to match database enum
export type Role = 'admin' | 'member' | 'dm' | 'player';

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
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

  // Add creator as dungeon_master
  await supabase
    .from('group_members')
    .insert([{
      group_id: data.id,
      user_id: userId,
      role: 'dungeon_master',
      joined_at: new Date().toISOString()
    }]);

  return data;
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
  // Transaktion starten
  const { error: transactionError } = await supabase.rpc('delete_group_with_dependencies', {
    p_group_id: groupId
  });

  if (transactionError) throw transactionError;
}

// Funktion zum Prüfen der Berechtigungen
export async function canManageGroup(groupId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (error) return false;
  return ['admin', 'dm'].includes(data.role);
}