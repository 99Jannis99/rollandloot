import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://digpdyxoyxbmzypretli.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpZ3BkeXhveXhibXp5cHJldGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIxOTIyMTQsImV4cCI6MjA0Nzc2ODIxNH0.Jw-QZyz52jjmY9FzbaXhU9Kq3OnEg5W4yfcfbbyN5O4';

const supabase = createClient(supabaseUrl, supabaseKey);

// Mapping von D&D API Kategorien zu unseren Icon-Kategorien
const categoryMapping: { [key: string]: string } = {
  'Weapon': 'Weapon',
  'Armor': 'Armor',
  'Adventuring Gear': 'Adventuring Gear',
  'Tools': 'Tools',
  'Mounts and Other Vehicles': 'Mounts and Vehicles',
  'Potion': 'Potion',
  'Ring': 'Ring',
  'Rod': 'Rod',
  'Scroll': 'Scroll',
  'Staff': 'Staff',
  'Wand': 'Wand',
  'Wondrous Item': 'Wonderous',
  'Magic Item': 'Magic Item'
};

// Icon-Mapping für verschiedene Item-Kategorien
const categoryIcons: { [key: string]: string } = {
  'Weapon': '/icons/sword.svg',
  'Armor': '/icons/shield.svg',
  'Adventuring Gear': '/icons/backpack.svg',
  'Tools': '/icons/tools.svg',
  'Mounts and Vehicles': '/icons/horse.svg',
  'Potion': '/icons/potion.svg',
  'Ring': '/icons/ring.svg',
  'Rod': '/icons/staff.svg',
  'Scroll': '/icons/scroll.svg',
  'Staff': '/icons/staff.svg',
  'Wand': '/icons/wand.svg',
  'Wonderous': '/icons/gem.svg',
  'Magic Item': '/icons/wand.svg',
  'default': '/icons/item.svg'
};

interface DndItem {
  index: string;
  name: string;
  equipment_category: {
    name: string;
  };
  cost: {
    quantity: number;
    unit: string;
  };
  weight?: number;
  desc?: string[];
  armor_class?: {
    base: number;
    dex_bonus?: boolean;
  };
  damage?: {
    damage_dice?: string;
    damage_type?: {
      name: string;
    };
  };
}

async function fetchAllItems(): Promise<DndItem[]> {
  try {
    const allItems: DndItem[] = [];

    // 1. Normale Ausrüstung
    const equipResponse = await fetch('https://www.dnd5eapi.co/api/equipment');
    const equipData = await equipResponse.json();
    
    // 2. Waffen spezifisch
    const weaponsResponse = await fetch('https://www.dnd5eapi.co/api/equipment-categories/weapon');
    const weaponsData = await weaponsResponse.json();
    
    // 3. Rüstungen spezifisch
    const armorResponse = await fetch('https://www.dnd5eapi.co/api/equipment-categories/armor');
    const armorData = await armorResponse.json();
    
    // 4. Magische Gegenstände
    const magicResponse = await fetch('https://www.dnd5eapi.co/api/magic-items');
    const magicData = await magicResponse.json();

    // Sammle alle Indices
    const allIndices = new Set([
      ...equipData.results.map((r: any) => r.index),
      ...weaponsData.equipment.map((r: any) => r.index),
      ...armorData.equipment.map((r: any) => r.index),
      ...magicData.results.map((r: any) => r.index)
    ]);

    // Hole Details für alle Items
    for (const index of allIndices) {
      try {
        // Versuche zuerst als normales Equipment
        const itemResponse = await fetch(`https://www.dnd5eapi.co/api/equipment/${index}`);
        if (itemResponse.ok) {
          const item = await itemResponse.json();
          
          // Füge zusätzliche Beschreibungen für Waffen und Rüstungen hinzu
          if (item.armor_class) {
            const armorDesc = `Armor Class: ${item.armor_class.base}${item.armor_class.dex_bonus ? ' + Dex modifier' : ''}`;
            item.desc = item.desc || [];
            item.desc.push(armorDesc);
          }
          
          if (item.damage) {
            const damageDesc = `Damage: ${item.damage.damage_dice || ''} ${item.damage.damage_type?.name || ''}`;
            item.desc = item.desc || [];
            item.desc.push(damageDesc);
          }
          
          allItems.push(item);
          continue;
        }

        // Versuche als magisches Item
        const magicItemResponse = await fetch(`https://www.dnd5eapi.co/api/magic-items/${index}`);
        if (magicItemResponse.ok) {
          const magicItem = await magicItemResponse.json();
          allItems.push({
            ...magicItem,
            equipment_category: { name: 'Magic Item' },
            cost: { quantity: 0, unit: 'gp' },
            weight: 0
          });
        }
      } catch (err) {
        console.error(`Failed to fetch item details for ${index}:`, err);
      }
    }

    return allItems;
  } catch (error) {
    console.error('Error fetching items:', error);
    throw error;
  }
}

async function importItems() {
  try {
    // Lösche zuerst alle vorhandenen Items
    const { error: deleteError } = await supabase
      .from('items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('Error deleting existing items:', deleteError);
      return;
    }

    console.log('Existing items deleted successfully');

    const dndItems = await fetchAllItems();
    let successCount = 0;
    let errorCount = 0;
    
    for (const item of dndItems) {
      const originalCategory = item.equipment_category.name;
      const mappedCategory = categoryMapping[originalCategory] || 'default';
      const iconPath = categoryIcons[mappedCategory];
      
      console.log(`Processing item: ${item.name}`);
      console.log(`Original category: ${originalCategory}`);
      console.log(`Mapped category: ${mappedCategory}`);
      console.log(`Icon path: ${iconPath}`);
      
      try {
        const { error } = await supabase
          .from('items')
          .insert([{
            name: item.name,
            description: item.desc ? item.desc.join('\n') : '',
            category: mappedCategory,
            weight: item.weight || 0,
            cost: item.cost?.quantity || 0,
            icon_url: iconPath
          }]);

        if (error) {
          console.error(`Error inserting item ${item.name}:`, error);
          errorCount++;
          continue;
        }

        successCount++;
        console.log(`Successfully imported: ${item.name} with icon ${iconPath}`);
      } catch (err) {
        console.error(`Failed to import item ${item.name}:`, err);
        errorCount++;
      }
    }

    console.log(`Import completed! Successfully imported ${successCount} items, failed to import ${errorCount} items.`);
  } catch (error) {
    console.error('Error during import:', error);
  }
}

await importItems(); 