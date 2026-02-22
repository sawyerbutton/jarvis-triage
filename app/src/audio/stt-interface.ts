/**
 * Pluggable Speech-to-Text provider interface.
 *
 * MVP: not implemented — see keyword-detector.ts for placeholder.
 * Future: plug in Whisper, Deepgram, or on-device STT.
 */
export interface SttProvider {
  /** Feed PCM audio data */
  feed(pcm: Uint8Array): void;

  /** Get partial transcript (if available) */
  getPartial(): string | null;

  /** Get final transcript and reset */
  finalize(): Promise<string | null>;

  /** Release resources */
  destroy(): void;
}
