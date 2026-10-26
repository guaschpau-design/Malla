// Log files: a group's events saved to a file and read back on another device (docs/protocol.md
// §10). The events travel sealed, as for a relay, so the file is only readable with the group.

import { fromBase64url, toBase64url } from './base64url.ts';
import { GROUP_ID_SIZE, LOG_FILE_KIND, LOG_FILE_VERSION, MAX_ENVELOPE_SIZE } from './constants.ts';
import { err, ok, protocolError, type ProtocolError, type Result } from './result.ts';

export interface LogFile {
  readonly groupId: Uint8Array;
  readonly envelopes: readonly Uint8Array[];
}

export function encodeLogFile(file: LogFile): string {
  return JSON.stringify({
    tesel: LOG_FILE_KIND,
    version: LOG_FILE_VERSION,
    group: toBase64url(file.groupId),
    envelopes: file.envelopes.map(toBase64url),
  });
}

/** Reads a log file. Envelopes that are not valid base64url or too large to be one are skipped. */
export function parseLogFile(text: string): Result<LogFile, ProtocolError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return err(protocolError('invalid-value', 'not JSON'));
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return err(protocolError('invalid-value', 'not a log file'));
  }
  const { tesel, version, group, envelopes } = parsed as Record<string, unknown>;
  if (tesel !== LOG_FILE_KIND) return err(protocolError('invalid-value', 'not a log file'));
  if (version !== LOG_FILE_VERSION) {
    return err(protocolError('unsupported-version', `log file version ${String(version)}`));
  }
  const groupId = typeof group === 'string' ? fromBase64url(group) : null;
  if (groupId?.length !== GROUP_ID_SIZE) {
    return err(protocolError('invalid-value', 'group ID'));
  }
  if (!Array.isArray(envelopes)) return err(protocolError('invalid-value', 'envelopes'));
  const decoded = envelopes.flatMap((item) => {
    const bytes = typeof item === 'string' ? fromBase64url(item) : null;
    return bytes !== null && bytes.length <= MAX_ENVELOPE_SIZE ? [bytes] : [];
  });
  return ok({ groupId, envelopes: decoded });
}
