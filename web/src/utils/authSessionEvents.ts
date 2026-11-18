// Axios reports authentication failures without depending on React or the account store.
const listeners = new Set<() => void>();

export function onSessionRequired(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySessionRequired() {
  listeners.forEach((listener) => listener());
}
