import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
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

  useEffect(() => {
    loadRequests();
  }, [user]);

  async function loadRequests() {
    if (!user?.id) return;
    try {
      setError(null);
      const supabaseUser = await syncUser(user);
      const pendingRequests = await getPendingRequests(supabaseUser.id);
      setRequests(pendingRequests);
    } catch (error: any) {
      console.error('Error loading requests:', error);
      setError('Failed to load friend requests');
    } finally {
      setLoading(false);
    }
  }

  async function handleResponse(requestId: string, status: 'accepted' | 'rejected') {
    try {
      setError(null);
      setResponding(requestId);
      await respondToFriendRequest(requestId, status);
      // Aktualisiere die Liste nach der Antwort
      await loadRequests();
    } catch (error: any) {
      console.error('Error responding to request:', error);
      setError('Failed to respond to friend request');
    } finally {
      setResponding(null);
    }
  }

  if (loading) return <div>Loading requests...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Friend Requests</h2>
      
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
            const sender = request.user1;
            const isResponding = responding === request.id;
            
            return (
              <div 
                key={request.id}
                className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <img 
                    src={sender?.avatar_url} 
                    alt={sender?.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <span className="font-medium">{sender?.username}</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleResponse(request.id, 'accepted')}
                    disabled={isResponding}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {isResponding ? 'Accepting...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleResponse(request.id, 'rejected')}
                    disabled={isResponding}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {isResponding ? 'Declining...' : 'Decline'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 