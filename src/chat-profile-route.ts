/** Profile URLs use the recipient's username, never their display name or numeric ID. */
export function chatProfilePath(username: string | undefined): string | null {
  const value = username?.trim();
  if (!value || value === '.' || value === '..' || /[\s\\/?#%]/.test(value)) return null;
  return `/${encodeURIComponent(value)}`;
}
