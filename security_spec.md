# Checkline Firestore Security Specification

## 1. Data Invariants
1. Every document under `/players/{playerId}` must have `uid == playerId == request.auth.uid`, and `request.auth.token.email_verified == true`.
2. PII (`email`) is strictly isolated in `/players/{playerId}/private/info` and never stored on `/players/{playerId}` or exposed to non-owners.
3. Subcollections `/players/{playerId}/private/{docId}` and `/players/{playerId}/savedMatches/{matchId}` require the parent `/players/{playerId}` document to exist via `get()` (Master Gate).
4. `createdAt` and `uid` are immutable after document creation. `updatedAt` must equal `request.time`.
5. String fields enforce strict `.size()` bounds matching `firebase-blueprint.json`, and numeric fields (`elo`, `wins`, `losses`, `draws`, `moveCount`, `eloDelta`) enforce valid integer types and ranges.

## 2. The Dirty Dozen Adversarial Payloads
1. **Unauthenticated Create**: Create `/players/userA` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email**: Create `/players/userA` with `email_verified == false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing**: Create `/players/userA` while signed in as `userB` -> `PERMISSION_DENIED`.
4. **UID Field Mismatch**: Create `/players/userA` as `userA` with `uid: "userB"` -> `PERMISSION_DENIED`.
5. **Shadow Ghost Field**: Create `/players/userA` with extra field `isAdmin: true` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Read/write `/players/` with 200-char invalid ID containing `$` -> `PERMISSION_DENIED`.
7. **Value Poisoning (Oversized Display Name)**: Update `displayName` to a 500-char string -> `PERMISSION_DENIED`.
8. **Type Poisoning**: Update `elo` to `"9999"` (string instead of int) -> `PERMISSION_DENIED`.
9. **Immutable Field Mutation**: Update `createdAt` or `uid` on `/players/userA` -> `PERMISSION_DENIED`.
10. **Forged Timestamp**: Create `savedMatches/m1` with client-supplied past timestamp != `request.time` -> `PERMISSION_DENIED`.
11. **Cross-Tenant PII Read**: Read `/players/userA/private/info` as `userB` -> `PERMISSION_DENIED`.
12. **Blanket List Query**: List `/players` or `/players/userA/savedMatches` as `userB` -> `PERMISSION_DENIED`.
