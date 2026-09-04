/**
 * @file client/src/permissions/permissionPromptQueue.ts
 * @description Serializes permission prompts across the app.
 *
 * NotificationProvider and useLocation mount at the same time and each want to
 * put a dialog on screen. Two native dialogs racing each other leaves the OS
 * animating both at once, which reads as the screen tearing/flickering, and the
 * second dialog can be dismissed by the first one's result. Routing every
 * prompt through this queue guarantees one dialog is fully resolved before the
 * next is presented.
 */

let tail: Promise<unknown> = Promise.resolve();

/**
 * Runs `task` once every previously queued prompt has settled.
 * A rejected task does not break the chain for later prompts.
 */
export function queuePermissionPrompt<T>(task: () => Promise<T>): Promise<T> {
  const result = tail.then(task, task);
  tail = result.catch(() => undefined);
  return result;
}
