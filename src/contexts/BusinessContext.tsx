import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { api, setActiveBusinessId } from '../lib/api';
import { useAuth } from './AuthContext';
import type { Business } from '../types/index';

const STORAGE_KEY = 'cl_active_business_id';

interface BusinessContextValue {
  businesses: Business[];
  activeBusiness: Business | null;
  activeBusinessId: number;
  switchBusiness: (id: number) => void;
  createBusiness: (name: string, nicho: string) => Promise<Business>;
  loading: boolean;
  loadError: boolean;
  retryLoad: () => void;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveId] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : 0; // 0 = no preference yet (avoids defaulting to id=1 across sessions)
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const initialLoadedRef = useRef(false);

  // Sync api.ts module variable and localStorage on every change
  useEffect(() => {
    setActiveBusinessId(activeBusinessId);
    localStorage.setItem(STORAGE_KEY, String(activeBusinessId));
  }, [activeBusinessId]);

  // Load businesses when auth state changes or user manually retries
  useEffect(() => {
    if (authLoading) return; // wait for Supabase to restore session from localStorage

    if (!session) {
      // User logged out: clear businesses list and stored business ID so the
      // next login doesn't show a stale business from a previous session.
      setBusinesses([]);
      setLoadError(false);
      localStorage.removeItem(STORAGE_KEY);
      setActiveId(0);
      setLoading(false);
      initialLoadedRef.current = false; // reset so next login shows spinner
      return;
    }

    // Only show full-screen loading on first fetch; subsequent session refreshes
    // (window focus, JWT renewal) refetch silently in the background.
    if (!initialLoadedRef.current) {
      setLoading(true);
    }

    api.getBusinesses()
      .then((list) => {
        initialLoadedRef.current = true;
        setLoadError(false);
        setBusinesses(list);
        // Guard: if stored id no longer belongs to this user, fall back to most
        // recently created business (highest id), not the oldest (list[0]).
        const ids = list.map((b: Business) => b.id);
        if (!ids.includes(activeBusinessId) && list.length > 0) {
          setActiveId(list[list.length - 1].id);
        }
      })
      .catch(() => {
        // Only flag error on first load — silent retries on JWT refresh are fine
        if (!initialLoadedRef.current) {
          setLoadError(true);
        }
      })
      .finally(() => setLoading(false));
  }, [session, authLoading, retryCount]); // retryCount forces re-fetch on manual retry

  const switchBusiness = useCallback((id: number) => {
    setActiveId(id);
  }, []);

  const retryLoad = useCallback(() => {
    setLoadError(false);
    setLoading(true);
    setRetryCount((c) => c + 1);
  }, []);

  const createBusiness = useCallback(async (name: string, nicho: string): Promise<Business> => {
    const newBusiness = await api.createBusiness({ name, nicho });
    setBusinesses((prev) => [...prev, newBusiness]);
    setActiveId(newBusiness.id); // immediately switch to the new business
    return newBusiness;
  }, []);

  const activeBusiness = businesses.find((b) => b.id === activeBusinessId) ?? null;

  return (
    <BusinessContext.Provider
      value={{ businesses, activeBusiness, activeBusinessId, switchBusiness, createBusiness, loading, loadError, retryLoad }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used inside <BusinessProvider>');
  return ctx;
}
