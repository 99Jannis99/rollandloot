import { useState, useEffect } from 'react';
import { useUser } from "@clerk/clerk-react";
import { 
  getPendingRequests, 
  respondToFriendRequest,
  cancelFriendRequest,
  FriendshipRequest 
} from '../services/friendshipService';
import { syncUser } from '../services/userService';
import { useFriendRequests } from '../contexts/FriendRequestContext';

export function FriendRequests() {
  const { pendingRequests, setPendingRequests, addFriend, removePendingRequest } = useFriendRequests();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [animatingRequestId, setAnimatingRequestId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [user]);

  async function loadRequests() {
    if (!user?.id) return;
    try {
      setError(null);
      const supabaseUser = await syncUser(user);
      setSupabaseUserId(supabaseUser.id);
      
      const requests = await getPendingRequests(supabaseUser.id);
      setPendingRequests(requests);
    } catch (error: any) {
      console.error('Error loading requests:', error);
      setError('Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  }

  async function handleResponse(requestId: string, status: 'accepted' | 'rejected') {
    try {
      setError(null);
      setResponding(requestId);
      setAnimatingRequestId(requestId);

      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updatedRequest = await respondToFriendRequest(requestId, status);
      
      if (status === 'accepted') {
        addFriend(updatedRequest);
      }
      
      removePendingRequest(requestId);
    } catch (error: any) {
      console.error('Error responding to request:', error);
      setError('Failed to respond to friend request');
      setAnimatingRequestId(null);
    } finally {
      setResponding(null);
    }
  }

  async function handleCancelRequest(requestId: string) {
    try {
      setResponding(requestId);
      setError(null);
      setAnimatingRequestId(requestId);

      await new Promise(resolve => setTimeout(resolve, 500));
      
      await cancelFriendRequest(requestId);
      await loadRequests();
    } catch (error: any) {
      console.error('Error canceling request:', error);
      setError('Failed to cancel friend request');
      setAnimatingRequestId(null);
    } finally {
      setResponding(null);
    }
  }

  const truncateUsername = (username: string, maxLength: number = 15) => {
    return username.length > maxLength 
      ? username.slice(0, maxLength) + '...'
      : username;
  };

  if (loading) return <div>Loading pending requests...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Pending</h2>
      
      {error && (
        <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg">
          {error}
        </div>
      )}

      {pendingRequests.length === 0 ? (
        <p className="text-gray-400">No pending requests</p>
      ) : (
        <div className="grid gap-4">
          {pendingRequests.map((request) => {
            const isOutgoing = request.user1_id === supabaseUserId;
            const otherUser = isOutgoing ? request.user2 : request.user1;
            
            if (!otherUser) return null;
            
            return (
              <div 
                key={request.id}
                className={`flex items-center justify-between p-4 bg-white/5 rounded-lg ${
                  isOutgoing ? 'animate-slide-in' : ''
                } ${
                  animatingRequestId === request.id ? 'animate-slide-out' : ''
                }`}
              >
                <div className="flex items-center space-x-4">
                  <img 
                    src={otherUser.avatar_url} 
                    alt={otherUser.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex flex-col">
                    <span 
                      className="font-medium"
                      title={otherUser.username}
                    >
                      {truncateUsername(otherUser.username)}
                    </span>
                    <span className="text-sm text-yellow-400">
                      {isOutgoing ? 'Request sent' : 'Incoming request'}
                    </span>
                  </div>
                </div>
                {isOutgoing ? (
                  <button
                    onClick={() => handleCancelRequest(request.id)}
                    disabled={responding === request.id}
                    className="px-4 py-2 bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {responding === request.id ? 'Canceling...' : 'Cancel'}
                  </button>
                ) : (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleResponse(request.id, 'accepted')}
                      disabled={responding === request.id}
                      className="px-4 py-2 bg-green-600/10 text-green-400 hover:bg-green-600/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {responding === request.id ? 'Accepting...' : 'Accept'}
                    </button>
                    <button
                      onClick={() => handleResponse(request.id, 'rejected')}
                      disabled={responding === request.id}
                      className="px-4 py-2 bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {responding === request.id ? 'Declining...' : 'Decline'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 