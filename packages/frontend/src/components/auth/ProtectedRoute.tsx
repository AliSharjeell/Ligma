'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const STORAGE_KEY = 'ligma-auth';

function isAuthStored(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return !!stored;
  } catch {
    return false;
  }
}

/**
 * ProtectedRoute component that guards routes requiring authentication.
 * Redirects unauthenticated users to /auth page.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const storeAuth = useAuthStore((state) => state.isAuthenticated);
  const [isAuth, setIsAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage directly for auth state
    const stored = isAuthStored();
    setIsAuth(stored);
    setIsLoading(false);

    if (!stored) {
      router.replace('/auth');
    }
  }, [router]);

  // Also subscribe to store changes
  useEffect(() => {
    if (!isLoading && !storeAuth) {
      router.replace('/auth');
    }
  }, [storeAuth, isLoading, router]);

  if (isLoading || !isAuth) {
    return null;
  }

  return <>{children}</>;
}
