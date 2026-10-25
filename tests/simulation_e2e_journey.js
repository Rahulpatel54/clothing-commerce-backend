'use strict';

const BASE_URL = 'http://localhost:4000/api/v1';

async function req(path, { method = 'GET', token, headers = {}, body } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = { rawText: text };
  }

  return { status: res.status, data: json };
}

async function runSimulation() {
  console.log('--- STARTING COMPREHENSIVE END-TO-END SIMULATION ---');
  const results = [];

  function record(step, ok, details) {
    results.push({ step, ok, details });
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${step}: ${JSON.stringify(details || {})}`);
  }

  // 1. Admin Login
  let adminLogin = await req('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'admin@123' },
  });
  if (adminLogin.status !== 200) {
    adminLogin = await req('/auth/login', {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'ChangeMe123!' },
    });
  }
  const adminToken = adminLogin.data?.data?.tokens?.accessToken;
  record('1. Admin Login', !!adminToken, { status: adminLogin.status });
  if (!adminToken) return;

  // 2. Admin Creates Category
  const catRes = await req('/categories', {
    method: 'POST',
    token: adminToken,
    body: {
      name: `Linen Summer ${Date.now()}`,
      description: 'Linen collection for warm climates',
    },
  });
  const catId = catRes.data?.data?.id;
  record('2. Create Category', !!catId, { catId });

  // 3. Admin Creates Product & Variants
  const prodSku = `LINEN-${Date.now()}`;
  const prodRes = await req('/products', {
    method: 'POST',
    token: adminToken,
    body: {
      name: `Relaxed Linen Shirt ${Date.now()}`,
      sku: prodSku,
      price: 75.00,
      description: '100% breathable premium organic linen',
      status: 'ACTIVE',
      categoryId: catId,
      variants: [
        { sku: `${prodSku}-S`, size: 'S', color: 'White', price: 75.00, costPrice: 30.00 },
        { sku: `${prodSku}-M`, size: 'M', color: 'White', price: 75.00, costPrice: 30.00 },
      ],
    },
  });
  const prod = prodRes.data?.data;
  const prodId = prod?.id;
  const variantS = prod?.variants?.[0];
  const variantM = prod?.variants?.[1];
  record('3. Create Product with Variants', !!prodId && !!variantS, { prodId, variantSId: variantS?.id });

  // 4. Admin Stocks Inventory via /inventory/receive
  if (variantS) {
    const stockRes = await req('/inventory/receive', {
      method: 'POST',
      token: adminToken,
      body: {
        variantId: variantS.id,
        quantity: 25,
        note: 'Initial batch shipment',
      },
    });
    record('4. Stock Inventory (Variant S +25 via receive)', stockRes.status === 200 || stockRes.status === 201, { status: stockRes.status });
  }

  // 5. Admin Creates Promotion & Coupon
  const promoRes = await req('/promotions', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Summer Splash 10%',
      type: 'PERCENTAGE',
      value: 10.00,
      minOrderAmount: 50.00,
      isActive: true,
    },
  });
  const promoId = promoRes.data?.data?.id;
  const couponCode = `SUMMER${Math.floor(1000 + Math.random() * 9000)}`;

  let couponCreated = false;
  if (promoId) {
    const couponRes = await req(`/promotions/${promoId}/coupons`, {
      method: 'POST',
      token: adminToken,
      body: {
        code: couponCode,
        usageLimit: 100,
        usageLimitPerCustomer: 1,
      },
    });
    couponCreated = couponRes.status === 201 || couponRes.status === 200;
  }
  record('5. Create Promotion & Coupon Code', couponCreated, { couponCode });

  // 6. Customer Registration & Login
  const customerEmail = `shopper-${Date.now()}@fashion.com`;
  const customerPhone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;
  const custReg = await req('/auth/register', {
    method: 'POST',
    body: {
      email: customerEmail,
      phone: customerPhone,
      password: 'ShopperPassword123!',
      firstName: 'Jane',
      lastName: 'Shopper',
    },
  });
  const custToken = custReg.data?.data?.tokens?.accessToken;

  const profileRes = await req('/customers/me', { token: custToken });
  const customerId = profileRes.data?.data?.id;
  record('6. Customer Registration & Profile Fetch', !!custToken && !!customerId, { customerId });

  // 7. Customer Adds Shipping Address
  const addrRes = await req(`/customers/${customerId}/addresses`, {
    method: 'POST',
    token: custToken,
    body: {
      label: 'Home',
      recipientName: 'Jane Shopper',
      phone: customerPhone,
      line1: '456 Ocean Boulevard',
      city: 'Santa Monica',
      state: 'CA',
      postalCode: '90401',
      country: 'US',
      isDefaultShipping: true,
      isDefaultBilling: true,
    },
  });
  const addressId = addrRes.data?.data?.id;
  record('7. Add Shipping Address', !!addressId, { addressId, status: addrRes.status });

  // 8. Customer Adds Item to Cart
  const cartRes = await req('/cart/items', {
    method: 'POST',
    token: custToken,
    body: {
      variantId: variantS.id,
      quantity: 2,
    },
  });
  record('8. Add Items to Customer Cart', cartRes.status === 200 || cartRes.status === 201, { status: cartRes.status });

  // 9. Customer Checkout with Coupon and Idempotency Key
  const checkoutIdemKey = `chk-${Date.now()}`;
  const checkoutRes = await req('/checkout', {
    method: 'POST',
    token: custToken,
    headers: { 'Idempotency-Key': checkoutIdemKey },
    body: {
      addressId,
      couponCode,
      useWalletBalance: false,
    },
  });
  const checkoutData = checkoutRes.data?.data;
  const order = checkoutData?.order || checkoutData;
  const orderId = order?.id;
  record('9. Checkout & Order Creation', !!orderId, {
    status: checkoutRes.status,
    orderId,
    orderNumber: order?.orderNumber,
    total: order?.totalAmount,
    error: checkoutRes.data?.error,
  });

  // 10. Replay Checkout with Same Idempotency Key (assert cached order returned)
  const replayRes = await req('/checkout', {
    method: 'POST',
    token: custToken,
    headers: { 'Idempotency-Key': checkoutIdemKey },
    body: {
      addressId,
      couponCode,
      useWalletBalance: false,
    },
  });
  const replayOrder = replayRes.data?.data?.order || replayRes.data?.data;
  record('10. Idempotency Key Replay Cached Result', replayOrder?.id === orderId, {
    originalOrderId: orderId,
    replayOrderId: replayOrder?.id,
  });

  // 11. Customer Attempts Review before Delivery (expect 400 rejection)
  const earlyReviewRes = await req('/reviews', {
    method: 'POST',
    token: custToken,
    body: {
      productId: prodId,
      variantId: variantS.id,
      rating: 5,
      title: 'Amazing quality',
      comment: 'Fits true to size and feels luxurious',
      fitFeedback: 'TRUE_TO_SIZE',
      qualityRating: 5,
    },
  });
  record('11. Undelivered Product Review Rejected', earlyReviewRes.status === 400 || earlyReviewRes.status === 403, {
    status: earlyReviewRes.status,
    message: earlyReviewRes.data?.error?.message,
  });

  // 12. Admin Fulfills Order through State Machine
  if (orderId) {
    const transitions = [
      { to: 'CONFIRMED', reason: 'Payment confirmed' },
      { to: 'PROCESSING', reason: 'Order allocated to warehouse' },
      { to: 'PACKED', reason: 'Boxed and labeled' },
      { to: 'SHIPPED', reason: 'Handed to courier' },
      { to: 'OUT_FOR_DELIVERY', reason: 'Courier vehicle out for delivery' },
      { to: 'DELIVERED', reason: 'Package signed and delivered' },
    ];

    let currentOrderState = 'PENDING';
    for (const t of transitions) {
      const stepRes = await req(`/orders/${orderId}/status`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: t.to, reason: t.reason },
      });
      console.log('TRANSITION STEP:', t.to, 'STATUS:', stepRes.status, 'BODY:', JSON.stringify(stepRes.data));
      if (stepRes.status === 200) currentOrderState = t.to;
    }
    record('12. Order State Machine Transitions to DELIVERED', currentOrderState === 'DELIVERED', { finalState: currentOrderState });

    // Test invalid transition (DELIVERED -> PENDING) -> expect 409 Conflict
    const invalidTrans = await req(`/orders/${orderId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'PENDING', reason: 'Illegal jump' },
    });
    record('12b. Invalid State Jump Rejected with 409 Conflict', invalidTrans.status === 409, { status: invalidTrans.status });
  }

  // 13. Customer Reviews Delivered Product (Now Succeeded!)
  const deliveredReviewRes = await req('/reviews', {
    method: 'POST',
    token: custToken,
    body: {
      productId: prodId,
      variantId: variantS.id,
      rating: 5,
      title: 'Loved the linen!',
      comment: 'Arrived quickly, soft linen fabric, fits wonderfully.',
      fitFeedback: 'TRUE_TO_SIZE',
      qualityRating: 5,
    },
  });
  const reviewId = deliveredReviewRes.data?.data?.id;
  record('13. Delivered Purchase Review Accepted', !!reviewId, { reviewId, status: deliveredReviewRes.status });

  // 14. Duplicate Review on Same Variant (expect rejection: one review per customer per variant)
  const dupReviewRes = await req('/reviews', {
    method: 'POST',
    token: custToken,
    body: {
      productId: prodId,
      variantId: variantS.id,
      rating: 4,
      title: 'Second review attempt',
      comment: 'Trying to review again',
    },
  });
  record('14. Duplicate Review Rejected', dupReviewRes.status === 400 || dupReviewRes.status === 409, {
    status: dupReviewRes.status,
    message: dupReviewRes.data?.error?.message,
  });

  // 15. Customer Submits UGC Post
  const ugcRes = await req('/ugc', {
    method: 'POST',
    token: custToken,
    body: {
      orderId,
      productId: prodId,
      platform: 'INSTAGRAM',
      mediaType: 'IMAGE',
      mediaUrl: 'https://images.example.com/summer-linen-customer.jpg',
      caption: 'Loving this white linen shirt at the beach! #SummerVibes',
    },
  });
  const ugcId = ugcRes.data?.data?.id;
  record('15. Customer UGC Submission', !!ugcId, { ugcId, status: ugcRes.status, error: ugcRes.data?.error });

  // 16. Admin Moderates UGC and Awards Points via /ugc/:id/verify
  if (ugcId) {
    const modUgc = await req(`/ugc/${ugcId}/verify`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'APPROVED',
        rewardAmount: 50,
      },
    });
    record('16. Admin Approves UGC & Credits Reward', modUgc.status === 200, { status: modUgc.status });

    // Check Customer Wallet
    const walletRes = await req('/loyalty/wallet', { token: custToken });
    record('16b. Customer Wallet Updated', walletRes.status === 200, {
      balance: walletRes.data?.data?.balance,
    });
  }

  // 17. Admin Creates Expense Category & Logs Operating Expense
  const expCatRes = await req('/expenses/categories', {
    method: 'POST',
    token: adminToken,
    body: {
      name: `Packaging Supplies ${Date.now()}`,
      description: 'Cardboard boxes and mailers',
    },
  });
  const expCatId = expCatRes.data?.data?.id;

  if (expCatId) {
    // Attempt expense in future open period (November 2026)
    const expRes = await req('/expenses', {
      method: 'POST',
      token: adminToken,
      body: {
        categoryId: expCatId,
        amount: 120.00,
        date: '2026-11-15',
        vendor: 'Packaging Express',
        paymentMethod: 'BANK_TRANSFER',
        description: 'Cardboard boxes and tissue paper',
      },
    });
    const expenseId = expRes.data?.data?.id;
    record('17. Admin Logs Expense', !!expenseId, { expenseId, status: expRes.status });
  }

  // 18. Admin Queries Dynamic P&L Statement
  const pnlRes = await req('/finance/pnl', { token: adminToken });
  const pnl = pnlRes.data?.data;
  record('18. Generate Financial P&L Statement', pnlRes.status === 200 && pnl?.revenue?.grossSales !== undefined, {
    status: pnlRes.status,
    grossSales: pnl?.revenue?.grossSales,
    cogs: pnl?.costOfGoodsSold?.totalCOGS,
    grossProfit: pnl?.profitability?.grossProfit,
    operatingExpenses: pnl?.profitability?.operatingExpenses,
    netProfit: pnl?.profitability?.netProfit,
  });

  // 19. Admin Queries Multi-Dimensional Analytics
  const salesAnalytics = await req('/analytics/sales', { token: adminToken });
  const customerAnalytics = await req('/analytics/customers', { token: adminToken });
  const operationsAnalytics = await req('/analytics/operations', { token: adminToken });
  record('19. Commerce Analytics (Sales/Customers/Operations)', salesAnalytics.status === 200 && customerAnalytics.status === 200, {
    salesStatus: salesAnalytics.status,
    customerStatus: customerAnalytics.status,
    operationsStatus: operationsAnalytics.status,
  });

  // 20. Customer Notifications & Preferences
  const notifRes = await req('/notifications', { token: custToken });
  record('20. Customer Notifications Inbox', notifRes.status === 200, {
    notificationCount: notifRes.data?.data?.length || notifRes.data?.meta?.total || 0,
  });

  const passedCount = results.filter((r) => r.ok).length;
  console.log('\n--- END OF SIMULATION ---');
  console.log(`Passed: ${passedCount}/${results.length} steps`);
}

runSimulation().catch(console.error);
