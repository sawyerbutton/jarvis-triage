import { updateText } from '../bridge';

/**
 * Helper to update a text container's content via textContainerUpgrade.
 */
export async function updateTextContainer(
  containerID: number,
  containerName: string,
  content: string,
): Promise<void> {
  await updateText(containerID, containerName, content);
}
