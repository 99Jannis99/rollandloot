import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { searchUsers, sendFriendRequest } from '../services/friendshipService';
import { syncUser } from '../services/userService';

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string;
}

export function AddFriend() {
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const supabaseUser = await syncUser(user);
      const results = await searchUsers(searchQuery, supabaseUser.id);
      setSearchResults(results);
    } catch (err: any) {
      setError('Failed to search users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRequest(friendId: string, friendUsername: string) {
    if (!user) return;
    
    setError(null);
    setSuccessMessage(null);

    try {
      const supabaseUser = await syncUser(user);
      await sendFriendRequest(supabaseUser.id, friendId);
      // Entferne den Benutzer aus den Suchergebnissen
      setSearchResults(prev => prev.filter(user => user.id !== friendId));
      setSuccessMessage(`Friend request sent to ${friendUsername}`);
    } catch (err: any) {
      setError(err.message || 'Failed to send friend request');
      console.error(err);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Add Friend</h2>
      
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users by username..."
          className="flex-1 px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

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

      <div className="space-y-2">
        {searchResults.map((result) => (
          <div
            key={result.id}
            className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
          >
            <div className="flex items-center space-x-4">
              <img
                src={result.avatar_url}
                alt={result.username}
                className="w-10 h-10 rounded-full"
              />
              <span className="font-medium">{result.username}</span>
            </div>
            <button
              onClick={() => handleSendRequest(result.id, result.username)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
            >
              Add Friend
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 