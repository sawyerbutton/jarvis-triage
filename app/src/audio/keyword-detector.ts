import { appendEventLog } from '../events';

/**
 * MVP keyword detector: does NOT do real recognition.
 * Just counts PCM frames for debugging / verification.
 */
let frameCount = 0;
let totalBytes = 0;

export function feedAudio(pcm: Uint8Array): void {
  frameCount++;
  totalBytes += pcm.length;

  // Log every 50 frames (~1s at 20ms/frame)
  if (frameCount % 50 === 0) {
    appendEventLog(`[audio] frames=${frameCount} totalBytes=${totalBytes}`);
  }
}

export function getStats() {
  return { frameCount, totalBytes };
}

export function resetStats(): void {
  frameCount = 0;
  totalBytes = 0;
}
