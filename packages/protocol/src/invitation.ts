// Invitation links (docs/protocol.md §6).

import { fromBase64url, toBase64url } from './base64url.ts';
import { ByteReader, ByteWriter, ProtocolFailure } from './bytes.ts';
import {
  GROUP_NAME_MAX_BYTES,
  GROUP_SECRET_SIZE,
  INVITATION_VERSION,
  NODE_ID_SIZE,
  SERVER_URL_MAX_BYTES,
} from './constants.ts';
import type { NodeId, Role } from './events.ts';
import { nodeIdFromBytes, nodeIdToBytes } from './node-id.ts';
import { err, ok, type ProtocolError, type Result } from './result.ts';

export interface Invitation {
  readonly role: Role;
  readonly secret: Uint8Array;
  readonly issuer: NodeId;
  readonly groupName: string;
  /** Server base URL, or null when the group has no server. */
  readonly server: string | null;
}

const ROLES: readonly Role[] = ['member', 'coordinator'];
const JOIN_PATH = '/join';

export function encodeInvitationToken(invitation: Invitation): Result<string, ProtocolError> {
  try {
    if (invitation.secret.length !== GROUP_SECRET_SIZE) {
      throw new ProtocolFailure('invalid-value', 'group secret must be 16 bytes');
    }
    if (invitation.server !== null && !invitation.server.startsWith('https://')) {
      throw new ProtocolFailure('invalid-value', 'server URL must use https://');
    }
    const token = new ByteWriter()
      .u8(INVITATION_VERSION)
      .u8(ROLES.indexOf(invitation.role))
      .raw(invitation.secret)
      .raw(nodeIdToBytes(invitation.issuer))
      .textU8(invitation.groupName, 1, GROUP_NAME_MAX_BYTES, 'group name')
      .textU8(invitation.server ?? '', 0, SERVER_URL_MAX_BYTES, 'server URL')
      .toBytes();
    return ok(toBase64url(token));
  } catch (failure) {
    if (failure instanceof ProtocolFailure) return err(failure.error);
    throw failure;
  }
}

export function decodeInvitationToken(token: string): Result<Invitation, ProtocolError> {
  const bytes = fromBase64url(token);
  if (bytes === null) return err({ code: 'invalid-value', detail: 'token is not base64url' });
  try {
    const reader = new ByteReader(bytes);
    const version = reader.u8();
    if (version !== INVITATION_VERSION) {
      return err({ code: 'unsupported-version', detail: `invitation version ${version}` });
    }
    const role = ROLES[reader.u8()];
    if (role === undefined) throw new ProtocolFailure('invalid-value', 'unknown role');
    const secret = reader.raw(GROUP_SECRET_SIZE);
    const issuer = nodeIdFromBytes(reader.raw(NODE_ID_SIZE));
    const groupName = reader.textU8(1, GROUP_NAME_MAX_BYTES, 'group name');
    const serverText = reader.textU8(0, SERVER_URL_MAX_BYTES, 'server URL');
    reader.end();
    if (serverText !== '' && !serverText.startsWith('https://')) {
      throw new ProtocolFailure('invalid-value', 'server URL must use https://');
    }
    return ok({ role, secret, issuer, groupName, server: serverText === '' ? null : serverText });
  } catch (failure) {
    if (failure instanceof ProtocolFailure) return err(failure.error);
    throw failure;
  }
}

/** Builds `https://{appOrigin}/join#{token}`. */
export function buildInvitationUrl(
  appOrigin: string,
  invitation: Invitation,
): Result<string, ProtocolError> {
  const token = encodeInvitationToken(invitation);
  if (!token.ok) return token;
  return ok(`${appOrigin.replace(/\/+$/, '')}${JOIN_PATH}#${token.value}`);
}

/** Extracts the invitation from a join URL; any origin is accepted, the path must be /join. */
export function parseInvitationUrl(url: string): Result<Invitation, ProtocolError> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return err({ code: 'invalid-value', detail: 'not a URL' });
  }
  if (!parsed.pathname.endsWith(JOIN_PATH) || parsed.hash.length < 2) {
    return err({ code: 'invalid-value', detail: 'not an invitation link' });
  }
  return decodeInvitationToken(parsed.hash.slice(1));
}
