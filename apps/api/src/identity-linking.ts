/**
 * What this does: decides whether a validated Telegram identity may be attached to a
 * canonical Cribbit user. It performs no database work and mutates nothing.
 * Key invariant: linking is explicit -- a caller must already be authenticated as the
 * canonical user, and no two users are ever merged and no product data is ever moved.
 * Explicitly out of scope: automatic identity matching by username, display name,
 * Telegram username, email, IP, browser or device, and any gameplay side effect.
 */

export type IdentityLinkOutcome = 'LINKED' | 'ALREADY_LINKED';
export type IdentityLinkConflictCode = 'IDENTITY_ALREADY_LINKED' | 'IDENTITY_PROVIDER_ALREADY_LINKED';

export type IdentityLinkDecision =
  | { kind:'ATTACH' }
  | { kind:'IDEMPOTENT' }
  | { kind:'CONFLICT'; code:IdentityLinkConflictCode; statusCode:409; message:string };

export interface TelegramIdentityLinkInput {
  /** Canonical users.id of the already-authenticated caller. */
  requestedUserId: string;
  /** users.id that currently owns this Telegram provider identity, if any. */
  identityOwnerUserId: string | null;
  /** Telegram provider_user_id already attached to the caller, if any. */
  callerTelegramIdentityId: string | null;
}

export function decideTelegramIdentityLink(input: TelegramIdentityLinkInput): IdentityLinkDecision {
  if (input.identityOwnerUserId) {
    if (input.identityOwnerUserId === input.requestedUserId) return { kind:'IDEMPOTENT' };
    return {
      kind:'CONFLICT',
      code:'IDENTITY_ALREADY_LINKED',
      statusCode:409,
      message:'That Telegram account is already linked to a different Cribbit account.',
    };
  }

  // Attaching a second Telegram identity to one account would let a different human act
  // as this user, so it is refused instead of silently merging two telegrams into one user.
  if (input.callerTelegramIdentityId) {
    return {
      kind:'CONFLICT',
      code:'IDENTITY_PROVIDER_ALREADY_LINKED',
      statusCode:409,
      message:'This Cribbit account already has a linked Telegram account.',
    };
  }

  return { kind:'ATTACH' };
}
