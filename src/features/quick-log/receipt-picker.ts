import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync } from 'expo-image-picker';

export async function pickReceipt(camera = false) {
  if (camera && !(await requestCameraPermissionsAsync()).granted) throw new Error('Camera permission denied');
  const result = await (camera ? launchCameraAsync : launchImageLibraryAsync)({ mediaTypes: ['images'], exif: false, allowsEditing: false, quality: 0.85 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  const longest = Math.max(asset.width, asset.height);
  if (longest > 2000) context.resize(asset.width >= asset.height ? { width: 2000 } : { height: 2000 });
  const image = await context.renderAsync();
  try { return await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 }); }
  finally { image.release(); context.release(); }
}
