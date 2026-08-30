export type SourceLoadGuard = {
  currentRequest: number;
  currentRevision: number;
  dirty: boolean;
  requestedRevision: number;
  request: number;
  selected: string;
  versionPath: string;
};

export function canApplyLoadedSource(guard: SourceLoadGuard): boolean {
  return guard.request === guard.currentRequest &&
    guard.requestedRevision === guard.currentRevision &&
    guard.selected === guard.versionPath &&
    !guard.dirty;
}
