import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "../lib/supabase";
import { GroupMembers } from "./GroupMembers";
import { GroupInventoryOverview } from "./GroupInventoryOverview";
import { InviteFriendsToGroup } from "./InviteFriendsToGroup";
import { syncUser } from "../services/userService";
import { EditGroupMembersModal } from "./EditGroupMembersModal";
import { GroupNotes } from "./GroupNotes";
import { TradeNotifications } from "./TradeNotifications";
import { ActiveTrades } from "../components/ActiveTrades";

interface Group {
  id: string;
  name: string;
  description: string;
  created_by: string;
}

interface Member {
  id: string;
  user_id: string;
  role: "admin" | "member" | "dm";
  users: {
    username: string;
    avatar_url: string;
  };
}

export function GroupPage() {
  const { id } = useParams();
  const { user } = useUser();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [shouldRefreshInventories, setShouldRefreshInventories] = useState(0);
  const [showEditMembersModal, setShowEditMembersModal] = useState(false);
  const [removedMemberId, setRemovedMemberId] = useState<string | null>(null);

  async function fetchGroupData() {
    try {
      if (!user || !id) return;

      // Sync user with Supabase
      const supabaseUser = await syncUser(user);

      // Fetch group details
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", id)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Fetch group members with their user details
      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select(
          `
          id,
          user_id,
          role,
          users (
            username,
            avatar_url
          )
        `
        )
        .eq("group_id", id);

      if (membersError) throw membersError;
      setMembers(membersData);

      // Find current user's role
      const currentMember = membersData.find(
        (member) => member.user_id === supabaseUser.id
      );
      if (currentMember) {
        setUserRole(currentMember.role);
      }
    } catch (error) {
      console.error("Error fetching group data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGroupData();
  }, [id, user]);

  const handleMemberAdded = async () => {
    await fetchGroupData();
    setShouldRefreshInventories((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-lg text-gray-300">Loading group details...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-400">Group not found</h2>
        <p className="text-gray-300 mt-2">
          This group might have been deleted or you don't have access to it.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{group.name}</h1>
            <p className="text-gray-300">{group.description}</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <GroupInventoryOverview
            groupId={group.id}
            key={shouldRefreshInventories}
          />
        </div>
        <div className="space-y-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 w-full justify-between">
              <h2 className="text-2xl font-bold">Group Members</h2>
              {(userRole === "admin" || userRole === "dm") && (
                <button
                  onClick={() => setShowEditMembersModal(true)}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
          <div className="space-y-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <GroupMembers
                members={members}
                groupId={group.id}
                userRole={userRole}
                onMembersUpdate={setMembers}
              />
            </div>
            {showEditMembersModal && (
              <EditGroupMembersModal
                groupId={group.id}
                onClose={() => setShowEditMembersModal(false)}
                onMembersUpdated={(removedId) => {
                  fetchGroupData();
                  setRemovedMemberId(removedId);
                }}
              />
            )}
            {(userRole === "admin" || userRole === "dm") && (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <InviteFriendsToGroup
                  groupId={group.id}
                  onMemberAdded={handleMemberAdded}
                  removedMemberId={removedMemberId}
                />
              </div>
            )}
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <GroupNotes groupId={group.id} />
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <ActiveTrades groupId={group.id} />
          </div>
        </div>
      </div>

      <TradeNotifications groupId={group.id} />
    </div>
  );
}
