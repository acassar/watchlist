import type { ApiError } from '@watchlist/shared';

/** Erreur renvoyée par l'API, avec son code stable (voir AuthErrorCode). */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: NonNullable<ApiError['issues']>;

  constructor(
    status: number,
    code: string,
    message: string,
    issues: ApiError['issues'] = [],
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

/**
 * Branchement de l'auth sur le client HTTP, fourni par le store d'auth.
 * Évite une dépendance circulaire client HTTP ↔ store.
 */
export interface AuthHooks {
  getAccessToken(): string | null;
  /** Rafraîchit la session ; renvoie false si elle est perdue. */
  refresh(): Promise<boolean>;
}

let authHooks: AuthHooks | null = null;

export function setAuthHooks(hooks: AuthHooks | null) {
  authHooks = hooks;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Ajoute le JWT et retente une fois après refresh si l'API répond 401. Vrai par défaut. */
  auth?: boolean;
}

/** Appel à l'API (même domaine, sous /api). */
export async function api<T = void>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true } = options;
  let response = await send(path, options, auth);

  if (response.status === 401 && auth && authHooks) {
    if (await authHooks.refresh()) response = await send(path, options, auth);
  }
  return parse<T>(response);
}

function send(path: string, options: RequestOptions, auth: boolean) {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const token = auth ? authHooks?.getAccessToken() : null;
  if (token) headers.authorization = `Bearer ${token}`;

  return fetch(`/api${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    // Le cookie de refresh (httpOnly, SameSite=Strict) part tout seul : même domaine.
    credentials: 'same-origin',
  });
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const error = (data ?? {}) as Partial<ApiError>;
    throw new ApiRequestError(
      response.status,
      error.code ?? 'NETWORK_ERROR',
      error.message ?? response.statusText,
      error.issues,
    );
  }
  return data as T;
}
