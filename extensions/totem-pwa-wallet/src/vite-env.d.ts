/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare module 'virtual:pwa-register/react' {
  import type { Ref } from 'react';
  export type RegisterSWOptions = {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  };
  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    offlineReady: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
