import { supabase } from "../lib/supabase";

export interface SupabaseUser {
  id: string;
  username: string;
  avatar_url: string;
  last_online: string;
  clerk_id: string;
  token?: string;
}

export async function syncUser(clerkUser: any): Promise<SupabaseUser> {
  // console.log("Starting syncUser...");
  // console.log("Clerk User:", clerkUser);

  try {
    // Prüfen, ob der Benutzer in der Supabase-Datenbank existiert
    const { data: existingUser, error } = await supabase
      .from("users")
      .select("*")
      .eq("clerk_id", clerkUser.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user from Supabase:", error);
      throw error;
    }

    const userData: SupabaseUser = {
      id: existingUser?.id || "",
      clerk_id: clerkUser.id,
      username: clerkUser.username,
      avatar_url: clerkUser.imageUrl,
      last_online: new Date().toISOString(),
    };

    // Benutzer erstellen oder aktualisieren
    if (!existingUser) {
      // console.log("User not found, creating new user in Supabase...");
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert([{
          clerk_id: userData.clerk_id,
          username: userData.username,
          avatar_url: userData.avatar_url,
          last_online: userData.last_online
        }])
        .select()
        .single();

      if (insertError) {
        console.error("Error creating user in Supabase:", insertError);
        throw insertError;
      }

      // console.log("User created successfully.");
      return newUser;
    }

    // console.log("User exists, returning existing user.");
    return existingUser;
  } catch (error) {
    console.error("Error in syncUser:", error);
    throw error;
  }
}