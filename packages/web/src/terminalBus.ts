/**
 * Raw terminal byte stream, deliberately kept outside the zustand store.
 * PTY output can arrive many times a second; routing it through reactive
 * state would re-render the whole subscribed tree per chunk. Terminal.tsx
 * subscribes directly and writes straight into xterm.js instead. Session
 * metadata (existence, cols/rows, exit code) still lives in the store since
 * that only changes rarely and other UI (status bar, tab badges) cares
 * about it.
 */

type Listener = (data: string) => void;

const listeners = new Map<string, Set<Listener>>();

export function emitTerminalData(terminalId: string, data: string): void {
  const set = listeners.get(terminalId);
  if (!set) return;
  for (const listener of set) listener(data);
}

export function onTerminalData(terminalId: string, listener: Listener): () => void {
  let set = listeners.get(terminalId);
  if (!set) {
    set = new Set();
    listeners.set(terminalId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}
