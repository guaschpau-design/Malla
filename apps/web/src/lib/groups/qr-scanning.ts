// Scanning invitation QR codes with the camera, where the browser can (Chrome on Android).
// Elsewhere people scan with the phone's camera app, which opens the link.

/** True if this browser can read QR codes from the camera. */
export async function canScanQr(): Promise<boolean> {
  if (!('BarcodeDetector' in window) || !('mediaDevices' in navigator)) return false;
  try {
    return (await BarcodeDetector.getSupportedFormats()).includes('qr_code');
  } catch {
    return false;
  }
}

const SCAN_INTERVAL_MS = 250;

/**
 * Shows the back camera in `video` and calls `onvalue` with the text of every QR code seen until
 * `signal` aborts. Rejects if the camera cannot be opened.
 */
export async function scanQrCodes(
  video: HTMLVideoElement,
  onvalue: (text: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  });
  const stop = () => {
    for (const track of stream.getTracks()) track.stop();
  };
  signal.addEventListener('abort', stop, { once: true });
  if (signal.aborted) stop(); // Cancelled while the camera was opening.
  video.srcObject = stream;
  await video.play();

  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  while (!signal.aborted) {
    try {
      for (const code of await detector.detect(video)) onvalue(code.rawValue);
    } catch {
      // A frame that is not ready yet; try the next one.
    }
    await new Promise((resolve) => setTimeout(resolve, SCAN_INTERVAL_MS));
  }
}
