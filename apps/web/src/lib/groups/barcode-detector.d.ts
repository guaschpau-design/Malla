// The Barcode Detection API (https://wicg.github.io/shape-detection-api/) is not in
// TypeScript's DOM library yet. Only what the scanner uses is declared.

interface DetectedBarcode {
  readonly rawValue: string;
}

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  static getSupportedFormats(): Promise<string[]>;
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
