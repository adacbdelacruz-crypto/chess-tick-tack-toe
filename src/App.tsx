import React, { useState } from 'react';
import { AuthModal } from './components/AuthModal';
import { HistoryView } from './components/HistoryView';
import { LeaderboardView } from './components/LeaderboardView';
import { MultiplayerView } from './components/MultiplayerView';
import { SoloArenaView } from './components/SoloArenaView';
import { TutorialView } from './components/TutorialView';
import { useAuth } from './context/AuthContext';

type NavTab = 'play' | 'multiplayer' | 'leaderboard' | 'history' | 'tutorial';

const NAV_ITEMS: Array<{ id: NavTab; label: string }> = [
  { id: 'play', label: 'Play' },
  { id: 'multiplayer', label: 'Multiplayer' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'history', label: 'History' },
  { id: 'tutorial', label: 'Tutorial' },
];

export default function App() {
  const { firebaseUser, profile, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('play');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>(
    'login'
  );

  const openAuth = (mode: 'login' | 'signup' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-[#fafafa]">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-[#09090b]/95 backdrop-blur-sm">
        <div className="max-w-[1320px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('play')}
            className="font-display text-2xl font-semibold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Checkline
          </button>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 border-b transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    active
                      ? 'text-white border-white'
                      : 'text-neutral-400 border-transparent hover:text-white hover:border-neutral-600'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            {loading ? (
              <span className="text-xs text-neutral-500 whitespace-nowrap shrink-0">
                Loading...
              </span>
            ) : firebaseUser ? (
              <button
                type="button"
                onClick={() => void logout()}
                title={
                  profile
                    ? `Signed in as ${profile.displayName} (${profile.elo} ELO)`
                    : 'Sign Out'
                }
                className="px-4 py-2 text-xs font-semibold border border-neutral-700 text-white hover:border-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="px-4 py-2 text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Strip */}
        <nav
          aria-label="Mobile navigation"
          className="md:hidden flex items-center gap-5 px-6 py-2.5 border-t border-neutral-900 overflow-x-auto text-xs font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 pb-0.5 border-b ${
                  active
                    ? 'text-white border-white'
                    : 'text-neutral-400 border-transparent'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeTab === 'play' && (
          <SoloArenaView
            onOpenAuth={openAuth}
            onOpenTutorial={() => setActiveTab('tutorial')}
          />
        )}
        {activeTab === 'multiplayer' && (
          <MultiplayerView onOpenAuth={openAuth} />
        )}
        {activeTab === 'leaderboard' && <LeaderboardView />}
        {activeTab === 'history' && <HistoryView onOpenAuth={openAuth} />}
        {activeTab === 'tutorial' && (
          <TutorialView onFinishToArena={() => setActiveTab('play')} />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-neutral-900 py-6 px-6">
        <div className="max-w-[1320px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <span>Checkline · Monochrome Chess &amp; Tic-Tac-Toe</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveTab('tutorial')}
              className="hover:text-white transition-colors"
            >
              Rules &amp; Tutorial
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className="hover:text-white transition-colors"
            >
              Global Standings
            </button>
            {!firebaseUser && (
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className="hover:text-white transition-colors"
              >
                Create Account
              </button>
            )}
          </div>
        </div>
      </footer>

      <AuthModal
        open={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}
