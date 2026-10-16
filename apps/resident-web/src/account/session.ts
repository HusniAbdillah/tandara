export function residentCsrf() {
  return (
    document.cookie
      .split('; ')
      .find((c) => c.startsWith('tandara_resident_csrf='))
      ?.split('=')[1] ?? ''
  );
}

export function returnPath(value: string | null) {
  if (!value) return null;
  try {
    const target = new URL(value, window.location.origin);
    if (
      target.origin !== window.location.origin ||
      ['/login', '/register'].includes(target.pathname)
    )
      return null;
    return target.pathname + target.search + target.hash;
  } catch {
    return null;
  }
}
