import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LeaderboardRow {
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

export function LeaderboardView() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/leaderboard');
      const data = (await res.json()) as {
        leaderboard?: LeaderboardRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load leaderboard.');
      }
      setRows(data.leaderboard || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to reach leaderboard.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-800 pb-8">
        <div>
          <p className="text-xs text-neutral-500 mb-2">
            Global Rankings · Rated AI &amp; Multiplayer Matches
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-white">
            Global Leaderboard
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void loadLeaderboard()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-neutral-700 text-neutral-300 hover:border-white hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Standings</span>
        </button>
      </div>

      {error && (
        <div className="border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="border border-neutral-800 bg-neutral-950 p-12 text-center text-sm text-neutral-400">
          Loading global standings...
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-neutral-800 bg-neutral-950 p-12 text-center space-y-3">
          <Trophy className="w-7 h-7 mx-auto text-neutral-500" />
          <p className="text-sm text-neutral-300">
            No ranked players recorded yet.
          </p>
          <p className="text-xs text-neutral-500">
            Sign in and complete a match to claim the top spot on the board.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-800 bg-neutral-950 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                <th className="py-3.5 px-5 font-medium">Rank</th>
                <th className="py-3.5 px-5 font-medium">Player</th>
                <th className="py-3.5 px-5 font-medium text-right">ELO</th>
                <th className="py-3.5 px-5 font-medium text-right">
                  Record (W / L / D)
                </th>
                <th className="py-3.5 px-5 font-medium text-right">Win Rate</th>
                <th className="py-3.5 px-5 font-medium text-right">
                  Legendary Wins
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900 text-sm">
              {rows.map((entry, idx) => {
                const total = entry.wins + entry.losses + entry.draws;
                const winRate =
                  total > 0 ? Math.round((entry.wins / total) * 100) : 0;
                const isSelf = profile?.uid === entry.uid;

                return (
                  <tr
                    key={entry.uid}
                    className={`transition-colors ${
                      isSelf
                        ? 'bg-white text-black font-medium'
                        : 'text-neutral-200 hover:bg-neutral-900/60'
                    }`}
                  >
                    <td className="py-3.5 px-5 font-mono-tabular">
                      #{idx + 1}
                    </td>
                    <td className="py-3.5 px-5">
                      <span>{entry.displayName}</span>
                      {isSelf && (
                        <span className="ml-2 text-xs opacity-70">(You)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono-tabular font-semibold">
                      {entry.elo}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono-tabular">
                      {entry.wins} / {entry.losses} / {entry.draws}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono-tabular">
                      {winRate}%
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono-tabular">
                      {entry.aiWinsLegendary}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
