/**
 * Teacher-held NVIDIA NIM credentials, following the NekoCore profile
 * pattern (`adapters/config.ts`: nvidia → integrate.api.nvidia.com/v1,
 * default model z-ai/glm-5.2): the key lives ONLY in this browser's
 * localStorage and rides each request as a header through the NekoPath
 * relay — the server forwards it to NVIDIA and never stores or logs it.
 */

const KEY_STORAGE = 'nekopath.nvidia.apiKey';
const MODEL_STORAGE = 'nekopath.nvidia.model';

export const NVIDIA_DEFAULT_MODEL = 'z-ai/glm-5.2';
export const NVIDIA_KEY_HEADER = 'x-nvidia-api-key';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function nvidiaApiKey(): string {
  return storage()?.getItem(KEY_STORAGE)?.trim() ?? '';
}

export function saveNvidiaApiKey(key: string): void {
  const cleaned = key.trim();
  if (cleaned) storage()?.setItem(KEY_STORAGE, cleaned);
  else storage()?.removeItem(KEY_STORAGE);
}

export function clearNvidiaApiKey(): void {
  storage()?.removeItem(KEY_STORAGE);
}

export function nvidiaModel(): string {
  return storage()?.getItem(MODEL_STORAGE)?.trim() || NVIDIA_DEFAULT_MODEL;
}

export function saveNvidiaModel(model: string): void {
  const cleaned = model.trim();
  if (cleaned && cleaned !== NVIDIA_DEFAULT_MODEL) storage()?.setItem(MODEL_STORAGE, cleaned);
  else storage()?.removeItem(MODEL_STORAGE);
}

/** Headers for the NekoPath NVIDIA relay; empty when no key is saved. */
export function nvidiaHeaders(): Record<string, string> {
  const key = nvidiaApiKey();
  return key ? { [NVIDIA_KEY_HEADER]: key } : {};
}
