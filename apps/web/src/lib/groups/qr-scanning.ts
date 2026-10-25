// Scanning invitation QR codes with the camera from inside the app. The decoder is plain
// JavaScript (jsQR) so it works in every browser, including Safari on iPhone, where the
// installed app cannot receive links opened by the camera app.

import jsQR from 'jsqr';

/** True if this browser can open a camera at all (only in a secure context). */
export function canScanQr(): boolean {
  return 'mediaDevices' in navigator;
}

/** Pixels in RGBA order, as a canvas returns them. */
export interface Frame {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/** The text of the QR code in a frame, or null if there is none. */
export function decodeQr(frame: Frame): string | null {
  return (
    jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })?.data ?? null
  );
}

const SCAN_INTERVAL_MS = 250;
/** Frames are scaled down to this width: enough for a code that fills part of the view. */
const SCAN_WIDTH = 640;

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

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error('2D canvas unavailable');
  while (!signal.aborted) {
    const frame = grabFrame(video, canvas, context);
    const text = frame && decodeQr(frame);
    if (text) onvalue(text);
    await new Promise((resolve) => setTimeout(resolve, SCAN_INTERVAL_MS));
  }
}

function grabFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): Frame | null {
  if (video.videoWidth === 0) return null; // No frame yet.
  const scale = Math.min(1, SCAN_WIDTH / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
