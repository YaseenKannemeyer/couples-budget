import { Directory, File, Paths } from 'expo-file-system';
const directory = (user: string, household: string) => new Directory(Paths.document, 'expense-receipts', user, household);
const file = (user: string, household: string, id: string) => new File(directory(user, household), `${id}.jpg`);
export async function saveReceipt(user: string, household: string, id: string, uri: string) {
  const source = new File(uri);
  if (!source.size || source.size > 5242880) throw new Error('Receipt too large');
  await directory(user, household).create({ idempotent: true, intermediates: true });
  const destination = file(user, household, id);
  await source.copy(destination, { overwrite: true });
}
export async function readReceipt(user: string, household: string, id: string) {
  const saved = file(user, household, id);
  if (!saved.exists) throw new Error('Receipt missing');
  return saved.arrayBuffer();
}
export async function deleteReceipt(user: string, household: string, id: string) {
  const saved = file(user, household, id);
  if (saved.exists) await saved.delete();
}
