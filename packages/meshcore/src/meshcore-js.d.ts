// meshcore.js ships no type declarations. Only the Web Bluetooth entry point is imported, so
// the library's Node-only serial code never reaches the browser bundle. The methods match
// CompanionConnection in companion.ts, which the compiler checks where the class is used.

declare module '@liamcottle/meshcore.js/src/connection/web_ble_connection.js' {
  export default class WebBleConnection {
    static open(): Promise<WebBleConnection | null | undefined>;
    readonly bleDevice: { readonly name?: string };
    on(event: string | number, listener: (...args: unknown[]) => void): void;
    off(event: string | number, listener: (...args: unknown[]) => void): void;
    getChannel(
      channelIdx: number,
    ): Promise<{ channelIdx: number; name: string; secret: Uint8Array }>;
    setChannel(channelIdx: number, name: string, secret: Uint8Array): Promise<void>;
    sendChannelData(
      channelIdx: number,
      pathLen: number,
      path: Uint8Array,
      dataType: number,
      payload: Uint8Array,
    ): Promise<unknown>;
    syncNextMessage(): Promise<
      | { channelData: { snr: number; channelIdx: number; dataType: number; data: Uint8Array } }
      | { channelMessage: unknown }
      | { contactMessage: unknown }
      | null
    >;
    close(): Promise<void>;
  }
}
