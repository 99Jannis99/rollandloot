import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase';
import { syncUser } from '../services/userService';

interface CreateGroupModalProps {
  onClose: () => void;
  onGroupCreated: (group: any) => void;
}

export function CreateGroupModal({ onClose, onGroupCreated }: CreateGroupModalProps) {
  const { user } = useUser();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) throw new Error('User not authenticated');

      // Sync user data with Supabase
      const supabaseUser = await syncUser(user);

      // Create the group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert([{
          name,
          description,
          created_by: supabaseUser.id
        }])
        .select()
        .single();

      if (groupError) throw groupError;

      // Create inventory for the group
      const { error: inventoryError } = await supabase
        .from('group_inventories')
        .insert([{
          group_id: groupData.id,
          user_id: supabaseUser.id,
        }]);

      if (inventoryError) throw inventoryError;

      // Add creator as dm
      const { error: memberError } = await supabase
        .from('group_members')
        .insert([{
          group_id: groupData.id,
          user_id: supabaseUser.id,
          role: 'dm'
        }]);

      if (memberError) throw memberError;

      onGroupCreated({ ...groupData, role: 'dm' });
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div 
        className="relative bg-gray-900 rounded-xl p-6 w-full max-w-md border border-white/10" 
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-6">Create New Group</h2>
        
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

          <div className="flex justify-end gap-4">
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
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}