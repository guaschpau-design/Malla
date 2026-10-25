// Reading and writing invitation links in the address bar (protocol §6, ADR-0012).

import {
  buildInvitationUrl,
  decodeInvitationToken,
  isJoinPath,
  type Invitation,
  type ProtocolError,
  type Result,
} from '@malla/protocol';

/** Where the app is served from, ending in `/`; `base` is Vite's BASE_URL. */
export function appBaseUrl(origin: string, base: string): string {
  return new URL(base, origin).href;
}

/**
 * The invitation in the current address, if it is a join link. The app reads its own address,
 * so the scheme is not checked here: development runs on http://localhost.
 */
export function invitationInAddress(
  pathname: string,
  hash: string,
): Result<Invitation, ProtocolError> | null {
  if (!isJoinPath(pathname) || hash.length < 2) return null;
  return decodeInvitationToken(hash.slice(1));
}

export function invitationLink(
  origin: string,
  base: string,
  invitation: Invitation,
): Result<string, ProtocolError> {
  return buildInvitationUrl(appBaseUrl(origin, base), invitation);
}
