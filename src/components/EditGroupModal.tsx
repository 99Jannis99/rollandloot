import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { updateGroup, deleteGroup } from '../services/groupService';
import { syncUser } from '../services/userService';

interface EditGroupModalProps {
  group: {
    id: string;
    name: string;
    description: string;
  };
  onClose: () => void;
  onGroupUpdated: (group: any) => void;
  onGroupDeleted: () => void;
}

export function EditGroupModal({ 
  group, 
  onClose, 
  onGroupUpdated,
  onGroupDeleted 
}: EditGroupModalProps) {
  const { user } = useUser();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) throw new Error('User not authenticated');
      await syncUser(user);

      const updatedGroup = await updateGroup(group.id, {
        name,
        description
      });

      onGroupUpdated(updatedGroup);
    } catch (error: any) {
      setError(error.message || 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      if (!user) throw new Error('User not authenticated');
      await syncUser(user);

      await deleteGroup(group.id);
      onGroupDeleted();
    } catch (error: any) {
      setError(error.message || 'Failed to delete group');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {showDeleteConfirm ? (
        <div 
          className="relative bg-gray-900 rounded-xl p-6 w-full max-w-md border border-white/10"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg 
                className="w-6 h-6 text-red-500" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-2">Delete Group</h3>
              <p className="text-gray-300">
                Are you sure you want to delete <span className="font-semibold">{group.name}</span>? 
                This action cannot be undone and all group data will be permanently lost.
              </p>
            </div>

            <div className="flex gap-4 mt-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, delete group'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div 
          className="relative bg-gray-900 rounded-xl p-6 w-full max-w-md border border-white/10" 
          onClick={e => e.stopPropagation()}
        >
          <h2 className="text-2xl font-bold mb-6">Edit Group</h2>
          
          {error && (
            <div className="mb-4 text-red-400 text-sm p-2 bg-red-500/10 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                Group Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                required
              />
            </div>

            <div className="flex justify-between gap-4">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                Delete Group
              </button>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
} 