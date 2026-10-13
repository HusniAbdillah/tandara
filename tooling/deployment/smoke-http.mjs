import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3000';
assert.equal((await fetch(base + '/ready')).status, 200);
assert.equal((await fetch(base + '/api/v1/auth/me')).status, 401);
const headers = {
  'X-Tandara-Client': 'web',
  Origin: 'https://posko.tandora.my.id',
};
const login = await fetch(base + '/api/v1/auth/login', {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@demo.tandara.test', password: 'synthetic-smoke-only' }),
});
assert.equal(login.status, 201);
assert.equal(login.headers.get('cache-control'), 'no-store');
const cookies = login.headers.getSetCookie();
assert.equal(cookies.length, 2);
assert.ok(cookies.every((cookie) => /Secure/i.test(cookie) && /SameSite=Strict/i.test(cookie)));
const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
const csrf = cookies
  .find((value) => value.startsWith('tandara_csrf='))
  .split(';')[0]
  .slice('tandara_csrf='.length);
assert.equal((await fetch(base + '/api/v1/auth/me', { headers: { Cookie: cookie } })).status, 200);
assert.equal(
  (
    await fetch(base + '/api/v1/auth/logout', {
      method: 'POST',
      headers: { ...headers, Cookie: cookie },
    })
  ).status,
  403,
);
assert.equal(
  (
    await fetch(base + '/api/v1/auth/logout', {
      method: 'POST',
      headers: { ...headers, Cookie: cookie, 'X-CSRF-Token': csrf },
    })
  ).status,
  201,
);
assert.equal((await fetch(base + '/api/v1/auth/me', { headers: { Cookie: cookie } })).status, 401);
