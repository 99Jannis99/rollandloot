import { useState, useEffect } from 'react';
import { useUser } from "@clerk/clerk-react";
import { 
  getPendingRequests, 
  respondToFriendRequest,
  FriendshipRequest 
} from '../services/friendshipService';
import { syncUser } from '../services/userService';

export function FriendRequests() {
  const { user } = useUser();
  const [requests, setRequests] = useState<FriendshipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [user]);

  async function loadRequests() {
    if (!user?.id) return;
    try {
      setError(null);
      const supabaseUser = await syncUser(user);
      setSupabaseUserId(supabaseUser.id);
      console.log('Current Supabase User:', supabaseUser);
      
      const pendingRequests = await getPendingRequests(supabaseUser.id);
      console.log('Pending Requests:', pendingRequests);
      setRequests(pendingRequests);
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
      await respondToFriendRequest(requestId, status);
      await loadRequests();
    } catch (error: any) {
      console.error('Error responding to request:', error);
      setError('Failed to respond to friend request');
    } finally {
      setResponding(null);
    }
  }

  if (loading) return <div>Loading pending requests...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Pending</h2>
      
      {error && (
        <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="text-gray-400">No pending requests</p>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => {
            const isOutgoing = request.user1_id === supabaseUserId;
            console.log('Request Debug:', {
              requestId: request.id,
              user1_id: request.user1_id,
              user2_id: request.user2_id,
              currentSupabaseUserId: supabaseUserId,
              isOutgoing,
              user1: request.user1,
              user2: request.user2
            });
            
            const otherUser = isOutgoing ? request.user2 : request.user1;
            console.log('Other User:', otherUser);
            
            if (!otherUser) return null;
            
            return (
              <div 
                key={request.id}
                className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <img 
                    src={otherUser.avatar_url} 
                    alt={otherUser.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{otherUser.username}</span>
                    <span className="text-sm text-yellow-400">
                      {isOutgoing ? 'Request sent' : 'Incoming request'}
                    </span>
                  </div>
                </div>
                {!isOutgoing && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleResponse(request.id, 'accepted')}
                      disabled={responding === request.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
                    >
                      {responding === request.id ? 'Accepting...' : 'Accept'}
                    </button>
                    <button
                      onClick={() => handleResponse(request.id, 'rejected')}
                      disabled={responding === request.id}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
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