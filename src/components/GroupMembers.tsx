import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface Member {
  id: string;
  user_id: string;
  role: 'admin' | 'player' | 'dm';
  users: {
    username: string;
    avatar_url: string;
  };
}

interface GroupMembersProps {
  members: Member[];
  groupId: string;
  userRole: string;
  onMembersUpdate: (members: Member[]) => void;
}

export function GroupMembers({ members, groupId, userRole, onMembersUpdate }: GroupMembersProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animatingMemberId, setAnimatingMemberId] = useState<string | null>(null);
  const prevMembersLength = useRef(members.length);

  useEffect(() => {
    // Nur animieren wenn ein neues Mitglied hinzugefügt wurde
    if (members.length > prevMembersLength.current) {
      const newMember = members[members.length - 1];
      setAnimatingMemberId(newMember.id);
      
      const timer = setTimeout(() => {
        setAnimatingMemberId(null);
      }, 500);

      return () => clearTimeout(timer);
    }
    prevMembersLength.current = members.length;
  }, [members.length]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/20 text-red-300';
      case 'dm':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'player':
        return 'bg-blue-500/20 text-blue-300';
      default:
        return 'bg-blue-500/20 text-blue-300';
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Group Members</h2>
      
      {error && (
        <div className="text-red-400 text-sm p-2 bg-red-500/10 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className={`flex items-center justify-between p-3 bg-white/5 rounded-lg transition-all duration-500 ${
              animatingMemberId === member.id ? 'animate-slide-in' : ''
            }`}
          >
            <div className="flex items-center space-x-3">
              <img
                src={member.users.avatar_url}
                alt={member.users.username}
                className="w-8 h-8 rounded-full"
              />
              <span>{member.users.username}</span>
            </div>
            <span className={`px-2 py-1 rounded-full text-sm ${getRoleBadgeColor(member.role)}`}>
              {member.role.toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      {members.length === 0 && (
        <p className="text-gray-400 text-center py-4">
          No members in this group yet.
        </p>
      )}
    </div>
  );
}