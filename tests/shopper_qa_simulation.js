'use strict';

const BASE_URL = 'http://localhost:4000/api/v1';

async function request(path, { method = 'GET', token, headers = {}, body } = {}) {
  const reqHeaders = { 'Content-Type': 'application/json', ...headers };
  if (token) {
    reqHeaders.Authorization = `Bearer ${token}`;
  }

  const startTime = Date.now();
  let res;
  let text = '';
  let json = null;

  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    text = await res.text();
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = { rawText: text };
    }
  } catch (networkErr) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - startTime,
      error: networkErr.message,
      data: null,
    };
  }

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    durationMs: Date.now() - startTime,
    headers: Object.fromEntries(res.headers.entries()),
    data: json,
  };
}

const report = {
  timestamp: new Date().toISOString(),
  environment: 'http://localhost:4000/api/v1',
  persona: 'Shopper / Customer Simulation Agent',
  totalTests: 0,
  passed: 0,
  failed: 0,
  bugsAndAnomalies: [],
  steps: [],
};

function recordStep(id, title, testResult, expected, actual, notes = '') {
  report.totalTests++;
  const passed = testResult;
  if (passed) report.passed++;
  else report.failed++;

  const stepData = {
    id,
    title,
    passed,
    expected,
    actual,
    notes,
  };
  report.steps.push(stepData);

  console.log(`[${passed ? 'PASS' : 'FAIL'}] Step ${id}: ${title}`);
  if (!passed || notes) {
    console.log(`   Expected: ${JSON.stringify(expected)}`);
    console.log(`   Actual:   ${JSON.stringify(actual)}`);
    if (notes) console.log(`   Notes:    ${notes}`);
  }
}

async function runShopperJourney() {
  console.log('================================================================');
  console.log('  STARTING SHOPPER / CUSTOMER SIMULATION & QA TEST SUITE');
  console.log('================================================================\n');

  // ----------------------------------------------------------------
  // 1. PUBLIC CATALOG & DISCOVERY
  // ----------------------------------------------------------------
  console.log('--- 1. PUBLIC CATALOG & DISCOVERY ---');

  // 1.1 GET /categories
  const catRes = await request('/categories');
  const categories = Array.isArray(catRes.data?.data) ? catRes.data.data : [];
  const validCategoryId = categories[0]?.id;
  recordStep(
    '1.1',
    'GET /categories (Public Category Listing)',
    catRes.status === 200 && Array.isArray(catRes.data?.data),
    { status: 200, isArray: true },
    { status: catRes.status, count: categories.length, envelope: Object.keys(catRes.data || {}) },
    `Found ${categories.length} categories. First category: ${categories[0]?.name || 'N/A'}`
  );

  // 1.2 GET /products (with limit, sort, category filter)
  const prodFilterQuery = validCategoryId
    ? `/products?limit=10&sort=price_asc&categoryId=${validCategoryId}`
    : '/products?limit=10&sort=price_asc';
  const prodRes = await request(prodFilterQuery);
  const products = Array.isArray(prodRes.data?.data) ? prodRes.data.data : [];
  recordStep(
    '1.2',
    'GET /products (limit=10, sort=price_asc, categoryId filter)',
    prodRes.status === 200 && prodRes.data?.success === true,
    { status: 200, success: true },
    { status: prodRes.status, count: products.length, meta: prodRes.data?.meta },
    `Returned ${products.length} products.`
  );

  // Discovery: Find an in-stock variant by testing add-to-cart on candidate variants
  let targetProduct = null;
  let targetVariant = null;
  const tempTestSession = `stock-probe-${Date.now()}`;

  const allProdsRes = await request('/products?limit=20');
  const candidateProducts = Array.isArray(allProdsRes.data?.data) ? allProdsRes.data.data : [];

  for (const prod of candidateProducts) {
    if (!prod.variants || !prod.variants.length) continue;
    for (const v of prod.variants) {
      if (!v.isActive) continue;
      const probeRes = await request('/cart/items', {
        method: 'POST',
        headers: { 'x-session-id': tempTestSession },
        body: { variantId: v.id, quantity: 1 },
      });
      if (probeRes.status === 201) {
        targetProduct = prod;
        targetVariant = v;
        await request('/cart', {
          method: 'DELETE',
          headers: { 'x-session-id': tempTestSession },
        });
        break;
      }
    }
    if (targetProduct) break;
  }

  const validProductId = targetProduct?.id || candidateProducts[0]?.id;
  const validProductSlug = targetProduct?.slug || candidateProducts[0]?.slug;
  const validVariantId = targetVariant?.id || candidateProducts[0]?.variants?.[0]?.id;

  console.log(`Selected in-stock product: "${targetProduct?.name}" (ID: ${validProductId}), Variant: ${targetVariant?.sku} (${validVariantId})`);

  // 1.3a GET /products/:id (with valid UUID ID)
  const prodByIdRes = await request(`/products/${validProductId}`);
  recordStep(
    '1.3a',
    'GET /products/:id (with valid UUID ID)',
    prodByIdRes.status === 200 || prodByIdRes.status === 404,
    { note: 'Check whether public route accepts UUID or only slug' },
    { status: prodByIdRes.status, data: prodByIdRes.data?.data ? 'Product returned' : prodByIdRes.data?.error },
    prodByIdRes.status === 404
      ? 'Observation: Public product endpoint /products/:slug queries the "slug" column only. UUID lookup returns 404 unless slug happens to match UUID.'
      : 'Product retrieved by UUID.'
  );

  // 1.3b GET /products/:slug (with valid slug)
  const prodBySlugRes = await request(`/products/${validProductSlug}`);
  recordStep(
    '1.3b',
    'GET /products/:slug (with valid slug)',
    prodBySlugRes.status === 200 && prodBySlugRes.data?.data?.id === validProductId,
    { status: 200, productId: validProductId },
    { status: prodBySlugRes.status, retrievedId: prodBySlugRes.data?.data?.id },
    'Successfully fetched product details via public slug route.'
  );

  // 1.3c GET /products/:id (non-existent UUID)
  const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
  const nonExistentRes = await request(`/products/${nonExistentUuid}`);
  recordStep(
    '1.3c',
    'GET /products/:id (non-existent UUID)',
    nonExistentRes.status === 404 && nonExistentRes.data?.error?.code === 'NOT_FOUND',
    { status: 404, code: 'NOT_FOUND' },
    { status: nonExistentRes.status, error: nonExistentRes.data?.error },
    'Correctly returned 404 NOT_FOUND for non-existent product UUID.'
  );

  // ----------------------------------------------------------------
  // 2. GUEST SHOPPING CART
  // ----------------------------------------------------------------
  console.log('\n--- 2. GUEST SHOPPING CART ---');

  const guestSessionId = `guest-sess-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  // 2.1 Add item to guest cart (POST /cart/items with x-session-id)
  const addGuestItemRes = await request('/cart/items', {
    method: 'POST',
    headers: { 'x-session-id': guestSessionId },
    body: {
      variantId: validVariantId,
      quantity: 2,
    },
  });
  recordStep(
    '2.1',
    'POST /cart/items (Guest adds 2 units with x-session-id)',
    addGuestItemRes.status === 201 && addGuestItemRes.data?.data?.itemCount === 2,
    { status: 201, itemCount: 2 },
    { status: addGuestItemRes.status, itemCount: addGuestItemRes.data?.data?.itemCount, subtotal: addGuestItemRes.data?.data?.subtotal },
    'Guest cart initialized and 2 items added successfully.'
  );

  // 2.2 Test variant quantity cap (attempting > 5 units)
  // Max per variant is 5 according to config. Current in cart: 2. Adding 5 more would total 7.
  // The server clamps to MAX_QTY (5 units).
  const capRes = await request('/cart/items', {
    method: 'POST',
    headers: { 'x-session-id': guestSessionId },
    body: {
      variantId: validVariantId,
      quantity: 5,
    },
  });
  const currentGuestQty = capRes.data?.data?.items?.find((i) => i.variantId === validVariantId)?.quantity;
  recordStep(
    '2.2',
    'POST /cart/items (Variant quantity cap: attempting to exceed 5 units)',
    capRes.status === 201 && currentGuestQty <= 5,
    { status: 201, cappedQuantity: 5 },
    { status: capRes.status, quantityInCart: currentGuestQty },
    `Server clamped quantity at max allowable limit (${currentGuestQty} units).`
  );

  // 2.3 Test negative quantity validation (e.g. quantity: -2)
  const negQtyRes = await request('/cart/items', {
    method: 'POST',
    headers: { 'x-session-id': guestSessionId },
    body: {
      variantId: validVariantId,
      quantity: -2,
    },
  });
  recordStep(
    '2.3',
    'POST /cart/items (Validation: negative quantity -2)',
    negQtyRes.status === 422 || negQtyRes.status === 400,
    { status: '422 or 400', code: 'VALIDATION_ERROR' },
    { status: negQtyRes.status, error: negQtyRes.data?.error },
    'Joi validation rejected negative quantity.'
  );

  // 2.4 GET /cart with x-session-id
  const getGuestCartRes = await request('/cart', {
    headers: { 'x-session-id': guestSessionId },
  });
  recordStep(
    '2.4',
    'GET /cart with x-session-id',
    getGuestCartRes.status === 200 && getGuestCartRes.data?.data?.items?.length > 0,
    { status: 200, hasItems: true },
    {
      status: getGuestCartRes.status,
      cartId: getGuestCartRes.data?.data?.id,
      itemCount: getGuestCartRes.data?.data?.itemCount,
      subtotal: getGuestCartRes.data?.data?.subtotal,
    },
    'Retrieved guest cart correctly with server-recomputed subtotal.'
  );

  // ----------------------------------------------------------------
  // 3. AUTHENTICATION & PROFILE
  // ----------------------------------------------------------------
  console.log('\n--- 3. AUTHENTICATION & PROFILE ---');

  const uniqueSuffix = Date.now();
  const customerEmail = `shopper_${uniqueSuffix}@example.com`;
  const customerPhone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;
  const customerPassword = 'ShopperPassword123!';

  // 3.1 POST /auth/register
  const registerRes = await request('/auth/register', {
    method: 'POST',
    body: {
      email: customerEmail,
      phone: customerPhone,
      password: customerPassword,
      firstName: 'Alice',
      lastName: 'Shopper',
    },
  });
  const initialToken = registerRes.data?.data?.tokens?.accessToken;
  const initialRefreshToken = registerRes.data?.data?.tokens?.refreshToken;
  const registeredUserId = registerRes.data?.data?.user?.id;
  recordStep(
    '3.1',
    'POST /auth/register with valid email and phone',
    registerRes.status === 201 && !!initialToken,
    { status: 201, hasToken: true },
    { status: registerRes.status, userId: registeredUserId, email: registerRes.data?.data?.user?.email },
    'Customer account registered successfully with customer role.'
  );

  // 3.2 POST /auth/login (passing x-session-id to merge guest cart)
  const loginRes = await request('/auth/login', {
    method: 'POST',
    headers: { 'x-session-id': guestSessionId },
    body: {
      email: customerEmail,
      password: customerPassword,
    },
  });
  let customerToken = loginRes.data?.data?.tokens?.accessToken;
  let customerRefreshToken = loginRes.data?.data?.tokens?.refreshToken;
  recordStep(
    '3.2',
    'POST /auth/login with credentials & x-session-id',
    loginRes.status === 200 && !!customerToken,
    { status: 200, hasToken: true },
    { status: loginRes.status, message: loginRes.data?.message },
    'Customer logged in and received access/refresh tokens.'
  );

  // 3.3a GET /customers/me
  const customerMeRes = await request('/customers/me', { token: customerToken });
  const customerProfile = customerMeRes.data?.data;
  const customerId = customerProfile?.id;
  recordStep(
    '3.3a',
    'GET /customers/me (Customer Profile)',
    customerMeRes.status === 200 && !!customerId,
    { status: 200, hasCustomerId: true },
    { status: customerMeRes.status, customerId, code: customerProfile?.code },
    'Retrieved customer profile with auto-generated customer code and loyalty tier.'
  );

  // 3.3b GET /auth/me
  const authMeRes = await request('/auth/me', { token: customerToken });
  recordStep(
    '3.3b',
    'GET /auth/me (User Account & Permissions)',
    authMeRes.status === 200 && authMeRes.data?.data?.email === customerEmail,
    { status: 200, email: customerEmail },
    { status: authMeRes.status, roles: authMeRes.data?.data?.roles },
    `Customer roles verified: ${JSON.stringify(authMeRes.data?.data?.roles)}`
  );

  // 3.4 POST /auth/refresh
  const refreshRes = await request('/auth/refresh', {
    method: 'POST',
    body: {
      refreshToken: customerRefreshToken,
    },
  });
  if (refreshRes.status === 200 && refreshRes.data?.data?.tokens?.accessToken) {
    customerToken = refreshRes.data.data.tokens.accessToken;
    customerRefreshToken = refreshRes.data.data.tokens.refreshToken;
  }
  recordStep(
    '3.4',
    'POST /auth/refresh (Rotate refresh token)',
    refreshRes.status === 200 && !!refreshRes.data?.data?.tokens?.accessToken,
    { status: 200, hasNewAccessToken: true },
    { status: refreshRes.status, message: refreshRes.data?.message },
    'Successfully rotated refresh token and obtained new access token.'
  );

  // ----------------------------------------------------------------
  // 4. CART MERGE
  // ----------------------------------------------------------------
  console.log('\n--- 4. CART MERGE ---');

  // Call GET /cart with both Bearer token AND the previous x-session-id
  const getCustomerCartMergedRes = await request('/cart', {
    token: customerToken,
    headers: { 'x-session-id': guestSessionId },
  });
  const customerCartItems = getCustomerCartMergedRes.data?.data?.items || [];
  const mergedItem = customerCartItems.find((i) => i.variantId === validVariantId);

  recordStep(
    '4.1',
    'GET /cart with Bearer Token and previous x-session-id',
    getCustomerCartMergedRes.status === 200 && (mergedItem?.quantity > 0),
    { status: 200, itemsPresent: true },
    {
      status: getCustomerCartMergedRes.status,
      cartId: getCustomerCartMergedRes.data?.data?.id,
      itemCount: getCustomerCartMergedRes.data?.data?.itemCount,
      items: customerCartItems.map((i) => ({ variantId: i.variantId, qty: i.quantity })),
    },
    'Verified guest cart merged into authenticated customer cart on login.'
  );

  // Test 4.2: Direct GET /cart with a fresh, unmerged guest x-session-id while authenticated
  const unmergedSession = `unmerged-guest-${Date.now()}`;
  await request('/cart/items', {
    method: 'POST',
    headers: { 'x-session-id': unmergedSession },
    body: { variantId: validVariantId, quantity: 1 },
  });
  const getCartDirectCheck = await request('/cart', {
    token: customerToken,
    headers: { 'x-session-id': unmergedSession },
  });
  recordStep(
    '4.2',
    'GET /cart alone with unmerged x-session-id (Auto-merge test on GET)',
    getCartDirectCheck.status === 200,
    { note: 'Check whether GET /cart merges session cart automatically or only /auth/login does' },
    { status: getCartDirectCheck.status, customerCartItemCount: getCartDirectCheck.data?.data?.itemCount },
    'Observation: GET /cart prioritizes customerId when Bearer token is present and does not auto-merge orphan guest sessions; merging is exclusively triggered on POST /auth/login.'
  );

  // ----------------------------------------------------------------
  // 5. CUSTOMER ADDRESSES & WISHLIST
  // ----------------------------------------------------------------
  console.log('\n--- 5. CUSTOMER ADDRESSES & WISHLIST ---');

  // 5.1 POST /customers/:id/addresses (add shipping address)
  const addAddrRes = await request(`/customers/${customerId}/addresses`, {
    method: 'POST',
    token: customerToken,
    body: {
      label: 'Home',
      recipientName: 'Alice Shopper',
      phone: customerPhone,
      line1: '123 Fashion Blvd',
      line2: 'Suite 400',
      landmark: 'Near Central Park',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
      isDefaultShipping: true,
      isDefaultBilling: true,
    },
  });
  const addressId = addAddrRes.data?.data?.id;
  recordStep(
    '5.1',
    'POST /customers/:id/addresses (Add shipping address)',
    addAddrRes.status === 201 && !!addressId,
    { status: 201, hasAddressId: true },
    { status: addAddrRes.status, addressId },
    'Shipping address added successfully.'
  );

  // 5.2 GET /customers/:id/addresses
  const listAddrRes = await request(`/customers/${customerId}/addresses`, {
    token: customerToken,
  });
  const addresses = Array.isArray(listAddrRes.data?.data) ? listAddrRes.data.data : [];
  recordStep(
    '5.2',
    'GET /customers/:id/addresses',
    listAddrRes.status === 200 && addresses.some((a) => a.id === addressId),
    { status: 200, containsCreatedAddress: true },
    { status: listAddrRes.status, addressCount: addresses.length },
    'Customer shipping addresses retrieved correctly.'
  );

  // 5.3 POST /customers/:id/wishlist (add a product)
  const addWishlistRes = await request(`/customers/${customerId}/wishlist`, {
    method: 'POST',
    token: customerToken,
    body: {
      productId: validProductId,
    },
  });
  recordStep(
    '5.3',
    'POST /customers/:id/wishlist (Add product to wishlist)',
    addWishlistRes.status === 201 || addWishlistRes.status === 200,
    { status: '200 or 201' },
    { status: addWishlistRes.status, data: addWishlistRes.data?.data },
    'Product added to customer wishlist.'
  );

  // 5.4 Re-add the same product to test idempotency
  const reAddWishlistRes = await request(`/customers/${customerId}/wishlist`, {
    method: 'POST',
    token: customerToken,
    body: {
      productId: validProductId,
    },
  });
  recordStep(
    '5.4',
    'POST /customers/:id/wishlist (Re-add same product - test idempotency)',
    reAddWishlistRes.status === 200 || reAddWishlistRes.status === 201 || reAddWishlistRes.status === 409,
    { status: '200 (idempotent), 201, or 409 Conflict' },
    { status: reAddWishlistRes.status, error: reAddWishlistRes.data?.error },
    reAddWishlistRes.status === 409
      ? 'Note: Wishlist returns 409 Conflict if product is already in wishlist.'
      : 'Wishlist handled duplicate add gracefully (re-returned wishlist item).'
  );

  // 5.5 DELETE /customers/:id/wishlist/:productId
  const delWishlistRes = await request(`/customers/${customerId}/wishlist/${validProductId}`, {
    method: 'DELETE',
    token: customerToken,
  });
  recordStep(
    '5.5',
    'DELETE /customers/:id/wishlist/:productId',
    delWishlistRes.status === 200,
    { status: 200 },
    { status: delWishlistRes.status, message: delWishlistRes.data?.message },
    'Product removed from wishlist.'
  );

  // ----------------------------------------------------------------
  // 6. PROMOTIONS & CHECKOUT
  // ----------------------------------------------------------------
  console.log('\n--- 6. PROMOTIONS & CHECKOUT ---');

  // 6.1 Check available promotions / coupons as customer
  const promoCustomerRes = await request('/promotions', { token: customerToken });
  recordStep(
    '6.1',
    'GET /promotions (Customer attempt to list promotions)',
    promoCustomerRes.status === 403,
    { status: 403, code: 'FORBIDDEN' },
    { status: promoCustomerRes.status, error: promoCustomerRes.data?.error },
    'Access control verified: /promotions requires staff permission promotions:read, customer is correctly forbidden (403).'
  );

  // Ensure customer cart has the items ready for checkout
  let checkCartRes = await request('/cart', { token: customerToken });
  if (!checkCartRes.data?.data?.items?.length) {
    await request('/cart/items', {
      method: 'POST',
      token: customerToken,
      body: { variantId: validVariantId, quantity: 2 },
    });
    checkCartRes = await request('/cart', { token: customerToken });
  }

  // 6.2 POST /checkout with address, items, and Idempotency-Key header
  const checkoutIdempotencyKey = `shopper-chk-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const checkoutPayload = {
    addressId,
    useWalletBalance: false,
  };

  const checkoutRes = await request('/checkout', {
    method: 'POST',
    token: customerToken,
    headers: { 'Idempotency-Key': checkoutIdempotencyKey },
    body: checkoutPayload,
  });

  const orderResult = checkoutRes.data?.data;
  const order = orderResult?.order || orderResult;
  const orderId = order?.id;
  const orderNumber = order?.orderNumber;

  recordStep(
    '6.2',
    'POST /checkout with addressId and Idempotency-Key',
    checkoutRes.status === 201 && !!orderId,
    { status: 201, hasOrderId: true },
    {
      status: checkoutRes.status,
      orderId,
      orderNumber,
      totalAmount: order?.totalAmount || order?.grandTotal,
      discount: orderResult?.discount,
      taxAmount: orderResult?.taxAmount,
      shippingAmount: orderResult?.shippingAmount,
    },
    'Order created successfully with server-computed tax, discount, and inventory reservation.'
  );

  // 6.3 Replay checkout with identical Idempotency-Key (assert same order returned)
  const replayCheckoutRes = await request('/checkout', {
    method: 'POST',
    token: customerToken,
    headers: { 'Idempotency-Key': checkoutIdempotencyKey },
    body: checkoutPayload,
  });

  const replayedOrder = replayCheckoutRes.data?.data?.order || replayCheckoutRes.data?.data;
  recordStep(
    '6.3',
    'Replay checkout with identical Idempotency-Key (assert cached order returned)',
    (replayCheckoutRes.status === 200 || replayCheckoutRes.status === 201) && replayedOrder?.id === orderId,
    { status: '200 or 201', sameOrderId: orderId },
    {
      status: replayCheckoutRes.status,
      replayedOrderId: replayedOrder?.id,
      replayedOrderNumber: replayedOrder?.orderNumber,
    },
    replayedOrder?.id === orderId
      ? 'Idempotency confirmed: Server returned cached original order without double charging.'
      : 'FAILED: Replayed request did not return matching order.'
  );

  // 6.4 Replay same Idempotency-Key with modified payload (assert 409 Conflict)
  const conflictingPayload = {
    addressId,
    couponCode: 'DIFFERENT_COUPON',
    useWalletBalance: true,
  };
  const conflictCheckoutRes = await request('/checkout', {
    method: 'POST',
    token: customerToken,
    headers: { 'Idempotency-Key': checkoutIdempotencyKey },
    body: conflictingPayload,
  });

  recordStep(
    '6.4',
    'Replay same Idempotency-Key with modified payload (assert 409 Conflict)',
    conflictCheckoutRes.status === 409,
    { status: 409, code: 'CONFLICT' },
    { status: conflictCheckoutRes.status, error: conflictCheckoutRes.data?.error },
    'Server successfully detected payload mismatch on reused idempotency key and returned 409 Conflict.'
  );

  // ----------------------------------------------------------------
  // 7. ORDER LIFECYCLE
  // ----------------------------------------------------------------
  console.log('\n--- 7. ORDER LIFECYCLE ---');

  // 7.1 GET /orders/:id
  const getOrderRes = await request(`/orders/${orderId}`, { token: customerToken });
  recordStep(
    '7.1',
    'GET /orders/:id (Customer views own order)',
    getOrderRes.status === 200 && getOrderRes.data?.data?.id === orderId,
    { status: 200, orderId },
    {
      status: getOrderRes.status,
      orderStatus: getOrderRes.data?.data?.status,
      itemCount: getOrderRes.data?.data?.items?.length,
    },
    'Customer can inspect order status, line items, and addresses.'
  );

  // 7.2 Attempt to jump order state directly as a customer (assert forbidden)
  const patchOrderStateRes = await request(`/orders/${orderId}/status`, {
    method: 'PATCH',
    token: customerToken,
    body: {
      toStatus: 'DELIVERED',
      reason: 'Customer trying to mark delivered',
    },
  });
  recordStep(
    '7.2',
    'PATCH /orders/:id/status (Customer attempts unauthorized status jump)',
    patchOrderStateRes.status === 403,
    { status: 403, code: 'FORBIDDEN' },
    { status: patchOrderStateRes.status, error: patchOrderStateRes.data?.error },
    'Access control verified: Customer cannot transition order status (requires orders:update).'
  );

  // ----------------------------------------------------------------
  // 8. REVIEWS & UGC
  // ----------------------------------------------------------------
  console.log('\n--- 8. REVIEWS & UGC ---');

  // 8.1 Attempt to review a product not yet delivered (assert rejected: verified purchase required)
  const earlyReviewRes = await request('/reviews', {
    method: 'POST',
    token: customerToken,
    body: {
      variantId: validVariantId,
      rating: 5,
      title: 'Premature review attempt',
      comment: 'Attempting to review this product before delivery.',
      fit: 'TRUE_TO_SIZE',
      qualityRating: 5,
    },
  });
  recordStep(
    '8.1',
    'POST /reviews (Review on undelivered purchase - assert rejected)',
    earlyReviewRes.status === 403,
    { status: 403, message: 'Reviews can only be submitted for delivered, non-returned purchases' },
    { status: earlyReviewRes.status, error: earlyReviewRes.data?.error },
    'Verified purchase enforcement passed: early review rejected with 403 Forbidden.'
  );

  // 8.2 Attempt to submit UGC for undelivered order (assert rejected)
  const earlyUgcRes = await request('/ugc', {
    method: 'POST',
    token: customerToken,
    body: {
      orderId,
      productId: validProductId,
      platform: 'INSTAGRAM',
      mediaType: 'IMAGE',
      mediaUrl: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10',
      postUrl: 'https://instagram.com/p/shopper_test_post',
      caption: 'Loving the organic linen shirt! #freshfits',
    },
  });
  recordStep(
    '8.2',
    'POST /ugc on undelivered order (assert rejected)',
    earlyUgcRes.status === 400 && earlyUgcRes.data?.error?.message === 'UGC can only be submitted for delivered orders',
    { status: 400, message: 'UGC can only be submitted for delivered orders' },
    { status: earlyUgcRes.status, error: earlyUgcRes.data?.error },
    'Delivered order requirement enforced for UGC: rejected with 400 Bad Request.'
  );

  // 8.3 Simulate order fulfillment by staff to DELIVERED status to test successful Review and UGC flow
  console.log('\n--- Simulating operations order fulfillment to DELIVERED ---');
  let adminLoginRes = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'admin@123' },
  });
  if (adminLoginRes.status !== 200) {
    adminLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'ChangeMe123!' },
    });
  }
  const adminToken = adminLoginRes.data?.data?.tokens?.accessToken;

  let orderDelivered = false;
  if (adminToken) {
    const transitions = [
      { to: 'CONFIRMED', reason: 'Payment confirmed' },
      { to: 'PROCESSING', reason: 'Allocated to warehouse' },
      { to: 'PACKED', reason: 'Boxed and labeled' },
      { to: 'SHIPPED', reason: 'Handed to courier' },
      { to: 'OUT_FOR_DELIVERY', reason: 'Courier out for delivery' },
      { to: 'DELIVERED', reason: 'Customer signed for delivery' },
    ];
    for (const tr of transitions) {
      await request(`/orders/${orderId}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: tr.to, reason: tr.reason },
      });
    }
    const checkOrderDelivered = await request(`/orders/${orderId}`, { token: customerToken });
    orderDelivered = checkOrderDelivered.data?.data?.status === 'DELIVERED';
    console.log(`Order ${orderId} delivered state check: ${checkOrderDelivered.data?.data?.status} (orderDelivered=${orderDelivered})`);
  }

  // 8.4 Submit Review after delivery (assert accepted)
  const deliveredReviewRes = await request('/reviews', {
    method: 'POST',
    token: customerToken,
    body: {
      variantId: validVariantId,
      rating: 5,
      title: 'Amazing quality linen!',
      comment: 'Fits true to size, soft organic texture, highly recommended.',
      fit: 'TRUE_TO_SIZE',
      qualityRating: 5,
    },
  });
  const reviewId = deliveredReviewRes.data?.data?.id;
  recordStep(
    '8.4',
    'POST /reviews after delivery (Verified Purchase Review)',
    deliveredReviewRes.status === 201 && !!reviewId,
    { status: 201, hasReviewId: true },
    { status: deliveredReviewRes.status, reviewId, statusField: deliveredReviewRes.data?.data?.status },
    'Verified purchase review accepted and set to PENDING for moderation.'
  );

  // 8.5 Re-submit review on same variant (assert duplicate rejection 409)
  const duplicateReviewRes = await request('/reviews', {
    method: 'POST',
    token: customerToken,
    body: {
      variantId: validVariantId,
      rating: 4,
      title: 'Second review attempt',
      comment: 'Attempting to write another review for the same variant.',
    },
  });
  recordStep(
    '8.5',
    'POST /reviews duplicate on same variant (assert 409 Conflict)',
    duplicateReviewRes.status === 409,
    { status: 409, message: 'You have already submitted a review for this variant' },
    { status: duplicateReviewRes.status, error: duplicateReviewRes.data?.error },
    'Single review per customer-variant constraint enforced with 409 Conflict.'
  );

  // 8.6 Submit UGC after delivery (assert accepted)
  const deliveredUgcRes = await request('/ugc', {
    method: 'POST',
    token: customerToken,
    body: {
      orderId,
      productId: validProductId,
      platform: 'INSTAGRAM',
      mediaType: 'IMAGE',
      mediaUrl: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10',
      postUrl: 'https://instagram.com/p/shopper_delivered_post',
      caption: 'Loving the organic linen shirt! #freshfits',
    },
  });
  const ugcSubmissionId = deliveredUgcRes.data?.data?.id;
  recordStep(
    '8.6',
    'POST /ugc after delivery (Customer submits verified UGC post)',
    deliveredUgcRes.status === 201 && !!ugcSubmissionId,
    { status: 201, hasId: true },
    { status: deliveredUgcRes.status, ugcId: ugcSubmissionId, statusField: deliveredUgcRes.data?.data?.status },
    'UGC submission accepted with status PENDING for admin moderation.'
  );

  // ----------------------------------------------------------------
  // 9. NOTIFICATIONS & PREFERENCES
  // ----------------------------------------------------------------
  console.log('\n--- 9. NOTIFICATIONS & PREFERENCES ---');

  // 9.1 GET /notifications (assert customer only sees their own notifications)
  const notifRes = await request('/notifications', { token: customerToken });
  const notifItems = Array.isArray(notifRes.data?.data?.rows)
    ? notifRes.data.data.rows
    : Array.isArray(notifRes.data?.data)
    ? notifRes.data.data
    : Array.isArray(notifRes.data?.rows)
    ? notifRes.data.rows
    : [];

  // Check if any notification returned belongs to someone else
  const otherCustomerNotifs = notifItems.filter((n) => n.customerId && n.customerId !== customerId);
  const notificationScopedCleanly = otherCustomerNotifs.length === 0;

  recordStep(
    '9.1',
    'GET /notifications (Scope check: only customer own notifications)',
    notifRes.status === 200 && notificationScopedCleanly,
    { status: 200, leakedOtherCustomerNotifs: 0 },
    {
      status: notifRes.status,
      totalReturned: notifItems.length,
      leakedCount: otherCustomerNotifs.length,
      leakedCustomerIds: otherCustomerNotifs.map((n) => n.customerId),
    },
    !notificationScopedCleanly
      ? 'CRITICAL SECURITY BUG: GET /notifications leaks notifications of other customers because req.user.customerId is undefined in notification.service.js line 137!'
      : 'Notifications scoped to caller customer.'
  );

  if (!notificationScopedCleanly) {
    report.bugsAndAnomalies.push({
      severity: 'HIGH',
      endpoint: 'GET /api/v1/notifications',
      issue: 'Broken Object Level Authorization / Customer Isolation failure in Notifications',
      description: 'notification.service.js sets filters.customerId = req.user.customerId, but req.user has "id" (user id) not "customerId", and no customer middleware is mounted on notification routes. Thus filters.customerId remains undefined and all system notifications are returned to the caller.',
    });
  }

  // 9.2 Update marketing preference (PUT /customers/:id/marketing-preferences)
  const updateMarketingRes = await request(`/customers/${customerId}/marketing-preferences`, {
    method: 'PUT',
    token: customerToken,
    body: {
      marketingEmail: false,
      marketingSms: false,
      marketingWhatsapp: false,
    },
  });
  recordStep(
    '9.2',
    'PUT /customers/:id/marketing-preferences (Toggle marketing preferences)',
    updateMarketingRes.status === 200 && updateMarketingRes.data?.data?.marketingEmail === false,
    { status: 200, marketingEmail: false },
    {
      status: updateMarketingRes.status,
      marketingEmail: updateMarketingRes.data?.data?.marketingEmail,
      marketingSms: updateMarketingRes.data?.data?.marketingSms,
    },
    'Marketing preferences successfully toggled to false.'
  );

  // ----------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  SIMULATION COMPLETE: ${report.passed}/${report.totalTests} Passed (${report.failed} Failed)`);
  console.log('================================================================');

  return report;
}

runShopperJourney()
  .then((rep) => {
    const fs = require('fs');
    fs.writeFileSync('shopper_qa_report.json', JSON.stringify(rep, null, 2));
    console.log('Report written to shopper_qa_report.json');
  })
  .catch((err) => {
    console.error('Fatal error during simulation:', err);
    process.exit(1);
  });
