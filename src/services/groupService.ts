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