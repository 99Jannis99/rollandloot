import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getGroupMembers } from '../services/groupService';
import { syncUser } from '../services/userService';

interface SelectTradePartnerModalProps {
  groupId: string;
  onClose: () => void;
  onPartnerSelected: (partnerId: string) => void;
}

interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  users: {
    username: string;
    avatar_url: string;
  };
}

export function SelectTradePartnerModal({ groupId, onClose, onPartnerSelected }: SelectTradePartnerModalProps) {
  const { user } = useUser();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    if (!user) return;

    try {
      setLoading(true);
      const supabaseUser = await syncUser(user);
      const groupMembers = await getGroupMembers(groupId);
      
      // Filtere DMs und den aktuellen User aus
      setMembers(groupMembers.filter(member => 
        member.role !== 'dm' && member.user_id !== supabaseUser.id
      ));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-300"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold mb-4">Select Trade Partner</h2>

        {error && (
          <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-4">Loading members...</div>
        ) : (
          <div className="grid gap-2">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => {
                  onPartnerSelected(member.user_id);
                  onClose();
                }}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors w-full group"
              >
                <img
                  src={member.users.avatar_url}
                  alt={member.users.username}
                  className="w-10 h-10 rounded-full flex-shrink-0"
                />
                <div className="min-w-0 flex-1 max-w-[180px]">
                  <div 
                    className="font-medium truncate text-left"
                    title={member.users.username}
                  >
                    {member.users.username}
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-400 flex-shrink-0">
                  Auswählen
                </div>
              </button>
            ))}

            {members.length === 0 && (
              <p className="text-center text-gray-400 py-4">
                No other players available for trading
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 