let memoryToken: string | null = null;

function getSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export const cribbitSessionTokenStore = {
  get(): string | null {
    const storage = getSessionStorage();
    if (!storage) return memoryToken;
    return storage.getItem('cribbit.sessionToken') || memoryToken;
  },
  set(token: string): void {
    memoryToken = token;
    getSessionStorage()?.setItem('cribbit.sessionToken', token);
  },
  clear(): void {
    memoryToken = null;
    getSessionStorage()?.removeItem('cribbit.sessionToken');
  }
};
