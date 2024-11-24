import { supabase } from '../lib/supabase';
import type { User } from '@clerk/clerk-react';

export interface SupabaseUser {
  id: string;
  email: string;
  username: string;
  avatar_url: string;
  last_online: string;
  clerk_id: string;
}

export async function syncUser(clerkUser: User): Promise<SupabaseUser> {
  try {
    const email = clerkUser.primaryEmailAddress?.emailAddress;
    if (!email) throw new Error('User email not found');
    if (!clerkUser.username) throw new Error('Username is required');

    // Suche nach existierendem Benutzer
    const { data: existingUser, error: searchError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerkUser.id)
      .maybeSingle();

    if (searchError) {
      console.error('Search error:', searchError);
      throw searchError;
    }

    const userData = {
      email,
      username: clerkUser.username,
      avatar_url: clerkUser.imageUrl,
      last_online: new Date().toISOString(),
      clerk_id: clerkUser.id
    };

    if (!existingUser) {
      // Erstelle neuen Benutzer
      const { data, error: insertError } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      return data;
    }

    // Update existierenden Benutzer via RPC
    const { data: updatedUser, error: updateError } = await supabase
      .rpc('update_user', {
        p_clerk_id: clerkUser.id,
        p_email: email,
        p_username: clerkUser.username,
        p_avatar_url: clerkUser.imageUrl,
        p_last_online: new Date().toISOString()
      }).single();

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    if (!updatedUser) {
      throw new Error('Update failed: No user returned');
    }

    return updatedUser;
  } catch (error: any) {
    console.error('Error syncing user:', error);
    throw new Error(`Failed to sync user: ${error.message || 'Unknown error'}`);
  }
}