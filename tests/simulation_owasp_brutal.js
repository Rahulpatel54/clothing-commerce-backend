'use strict';

/**
 * Brutal Live OWASP Top 10 & Node.js Security Assessment Suite
 * Runs against the live Docker backend at http://localhost:4000/api/v1
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';

async function req(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, headers: res.headers, data };
  } catch (err) {
    return { status: 0, error: err.message };
  }
}

async function runBrutalOwaspTests() {
  console.log('=== STARTING BRUTAL OWASP TOP 10 & NODE.JS LIVE SECURITY AUDIT ===\n');

  let passed = 0;
  let total = 0;

  function assert(name, condition, details = {}) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${name}`);
    } else {
      console.error(`[FAIL] ${name}`, details);
    }
  }

  // 1. OWASP A01: Broken Access Control & IDOR
  console.log('--- 1. OWASP A01: Broken Access Control ---');

  // 1.1 Unauthenticated access to admin endpoints
  const adminEndpoints = ['/users', '/finance/pnl', '/expenses', '/marketing/campaigns'];
  for (const ep of adminEndpoints) {
    const r = await req(ep);
    assert(`Unauthenticated ${ep} blocked with 401`, r.status === 401, { status: r.status });
  }

  // 1.2 Path Traversal Attack
  const traversalPayloads = [
    '/products/../../../../etc/passwd',
    '/products/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '/products/..%2f..%2f.env',
    '/products/..\\..\\windows\\system.ini',
  ];
  for (const payload of traversalPayloads) {
    const r = await req(payload);
    assert(`Path traversal ${payload} safely handled (no 500 crash or leak)`, [400, 404].includes(r.status), { status: r.status });
  }

  // 1.3 CORS Origin Check
  const corsRes = await fetch(`${BASE_URL}/health/live`, {
    headers: { Origin: 'https://malicious-attacker-domain.com' },
  });
  const allowOrigin = corsRes.headers.get('access-control-allow-origin');
  assert('CORS does not blindly reflect malicious origin with credentials', allowOrigin !== 'https://malicious-attacker-domain.com' || corsRes.headers.get('access-control-allow-credentials') !== 'true');

  // 2. OWASP A02: Cryptographic Failures & Sensitive Information Leakage
  console.log('\n--- 2. OWASP A02: Cryptographic Failures ---');

  // 2.1 Verify responses never leak passwordHash or salt
  let loginRes = await req('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'admin@123' },
  });
  if (loginRes.status !== 200) {
    loginRes = await req('/auth/login', {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'ChangeMe123!' },
    });
  }
  const adminToken = loginRes.data?.data?.tokens?.accessToken;
  const userObj = loginRes.data?.data?.user || {};
  assert('Login response does not leak passwordHash or mfaSecret', userObj.passwordHash === undefined && userObj.mfaSecretEncrypted === undefined, { userObj });

  // 3. OWASP A03: Injection (SQLi, NoSQLi, CRLF)
  console.log('\n--- 3. OWASP A03: Injection Attacks ---');

  // 3.1 SQL Injection in Product Search
  const sqliPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT NULL, NULL, NULL --",
    "admin'--",
    "1' AND (SELECT COUNT(*) FROM users) > 0 --",
  ];
  for (const sql of sqliPayloads) {
    const r = await req(`/products?search=${encodeURIComponent(sql)}`);
    assert(`SQLi payload [${sql}] handled safely without SQL syntax error`, [200, 422].includes(r.status) && !JSON.stringify(r.data).includes('syntax error'), { status: r.status, data: r.data });
  }

  // 3.2 SQL Injection in Sorting Parameters
  const sortSqli = await req('/products?sort=name;SELECT+pg_sleep(5);--');
  assert('SQLi in sort parameter rejected by validation', sortSqli.status === 422, { status: sortSqli.status });

  // 3.3 HTTP Header / CRLF Injection attempt
  const crlfRes = await req('/health/live', {
    headers: { 'X-Custom': 'test\r\nInjected-Header: evil\r\n\r\n' },
  });
  assert('CRLF injection handled safely', crlfRes.status !== 500);

  // 4. OWASP A04: Insecure Design & Business Logic Hardening
  console.log('\n--- 4. OWASP A04: Business Logic & Parameter Tampering ---');

  // 4.1 Negative & Decimal Quantity in Cart Add
  const badQty1 = await req('/cart/items', {
    method: 'POST',
    headers: { 'x-session-id': 'brutal-test-session' },
    body: { variantId: '550e8400-e29b-41d4-a716-446655440000', quantity: -10 },
  });
  assert('Negative cart quantity rejected with 422', badQty1.status === 422, { status: badQty1.status });

  const badQty2 = await req('/cart/items', {
    method: 'POST',
    headers: { 'x-session-id': 'brutal-test-session' },
    body: { variantId: '550e8400-e29b-41d4-a716-446655440000', quantity: 1.99 },
  });
  assert('Fractional cart quantity rejected with 422', badQty2.status === 422, { status: badQty2.status });

  // 4.2 XSS Payloads in UGC Caption / Text Fields
  const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
  const dummyCust = await req('/auth/register', {
    method: 'POST',
    body: {
      email: `xss-tester-${Date.now()}@example.com`,
      phone: `+1555${Math.floor(1000000 + Math.random() * 9000000)}`,
      password: 'StrongPassword123!',
      firstName: xssPayload,
      lastName: 'Tester',
    },
  });
  const custToken = dummyCust.data?.data?.tokens?.accessToken;
  assert('XSS payload in user registration accepted/handled safely without executing', dummyCust.status === 201 || dummyCust.status === 422);

  // 5. OWASP A05: Security Misconfiguration
  console.log('\n--- 5. OWASP A05: Security Misconfiguration ---');
  const liveCheck = await req('/health/live');
  const headers = liveCheck.headers;
  assert('Content-Security-Policy header present', headers.get('content-security-policy') !== null);
  assert('X-Content-Type-Options: nosniff header present', headers.get('x-content-type-options') === 'nosniff');
  assert('X-Frame-Options: SAMEORIGIN header present', headers.get('x-frame-options') === 'SAMEORIGIN');
  assert('X-Powered-By header is concealed', headers.get('x-powered-by') === null);

  // 6. OWASP A07: Authentication & Session Attacks
  console.log('\n--- 6. OWASP A07: Authentication Security ---');

  // 6.1 JWT alg: none attack
  const noneAlgToken = [
    Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: 'admin', roles: ['admin'] })).toString('base64url'),
    '',
  ].join('.');
  const noneAlgRes = await req('/auth/me', { token: noneAlgToken });
  assert('JWT alg: none forged token rejected with 401', noneAlgRes.status === 401, { status: noneAlgRes.status });

  // 6.2 Malformed JWT
  const malformedRes = await req('/auth/me', { token: 'invalid.jwt.signature' });
  assert('Malformed JWT token rejected with 401', malformedRes.status === 401);

  // 7. Node.js Specific Vulnerabilities: Prototype Pollution & Payload Limits
  console.log('\n--- 7. Node.js Specific Vulnerabilities ---');

  // 7.1 Prototype Pollution payload via __proto__
  const ppRes1 = await req('/categories', {
    method: 'POST',
    token: adminToken,
    body: JSON.parse('{"__proto__": {"pollutedLive": true}, "name": "Security Test Cat"}'),
  });
  assert('Prototype pollution payload via __proto__ did not crash server', [201, 400, 401, 422].includes(ppRes1.status));

  // 7.2 Prototype Pollution payload via constructor.prototype
  const ppRes2 = await req('/categories', {
    method: 'POST',
    token: adminToken,
    body: JSON.parse('{"constructor": {"prototype": {"adminLive": true}}, "name": "Security Test Cat 2"}'),
  });
  assert('Prototype pollution via constructor.prototype did not crash server', [201, 400, 401, 422].includes(ppRes2.status));

  // 7.3 ReDoS / Pathological input strings
  const redosStr = 'a'.repeat(5000) + '!@#$';
  const redosRes = await req(`/products?search=${encodeURIComponent(redosStr)}`);
  assert('Long pathological string handled without event-loop timeout', [200, 422].includes(redosRes.status));

  // 7.4 Malformed JSON in body
  const rawMalformedRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": "broken-json, without-closing',
  });
  assert('Malformed JSON body returns 400 without crashing', rawMalformedRes.status === 400);

  console.log('\n=======================================');
  console.log(`TOTAL SECURITY CHECKS: ${passed}/${total} PASSED`);
  console.log('=======================================');
}

runBrutalOwaspTests().catch(console.error);
