import { useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { CreateGroupModal } from "./CreateGroupModal";
import { syncUser } from "../services/userService";
import { FriendsList } from './FriendsList';
import { FriendRequests } from './FriendRequests';
import { AddFriend } from './AddFriend';

interface GroupData {
  id: string;
  name: string;
  description: string;
}

interface GroupMember {
  role: string;
  groups: GroupData;
}

interface Group extends GroupData {
  role: string;
}

export function Dashboard() {
  const { user } = useUser();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchGroups() {
      try {
        if (!user) return;
        setError(null);
        setLoading(true);

        const supabaseUser = await syncUser(user).catch(error => {
          console.error('User sync failed:', error);
          throw new Error('Failed to sync user data. Please try again.');
        });

        const { data, error } = await supabase
          .from('group_members')
          .select(`
            role,
            groups (
              id,
              name,
              description
            )
          `)
          .eq('user_id', supabaseUser.id);

        if (error) throw error;

        if (isMounted && data) {
          const validGroups = data
            .filter(item => item.groups !== null)
            .map(item => ({
              id: item.groups.id,
              name: item.groups.name,
              description: item.groups.description,
              role: item.role
            }));

          setGroups(validGroups);
        }
      } catch (error: any) {
        console.error('Error fetching groups:', error);
        if (isMounted) {
          setError(error.message || 'Failed to load groups. Please try again later.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchGroups();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleGroupCreated = (newGroup: Group) => {
    setGroups([...groups, newGroup]);
    setShowCreateModal(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-lg text-gray-300">Loading your groups...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Welcome, {user?.username || 'Adventurer'}!</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Create New Group
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div className="space-y-8">
          <FriendRequests />
          <AddFriend />
        </div>
        <FriendsList />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-6">Your Groups</h2>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-300 mb-6">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/group/${group.id}`}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold mb-2">{group.name}</h3>
                  <p className="text-gray-300 mb-4">{group.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  group.role === 'dm' ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-blue-500/20 text-blue-300'
                }`}>
                  {group.role === 'dm' ? 'DM' : 'Player'}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {!error && groups.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-300">You're not part of any groups yet.</p>
            <p className="text-gray-300">Create a new group or ask for an invitation!</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}