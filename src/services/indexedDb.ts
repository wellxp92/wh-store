import { Product, StoreSettings } from '../types';

const DB_NAME = 'wh_store_db_v1';
const DB_VERSION = 1;
const SETTINGS_STORE = 'store_settings';
const PRODUCTS_STORE = 'products';
const SETTINGS_KEY = 'wh_store_catalog_settings';

/**
 * Opens or initializes the WH Store IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado neste navegador.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error || new Error('Falha ao abrir IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }

      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        db.createObjectStore(PRODUCTS_STORE, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Saves complete store settings (with full-fidelity high-resolution images) to IndexedDB.
 * IndexedDB has gigabytes of storage capacity, eliminating browser 5MB localStorage limits.
 */
export async function saveStoreSettingsToIndexedDB(settings: StoreSettings): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SETTINGS_STORE, PRODUCTS_STORE], 'readwrite');
      const settingsStore = tx.objectStore(SETTINGS_STORE);
      const productsStore = tx.objectStore(PRODUCTS_STORE);

      settingsStore.put(settings, SETTINGS_KEY);

      // Also persist each product individually for fast single-entity retrieval
      if (Array.isArray(settings.products)) {
        for (const prod of settings.products) {
          if (prod && prod.id) {
            productsStore.put(prod);
          }
        }
      }

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        console.warn('[IndexedDB] Erro na transação de salvamento:', tx.error);
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Aviso ao persistir dados no banco local:', err);
  }
}

/**
 * Loads complete store settings from IndexedDB
 */
export async function loadStoreSettingsFromIndexedDB(): Promise<StoreSettings | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readonly');
      const store = tx.objectStore(SETTINGS_STORE);
      const request = store.get(SETTINGS_KEY);

      request.onsuccess = () => {
        const result = request.result;
        if (result && typeof result === 'object' && Array.isArray(result.products)) {
          resolve(result as StoreSettings);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Aviso ao recuperar dados do banco local:', err);
    return null;
  }
}

/**
 * Saves a single product to IndexedDB
 */
export async function saveProductToIndexedDB(product: Product): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PRODUCTS_STORE, 'readwrite');
      const store = tx.objectStore(PRODUCTS_STORE);
      store.put(product);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Aviso ao salvar produto individual no IndexedDB:', err);
  }
}

/**
 * Deletes a product from IndexedDB
 */
export async function deleteProductFromIndexedDB(productId: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PRODUCTS_STORE, 'readwrite');
      const store = tx.objectStore(PRODUCTS_STORE);
      store.delete(productId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Aviso ao excluir produto no IndexedDB:', err);
  }
}
