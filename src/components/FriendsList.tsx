import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { getFriendsList, removeFriend, FriendshipRequest } from '../services/friendshipService';
import { syncUser } from '../services/userService';
import { useFriendRequests } from '../contexts/FriendRequestContext';

interface RemoveConfirmProps {
  friend: {
    username: string;
    avatar_url: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function RemoveConfirmDialog({ friend, onConfirm, onCancel, isDeleting }: RemoveConfirmProps) {
  return (
    <div className="flex flex-col items-center text-center gap-4">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
        <svg 
          className="w-6 h-6 text-red-500" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" 
          />
        </svg>
      </div>
      
      <div>
        <h3 className="text-xl font-bold mb-2">Remove Friend</h3>
        <p className="text-gray-300">
          Are you sure you want to remove <span className="font-semibold">{friend.username}</span>? 
          You will need to send a new friend request if you want to be friends again.
        </p>
      </div>

      <div className="flex gap-4 mt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          disabled={isDeleting}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
        >
          {isDeleting ? 'Removing...' : 'Yes, remove friend'}
        </button>
      </div>
    </div>
  );
}

export function FriendsList() {
  const { friends, setFriends } = useFriendRequests();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{
    friendshipId: string;
    friend: { username: string; avatar_url: string; };
  } | null>(null);
  const [animatingFriendshipId, setAnimatingFriendshipId] = useState<{
    id: string;
    type: 'in' | 'out';
  } | null>(null);

  useEffect(() => {
    loadFriends();
  }, [user]);

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

  async function handleRemoveFriend(friendshipId: string) {
    try {
      setRemovingFriendId(friendshipId);
      setAnimatingFriendshipId({ id: friendshipId, type: 'out' });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await removeFriend(friendshipId);
      setFriends(prev => prev.filter(f => f.id !== friendshipId));
      setConfirmRemove(null);
    } catch (err: any) {
      setError('Failed to remove friend');
      setAnimatingFriendshipId(null);
    } finally {
      setRemovingFriendId(null);
    }
  }

  useEffect(() => {
    if (friends.length > 0) {
      const lastFriend = friends[friends.length - 1];
      setAnimatingFriendshipId({ id: lastFriend.id, type: 'in' });
      
      const timer = setTimeout(() => {
        setAnimatingFriendshipId(null);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [friends.length]);

  const filteredFriends = friends.filter(friendship => {
    const friend = friendship.user1_id === supabaseUserId ? friendship.user2 : friendship.user1;
    return friend?.username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return <div>Loading friends...</div>;
  }

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Friends</h2>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search friends..."
            className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent pl-10"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        
        {error && (
          <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg">
            {error}
          </div>
        )}

        {filteredFriends.length === 0 ? (
          <p className="text-gray-400">
            {searchQuery ? 'No friends match your search' : 'No friends yet'}
          </p>
        ) : (
          <div className="grid gap-4">
            {filteredFriends.map((friendship) => {
              const friend = friendship.user1_id === supabaseUserId 
                ? friendship.user2 
                : friendship.user1;
              
              if (!friend) return null;
              
              return (
                <div 
                  key={friendship.id}
                  className={`flex items-center justify-between p-4 bg-white/5 rounded-lg ${
                    animatingFriendshipId?.id === friendship.id
                      ? animatingFriendshipId.type === 'in'
                        ? 'animate-slide-in'
                        : 'animate-slide-out'
                      : ''
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <img 
                      src={friend.avatar_url} 
                      alt={friend.username}
                      className="w-10 h-10 rounded-full"
                    />
                    <span className="font-medium">{friend.username}</span>
                  </div>
                  <button
                    onClick={() => setConfirmRemove({ 
                      friendshipId: friendship.id,
                      friend: {
                        username: friend.username,
                        avatar_url: friend.avatar_url
                      }
                    })}
                    disabled={removingFriendId === friendship.id}
                    className="px-3 py-1 text-sm bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmRemove && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          onClick={() => setConfirmRemove(null)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div 
            className="relative bg-gray-900 rounded-xl p-6 w-full max-w-md border border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <RemoveConfirmDialog
              friend={confirmRemove.friend}
              onConfirm={() => handleRemoveFriend(confirmRemove.friendshipId)}
              onCancel={() => setConfirmRemove(null)}
              isDeleting={removingFriendId === confirmRemove.friendshipId}
            />
          </div>
        </div>
      )}
    </>
  );
} 