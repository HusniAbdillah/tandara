export function residentCsrf() {
  return (
    document.cookie
      .split('; ')
      .find((c) => c.startsWith('tandara_resident_csrf='))
      ?.split('=')[1] ?? ''
  );
}
