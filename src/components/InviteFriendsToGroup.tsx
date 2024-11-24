import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { getFriendsList, FriendshipRequest } from '../services/friendshipService';
import { syncUser } from '../services/userService';
import { inviteToGroup, getGroupMembers } from '../services/groupService';

interface InviteFriendsToGroupProps {
  groupId: string;
}

interface Friend {
  id: string;
  username: string;
  avatar_url: string;
}

export function InviteFriendsToGroup({ groupId }: InviteFriendsToGroupProps) {
  const { user } = useUser();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);

  async function loadFriends() {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const supabaseUser = await syncUser(user);
      
      // Hole alle Freunde
      const friendsList = await getFriendsList(supabaseUser.id);
      
      // Hole alle Gruppenmitglieder
      const groupMembers = await getGroupMembers(groupId);
      const groupMemberIds = groupMembers.map(member => member.user_id);
      
      // Konvertiere die Freundschaftsliste in eine Liste von Freunden,
      // filtere aber bereits eingeladene Freunde heraus
      const friendsData = friendsList
        .map(friendship => {
          const friend = friendship.user1_id === supabaseUser.id 
            ? friendship.user2! 
            : friendship.user1!;
          return {
            id: friendship.user1_id === supabaseUser.id 
              ? friendship.user2_id 
              : friendship.user1_id,
            username: friend.username,
            avatar_url: friend.avatar_url
          };
        })
        .filter(friend => !groupMemberIds.includes(friend.id));
      
      setFriends(friendsData);
    } catch (err: any) {
      setError('Failed to load friends');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFriends();
  }, [user, groupId]);

  async function handleInvite(friendId: string, friendUsername: string) {
    if (!user) return;
    
    try {
      setInvitingFriendId(friendId);
      setError(null);
      setSuccessMessage(null);
      
      await inviteToGroup(groupId, friendId);
      
      setSuccessMessage(`Invited ${friendUsername} to the group`);
      // Entferne den eingeladenen Freund aus der Liste
      setFriends(prev => prev.filter(f => f.id !== friendId));
    } catch (err: any) {
      setError(err.message || 'Failed to invite friend');
      console.error(err);
    } finally {
      setInvitingFriendId(null);
    }
  }

  if (loading && friends.length === 0) {
    return <div>Loading friends...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Invite Friends</h3>

      {error && (
        <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="text-green-400 text-sm p-2 bg-green-500/10 rounded-lg">
          {successMessage}
        </div>
      )}

      {friends.length === 0 ? (
        <p className="text-gray-400">No friends to invite</p>
      ) : (
        <div className="grid gap-2">
          {friends.map((friend) => (
            <div
              key={friend.id}
              className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <img
                  src={friend.avatar_url}
                  alt={friend.username}
                  className="w-8 h-8 rounded-full"
                />
                <span>{friend.username}</span>
              </div>
              <button
                onClick={() => handleInvite(friend.id, friend.username)}
                disabled={invitingFriendId === friend.id}
                className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50"
              >
                {invitingFriendId === friend.id ? 'Inviting...' : 'Invite'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 