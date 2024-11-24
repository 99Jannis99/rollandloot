import { useState, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { searchUsers, sendFriendRequest } from '../services/friendshipService';
import { syncUser } from '../services/userService';
import { useFriendRequests } from '../contexts/FriendRequestContext';

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string;
  isAnimatingOut?: boolean;
}

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

function Tooltip({ text, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (tooltipRef.current) {
      const offset = 10; // Abstand vom Cursor
      setPosition({
        x: e.clientX + offset,
        y: e.clientY + offset
      });
    }
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onMouseMove={handleMouseMove}
    >
      {children}
      {show && text.length > 15 && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-2 py-1 text-sm bg-gray-900 text-white rounded shadow-lg border border-white/10"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            pointerEvents: 'none'
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

export function AddFriend() {
  const { addPendingRequest } = useFriendRequests();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const truncateUsername = (username: string, maxLength: number = 15) => {
    return username.length > maxLength 
      ? username.slice(0, maxLength) + '...'
      : username;
  };

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
      setSearchResults(prev => 
        prev.map(result => 
          result.id === friendId 
            ? { ...result, isAnimatingOut: true }
            : result
        )
      );

      const supabaseUser = await syncUser(user);
      const newRequest = await sendFriendRequest(supabaseUser.id, friendId);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      addPendingRequest(newRequest);
      setSearchResults(prev => prev.filter(user => user.id !== friendId));
      setSuccessMessage(`Friend request sent to ${friendUsername}`);
    } catch (err: any) {
      setSearchResults(prev => 
        prev.map(result => 
          result.id === friendId 
            ? { ...result, isAnimatingOut: false }
            : result
        )
      );
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

      <div className="space-y-2 relative">
        {searchResults.map((result) => (
          <div
            key={result.id}
            className={`flex items-center justify-between p-4 bg-white/5 rounded-lg transition-all duration-500 ${
              result.isAnimatingOut ? 'animate-slide-out' : ''
            }`}
          >
            <div className="flex items-center space-x-4">
              <img
                src={result.avatar_url}
                alt={result.username}
                className="w-10 h-10 rounded-full"
              />
              <Tooltip text={result.username}>
                <span className="font-medium">
                  {truncateUsername(result.username)}
                </span>
              </Tooltip>
            </div>
            <button
              onClick={() => handleSendRequest(result.id, result.username)}
              disabled={result.isAnimatingOut}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {result.isAnimatingOut ? 'Sending...' : 'Add Friend'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 