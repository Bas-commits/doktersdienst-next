'use client';

import { createContext, useContext } from 'react';

const DeelnemerProfileContext = createContext<string | null>(null);

export function DeelnemerProfileProvider({
  displayName,
  children,
}: {
  displayName: string;
  children: React.ReactNode;
}) {
  return (
    <DeelnemerProfileContext.Provider value={displayName}>{children}</DeelnemerProfileContext.Provider>
  );
}

/** Resolved display name from deelnemer profile (voornaam/achternaam), not login email. */
export function useDeelnemerDisplayName(fallback = 'daar'): string {
  const displayName = useContext(DeelnemerProfileContext);
  return displayName ?? fallback;
}
