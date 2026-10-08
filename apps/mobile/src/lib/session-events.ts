type Listener = () => void;

let listener: Listener | null = null;

/**
 * Connects the query client (which sees every failed request) with the auth provider (which
 * owns the session). When any request reports an invalid session, the provider ends it.
 */
export function onSessionExpired(callback: Listener): () => void {
  listener = callback;
  return () => {
    if (listener === callback) listener = null;
  };
}

export function emitSessionExpired(): void {
  listener?.();
}
