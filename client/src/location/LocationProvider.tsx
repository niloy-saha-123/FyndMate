import React, { createContext, useContext, ReactNode } from 'react';
import { useLocation } from '@/src/hooks/useLocation';

type LocationContextValue = ReturnType<typeof useLocation>;

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <LocationContext.Provider value={location}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useLocationContext must be used inside LocationProvider');
  }
  return ctx;
}

