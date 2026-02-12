declare module 'expo-task-manager' {
  export function defineTask(
    taskName: string,
    taskExecutor: (body: { data?: unknown; error?: unknown }) => Promise<void> | void
  ): void;

  export function isTaskDefined(taskName: string): boolean;
}
