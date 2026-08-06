import * as SecureStore from "expo-secure-store";

export async function saveSecure(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.error("[storage] saveSecure failed:", err);
  }
}

export async function getSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.error("[storage] getSecure failed:", err);
    return null;
  }
}
