/** Redirect client → /login când sesiunea e invalidă (401). */

export function redirectToLogin(nextPath?: string): void {
  if (typeof window === "undefined") return;
  const path =
    nextPath ?? `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams();
  if (path && path !== "/login" && !path.startsWith("/login?")) {
    params.set("next", path);
  }
  const q = params.toString();
  window.location.replace(q ? `/login?${q}` : "/login");
}

/** Dacă status e 401, redirecționează și returnează true. */
export function handleUnauthorized(
  res: Pick<Response, "status">,
  nextPath?: string,
): boolean {
  if (res.status !== 401) return false;
  redirectToLogin(nextPath);
  return true;
}
