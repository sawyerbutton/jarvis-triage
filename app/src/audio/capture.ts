import { audioControl, onEvent } from '../bridge';
import { feedAudio, resetStats } from './keyword-detector';
import { appendEventLog } from '../events';
import type { EvenHubEvent } from '@evenrealities/even_hub_sdk';

let unsubscribe: (() => void) | null = null;

function handleAudioEvent(event: EvenHubEvent): void {
  if (event.audioEvent?.audioPcm) {
    feedAudio(event.audioEvent.audioPcm);
  }
}

/** Start capturing audio from the G2 microphone */
export async function startCapture(): Promise<void> {
  resetStats();
  unsubscribe = onEvent(handleAudioEvent);
  const ok = await audioControl(true);
  appendEventLog(`[audio] capture started (mic=${ok})`);
}

/** Stop capturing audio */
export async function stopCapture(): Promise<void> {
  await audioControl(false);
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  appendEventLog('[audio] capture stopped');
}
