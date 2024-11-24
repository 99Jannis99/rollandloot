import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { getFriendsList, FriendshipRequest } from '../services/friendshipService';
import { syncUser } from '../services/userService';

export function FriendsList() {
  const { user } = useUser();
  const [friends, setFriends] = useState<FriendshipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadFriends() {
      try {
        if (!user?.id) return;
        const supabaseUser = await syncUser(user);
        setSupabaseUserId(supabaseUser.id);
        
        const friendsList = await getFriendsList(supabaseUser.id);
        setFriends(friendsList);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadFriends();
  }, [user]);

  if (loading) {
    return <div>Loading friends...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Friends</h2>
      {friends.length === 0 ? (
        <p className="text-gray-400">No friends yet</p>
      ) : (
        <div className="grid gap-4">
          {friends.map((friendship) => {
            // Bestimme den Freund basierend auf der Supabase User ID
            const friendData = friendship.user1_id === supabaseUserId 
              ? friendship.user2 
              : friendship.user1;
            
            return (
              <div 
                key={friendship.id}
                className="flex items-center space-x-4 p-4 bg-white/5 rounded-lg"
              >
                <img 
                  src={friendData?.avatar_url} 
                  alt={friendData?.username}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex flex-col">
                  <span className="font-medium">{friendData?.username}</span>
                  <span className="text-sm text-gray-400">
                    Friend since {new Date(friendship.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 