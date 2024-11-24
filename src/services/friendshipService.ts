import { supabase } from '../lib/supabase';

export interface FriendshipRequest {
  id: string;
  user1_id: string;
  user2_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  user1?: {
    username: string;
    avatar_url: string;
  };
  user2?: {
    username: string;
    avatar_url: string;
  };
}

export async function sendFriendRequest(senderId: string, receiverId: string): Promise<FriendshipRequest> {
  try {
    const { data: existingRequest } = await supabase
      .from('user_friends')
      .select('*')
      .or(`and(user1_id.eq.${senderId},user2_id.eq.${receiverId}),and(user1_id.eq.${receiverId},user2_id.eq.${senderId})`)
      .single();

    if (existingRequest) {
      throw new Error(
        existingRequest.status === 'pending' 
          ? 'Friend request already sent' 
          : 'You are already friends with this user'
      );
    }

    const { data, error } = await supabase
      .from('user_friends')
      .insert([
        { user1_id: senderId, user2_id: receiverId }
      ])
      .select(`
        *,
        user1:users!user_friends_user1_id_fkey (username, avatar_url),
        user2:users!user_friends_user2_id_fkey (username, avatar_url)
      `)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    if (error.code === '23505') {
      throw new Error('Friend request already exists');
    }
    throw error;
  }
}

export async function getPendingRequests(userId: string): Promise<FriendshipRequest[]> {
  const { data, error } = await supabase
    .from('user_friends')
    .select(`
      *,
      user1:users!user_friends_user1_id_fkey (username, avatar_url),
      user2:users!user_friends_user2_id_fkey (username, avatar_url)
    `)
    .eq('status', 'pending')
    .or(`user2_id.eq.${userId},user1_id.eq.${userId}`);

  if (error) throw error;
  return data || [];
}

export async function getFriendsList(userId: string): Promise<FriendshipRequest[]> {
  const { data, error } = await supabase
    .from('user_friends')
    .select(`
      *,
      user1:users!user_friends_user1_id_fkey (username, avatar_url),
      user2:users!user_friends_user2_id_fkey (username, avatar_url)
    `)
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) throw error;
  return data || [];
}

export async function respondToFriendRequest(
  requestId: string, 
  status: 'accepted' | 'rejected'
): Promise<FriendshipRequest> {
  try {
    const { data: updatedRequest, error: rpcError } = await supabase
      .rpc('update_friend_request', {
        p_request_id: requestId,
        p_status: status
      })
      .single();

    if (rpcError) throw rpcError;

    const { data, error } = await supabase
      .from('user_friends')
      .select(`
        *,
        user1:users!user_friends_user1_id_fkey (username, avatar_url),
        user2:users!user_friends_user2_id_fkey (username, avatar_url)
      `)
      .eq('id', requestId)
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Error updating friend request:', error);
    throw error;
  }
}

export async function searchUsers(query: string, currentUserId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, avatar_url')
    .neq('id', currentUserId)
    .ilike('username', `%${query}%`)
    .limit(10);

  if (error) throw error;
  return data || [];
}

export async function removeFriend(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from('user_friends')
    .delete()
    .eq('id', friendshipId);

  if (error) throw error;
} 