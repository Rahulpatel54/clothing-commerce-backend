'use strict';

/**
 * Edge Case & Boundary Verification Script
 * Executes automated HTTP requests against http://localhost:4000/api/v1
 */

const BASE_URL = 'http://localhost:4000/api/v1';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const config = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(url, config);
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = { rawText: text };
  }

  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    data: json,
  };
}

async function runEdgeCaseTests() {
  const report = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    findings: [],
  };

  function assert(testName, condition, details = {}) {
    report.totalTests++;
    if (condition) {
      report.passed++;
      console.log(`[PASS] ${testName}`);
    } else {
      report.failed++;
      console.error(`[FAIL] ${testName}`, details);
      report.findings.push({ test: testName, ...details });
    }
  }

  console.log('=== 1. Authentication & Token Boundary Tests ===');

  // Test 1.1: Missing Authorization Header on Protected Route
  const res1 = await request('/users');
  assert(
    'Missing auth token rejected with 401',
    res1.status === 401 && res1.data.success === false,
    { status: res1.status, body: res1.data }
  );

  // Test 1.2: Malformed Bearer Token
  const res2 = await request('/users', {
    headers: { Authorization: 'Bearer this-is-not-a-valid-jwt' },
  });
  assert(
    'Malformed JWT token rejected with 401',
    res2.status === 401 && res2.data.success === false,
    { status: res2.status, body: res2.data }
  );

  // Test 1.3: Empty Bearer Token
  const res3 = await request('/users', {
    headers: { Authorization: 'Bearer ' },
  });
  assert(
    'Empty bearer token rejected with 401',
    res3.status === 401 && res3.data.success === false,
    { status: res3.status, body: res3.data }
  );

  // Test 1.4: Brute-force bad login attempts (triggers account lock)
  const bruteEmail = `brute-${Date.now()}@example.com`;
  await request('/auth/register', {
    method: 'POST',
    body: {
      email: bruteEmail,
      phone: `+1555${Math.floor(1000000 + Math.random() * 9000000)}`,
      password: 'StrongPassword123!',
      firstName: 'Brute',
      lastName: 'Force',
    },
  });

  let lastLoginRes = null;
  for (let i = 0; i < 6; i++) {
    lastLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: bruteEmail, password: 'WrongPassword123!' },
    });
  }
  assert(
    'Invalid login attempts rejected with 401, 423 locked, or 429 rate limited',
    lastLoginRes.status === 401 || lastLoginRes.status === 423 || lastLoginRes.status === 429,
    { status: lastLoginRes.status, body: lastLoginRes.data }
  );

  console.log('\n=== 2. Multi-Tenant IDOR & Privilege Isolation Tests ===');

  // Register Customer A
  const emailA = `customer-a-${Date.now()}@test.com`;
  const phoneA = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;
  const regResA = await request('/auth/register', {
    method: 'POST',
    body: {
      email: emailA,
      phone: phoneA,
      password: 'StrongPassword123!',
      firstName: 'Customer',
      lastName: 'Alpha',
    },
  });

  const tokenA = regResA.data?.data?.tokens?.accessToken;
  const userAId = regResA.data?.data?.user?.id;

  // Register Customer B
  const emailB = `customer-b-${Date.now()}@test.com`;
  const phoneB = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;
  const regResB = await request('/auth/register', {
    method: 'POST',
    body: {
      email: emailB,
      phone: phoneB,
      password: 'StrongPassword123!',
      firstName: 'Customer',
      lastName: 'Beta',
    },
  });

  const tokenB = regResB.data?.data?.tokens?.accessToken;
  const userBId = regResB.data?.data?.user?.id;

  assert('Customer A registered successfully', !!tokenA, { status: regResA.status, body: regResA.data });
  assert('Customer B registered successfully', !!tokenB, { status: regResB.status, body: regResB.data });

  // Get Customer profiles
  const profileResA = await request('/customers/me', { headers: { Authorization: `Bearer ${tokenA}` } });
  const customerAId = profileResA.data?.data?.id;

  const profileResB = await request('/customers/me', { headers: { Authorization: `Bearer ${tokenB}` } });
  const customerBId = profileResB.data?.data?.id;

  // Test 2.1: Customer A attempts to access Customer B's profile
  const idorRes1 = await request(`/customers/${customerBId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(
    'Customer A accessing Customer B profile returns 403 Forbidden',
    idorRes1.status === 403,
    { status: idorRes1.status, body: idorRes1.data }
  );

  // Test 2.2: Customer A attempts to access Customer B's addresses
  const idorRes2 = await request(`/customers/${customerBId}/addresses`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(
    'Customer A accessing Customer B addresses returns 403 Forbidden',
    idorRes2.status === 403,
    { status: idorRes2.status, body: idorRes2.data }
  );

  // Test 2.3: Customer A attempts to access Customer B's wishlist
  const idorRes3 = await request(`/customers/${customerBId}/wishlist`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(
    'Customer A accessing Customer B wishlist returns 403 Forbidden',
    idorRes3.status === 403,
    { status: idorRes3.status, body: idorRes3.data }
  );

  // Test 2.4: Customer A attempts to access Admin-only routes
  const adminEndpoints = ['/users', '/expenses', '/finance/pnl', '/marketing/campaigns'];
  for (const ep of adminEndpoints) {
    const res = await request(ep, { headers: { Authorization: `Bearer ${tokenA}` } });
    assert(
      `Customer A accessing ${ep} returns 403 Forbidden`,
      res.status === 403,
      { status: res.status, endpoint: ep, body: res.data }
    );
  }

  console.log('\n=== 3. Mass-Assignment & Privilege Escalation Tests ===');

  // Test 3.1: Injecting admin role during registration
  const rogueEmail = `rogue-${Date.now()}@test.com`;
  const roguePhone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;
  const rogueReg = await request('/auth/register', {
    method: 'POST',
    body: {
      email: rogueEmail,
      phone: roguePhone,
      password: 'StrongPassword123!',
      firstName: 'Rogue',
      lastName: 'User',
      role: 'admin',
      roles: ['admin'],
      isStaff: true,
    },
  });

  const rogueToken = rogueReg.data?.data?.tokens?.accessToken;
  if (rogueToken) {
    // Attempt to access admin endpoint with rogue token
    const testAdmin = await request('/users', { headers: { Authorization: `Bearer ${rogueToken}` } });
    assert(
      'Mass-assignment of admin role during registration was blocked (returns 403 on admin routes)',
      testAdmin.status === 403,
      { status: testAdmin.status, body: testAdmin.data }
    );
  } else {
    assert(
      'Registration with rogue parameters was rejected or ignored',
      rogueReg.status === 201 || rogueReg.status === 400,
      { status: rogueReg.status, body: rogueReg.data }
    );
  }

  // Test 3.2: Customer trying to modify totalSpend or orderCount
  if (customerAId) {
    const patchCustRes = await request(`/customers/${customerAId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        totalSpend: '99999.00',
        orderCount: 500,
        notes: 'Hacked Notes',
      },
    });

    const verifyProfile = await request('/customers/me', { headers: { Authorization: `Bearer ${tokenA}` } });
    const spend = Number(verifyProfile.data?.data?.stats?.totalSpend || verifyProfile.data?.data?.totalSpend || 0);
    assert(
      'Customer cannot client-override derived totalSpend',
      spend < 99999,
      { currentSpend: spend }
    );
  }

  console.log('\n=== 4. Cart & Input Boundary Tests ===');

  // Test 4.1: Negative item quantity in cart
  const negCartRes = await request('/cart/items', {
    method: 'POST',
    headers: { 'x-session-id': 'test-session-boundary' },
    body: {
      variantId: '00000000-0000-0000-0000-000000000000',
      quantity: -5,
    },
  });
  assert(
    'Negative cart item quantity rejected with validation error (400 or 422)',
    negCartRes.status === 400 || negCartRes.status === 422,
    { status: negCartRes.status, body: negCartRes.data }
  );

  // Test 4.2: Quantity exceeding max variant cap (e.g. quantity: 99)
  const capCartRes = await request('/cart/items', {
    method: 'POST',
    headers: { 'x-session-id': 'test-session-boundary' },
    body: {
      variantId: '00000000-0000-0000-0000-000000000000',
      quantity: 99,
    },
  });
  assert(
    'Quantity exceeding cap rejected with validation error (400 or 422)',
    capCartRes.status === 400 || capCartRes.status === 422,
    { status: capCartRes.status, body: capCartRes.data }
  );

  // Test 4.3: Malformed UUID parameter
  const badUuidRes = await request('/products/not-a-valid-uuid');
  assert(
    'Malformed UUID route parameter rejected with 400/404/422 without 500 crash',
    badUuidRes.status === 400 || badUuidRes.status === 404 || badUuidRes.status === 422,
    { status: badUuidRes.status, body: badUuidRes.data }
  );

  console.log('\n=== 5. Idempotency Key Mechanics Tests ===');

  const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Create an address for customer A
  const addrRes = await request(`/customers/${customerAId}/addresses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: {
      label: 'Home',
      recipientName: 'Customer Alpha',
      phone: '+15551234567',
      line1: '123 Test Ave',
      city: 'Metro',
      state: 'CA',
      postalCode: '90001',
      country: 'US',
    },
  });
  const addressId = addrRes.data?.data?.id;

  // Add an item to customer A's cart
  let prods = await request('/products?limit=1');
  let variantId = prods.data?.data?.[0]?.variants?.[0]?.id || prods.data?.data?.rows?.[0]?.variants?.[0]?.id;

  let adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'admin@123' },
  });
  if (adminLogin.status !== 200) {
    adminLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'ChangeMe123!' },
    });
  }
  const adminToken = adminLogin.data?.data?.tokens?.accessToken;

  if (!variantId && adminToken) {
    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { name: `EdgeCase Cat ${Date.now()}` },
    });
    const catId = catRes.data?.data?.id;
    const prodRes = await request('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: `EdgeCase Product ${Date.now()}`,
        sku: `PROD-${Date.now()}`,
        categoryId: catId,
        price: 99.99,
        status: 'ACTIVE',
        variants: [{ sku: `EDGE-${Date.now()}`, size: 'M', color: 'Black', price: 99.99, initialStock: 50 }],
      },
    });
    variantId = prodRes.data?.data?.variants?.[0]?.id;
  }

  if (variantId && adminToken) {
    await request('/inventory/receive', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { variantId, quantity: 50 },
    });
  }

  if (variantId) {
    await request('/cart/items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { variantId, quantity: 1 },
    });
  }

  // Test 5.1: Send checkout with idempotency key
  const checkoutPayload1 = { addressId, useWalletBalance: false };

  const idemRes1 = await request('/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: checkoutPayload1,
  });

  if (idemRes1.status !== 201) {
    console.log('[DEBUG Test 5.1] checkout status:', idemRes1.status, 'error:', idemRes1.data?.error);
  }

  // Test 5.2: Replay identical payload with same idempotency key
  const idemRes2 = await request('/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: checkoutPayload1,
  });

  assert(
    'Replaying exact idempotency key returns identical status code',
    idemRes1.status === idemRes2.status,
    { firstStatus: idemRes1.status, secondStatus: idemRes2.status }
  );

  // Test 5.3: Replay same idempotency key with conflicting payload
  const checkoutPayload2 = { addressId, useWalletBalance: true };

  const idemRes3 = await request('/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: checkoutPayload2,
  });

  assert(
    'Replaying idempotency key with different payload triggers 409 Conflict',
    idemRes3.status === 409,
    { status: idemRes3.status, body: idemRes3.data }
  );

  console.log('\n=======================================');
  console.log(`Results: ${report.passed}/${report.totalTests} passed (${report.failed} failed)`);
  console.log('=======================================');

  return report;
}

runEdgeCaseTests()
  .then((res) => {
    process.exit(res.failed === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
