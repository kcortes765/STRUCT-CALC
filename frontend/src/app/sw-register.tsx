'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Unregister any existing Service Workers (offline mode disabled)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
          console.log('[App] Service Worker unregistered');
        });
      });
    }

    // Initialize IndexedDB for calculation history
    const initializeDB = async () => {
      try {
        const { initDB } = await import('../lib/db');
        await initDB();
        console.log('[App] IndexedDB initialized for history');
      } catch (error) {
        console.error('[App] IndexedDB initialization failed:', error);
      }
    };

    initializeDB();
  }, []);

  return null;
}
