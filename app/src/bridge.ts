import {
  waitForEvenAppBridge,
  type EvenAppBridge,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerUpgrade,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';

let bridge: EvenAppBridge | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`Even bridge not detected within ${ms}ms`)),
      ms,
    );
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

/** Initialise the bridge; returns null if not in Even Hub environment */
export async function initBridge(timeoutMs = 6000): Promise<EvenAppBridge | null> {
  try {
    bridge = await withTimeout(waitForEvenAppBridge(), timeoutMs);
    console.log('[bridge] connected');
    return bridge;
  } catch {
    console.warn('[bridge] not available, running in mock mode');
    return null;
  }
}

export function getBridge(): EvenAppBridge | null {
  return bridge;
}

/** First-time page creation */
export async function createStartUp(config: ConstructorParameters<typeof CreateStartUpPageContainer>[0]) {
  if (!bridge) { console.log('[bridge:mock] createStartUpPageContainer', config); return; }
  await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config));
}

/** Rebuild page layout (subsequent updates) */
export async function rebuild(config: ConstructorParameters<typeof RebuildPageContainer>[0]) {
  if (!bridge) { console.log('[bridge:mock] rebuildPageContainer', config); return; }
  await bridge.rebuildPageContainer(new RebuildPageContainer(config));
}

/** Update text in an existing container */
export async function updateText(
  containerID: number,
  containerName: string,
  content: string,
) {
  if (!bridge) { console.log('[bridge:mock] textContainerUpgrade', { containerID, content }); return; }
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({ containerID, containerName, contentOffset: 0, contentLength: 2000, content }),
  );
}

/** Subscribe to EvenHub events */
export function onEvent(cb: (event: EvenHubEvent) => void): () => void {
  if (!bridge) { console.log('[bridge:mock] onEvenHubEvent subscribed'); return () => {}; }
  return bridge.onEvenHubEvent(cb);
}

/** Open / close microphone */
export async function audioControl(open: boolean): Promise<boolean> {
  if (!bridge) { console.log('[bridge:mock] audioControl', open); return false; }
  return bridge.audioControl(open);
}
