// 本地数据存储：优先 IndexedDB，不可用时退回 localStorage。

const DB_NAME = 'fridge-keeper';
const STORE = 'items';
const LS_KEY = 'fridge-keeper:items';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => (result = r));
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const ls = {
  all() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch {
      return [];
    }
  },
  save(items) {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  },
};

async function withFallback(idbFn, lsFn) {
  try {
    const db = await openDB();
    return await idbFn(db);
  } catch {
    return lsFn();
  }
}

export function getAll() {
  return withFallback(
    (db) =>
      tx(db, 'readonly', (s) => {
        return new Promise((res) => {
          const r = s.getAll();
          r.onsuccess = () => res(r.result);
        });
      }),
    () => ls.all(),
  );
}

export function put(item) {
  return withFallback(
    (db) => tx(db, 'readwrite', (s) => void s.put(item)),
    () => {
      const items = ls.all().filter((i) => i.id !== item.id);
      items.push(item);
      ls.save(items);
    },
  );
}

export function putMany(list) {
  return withFallback(
    (db) => tx(db, 'readwrite', (s) => list.forEach((i) => s.put(i))),
    () => {
      const map = new Map(ls.all().map((i) => [i.id, i]));
      list.forEach((i) => map.set(i.id, i));
      ls.save([...map.values()]);
    },
  );
}

export function remove(id) {
  return withFallback(
    (db) => tx(db, 'readwrite', (s) => void s.delete(id)),
    () => ls.save(ls.all().filter((i) => i.id !== id)),
  );
}

export function clearAll() {
  return withFallback(
    (db) => tx(db, 'readwrite', (s) => void s.clear()),
    () => ls.save([]),
  );
}
