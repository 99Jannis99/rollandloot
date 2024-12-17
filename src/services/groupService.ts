import { supabase } from "../lib/supabase";
import { syncUser } from "../services/userService";

export interface Group {
  id: string;
  name: string;
  description: string;
  created_at: string;
  created_by: string;
}

export type Role = "admin" | "member" | "dm" | "player";

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  is_active: boolean;
}

export interface GroupInventory {
  id: string;
  user_id: string;
  group_id: string;
  user?: {
    username: string;
    avatar_url: string;
  };
  member?: {
    nickname: string | null;
  };
  inventory_items: {
    id: string;
    item_id: string;
    quantity: number;
    item_type: "standard" | "custom";
    items: {
      id: string;
      name: string;
      description: string;
      category: string;
      weight: number;
      icon_url: string | null;
    };
  }[];
}

export interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  weight: number;
  icon_url: string;
}

export interface Currency {
  type: "copper" | "silver" | "gold" | "platinum";
  amount: number;
}

export async function getAllGroupInventories(
  groupId: string
): Promise<GroupInventory[]> {
  try {
    const { data: members, error: membersError } = await supabase
      .from("group_members")
      .select(
        `
        user_id,
        role,
        nickname,
        users (
          username,
          avatar_url
        )
      `
      )
      .eq("group_id", groupId)
      .neq("role", "dm");

    if (membersError) throw membersError;

    const inventories = await Promise.all(
      (members || []).map(async (member) => {
        if (member.role === "dm") return null;

        const { data: inventoryData } = await supabase
          .from("group_inventories")
          .select("id")
          .eq("group_id", groupId)
          .eq("user_id", member.user_id)
          .single();

        if (!inventoryData) return null;

        const { data: inventoryItems } = await supabase
          .from("inventory_items")
          .select(
            `
          id,
          quantity,
          item_id,
          item_type,
          items:all_items!inner(
            id,
            name,
            description,
            category,
            weight,
            icon_url
          )
        `
          )
          .eq("inventory_id", inventoryData.id);

        return {
          id: inventoryData.id,
          user_id: member.user_id,
          group_id: groupId,
          user: member.users,
          member: {
            nickname: member.nickname,
          },
          inventory_items: inventoryItems || [],
        };
      })
    );

    return inventories.filter((inv): inv is GroupInventory => inv !== null);
  } catch (error) {
    console.error("Error in getAllGroupInventories:", error);
    throw error;
  }
}

export async function getPlayerInventory(
  groupId: string,
  userId: string
): Promise<GroupInventory | null> {
  try {
    const isDM = await isDungeonMaster(groupId, userId);
    if (isDM) {
      return null;
    }

    const { data: inventory, error } = await supabase
      .from("group_inventories")
      .select(
        `
        id,
        user_id,
        group_id,
        users (
          username,
          avatar_url
        )
      `
      )
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .single();

    if (error || !inventory) return null;

    const { data: inventoryItems } = await supabase
      .from("inventory_items")
      .select(
        `
        id,
        quantity,
        item_id,
        item_type,
        items:all_items!inner(
          id,
          name,
          description,
          category,
          weight,
          icon_url
        )
      `
      )
      .eq("inventory_id", inventory.id);

    return {
      ...inventory,
      inventory_items: inventoryItems || [],
    };
  } catch (error) {
    console.error("Error in getPlayerInventory:", error);
    throw error;
  }
}

export async function addItemToPlayerInventory(
  groupId: string,
  playerId: string,
  itemId: string,
  quantity: number,
  isCustom: boolean
) {
  try {
    const { data: inventoryData, error: inventoryError } = await supabase
      .from("group_inventories")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", playerId)
      .single();

    if (inventoryError) throw inventoryError;

    // Zuerst fügen wir das Item zum Inventar hinzu
    const { data: newItem, error: insertError } = await supabase
      .from("inventory_items")
      .insert({
        inventory_id: inventoryData.id,
        item_id: itemId,
        quantity: quantity,
        item_type: isCustom ? "custom" : "api",
      })
      .select("id, item_id, quantity, item_type")
      .single();

    if (insertError) throw insertError;

    // Hole die Item-Details aus der all_items Tabelle
    const { data: itemDetails, error: itemError } = await supabase
      .from("all_items")
      .select("id, name, description, category, weight, icon_url")
      .eq("id", itemId)
      .single();

    if (itemError) throw itemError;

    // Kombiniere die Daten in das gewünschte Format
    return {
      id: newItem.id,
      item_id: newItem.item_id,
      quantity: newItem.quantity,
      item_type: newItem.item_type,
      items: {
        id: itemDetails.id,
        name: itemDetails.name,
        description: itemDetails.description,
        category: itemDetails.category,
        weight: itemDetails.weight,
        icon_url: itemDetails.icon_url,
      },
    };
  } catch (error) {
    console.error("Error adding item to inventory:", error);
    throw error;
  }
}

export async function removeItemFromInventory(
  itemId: string,
  userId: string,
  isDM: boolean
): Promise<void> {
  try {
    // Direkt das Item löschen, ohne weitere Überprüfungen
    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .match({ id: itemId });

    if (error) throw error;
  } catch (error) {
    throw error;
  }
}

export async function createGroup(
  name: string,
  description: string,
  userId: string
): Promise<Group> {
  try {
    // 1. Erstelle die Gruppe
    const { data: groupData, error: groupError } = await supabase
      .from("groups")
      .insert([
        {
          name,
          description,
          created_by: userId,
        },
      ])
      .select()
      .single();

    if (groupError) throw groupError;

    // 2. Warte einen Moment
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 3. Füge den DM hinzu
    const { error: memberError } = await supabase.from("group_members").insert([
      {
        group_id: groupData.id,
        user_id: userId,
        role: "dm",
        joined_at: new Date().toISOString(),
        is_active: true,
      },
    ]);

    if (memberError) {
      // Wenn das Hinzufügen fehlschlägt, lösche die Gruppe
      await supabase.from("groups").delete().eq("id", groupData.id);
      throw memberError;
    }

    // 4. Warte einen Moment
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 5. Lösche ALLE Inventare für diesen Benutzer in dieser Gruppe
    const { error: deleteError } = await supabase
      .from("group_inventories")
      .delete()
      .match({
        group_id: groupData.id,
        user_id: userId,
      });

    if (deleteError) {
      console.error("Error deleting inventory:", deleteError);
    }

    return groupData;
  } catch (error) {
    console.error("Error in group creation process:", error);
    throw error;
  }
}

export async function updateGroup(
  groupId: string,
  data: { name?: string; description?: string }
): Promise<Group> {
  try {
    const { data: updatedGroup, error } = await supabase.rpc("update_group", {
      p_group_id: groupId,
      p_name: data.name,
      p_description: data.description,
    });

    if (error) {
      console.error("Error updating group:", error);
      throw error;
    }

    if (!updatedGroup) {
      throw new Error("Group not found");
    }

    return updatedGroup as Group;
  } catch (error) {
    console.error("Error in updateGroup:", error);
    throw error;
  }
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_group_with_dependencies", {
    p_group_id: groupId,
  });

  if (error) throw error;
}

export async function inviteToGroup(groupId: string, userId: string) {
  try {
    // Prüfe zuerst, ob der Benutzer bereits in der Gruppe ist
    const { data: existingMember, error: checkError } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle(); // Verwende maybeSingle statt single

    if (checkError) throw checkError;

    // Wenn der Benutzer bereits DM ist, verhindere die Einladung
    if (existingMember?.role === "dm") {
      throw new Error("User is already a DM in this group");
    }

    // Wenn der Benutzer bereits Mitglied ist, beende hier
    if (existingMember) {
      throw new Error("User is already a member of this group");
    }

    // Füge das Mitglied zur Gruppe hinzu
    const { data: memberData, error: memberError } = await supabase
      .from("group_members")
      .insert([
        {
          group_id: groupId,
          user_id: userId,
          role: "player",
          is_active: true,
        },
      ])
      .select()
      .single();

    if (memberError) throw memberError;

    // Erstelle ein Inventar für den Spieler
    const { error: inventoryError } = await supabase
      .from("group_inventories")
      .insert([
        {
          group_id: groupId,
          user_id: userId,
        },
      ]);

    if (inventoryError) {
      // Wenn das Erstellen des Inventars fehlschlägt, entferne das Mitglied wieder
      await supabase
        .from("group_members")
        .delete()
        .match({ group_id: groupId, user_id: userId });

      throw inventoryError;
    }

    return memberData;
  } catch (error) {
    console.error("Error inviting to group:", error);
    throw error;
  }
}

export async function getGroupMembers(groupId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select(
      `
      *,
      users (
        id,
        username,
        avatar_url
      )
    `
    )
    .eq("group_id", groupId);

  if (error) throw error;
  return data || [];
}

export async function isDungeonMaster(
  groupId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (error) return false;
  return data.role === "dm";
}

export async function updateUserRole(
  groupId: string,
  userId: string,
  newRole: "player" | "dm"
) {
  try {
    const { error: updateError } = await supabase
      .from("group_members")
      .update({ role: newRole })
      .eq("group_id", groupId)
      .eq("user_id", userId);

    if (updateError) throw updateError;

    // Wenn der Benutzer zum DM wird, lösche sein Inventar
    if (newRole === "dm") {
      const { error: deleteError } = await supabase
        .from("group_inventories")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId);

      if (deleteError) throw deleteError;
    } else {
      // Wenn der Benutzer zum Spieler wird, erstelle ein Inventar
      const { error: createError } = await supabase
        .from("group_inventories")
        .insert([
          {
            group_id: groupId,
            user_id: userId,
          },
        ]);

      if (createError) throw createError;
    }
  } catch (error) {
    console.error("Error updating user role:", error);
    throw error;
  }
}

export async function updateItemQuantity(
  itemId: string,
  quantityChange: number,
  userId: string,
  isDM: boolean
): Promise<void> {
  try {
    // Verwende die RPC-Funktion für das Update
    const { error } = await supabase.rpc("update_inventory_item_quantity", {
      p_item_id: itemId,
      p_quantity_change: quantityChange,
    });

    if (error) throw error;
  } catch (error) {
    throw error;
  }
}

export async function searchItems(
  searchTerm: string,
  groupId: string
): Promise<Item[]> {
  try {
    // Suche in der items Tabelle
    const { data: standardItems, error: standardError } = await supabase
      .from("items")
      .select("*")
      .ilike("name", `%${searchTerm}%`)
      .order("name");

    if (standardError) throw standardError;

    // Suche in der custom_items Tabelle
    const { data: customItems, error: customError } = await supabase
      .from("custom_items")
      .select("*")
      .eq("group_id", groupId)
      .ilike("name", `%${searchTerm}%`)
      .order("name");

    if (customError) throw customError;

    // Kombiniere die Ergebnisse
    const allItems = [
      ...(standardItems || []),
      ...(customItems || []).map((item) => ({
        ...item,
        is_custom: true, // Optional: Markiere custom items
      })),
    ];

    // Sortiere nach Namen und limitiere auf 10 Ergebnisse
    return allItems.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 10);
  } catch (error) {
    console.error("Error searching items:", error);
    throw error;
  }
}

export async function createCustomItem(
  groupId: string,
  clerkUserId: string,
  itemData: {
    name: string;
    description: string;
    category: string;
    weight: number;
  }
): Promise<void> {
  try {
    // Hole direkt den Supabase User aus der users Tabelle
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user:", userError);
      throw new Error("User not found");
    }

    const { error } = await supabase.from("custom_items").insert([
      {
        ...itemData,
        group_id: groupId,
        created_by: userData.id,
      },
    ]);

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error creating custom item:", error);
    throw error;
  }
}

export async function getAvailableCategories(
  groupId: string
): Promise<string[]> {
  try {
    // Hole Kategorien von Standard-Items
    const { data: standardItems, error: standardError } = await supabase
      .from("items")
      .select("category")
      .order("category");

    if (standardError) throw standardError;

    // Hole Kategorien von Custom-Items
    const { data: customItems, error: customError } = await supabase
      .from("custom_items")
      .select("category")
      .eq("group_id", groupId)
      .order("category");

    if (customError) throw customError;

    // Kombiniere und entferne Duplikate
    const allCategories = [
      ...(standardItems || []).map((item) => item.category),
      ...(customItems || []).map((item) => item.category),
    ];

    const uniqueCategories = [...new Set(allCategories)].filter(Boolean);
    return uniqueCategories;
  } catch (error) {
    console.error("Error getting categories:", error);
    throw error;
  }
}

export async function getCustomItems(groupId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("custom_items")
    .select("*")
    .eq("group_id", groupId)
    .order("name");

  if (error) throw error;
  return data || [];
}

export async function deleteCustomItem(
  groupId: string,
  itemId: string
): Promise<void> {
  const { error } = await supabase
    .from("custom_items")
    .delete()
    .eq("id", itemId)
    .eq("group_id", groupId);

  if (error) throw error;
}

export async function updateCustomItem(
  groupId: string,
  item: {
    id: string;
    name: string;
    description: string;
    category: string;
    weight: number;
  }
): Promise<void> {
  const { error } = await supabase.from("custom_items").upsert(
    {
      // Verwende upsert statt update
      id: item.id, // ID muss hier mit angegeben werden
      group_id: groupId, // group_id muss hier mit angegeben werden
      name: item.name,
      description: item.description,
      category: item.category,
      weight: item.weight,
    },
    {
      onConflict: "id", // Update nur wenn ID existiert
      ignoreDuplicates: false,
    }
  );

  if (error) {
    console.error("Update error:", error);
    throw error;
  }
}

export async function updateInventoryCurrencies(
  inventoryId: string,
  currencies: Currency[]
): Promise<void> {
  try {
    // Zuerst prüfen, ob das Inventar existiert
    const { data: inventoryExists } = await supabase
      .from("group_inventories")
      .select("id")
      .eq("id", inventoryId)
      .single();

    if (!inventoryExists) {
      console.warn("Inventory not found:", inventoryId);
      return;
    }

    const currencyData = currencies.reduce((acc, curr) => {
      acc[curr.type] = curr.amount;
      return acc;
    }, {} as Record<string, number>);

    const { error } = await supabase.from("inventory_currencies").upsert(
      {
        inventory_id: inventoryId,
        ...currencyData,
      },
      {
        onConflict: "inventory_id",
      }
    );

    if (error) {
      console.error("Error updating currencies:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in updateInventoryCurrencies:", error);
    throw error;
  }
}

export async function getInventoryCurrencies(
  inventoryId: string
): Promise<Currency[]> {
  try {
    // Prüfe zuerst, ob das Inventar existiert
    const { data: inventoryExists } = await supabase
      .from("group_inventories")
      .select("id")
      .eq("id", inventoryId)
      .single();

    if (!inventoryExists) {
      console.warn("Inventory not found:", inventoryId);
      return [
        { type: "copper", amount: 0 },
        { type: "silver", amount: 0 },
        { type: "gold", amount: 0 },
        { type: "platinum", amount: 0 },
      ];
    }

    const { data, error } = await supabase
      .from("inventory_currencies")
      .select("*")
      .eq("inventory_id", inventoryId)
      .maybeSingle();

    // Wenn keine Daten gefunden wurden, erstelle einen neuen Eintrag
    if (!data) {
      const defaultCurrencies = {
        inventory_id: inventoryId,
        copper: 0,
        silver: 0,
        gold: 0,
        platinum: 0,
      };

      const { data: newData, error: insertError } = await supabase
        .from("inventory_currencies")
        .upsert(defaultCurrencies, {
          // Verwende upsert statt insert
          onConflict: "inventory_id",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating currencies:", insertError);
        return [
          { type: "copper", amount: 0 },
          { type: "silver", amount: 0 },
          { type: "gold", amount: 0 },
          { type: "platinum", amount: 0 },
        ];
      }

      return [
        { type: "copper", amount: newData.copper },
        { type: "silver", amount: newData.silver },
        { type: "gold", amount: newData.gold },
        { type: "platinum", amount: newData.platinum },
      ];
    }

    return [
      { type: "copper", amount: data.copper },
      { type: "silver", amount: data.silver },
      { type: "gold", amount: data.gold },
      { type: "platinum", amount: data.platinum },
    ];
  } catch (error) {
    console.error("Error in getInventoryCurrencies:", error);
    // Bei einem Fehler geben wir Standardwerte zurück
    return [
      { type: "copper", amount: 0 },
      { type: "silver", amount: 0 },
      { type: "gold", amount: 0 },
      { type: "platinum", amount: 0 },
    ];
  }
}

export function subscribeToInventoryChanges(
  inventoryIds: string[],
  onUpdate: () => void
) {
  const channel = supabase
    .channel("inventory-changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "inventory_items",
        filter: `inventory_id=in.(${inventoryIds.join(",")})`,
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function removeGroupMember(
  groupId: string,
  userId: string
): Promise<void> {
  try {
    // Lösche zuerst das Inventar des Mitglieds
    const { error: inventoryError } = await supabase
      .from("group_inventories")
      .delete()
      .match({ group_id: groupId, user_id: userId });

    if (inventoryError) throw inventoryError;

    // Dann entferne das Mitglied aus der Gruppe
    const { error: memberError } = await supabase
      .from("group_members")
      .delete()
      .match({ group_id: groupId, user_id: userId });

    if (memberError) throw memberError;
  } catch (error) {
    console.error("Error removing group member:", error);
    throw error;
  }
}

export async function updateMemberNickname(
  groupId: string,
  userId: string,
  nickname: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc("update_member_nickname", {
      p_group_id: groupId,
      p_user_id: userId,
      p_nickname: nickname,
    });

    if (error) throw error;
  } catch (error) {
    console.error("Error updating nickname:", error);
    throw error;
  }
}

export async function getUserGroupNotes(
  groupId: string,
  userId: string
): Promise<GroupNote[]> {
  try {
    const { data, error } = await supabase
      .from("group_notes")
      .select("*")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notes:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error in getUserGroupNotes:", error);
    throw error;
  }
}

export async function createGroupNote(
  groupId: string,
  userId: string,
  content: string,
  title?: string
): Promise<GroupNote> {
  try {
    // Debugging-Logs: Daten für die Anfrage
    console.log("Creating note with:", {
      groupId,
      userId,
      content,
      title,
    });

    // Daten in die Supabase-Tabelle einfügen
    const { data, error } = await supabase
      .from("group_notes")
      .insert([
        {
          group_id: groupId, // Gruppen-ID
          user_id: userId, // Benutzer-ID
          content, // Notizinhalt
          title, // Optionaler Titel
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating note:", error);
      throw error;
    }

    console.log("Note created successfully:", data);
    return data;
  } catch (error) {
    console.error("Error in createGroupNote:", error);
    throw error;
  }
}

export async function updateGroupNote(
  noteId: string,
  userId: string,
  updates: { content?: string; title?: string }
): Promise<void> {
  try {
    const { error } = await supabase
      .from("group_notes")
      .update(updates)
      .eq("id", noteId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating note:", error);
      throw error;
    }

    console.log("Note updated successfully:", noteId);
  } catch (error) {
    console.error("Error in updateGroupNote:", error);
    throw error;
  }
}

export async function deleteGroupNote(
  noteId: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("group_notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting note:", error);
      throw error;
    }

    console.log("Note deleted successfully:", noteId);
  } catch (error) {
    console.error("Error in deleteGroupNote:", error);
    throw error;
  }
}

export async function getUserInventoryItems(groupId: string, userId: string) {
  try {
    // Zuerst das Inventar des Users finden
    const { data: inventory, error: inventoryError } = await supabase
      .from('group_inventories')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (inventoryError) throw inventoryError;
    if (!inventory) throw new Error('Inventory not found');

    // Dann die Items des Inventars abrufen
    const { data: items, error: itemsError } = await supabase
      .from('inventory_items')
      .select(`
        id,
        quantity,
        items:all_items!inner(
          id,
          name,
          description,
          category,
          weight
        )
      `)
      .eq('inventory_id', inventory.id);

    if (itemsError) throw itemsError;
    return items || [];

  } catch (error) {
    console.error('Error fetching inventory items:', error);
    throw error;
  }
}
