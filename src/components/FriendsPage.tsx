import { FriendsList } from './FriendsList';
import { FriendRequests } from './FriendRequests';
import { AddFriend } from './AddFriend';

export function FriendsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold mb-8">Friends</h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <AddFriend />
          <FriendRequests />
        </div>
        <FriendsList />
      </div>
    </div>
  );
} 