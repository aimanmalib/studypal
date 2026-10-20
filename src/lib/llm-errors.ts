/**
 * Error codes shared by the API routes and the UI. Every error the API returns
 * is `{ "error": "<friendly message>", "code": "<one of these>" }`, either as a
 * JSON body or as an SSE `data:` event.
 */

export type LLMErrorCode =
  // Request / configuration problems (HTTP 400).
  | 'missing_key'
  | 'invalid_key_format'
  | 'unknown_provider'
  | 'provider_not_allowed'
  | 'base_url_not_allowed'
  | 'invalid_base_url'
  | 'invalid_model'
  | 'bad_request'
  // Server configuration problem (HTTP 500).
  | 'server_misconfigured'
  // Upstream provider problems.
  | 'invalid_key'
  | 'forbidden'
  | 'model_not_found'
  | 'rate_limited'
  | 'upstream_bad_request'
  | 'upstream_unavailable'
  | 'upstream_unreachable'
  | 'upstream_timeout'
  | 'unparseable_output';

/** Codes that mean "the visitor needs to fix something in Settings". */
export const SETTINGS_ERROR_CODES: readonly LLMErrorCode[] = [
  'missing_key',
  'invalid_key_format',
  'invalid_key',
  'forbidden',
  'model_not_found',
  'unknown_provider',
  'provider_not_allowed',
  'base_url_not_allowed',
  'invalid_base_url',
  'invalid_model',
];

export class LLMError extends Error {
  readonly code: LLMErrorCode;
  /** HTTP status this app answers with. */
  readonly status: number;
  /** HTTP status the provider answered with, when there was one. */
  readonly upstreamStatus?: number;

  constructor(code: LLMErrorCode, message: string, status: number, upstreamStatus?: number) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.status = status;
    this.upstreamStatus = upstreamStatus;
  }
}

/** Map a provider's HTTP status to a friendly, non-technical error. */
export function upstreamError(status: number): LLMError {
  if (status === 401) {
    return new LLMError(
      'invalid_key',
      'The provider rejected your key. Check that it is correct and still active.',
      502,
      status,
    );
  }
  if (status === 403) {
    return new LLMError(
      'forbidden',
      'The provider refused the request. Your key may not have access to this model.',
      502,
      status,
    );
  }
  if (status === 404) {
    return new LLMError(
      'model_not_found',
      'The provider could not find that model. Check the model name in Settings.',
      502,
      status,
    );
  }
  if (status === 429) {
    return new LLMError(
      'rate_limited',
      'The provider says you hit a rate limit or ran out of credit. Wait a moment or check your plan.',
      429,
      status,
    );
  }
  if (status >= 500) {
    return new LLMError(
      'upstream_unavailable',
      'The provider is having trouble right now. Please try again shortly.',
      502,
      status,
    );
  }
  return new LLMError(
    'upstream_bad_request',
    'The provider rejected the request. The model name may be wrong or unsupported.',
    502,
    status,
  );
}

/** Turn anything thrown into an LLMError without leaking internals. */
export function toLLMError(err: unknown): LLMError {
  if (err instanceof LLMError) return err;
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
    return new LLMError('upstream_timeout', 'The provider took too long to answer. Please try again.', 504);
  }
  return new LLMError(
    'upstream_unreachable',
    'Could not reach the provider. Check your connection and try again.',
    502,
  );
}
