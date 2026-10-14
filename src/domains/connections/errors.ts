export class ConnectionError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code:
      | 'setup_required'
      | 'denied'
      | 'unauthenticated'
      | 'invalid'
      | 'expired'
      | 'replayed'
      | 'revoked'
      | 'degraded'
      | 'provider'
      | 'unavailable' = 'invalid',
  ) {
    super(message);
  }
}
