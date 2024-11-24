import { supabase } from '../lib/supabase';

export interface FriendRequest {
  id: string;
  user1_id: string;
  user2_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export async function sendFriendRequest(userId: string, friendId: string): Promise<FriendRequest> {
  const { data, error } = await supabase
    .from('user_friends')
    .insert([{
      user1_id: userId,
      user2_id: friendId,
      status: 'pending'
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getFriendRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('user_friends')
    .select('*')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('status', 'pending');

  if (error) throw error;
  return data;
}

export async function getFriendList(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('user_friends')
    .select('*')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) throw error;
  return data;
}

export async function updateFriendRequestStatus(
  requestId: string,
  status: 'accepted' | 'rejected'
): Promise<FriendRequest> {
  const { data, error } = await supabase
    .from('user_friends')
    .update({ status })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
}