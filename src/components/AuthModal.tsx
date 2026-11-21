import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'signup';
  onClose: () => void;
}

export function AuthModal({
  open,
  initialMode = 'login',
  onClose,
}: AuthModalProps) {
  const {
    firebaseUser,
    profile,
    authBusy,
    authError,
    needsHandleOnboarding,
    signInWithGoogle,
    updateHandle,
    dismissOnboarding,
  } = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>(initialMode);
  const [handleInput, setHandleInput] = useState('');
  const [savingHandle, setSavingHandle] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);

  if (!open && !needsHandleOnboarding) return null;

  const showOnboarding = Boolean(firebaseUser && profile && needsHandleOnboarding);

  const handleSaveCallsign = async (e: React.FormEvent) => {
    e.preventDefault();
    setHandleError(null);
    const trimmed = handleInput.trim();
    if (trimmed.length < 2 || trimmed.length > 32) {
      setHandleError('Callsign must be between 2 and 32 characters.');
      return;
    }
    setSavingHandle(true);
    try {
      await updateHandle(trimmed);
      onClose();
    } catch (err: unknown) {
      setHandleError(
        err instanceof Error ? err.message : 'Unable to save callsign.'
      );
    } finally {
      setSavingHandle(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md border border-neutral-800 bg-[#09090b] p-8 shadow-2xl">
        <button
          type="button"
          onClick={() => {
            if (showOnboarding) dismissOnboarding();
            onClose();
          }}
          aria-label="Close dialog"
          className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {showOnboarding ? (
          <div>
            <p className="text-xs text-neutral-500 mb-2">
              Player Registration
            </p>
            <h2
              id="auth-modal-title"
              className="font-display text-3xl font-semibold tracking-tight text-white mb-3"
            >
              Choose Your Callsign
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed mb-6">
              Your callsign appears on the global leaderboard, multiplayer rooms,
              and archived match records.
            </p>
            <form onSubmit={handleSaveCallsign} className="space-y-4">
              <div>
                <label
                  htmlFor="callsign-input"
                  className="block text-xs font-medium text-neutral-300 mb-1.5"
                >
                  Callsign (2–32 characters)
                </label>
                <input
                  id="callsign-input"
                  type="text"
                  maxLength={32}
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder={profile?.displayName || 'Grandmaster'}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white"
                />
              </div>
              {handleError && (
                <p className="text-xs text-neutral-200 border border-neutral-700 bg-neutral-900 px-3 py-2">
                  {handleError}
                </p>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    dismissOnboarding();
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
                >
                  Keep Default
                </button>
                <button
                  type="submit"
                  disabled={savingHandle}
                  className="px-5 py-2.5 text-xs font-medium bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  {savingHandle ? 'Saving...' : 'Confirm Callsign'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 mb-6 w-fit">
              <button
                type="button"
                onClick={() => setTab('login')}
                className={`px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  tab === 'login'
                    ? 'bg-white text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => setTab('signup')}
                className={`px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  tab === 'signup'
                    ? 'bg-white text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            <h2
              id="auth-modal-title"
              className="font-display text-3xl font-semibold tracking-tight text-white mb-3 text-balance"
            >
              {tab === 'login'
                ? 'Return to the Board'
                : 'Create Your Player Record'}
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed mb-6">
              {tab === 'login'
                ? 'Sign in with Google to synchronize your ELO rating, saved match replays, and multiplayer presence.'
                : 'Register with Google to claim a global leaderboard rank, track AI tier victories, and archive every match.'}
            </p>

            {authError && (
              <div className="mb-4 border border-neutral-700 bg-neutral-900 px-3.5 py-2.5 text-xs text-neutral-200">
                {authError}
              </div>
            )}

            <button
              type="button"
              disabled={authBusy}
              onClick={async () => {
                await signInWithGoogle(tab);
                if (tab === 'login') {
                  onClose();
                }
              }}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              <span>
                {authBusy
                  ? 'Connecting...'
                  : tab === 'login'
                    ? 'Continue with Google'
                    : 'Sign Up with Google'}
              </span>
            </button>

            <p className="mt-5 text-xs text-neutral-500 leading-relaxed">
              Starting rating is 1200 ELO. All ranked matches against AI tiers
              and online opponents update your standing automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
