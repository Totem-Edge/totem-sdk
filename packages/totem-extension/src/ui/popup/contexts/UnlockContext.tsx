import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface UnlockContextState {
  isOpen: boolean;
  error: string | null;
  reason: string;
  pendingAction: (() => Promise<void>) | null;
}

export interface UnlockContextValue extends UnlockContextState {
  openUnlock: (reason: string, retryAction?: () => Promise<void>) => void;
  closeUnlock: () => void;
  setError: (error: string | null) => void;
  clearPendingAction: () => void;
}

const UnlockContext = createContext<UnlockContextValue | null>(null);

export function UnlockProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UnlockContextState>({
    isOpen: false,
    error: null,
    reason: '',
    pendingAction: null,
  });

  const openUnlock = useCallback((reason: string, retryAction?: () => Promise<void>) => {
    console.log('[UnlockContext] Opening unlock modal:', reason);
    setState({
      isOpen: true,
      error: null,
      reason,
      pendingAction: retryAction || null,
    });
  }, []);

  const closeUnlock = useCallback(() => {
    console.log('[UnlockContext] Closing unlock modal');
    setState(prev => ({
      ...prev,
      isOpen: false,
      error: null,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({
      ...prev,
      error,
    }));
  }, []);

  const clearPendingAction = useCallback(() => {
    setState(prev => ({
      ...prev,
      pendingAction: null,
    }));
  }, []);

  return (
    <UnlockContext.Provider value={{
      ...state,
      openUnlock,
      closeUnlock,
      setError,
      clearPendingAction,
    }}>
      {children}
    </UnlockContext.Provider>
  );
}

export function useUnlock(): UnlockContextValue {
  const context = useContext(UnlockContext);
  if (!context) {
    throw new Error('useUnlock must be used within an UnlockProvider');
  }
  return context;
}
