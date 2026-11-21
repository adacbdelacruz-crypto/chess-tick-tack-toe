import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreError';
import type { DifficultyLevel, GameMode, PlayerColor } from '../shared/gameEngine';

export interface FirestorePlayerProfile {
  uid: string;
  displayName: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  soundEnabled: boolean;
  tutorialCompleted: boolean;
}

export async function syncFirestorePlayerProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}): Promise<{ soundEnabled: boolean; tutorialCompleted: boolean }> {
  const safeUid = params.uid.slice(0, 128);
  const safeName = (params.displayName || 'Player').trim().slice(0, 32);
  const validName = safeName.length >= 2 ? safeName : 'Player';
  const playerPath = `players/${safeUid}`;
  const privatePath = `players/${safeUid}/private/info`;

  let soundEnabled = true;
  let tutorialCompleted = false;

  try {
    const playerRef = doc(db, 'players', safeUid);
    const snap = await getDoc(playerRef);
    if (!snap.exists()) {
      await setDoc(playerRef, {
        uid: safeUid,
        displayName: validName,
        elo: Math.max(100, Math.min(5000, Math.round(params.elo))),
        wins: Math.max(0, params.wins),
        losses: Math.max(0, params.losses),
        draws: Math.max(0, params.draws),
        soundEnabled: true,
        tutorialCompleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = snap.data();
      soundEnabled =
        typeof existing.soundEnabled === 'boolean' ? existing.soundEnabled : true;
      tutorialCompleted =
        typeof existing.tutorialCompleted === 'boolean'
          ? existing.tutorialCompleted
          : false;

      if (
        existing.elo !== params.elo ||
        existing.wins !== params.wins ||
        existing.losses !== params.losses ||
        existing.draws !== params.draws
      ) {
        await updateDoc(playerRef, {
          elo: Math.max(100, Math.min(5000, Math.round(params.elo))),
          wins: Math.max(0, params.wins),
          losses: Math.max(0, params.losses),
          draws: Math.max(0, params.draws),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, playerPath);
  }

  try {
    const privateRef = doc(db, 'players', safeUid, 'private', 'info');
    const privSnap = await getDoc(privateRef);
    const safeEmail = (params.email || `${safeUid}@player.local`).slice(0, 254);
    if (!privSnap.exists()) {
      await setDoc(privateRef, {
        uid: safeUid,
        email: safeEmail,
        updatedAt: serverTimestamp(),
      });
    } else if (privSnap.data().email !== safeEmail) {
      await updateDoc(privateRef, {
        email: safeEmail,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }

  return { soundEnabled, tutorialCompleted };
}

export async function updateFirestoreDisplayName(
  uid: string,
  displayName: string
): Promise<void> {
  const safeName = displayName.trim().slice(0, 32);
  if (safeName.length < 2) return;
  const path = `players/${uid}`;
  try {
    await updateDoc(doc(db, 'players', uid), {
      displayName: safeName,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateFirestoreSoundPref(
  uid: string,
  soundEnabled: boolean
): Promise<void> {
  const path = `players/${uid}`;
  try {
    await updateDoc(doc(db, 'players', uid), {
      soundEnabled,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateFirestoreTutorialCompleted(
  uid: string,
  tutorialCompleted: boolean
): Promise<void> {
  const path = `players/${uid}`;
  try {
    await updateDoc(doc(db, 'players', uid), {
      tutorialCompleted,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveFirestoreMatchBookmark(params: {
  uid: string;
  matchId: string;
  opponentName: string;
  mode: GameMode;
  difficulty: DifficultyLevel | null;
  playerColor: PlayerColor;
  result: 'win' | 'loss' | 'draw';
  moveCount: number;
  eloDelta: number;
}): Promise<void> {
  const safeId = params.matchId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `m_${Date.now()}`;
  const path = `players/${params.uid}/savedMatches/${safeId}`;
  try {
    await setDoc(doc(db, 'players', params.uid, 'savedMatches', safeId), {
      uid: params.uid,
      opponentName: params.opponentName.trim().slice(0, 64) || 'Opponent',
      mode: params.mode,
      difficulty: params.difficulty ?? 'none',
      playerColor: params.playerColor,
      result: params.result,
      moveCount: Math.max(1, Math.min(500, Math.round(params.moveCount))),
      eloDelta: Math.max(-200, Math.min(200, Math.round(params.eloDelta))),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchFirestoreRecentMatches(uid: string) {
  const path = `players/${uid}/savedMatches`;
  try {
    const q = query(
      collection(db, 'players', uid, 'savedMatches'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
