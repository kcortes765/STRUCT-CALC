/**
 * IndexedDB wrapper for offline data storage
 * Stores sections, materials, and calculation history
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SteelSection, SteelMaterial, BeamAnalysisResult, ColumnAnalysisResult } from './types';

// Database schema
interface StructCalcDB extends DBSchema {
  sections: {
    key: string;
    value: SteelSection;
    indexes: { 'by-type': string; 'by-catalog': string };
  };
  materials: {
    key: string;
    value: SteelMaterial;
  };
  calculations: {
    key: number;
    value: Calculation;
    indexes: { 'by-date': Date; 'by-type': string };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: unknown;
      timestamp: number;
    };
  };
}

// Calculation storage type
export interface Calculation {
  id?: number;
  type: 'beam' | 'column' | 'frame';
  timestamp: Date;
  name?: string;
  notes?: string;
  result: BeamAnalysisResult | ColumnAnalysisResult | unknown;
}

const DB_NAME = 'struct-calc-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<StructCalcDB> | null = null;

/**
 * Initialize the database
 */
export async function initDB(): Promise<IDBPDatabase<StructCalcDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<StructCalcDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      console.log('[DB] Upgrading database...');

      // Create sections store
      if (!db.objectStoreNames.contains('sections')) {
        const sectionsStore = db.createObjectStore('sections', { keyPath: 'id' });
        sectionsStore.createIndex('by-type', 'type');
        sectionsStore.createIndex('by-catalog', 'catalog');
        console.log('[DB] Created sections store');
      }

      // Create materials store
      if (!db.objectStoreNames.contains('materials')) {
        db.createObjectStore('materials', { keyPath: 'id' });
        console.log('[DB] Created materials store');
      }

      // Create calculations store
      if (!db.objectStoreNames.contains('calculations')) {
        const calcStore = db.createObjectStore('calculations', {
          keyPath: 'id',
          autoIncrement: true
        });
        calcStore.createIndex('by-date', 'timestamp');
        calcStore.createIndex('by-type', 'type');
        console.log('[DB] Created calculations store');
      }

      // Create metadata store for cache timestamps
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
        console.log('[DB] Created metadata store');
      }
    },
    blocked() {
      console.warn('[DB] Database upgrade blocked');
    },
    blocking() {
      console.warn('[DB] Database blocking other connections');
    },
  });

  console.log('[DB] Database initialized successfully');
  return dbInstance;
}

// ==================== SECTIONS ====================

/**
 * Cache sections in IndexedDB
 */
export async function cacheSections(sections: SteelSection[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('sections', 'readwrite');

  try {
    await Promise.all([
      ...sections.map(section => tx.store.put(section)),
      tx.done
    ]);

    // Update metadata
    await setMetadata('sections_cached_at', Date.now());

    console.log(`[DB] Cached ${sections.length} sections`);
  } catch (error) {
    console.error('[DB] Error caching sections:', error);
    throw error;
  }
}

/**
 * Get all cached sections
 */
export async function getOfflineSections(): Promise<SteelSection[]> {
  const db = await initDB();
  const sections = await db.getAll('sections');
  console.log(`[DB] Retrieved ${sections.length} cached sections`);
  return sections;
}

/**
 * Get sections by type
 */
export async function getOfflineSectionsByType(type: string): Promise<SteelSection[]> {
  const db = await initDB();
  const sections = await db.getAllFromIndex('sections', 'by-type', type);
  return sections;
}

/**
 * Get section by ID
 */
export async function getOfflineSection(id: string): Promise<SteelSection | undefined> {
  const db = await initDB();
  return await db.get('sections', id);
}

/**
 * Search sections offline (simple text search)
 */
export async function searchOfflineSections(query: string): Promise<SteelSection[]> {
  const sections = await getOfflineSections();
  const lowerQuery = query.toLowerCase();

  return sections.filter(section =>
    section.id.toLowerCase().includes(lowerQuery)
  );
}

// ==================== MATERIALS ====================

/**
 * Cache materials in IndexedDB
 */
export async function cacheMaterials(materials: SteelMaterial[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('materials', 'readwrite');

  try {
    await Promise.all([
      ...materials.map(material => tx.store.put(material)),
      tx.done
    ]);

    // Update metadata
    await setMetadata('materials_cached_at', Date.now());

    console.log(`[DB] Cached ${materials.length} materials`);
  } catch (error) {
    console.error('[DB] Error caching materials:', error);
    throw error;
  }
}

/**
 * Get all cached materials
 */
export async function getOfflineMaterials(): Promise<SteelMaterial[]> {
  const db = await initDB();
  const materials = await db.getAll('materials');
  console.log(`[DB] Retrieved ${materials.length} cached materials`);
  return materials;
}

/**
 * Get material by ID
 */
export async function getOfflineMaterial(id: string): Promise<SteelMaterial | undefined> {
  const db = await initDB();
  return await db.get('materials', id);
}

// ==================== CALCULATIONS ====================

/**
 * Save a calculation to history
 */
export async function saveCalculation(calc: Calculation): Promise<number> {
  const db = await initDB();

  const calculationToSave = {
    ...calc,
    timestamp: calc.timestamp || new Date(),
  };

  const id = await db.add('calculations', calculationToSave);
  console.log(`[DB] Saved calculation with ID ${id}`);
  return id;
}

/**
 * Get recent calculations
 */
export async function getCalculations(limit?: number): Promise<Calculation[]> {
  const db = await initDB();
  const tx = db.transaction('calculations', 'readonly');
  const index = tx.store.index('by-date');

  let calculations = await index.getAll();

  // Sort by date descending (most recent first)
  calculations.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (limit) {
    calculations = calculations.slice(0, limit);
  }

  console.log(`[DB] Retrieved ${calculations.length} calculations`);
  return calculations;
}

/**
 * Get calculations by type
 */
export async function getCalculationsByType(type: 'beam' | 'column' | 'frame'): Promise<Calculation[]> {
  const db = await initDB();
  const calculations = await db.getAllFromIndex('calculations', 'by-type', type);

  // Sort by date descending
  calculations.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return calculations;
}

/**
 * Get a specific calculation by ID
 */
export async function getCalculationById(id: number): Promise<Calculation | undefined> {
  const db = await initDB();
  return await db.get('calculations', id);
}

/**
 * Delete a calculation
 */
export async function deleteCalculation(id: number): Promise<void> {
  const db = await initDB();
  await db.delete('calculations', id);
  console.log(`[DB] Deleted calculation ${id}`);
}

/**
 * Clear all calculations
 */
export async function clearCalculations(): Promise<void> {
  const db = await initDB();
  await db.clear('calculations');
  console.log('[DB] Cleared all calculations');
}

// ==================== METADATA ====================

/**
 * Set metadata value
 */
async function setMetadata(key: string, value: unknown): Promise<void> {
  const db = await initDB();
  await db.put('metadata', {
    key,
    value,
    timestamp: Date.now()
  });
}

/**
 * Get metadata value
 */
export async function getMetadata(key: string): Promise<unknown | undefined> {
  const db = await initDB();
  const entry = await db.get('metadata', key);
  return entry?.value;
}

/**
 * Check if cached data is stale (older than specified hours)
 */
export async function isCacheStale(key: string, maxAgeHours: number = 24): Promise<boolean> {
  const cachedAt = await getMetadata(`${key}_cached_at`) as number | undefined;

  if (!cachedAt) {
    return true; // No cache exists
  }

  const ageHours = (Date.now() - cachedAt) / (1000 * 60 * 60);
  return ageHours > maxAgeHours;
}

// ==================== UTILITIES ====================

/**
 * Clear all data from the database
 */
export async function clearAllData(): Promise<void> {
  const db = await initDB();

  await Promise.all([
    db.clear('sections'),
    db.clear('materials'),
    db.clear('calculations'),
    db.clear('metadata')
  ]);

  console.log('[DB] Cleared all data');
}

/**
 * Get database statistics
 */
export async function getDBStats(): Promise<{
  sections: number;
  materials: number;
  calculations: number;
  sectionsLastCached?: Date;
  materialsLastCached?: Date;
}> {
  const db = await initDB();

  const [sections, materials, calculations] = await Promise.all([
    db.count('sections'),
    db.count('materials'),
    db.count('calculations')
  ]);

  const sectionsTimestamp = await getMetadata('sections_cached_at') as number | undefined;
  const materialsTimestamp = await getMetadata('materials_cached_at') as number | undefined;

  return {
    sections,
    materials,
    calculations,
    sectionsLastCached: sectionsTimestamp ? new Date(sectionsTimestamp) : undefined,
    materialsLastCached: materialsTimestamp ? new Date(materialsTimestamp) : undefined
  };
}
