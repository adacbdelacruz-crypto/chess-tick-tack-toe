/**
 * Security Rule Verification Harness for Checkline
 * Validates the 12 "Dirty Dozen" adversarial payloads defined in security_spec.md
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Create',
    path: '/players/userA',
    operation: 'create',
    auth: null,
    payload: { uid: 'userA', displayName: 'Rogue' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email',
    path: '/players/userA',
    operation: 'create',
    auth: { uid: 'userA', email_verified: false },
    payload: { uid: 'userA', displayName: 'Unverified' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing',
    path: '/players/userA',
    operation: 'create',
    auth: { uid: 'userB', email_verified: true },
    payload: { uid: 'userA', displayName: 'Spoofer' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'UID Field Mismatch',
    path: '/players/userA',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: { uid: 'userB', displayName: 'Mismatch' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Ghost Field',
    path: '/players/userA',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: { uid: 'userA', displayName: 'Shadow', isAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'ID Poisoning',
    path: '/players/bad$id_' + 'x'.repeat(160),
    operation: 'get',
    auth: { uid: 'userA', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Oversized Display Name',
    path: '/players/userA',
    operation: 'update',
    auth: { uid: 'userA', email_verified: true },
    payload: { displayName: 'A'.repeat(500) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Type Poisoning on ELO',
    path: '/players/userA',
    operation: 'update',
    auth: { uid: 'userA', email_verified: true },
    payload: { elo: '9999' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable createdAt Mutation',
    path: '/players/userA',
    operation: 'update',
    auth: { uid: 'userA', email_verified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Forged Timestamp on Match',
    path: '/players/userA/savedMatches/m1',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: { uid: 'userA', opponentName: 'Bot', createdAt: '1999-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Cross-Tenant PII Read',
    path: '/players/userA/private/info',
    operation: 'get',
    auth: { uid: 'userB', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket List Query',
    path: '/players/userA/savedMatches',
    operation: 'list',
    auth: { uid: 'userB', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
