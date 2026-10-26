// Web keeps offline photo bytes outside localStorage's small synchronous quota.
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('couples-budget-receipts-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
const key = (user: string, household: string, id: string) => `${user}:${household}:${id}`;
async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', mode); const request = work(tx.objectStore('photos'));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Receipt storage unavailable')); };
  });
}
export async function saveReceipt(user: string, household: string, id: string, uri: string) {
  const bytes = await (await fetch(uri)).arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 5242880) throw new Error('Receipt too large');
  await transaction('readwrite', store => store.put(bytes, key(user, household, id)));
}
export async function readReceipt(user: string, household: string, id: string): Promise<ArrayBuffer> {
  const bytes = await transaction('readonly', store => store.get(key(user, household, id)));
  if (!(bytes instanceof ArrayBuffer)) throw new Error('Receipt missing');
  return bytes;
}
export async function deleteReceipt(user: string, household: string, id: string) {
  await transaction('readwrite', store => store.delete(key(user, household, id)));
}
