import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  syncFirestorePlayerProfile,
  updateFirestoreDisplayName,
  updateFirestoreSoundPref,
  updateFirestoreTutorialCompleted,
} from '../lib/firestoreSync';

export interface PlayerProfile {
  id: number;
  uid: string;
  displayName: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  aiWinsEasy: number;
  aiWinsIntermediate: number;
  aiWinsHard: number;
  aiWinsLegendary: number;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: PlayerProfile | null;
  loading: boolean;
  authBusy: boolean;
  authError: string | null;
  soundEnabled: boolean;
  tutorialCompleted: boolean;
  needsHandleOnboarding: boolean;
  dismissOnboarding: () => void;
  getIdToken: () => Promise<string | null>;
  signInWithGoogle: (intent?: 'login' | 'signup') => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateHandle: (newName: string) => Promise<void>;
  toggleSound: () => Promise<void>;
  markTutorialCompleted: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [needsHandleOnboarding, setNeedsHandleOnboarding] = useState(false);

  const loadBackendProfile = useCallback(
    async (user: User, showOnboardingIfNew = false) => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error('Failed to load player profile.');
        }
        const data = (await res.json()) as { user: PlayerProfile };
        setProfile(data.user);

        if (user.emailVerified) {
          try {
            const prefs = await syncFirestorePlayerProfile({
              uid: user.uid,
              email: user.email || `${user.uid}@player.local`,
              displayName: data.user.displayName,
              elo: data.user.elo,
              wins: data.user.wins,
              losses: data.user.losses,
              draws: data.user.draws,
            });
            setSoundEnabled(prefs.soundEnabled);
            setTutorialCompleted(prefs.tutorialCompleted);
          } catch (fsErr) {
            console.warn('Firestore profile sync skipped:', fsErr);
          }
        }

        if (
          showOnboardingIfNew &&
          data.user.wins === 0 &&
          data.user.losses === 0 &&
          data.user.draws === 0
        ) {
          setNeedsHandleOnboarding(true);
        }
      } catch (err) {
        console.error('Error loading backend profile:', err);
      }
    },
    []
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadBackendProfile(user, false);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [loadBackendProfile]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  }, []);

  const signInWithGoogle = useCallback(
    async (intent: 'login' | 'signup' = 'login') => {
      setAuthError(null);
      setAuthBusy(true);
      try {
        const cred = await signInWithPopup(auth, googleAuthProvider);
        await loadBackendProfile(cred.user, intent === 'signup');
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Unable to complete sign-in.';
        setAuthError(msg);
      } finally {
        setAuthBusy(false);
      }
    },
    [loadBackendProfile]
  );

  const logout = useCallback(async () => {
    setAuthBusy(true);
    try {
      await signOut(auth);
      setProfile(null);
      setNeedsHandleOnboarding(false);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      await loadBackendProfile(auth.currentUser, false);
    }
  }, [loadBackendProfile]);

  const updateHandle = useCallback(async (newName: string) => {
    if (!auth.currentUser) return;
    const token = await auth.currentUser.getIdToken();
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: newName }),
    });
    const data = (await res.json()) as { user?: PlayerProfile; error?: string };
    if (!res.ok || !data.user) {
      throw new Error(data.error || 'Failed to update player handle.');
    }
    setProfile(data.user);
    setNeedsHandleOnboarding(false);

    if (auth.currentUser.emailVerified) {
      try {
        await updateFirestoreDisplayName(
          auth.currentUser.uid,
          data.user.displayName
        );
      } catch (err) {
        console.warn('Firestore displayName sync warning:', err);
      }
    }
  }, []);

  const toggleSound = useCallback(async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (auth.currentUser?.emailVerified) {
      try {
        await updateFirestoreSoundPref(auth.currentUser.uid, next);
      } catch (err) {
        console.warn('Firestore sound preference warning:', err);
      }
    }
  }, [soundEnabled]);

  const markTutorialCompleted = useCallback(async () => {
    setTutorialCompleted(true);
    if (auth.currentUser?.emailVerified) {
      try {
        await updateFirestoreTutorialCompleted(auth.currentUser.uid, true);
      } catch (err) {
        console.warn('Firestore tutorial flag warning:', err);
      }
    }
  }, []);

  const dismissOnboarding = useCallback(() => {
    setNeedsHandleOnboarding(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        authBusy,
        authError,
        soundEnabled,
        tutorialCompleted,
        needsHandleOnboarding,
        dismissOnboarding,
        getIdToken,
        signInWithGoogle,
        logout,
        refreshProfile,
        updateHandle,
        toggleSound,
        markTutorialCompleted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
