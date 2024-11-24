import { createContext, useContext, useState, ReactNode } from 'react';
import { FriendshipRequest } from '../services/friendshipService';

interface FriendRequestContextType {
  pendingRequests: FriendshipRequest[];
  friends: FriendshipRequest[];
  setPendingRequests: (requests: FriendshipRequest[]) => void;
  setFriends: (friends: FriendshipRequest[]) => void;
  addPendingRequest: (request: FriendshipRequest) => void;
  addFriend: (friend: FriendshipRequest) => void;
  removePendingRequest: (requestId: string) => void;
}

const FriendRequestContext = createContext<FriendRequestContextType | undefined>(undefined);

export function FriendRequestProvider({ children }: { children: ReactNode }) {
  const [pendingRequests, setPendingRequests] = useState<FriendshipRequest[]>([]);
  const [friends, setFriends] = useState<FriendshipRequest[]>([]);

  const addPendingRequest = (request: FriendshipRequest) => {
    setPendingRequests(prev => [...prev, request]);
  };

  const addFriend = (friend: FriendshipRequest) => {
    setFriends(prev => [...prev, friend]);
  };

  const removePendingRequest = (requestId: string) => {
    setPendingRequests(prev => prev.filter(req => req.id !== requestId));
  };

  return (
    <FriendRequestContext.Provider 
      value={{ 
        pendingRequests, 
        friends,
        setPendingRequests,
        setFriends, 
        addPendingRequest,
        addFriend,
        removePendingRequest
      }}
    >
      {children}
    </FriendRequestContext.Provider>
  );
}

export function useFriendRequests() {
  const context = useContext(FriendRequestContext);
  if (context === undefined) {
    throw new Error('useFriendRequests must be used within a FriendRequestProvider');
  }
  return context;
} 