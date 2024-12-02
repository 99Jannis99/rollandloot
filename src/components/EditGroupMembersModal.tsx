import { useState, useEffect } from 'react';
import { XMarkIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { getGroupMembers, removeGroupMember, updateMemberNickname } from '../services/groupService';

interface Member {
  id: string;
  user_id: string;
  role: string;
  nickname: string | null;
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
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [newNickname, setNewNickname] = useState<string>('');

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

  const handleUpdateNickname = async (member: Member) => {
    try {
      setMembers(prev => prev.map(m => {
        if (m.id === member.id) {
          return { ...m, nickname: newNickname };
        }
        return m;
      }));
      
      await updateMemberNickname(groupId, member.user_id, newNickname);
      setEditingNickname(null);
    } catch (err) {
      await loadMembers();
      setError('Failed to update nickname');
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
                  <div className="flex flex-col">
                    {editingNickname === member.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newNickname}
                          onChange={(e) => setNewNickname(e.target.value)}
                          className="px-2 py-1 bg-black/30 border border-white/10 rounded text-sm"
                          placeholder={member.users.username}
                        />
                        <button
                          onClick={() => handleUpdateNickname(member)}
                          className="px-3 py-1 text-sm bg-green-600/10 text-green-400 hover:bg-green-600/20 rounded-lg transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNickname(null)}
                          className="px-3 py-1 text-sm bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span>{member.nickname || member.users.username}</span>
                        {member.nickname && (
                          <span className="text-xs text-gray-400">
                            @{member.users.username}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {editingNickname !== member.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingNickname(member.id);
                        setNewNickname(member.nickname || '');
                      }}
                      className="p-2 text-violet-400 hover:bg-violet-400/10 rounded-lg transition-colors"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 