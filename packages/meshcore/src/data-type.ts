import { MESHCORE_DATA_TYPE } from '@teselia/protocol';

/** `data_type` of the datagrams Teselia sends (protocol §7). */
export const SEND_DATA_TYPE = MESHCORE_DATA_TYPE;

/**
 * `data_type` values accepted as Teselia events. When a permanent value is registered it becomes
 * SEND_DATA_TYPE and the development value stays here for a transition period.
 */
export const ACCEPTED_DATA_TYPES: readonly number[] = [MESHCORE_DATA_TYPE];
