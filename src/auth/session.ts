export type ChatPalezUser = {
  user_id: number | string;
  user_name?: string;
  user_firstname?: string;
  user_lastname?: string;
  user_fullname?: string;
  user_email?: string;
  user_picture?: string;
  [key: string]: unknown;
};

export type AuthSession = {
  token: string;
  user: ChatPalezUser;
};

const TOKEN_KEY = 'chatpalez.mobile.token';
const USER_KEY = 'chatpalez.mobile.user';

let current: AuthSession | null = readSession();

export function getSession(): AuthSession | null {
  return current;
}

export function getAuthToken(): string | null {
  return current?.token ?? null;
}

export function setSession(session: AuthSession): void {
  current = session;
  sessionStorage.setItem(TOKEN_KEY, session.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession(): void {
  current = null;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function readSession(): AuthSession | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const user = sessionStorage.getItem(USER_KEY);
  if (!token || !user) return null;

  try {
    return {
      token,
      user: JSON.parse(user) as ChatPalezUser
    };
  } catch {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}
