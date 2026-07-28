import { useState, useEffect, useCallback } from 'react';
import { 
  getAnnouncements, 
  dismissAnnouncement, 
  getShowAnnouncements,
  setShowAnnouncements,
  onAnnouncementStoreChange,
  type Announcement 
} from '../../core/announcements/store';

interface UseAnnouncementsReturn {
  announcements: Announcement[];
  showAnnouncements: boolean;
  loading: boolean;
  dismiss: (id: number) => Promise<void>;
  toggleShowAnnouncements: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAnnouncements(): UseAnnouncementsReturn {
  const [announcements, setAnnouncementsState] = useState<Announcement[]>([]);
  const [showAnnouncements, setShowAnnouncementsState] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [anncs, show] = await Promise.all([
        getAnnouncements(),
        getShowAnnouncements()
      ]);
      setAnnouncementsState(anncs);
      setShowAnnouncementsState(show);
    } catch (e) {
      console.error('[useAnnouncements] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = onAnnouncementStoreChange(loadData);
    return unsubscribe;
  }, [loadData]);

  const dismiss = useCallback(async (id: number) => {
    await dismissAnnouncement(id);
    await loadData();
  }, [loadData]);

  const toggleShowAnnouncements = useCallback(async () => {
    const newValue = !showAnnouncements;
    await setShowAnnouncements(newValue);
    setShowAnnouncementsState(newValue);
    if (newValue) {
      await loadData();
    } else {
      setAnnouncementsState([]);
    }
  }, [showAnnouncements, loadData]);

  return {
    announcements,
    showAnnouncements,
    loading,
    dismiss,
    toggleShowAnnouncements,
    refresh: loadData
  };
}
