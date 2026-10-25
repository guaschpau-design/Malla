/**
 * Result of an operation that can fail on bad input. Decoders and encoders return results
 * instead of throwing, so that untrusted bytes from the network or the radio can never crash
 * the caller (CONTRIBUTING.md §3.6).
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

export function err<E>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}

export type ProtocolErrorCode =
  /** The input ended before a field was complete. */
  | 'truncated'
  /** The input continues after the last field. */
  | 'trailing-bytes'
  /** The encoded event would exceed MAX_EVENT_SIZE. */
  | 'too-large'
  /** The event header carries a protocol version we do not implement. */
  | 'unsupported-version'
  /** The event type code is not known to this implementation. */
  | 'unknown-type'
  /** A text field is not valid UTF-8. */
  | 'invalid-utf8'
  /** A field holds a value outside its allowed range. */
  | 'invalid-value';

export interface ProtocolError {
  readonly code: ProtocolErrorCode;
  /** Human-readable explanation for logs and debugging; never shown to end users. */
  readonly detail: string;
}

export function protocolError(code: ProtocolErrorCode, detail: string): ProtocolError {
  return { code, detail };
}
