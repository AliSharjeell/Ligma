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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initial check
    if (!isAuthStored()) {
      router.replace('/auth?error=unauthorized');
    } else {
      setIsReady(true);
    }
  }, [router]);

  // Also watch for store changes
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, isReady, router]);

  // Don't render children until auth is verified
  if (!isReady || !isAuthStored()) {
    return null;
  }

  return <>{children}</>;
}
