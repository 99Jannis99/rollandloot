import { useState, useEffect } from 'react';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { getGroupMembers, removeGroupMember } from '../services/groupService';

interface Member {
  id: string;
  user_id: string;
  role: string;
  users: {
    username: string;
    avatar_url: string;
  };
}

interface EditGroupMembersModalProps {
  groupId: string;
  onClose: () => void;
  onMembersUpdated: (removedId: string) => void;
}

export function EditGroupMembersModal({ groupId, onClose, onMembersUpdated }: EditGroupMembersModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const data = await getGroupMembers(groupId);
      setMembers(data.filter(member => member.role !== 'dm'));
      setLoading(false);
    } catch (err) {
      setError('Failed to load members');
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await removeGroupMember(groupId, userId);
      await loadMembers();
      onMembersUpdated(userId);
    } catch (err) {
      setError('Failed to remove member');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-300"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold mb-4">Edit Group Members</h2>

        {error && (
          <div className="text-red-400 mb-4 p-2 bg-red-500/10 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-black/20 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={member.users.avatar_url}
                    alt={member.users.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <span>{member.users.username}</span>
                </div>
                <button
                  onClick={() => handleRemoveMember(member.user_id)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 