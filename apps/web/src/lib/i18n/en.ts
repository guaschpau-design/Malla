// The English dictionary defines the set of keys. Every other language must provide all of them.

export const en = {
  appTagline: 'Shared situational awareness for civil society, online and over LoRa mesh.',
  protocolVersion: 'Protocol version',
  language: 'Language',
} as const;

export type Messages = { readonly [K in keyof typeof en]: string };
