/**
 * @file client/src/contexts/TabBadgeContext.tsx
 * @description Context for tab bar notification indicators (dot only, no count).
 * Used by Messages and Requests tabs to drive when the dot is shown/hidden.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

type TabBadgeState = {
  messagesUnread: number;
  pendingRequests: number;
  setMessagesUnread: (n: number) => void;
  setPendingRequests: (n: number) => void;
};

const TabBadgeContext = createContext<TabBadgeState | null>(null);

export function TabBadgeProvider({ children }: { children: React.ReactNode }) {
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  return (
    <TabBadgeContext.Provider
      value={{
        messagesUnread,
        pendingRequests,
        setMessagesUnread: useCallback((n: number) => setMessagesUnread(n), []),
        setPendingRequests: useCallback((n: number) => setPendingRequests(n), []),
      }}
    >
      {children}
    </TabBadgeContext.Provider>
  );
}

export function useTabBadge() {
  const ctx = useContext(TabBadgeContext);
  if (!ctx) {
    return {
      messagesUnread: 0,
      pendingRequests: 0,
      setMessagesUnread: () => {},
      setPendingRequests: () => {},
    };
  }
  return ctx;
}
