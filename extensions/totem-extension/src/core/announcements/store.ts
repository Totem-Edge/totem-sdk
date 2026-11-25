import {
  EXTENSION_UPDATE_STORAGE_KEY,
  UPDATE_ANNOUNCEMENT_ID,
  getUpdateAnnouncement,
} from './updateCheck';

export interface Announcement {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
  priority: number;
  status: 'draft' | 'active' | 'archived';
  updated_at: string;
}

interface AnnouncementStore {
  announcements: Announcement[];
  dismissed: { [id: number]: string }; // id -> updated_at when dismissed
  showAnnouncements: boolean;
  lastFetch: number;
}

const STORAGE_KEY = 'totem_announcements_store';

async function getStore(): Promise<AnnouncementStore> {
  try {
    const result = await chrome.storage.local.getTyped(STORAGE_KEY);
    return result[STORAGE_KEY] || {
      announcements: [],
      dismissed: {},
      showAnnouncements: true,
      lastFetch: 0
    };
  } catch {
    return {
      announcements: [],
      dismissed: {},
      showAnnouncements: true,
      lastFetch: 0
    };
  }
}

async function setStore(store: AnnouncementStore): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

export async function getAnnouncements(): Promise<Announcement[]> {
  const [store, update] = await Promise.all([getStore(), getUpdateAnnouncement()]);
  // A critical extension update is not Axia news: keep it visible even when
  // the user has hidden the Axia announcement feed.
  const source = store.showAnnouncements
    ? (update ? [update, ...store.announcements] : store.announcements)
    : (update ? [update] : []);
  return source.filter(a => {
    const dismissedAt = store.dismissed[a.id];
    if (!dismissedAt) return true;
    return a.updated_at !== dismissedAt;
  });
}

export async function getAllAnnouncementsRaw(): Promise<Announcement[]> {
  const store = await getStore();
  return store.announcements;
}

export async function setAnnouncements(announcements: Announcement[]): Promise<void> {
  const store = await getStore();
  store.announcements = announcements;
  store.lastFetch = Date.now();
  await setStore(store);
}

export async function upsertAnnouncement(announcement: Announcement): Promise<void> {
  const store = await getStore();
  const index = store.announcements.findIndex(a => a.id === announcement.id);
  if (index >= 0) {
    store.announcements[index] = announcement;
  } else {
    store.announcements.push(announcement);
  }
  store.announcements.sort((a, b) => b.priority - a.priority);
  await setStore(store);
}

export async function archiveAnnouncement(id: number): Promise<void> {
  const store = await getStore();
  store.announcements = store.announcements.filter(a => a.id !== id);
  delete store.dismissed[id];
  await setStore(store);
}

export async function dismissAnnouncement(id: number): Promise<void> {
  const store = await getStore();
  let announcement = store.announcements.find(a => a.id === id);
  if (!announcement && id === UPDATE_ANNOUNCEMENT_ID) {
    announcement = (await getUpdateAnnouncement()) || undefined;
  }
  if (announcement) {
    store.dismissed[id] = announcement.updated_at;
  }
  await setStore(store);
}

export async function getShowAnnouncements(): Promise<boolean> {
  const store = await getStore();
  return store.showAnnouncements;
}

export async function setShowAnnouncements(show: boolean): Promise<void> {
  const store = await getStore();
  store.showAnnouncements = show;
  await setStore(store);
}

export function onAnnouncementStoreChange(callback: () => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes[STORAGE_KEY] || changes[EXTENSION_UPDATE_STORAGE_KEY]) {
      callback();
    }
  };
  chrome.storage.local.onChanged.addListener(listener);
  return () => chrome.storage.local.onChanged.removeListener(listener);
}
