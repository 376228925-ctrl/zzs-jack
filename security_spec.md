# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Core Data Invariants
1. **Default Deny**: Any path not explicitly matched is denied for both read and write.
2. **No Self-Role Escalation**: A user creating `/users/{userId}` can ONLY set `role == 'player'`, and cannot modify `role` during updates unless `isSuperAdmin()`.
3. **RBAC Single Source of Truth**: Admin status is verified exclusively against `/admins/{uid}` or verified bootstrapped super admin email (`hjhm1314@gmail.com` with `email_verified == true`), never client-supplied claims.
4. **Strict User Isolation (PII / Personal Reviews)**: `/users/{userId}` can only be read by `isOwner(userId)` or `isAdmin()`. `/personal_records/{recordId}` can only be read, listed, created, or deleted by `ownerId == request.auth.uid`.
5. **Admin-Only Tournament Publishing**: Creating, editing, or deleting `/sessions/{sessionId}` requires `isAdmin() || isSuperAdmin()`. Regular players have read-only access to published/completed sessions and cannot read unpublished drafts created by others.
6. **Temporal & Structural Integrity**: `createdAt` and `updatedAt` must strictly equal `request.time`; `createdAt`, `uid`, `ownerId`, and `createdBy` are immutable after creation; all strings and arrays have strict upper size limits; all document IDs match `^[a-zA-Z0-9_\-]+$`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Self-Admin Registration**: Unprivileged user creates `/users/{uid}` with `{ role: "admin" }`.
2. **Role Escalation Update**: Regular user updates `/users/{uid}` changing `role` from `"player"` to `"super_admin"`.
3. **Shadow Ghost Field Injection**: User updates `/users/{uid}` adding `{ isVerifiedAdmin: true }` outside allowlisted keys.
4. **Cross-User Profile Scraping**: User A calls `get` on `/users/userB`.
5. **Cross-User AI Review Scraping**: User A queries `/personal_records` where `ownerId == 'userB'`.
6. **Forged Owner on Create**: User A creates `/personal_records/rec1` with `{ ownerId: "userB" }`.
7. **Unauthorized Admin Grant**: Regular user attempts to create `/admins/{uid}` to grant themselves admin role.
8. **Unauthorized Session Publishing**: Regular player attempts to create or update `/sessions/sess1`.
9. **Draft Session Eavesdropping**: Regular player calls `get` on `/sessions/draft1` where `status == "draft"`.
10. **ID Poisoning**: Admin attempts to create `/sessions/../../hack!!` with invalid characters or >128 chars.
11. **Backdated Timestamp Forgery**: User creates `/personal_records/rec2` with client timestamp instead of `request.time`.
12. **Unverified Admin Email Spoof**: Unverified account (`email_verified: false`) matching admin email attempts privileged write.
