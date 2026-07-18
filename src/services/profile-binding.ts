/**
 * Browser-visible profile binding used only to reject a stale HttpOnly session.
 * It is not a credential: the server still authenticates exclusively from the
 * opaque session cookie and never trusts this value to grant access.
 */

export const PROFILE_BINDING_COOKIE = 'nekopath_profile';
export const SIGNED_OUT_PROFILE = 'signed-out';

const BINDING_MAX_AGE_SECONDS = 60 * 60 * 12;

function writeBinding(value: string): void {
  if (typeof document === 'undefined') return;
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${PROFILE_BINDING_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${BINDING_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function bindBrowserProfile(profileId: string): void {
  writeBinding(profileId);
}

export function markBrowserSignedOut(): void {
  writeBinding(SIGNED_OUT_PROFILE);
}

export function readBoundProfileId(): string | null {
  if (typeof document === 'undefined') return null;
  for (const pair of document.cookie.split(';')) {
    const [rawName, ...rawValue] = pair.trim().split('=');
    if (rawName === PROFILE_BINDING_COOKIE) {
      return decodeURIComponent(rawValue.join('='));
    }
  }
  return null;
}
