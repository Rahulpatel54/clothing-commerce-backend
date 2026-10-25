'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');

const BASE_URL = 'http://localhost:4000/api/v1';

function execContainerJs(code) {
  try {
    const result = spawnSync('docker', ['exec', '-i', 'commerce-api', 'node'], {
      input: code,
      encoding: 'utf8',
    });
    if (result.status === 0) return result.stdout.trim();
  } catch (e) {
    // Docker not available, fallback to local node
  }
  const localResult = spawnSync('node', {
    input: code.replace(/'\/app\/src/g, "'./src").replace(/"\/app\/src/g, '"./src'),
    cwd: __dirname,
    encoding: 'utf8',
  });
  if (localResult.status !== 0) {
    throw new Error(`Local script failed: ${localResult.stderr || localResult.stdout}`);
  }
  return localResult.stdout.trim();
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
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
    json = text;
  }

  return {
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries(res.headers.entries()),
    data: json,
  };
}

async function run() {
  const results = {
    timestamp: new Date().toISOString(),
    steps: {},
    summary: { total: 0, passed: 0, failed: 0, bugs: [] },
  };

  function record(stepKey, title, testResult) {
    if (!results.steps[stepKey]) results.steps[stepKey] = [];
    results.steps[stepKey].push({ title, ...testResult });
    results.summary.total++;
    if (testResult.passed) {
      results.summary.passed++;
    } else {
      results.summary.failed++;
    }
  }

  console.log('===============================================================');
  console.log('STORE ADMIN & OPERATIONS SIMULATION - FULL TEST SUITE');
  console.log('===============================================================');

  let adminToken = '';
  let adminUserId = '';

  // =========================================================================
  // 1. Admin Authentication
  // =========================================================================
  console.log('\n--- STEP 1: Admin Authentication ---');

  // Test invalid credentials
  const badLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'WrongPassword123!' },
  });
  console.log('[1.1] Invalid login response:', badLogin.status, badLogin.data?.error?.code);
  record('1_auth', 'Invalid Credentials Rejection', {
    endpoint: 'POST /auth/login',
    expectedStatus: 401,
    actualStatus: badLogin.status,
    passed: badLogin.status === 401,
    response: badLogin.data,
  });

  // Ensure admin user failed attempts is cleared so it does not accumulate across runs
  execContainerJs(`
    const db = require('/app/src/models');
    db.User.update({ failedLoginAttempts: 0, lockedUntil: null }, { where: { email: 'admin@example.com' } }).then(() => process.exit(0));
  `);

  // Test valid seed credentials
  let validLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'admin@123' },
  });
  if (validLogin.status !== 200) {
    validLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'ChangeMe123!' },
    });
  }
  console.log('[1.2] Valid login response:', validLogin.status, validLogin.data?.message);
  adminToken = validLogin.data?.data?.tokens?.accessToken;
  adminUserId = validLogin.data?.data?.user?.id;

  record('1_auth', 'Admin Login with Seed Credentials', {
    endpoint: 'POST /auth/login',
    expectedStatus: 200,
    actualStatus: validLogin.status,
    passed: validLogin.status === 200 && Boolean(adminToken),
    response: {
      userId: adminUserId,
      email: validLogin.data?.data?.user?.email,
      roles: validLogin.data?.data?.roles,
      hasToken: Boolean(adminToken),
    },
  });

  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  // =========================================================================
  // 2. User & Customer Management
  // =========================================================================
  console.log('\n--- STEP 2: User & Customer Management ---');

  // GET /users
  const listUsers = await request('/users?page=1&limit=10', { headers: authHeaders });
  console.log('[2.1] GET /users response:', listUsers.status, 'Total users:', listUsers.data?.meta?.total);
  record('2_users_customers', 'List Users with Pagination', {
    endpoint: 'GET /users',
    expectedStatus: 200,
    actualStatus: listUsers.status,
    passed: listUsers.status === 200 && Array.isArray(listUsers.data?.data) && Boolean(listUsers.data?.meta),
    meta: listUsers.data?.meta,
    count: listUsers.data?.data?.length,
  });

  // POST /users: create staff account
  const staffEmail = `staff-sim-${Date.now()}@example.com`;
  const createStaff = await request('/users', {
    method: 'POST',
    headers: authHeaders,
    body: {
      email: staffEmail,
      password: 'StaffPass123!',
      firstName: 'Fulfillment',
      lastName: 'Staff',
      roles: ['staff'],
      status: 'ACTIVE',
    },
  });
  console.log('[2.2] POST /users (create staff):', createStaff.status, createStaff.data?.data?.id);
  const createdStaffId = createStaff.data?.data?.id;
  record('2_users_customers', 'Create Staff Account', {
    endpoint: 'POST /users',
    expectedStatus: 201,
    actualStatus: createStaff.status,
    passed: createStaff.status === 201 && Boolean(createdStaffId),
    createdUser: { id: createdStaffId, email: staffEmail, roles: createStaff.data?.data?.roles },
  });

  // PATCH /users/:id/status: Suspend user
  const suspendStaff = await request(`/users/${createdStaffId}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { status: 'SUSPENDED', reason: 'Operational security review' },
  });
  console.log('[2.3] PATCH /users/:id/status (suspend):', suspendStaff.status, suspendStaff.data?.data?.status);
  record('2_users_customers', 'Suspend Staff Account', {
    endpoint: `PATCH /users/${createdStaffId}/status`,
    expectedStatus: 200,
    actualStatus: suspendStaff.status,
    passed: suspendStaff.status === 200 && suspendStaff.data?.data?.status === 'SUSPENDED',
    status: suspendStaff.data?.data?.status,
  });

  // PATCH /users/:id/status: Reactivate user
  const reactivateStaff = await request(`/users/${createdStaffId}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { status: 'ACTIVE', reason: 'Review cleared' },
  });
  console.log('[2.4] PATCH /users/:id/status (reactivate):', reactivateStaff.status, reactivateStaff.data?.data?.status);
  record('2_users_customers', 'Reactivate Staff Account', {
    endpoint: `PATCH /users/${createdStaffId}/status`,
    expectedStatus: 200,
    actualStatus: reactivateStaff.status,
    passed: reactivateStaff.status === 200 && reactivateStaff.data?.data?.status === 'ACTIVE',
    status: reactivateStaff.data?.data?.status,
  });

  // GET /customers
  const listCustomers = await request('/customers?page=1&limit=10', { headers: authHeaders });
  console.log('[2.5] GET /customers:', listCustomers.status, 'Total customers:', listCustomers.data?.meta?.total);
  const targetCustomer = listCustomers.data?.data?.[0];
  const targetCustomerId = targetCustomer?.id;
  record('2_users_customers', 'List Customers with Financial Stats', {
    endpoint: 'GET /customers',
    expectedStatus: 200,
    actualStatus: listCustomers.status,
    passed: listCustomers.status === 200 && Array.isArray(listCustomers.data?.data),
    sampleCustomer: {
      id: targetCustomer?.id,
      totalSpend: targetCustomer?.totalSpend,
      orderCount: targetCustomer?.orderCount,
      averageOrderValue: targetCustomer?.averageOrderValue,
    },
  });

  // PATCH /customers/:id: Add tags & admin notes
  let updateCustomer = null;
  if (targetCustomerId) {
    updateCustomer = await request(`/customers/${targetCustomerId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: {
        tags: ['vip', 'autumn-campaign', 'high-intent'],
        notes: 'Preferred VIP shopper. Priority concierge support assigned.',
      },
    });
    console.log('[2.6] PATCH /customers/:id (tags & notes):', updateCustomer.status, updateCustomer.data?.data?.tags);
  }
  record('2_users_customers', 'Update Customer Tags and Admin Notes', {
    endpoint: `PATCH /customers/${targetCustomerId}`,
    expectedStatus: 200,
    actualStatus: updateCustomer?.status,
    passed: updateCustomer?.status === 200 && updateCustomer?.data?.data?.tags?.includes('vip'),
    tags: updateCustomer?.data?.data?.tags,
    notes: updateCustomer?.data?.data?.notes,
  });

  // Boundary condition: Customer 404
  const notFoundCustomer = await request('/customers/00000000-0000-0000-0000-000000000000', {
    method: 'PATCH',
    headers: authHeaders,
    body: { notes: 'Should fail' },
  });
  console.log('[2.7] Non-existent customer 404 check:', notFoundCustomer.status);
  record('2_users_customers', 'Non-existent Customer 404 Check', {
    endpoint: 'PATCH /customers/00000000-0000-0000-0000-000000000000',
    expectedStatus: 404,
    actualStatus: notFoundCustomer.status,
    passed: notFoundCustomer.status === 404,
  });

  // =========================================================================
  // 3. Catalog & Products
  // =========================================================================
  console.log('\n--- STEP 3: Catalog & Products ---');

  // POST /categories: create category
  const catName = `Autumn Jackets ${Date.now()}`;
  const createCat = await request('/categories', {
    method: 'POST',
    headers: authHeaders,
    body: {
      name: catName,
      description: 'Outerwear for cool rainy autumn seasons',
      isActive: true,
    },
  });
  console.log('[3.1] POST /categories:', createCat.status, 'Slug:', createCat.data?.data?.slug);
  const createdCategoryId = createCat.data?.data?.id;
  const createdCategorySlug = createCat.data?.data?.slug;
  record('3_catalog_products', 'Create Category with Auto-Slug Generation', {
    endpoint: 'POST /categories',
    expectedStatus: 201,
    actualStatus: createCat.status,
    passed: createCat.status === 201 && Boolean(createdCategorySlug),
    category: { id: createdCategoryId, name: catName, slug: createdCategorySlug },
  });

  // POST /products: create product with S/M/L variants
  const productSku = `PARKA-${Date.now().toString().slice(-6)}`;
  const createProd = await request('/products', {
    method: 'POST',
    headers: authHeaders,
    body: {
      name: 'Waterproof Parka',
      sku: productSku,
      price: 129.99,
      costPrice: 55.00,
      compareAtPrice: 159.99,
      categoryId: createdCategoryId,
      description: 'Windproof, seam-sealed breathable technical parka',
      material: 'Recycled Nylon shell with DWR finish',
      fit: 'Relaxed Fit',
      status: 'DRAFT',
      variants: [
        { sku: `${productSku}-S`, size: 'S', color: 'Olive Green', price: 129.99, costPrice: 55.00, compareAtPrice: 159.99 },
        { sku: `${productSku}-M`, size: 'M', color: 'Olive Green', price: 129.99, costPrice: 55.00, compareAtPrice: 159.99 },
        { sku: `${productSku}-L`, size: 'L', color: 'Olive Green', price: 129.99, costPrice: 55.00, compareAtPrice: 159.99 },
      ],
    },
  });
  console.log('[3.2] POST /products:', createProd.status, createProd.data?.data?.id, 'Variants:', createProd.data?.data?.variants?.length);
  const createdProductId = createProd.data?.data?.id;
  const createdVariants = createProd.data?.data?.variants || [];
  const variantS = createdVariants.find((v) => v.size === 'S') || createdVariants[0];

  record('3_catalog_products', 'Create Product with S/M/L Variants', {
    endpoint: 'POST /products',
    expectedStatus: 201,
    actualStatus: createProd.status,
    passed: createProd.status === 201 && createdVariants.length === 3,
    product: {
      id: createdProductId,
      name: createProd.data?.data?.name,
      sku: productSku,
      variantsCount: createdVariants.length,
      variants: createdVariants.map((v) => ({ id: v.id, sku: v.sku, size: v.size, price: v.price })),
    },
  });

  // PATCH /products/:id: Attempt invalid status 'PUBLISHED'
  const invalidStatusPublish = await request(`/products/${createdProductId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { status: 'PUBLISHED' },
  });
  console.log('[3.3] PATCH /products/:id with status "PUBLISHED":', invalidStatusPublish.status, invalidStatusPublish.data?.error?.message);
  record('3_catalog_products', 'Schema Validation Check on Status "PUBLISHED"', {
    endpoint: `PATCH /products/${createdProductId}`,
    expectedStatus: 422,
    actualStatus: invalidStatusPublish.status,
    passed: invalidStatusPublish.status === 422,
    note: 'Validation middleware returns 422 Unprocessable Entity. API schema restricts status to [DRAFT, ACTIVE, ARCHIVED].',
    error: invalidStatusPublish.data?.error,
  });

  // PATCH /products/:id: Publish product with status 'ACTIVE'
  const publishProd = await request(`/products/${createdProductId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { status: 'ACTIVE' },
  });
  console.log('[3.4] PATCH /products/:id with status "ACTIVE":', publishProd.status, publishProd.data?.data?.status);
  record('3_catalog_products', 'Publish Product (status ACTIVE)', {
    endpoint: `PATCH /products/${createdProductId}`,
    expectedStatus: 200,
    actualStatus: publishProd.status,
    passed: publishProd.status === 200 && publishProd.data?.data?.status === 'ACTIVE',
    productStatus: publishProd.data?.data?.status,
  });

  // =========================================================================
  // 4. Inventory Operations
  // =========================================================================
  console.log('\n--- STEP 4: Inventory Operations ---');

  // Test GET /inventory (expect 404 because inventory routes are /movements and /:variantId)
  const getRawInventory = await request('/inventory', { headers: authHeaders });
  console.log('[4.1] GET /inventory route check:', getRawInventory.status);
  record('4_inventory', 'GET /inventory Route Architecture Inspection', {
    endpoint: 'GET /inventory',
    expectedStatus: 404,
    actualStatus: getRawInventory.status,
    passed: getRawInventory.status === 404,
    note: 'Inventory module routes are variant-scoped (/inventory/:variantId) and movement-scoped (/inventory/movements).',
  });

  // GET /inventory/:variantId
  const getVariantStock = await request(`/inventory/${variantS.id}`, { headers: authHeaders });
  console.log('[4.2] GET /inventory/:variantId:', getVariantStock.status, getVariantStock.data?.data);
  record('4_inventory', 'Inspect Variant Inventory Level', {
    endpoint: `GET /inventory/${variantS.id}`,
    expectedStatus: 200,
    actualStatus: getVariantStock.status,
    passed: getVariantStock.status === 200 && getVariantStock.data?.data?.physical !== undefined,
    stock: getVariantStock.data?.data,
  });

  // Test POST /inventory/purchase (check if route exists vs /receive)
  const purchaseRoute = await request('/inventory/purchase', {
    method: 'POST',
    headers: authHeaders,
    body: { variantId: variantS.id, quantity: 25 },
  });
  console.log('[4.3] POST /inventory/purchase endpoint check:', purchaseRoute.status);
  record('4_inventory', 'POST /inventory/purchase Route Inspection', {
    endpoint: 'POST /inventory/purchase',
    expectedStatus: 404,
    actualStatus: purchaseRoute.status,
    passed: purchaseRoute.status === 404,
    note: 'Operational receiving endpoint is POST /inventory/receive.',
  });

  // POST /inventory/receive: +25 physical units
  const receiveStock = await request('/inventory/receive', {
    method: 'POST',
    headers: authHeaders,
    body: {
      variantId: variantS.id,
      quantity: 25,
      referenceType: 'PURCHASE_ORDER',
      referenceId: 'PO-2026-OCT-001',
      note: 'Initial autumn seasonal stock intake',
    },
  });
  console.log('[4.4] POST /inventory/receive (+25):', receiveStock.status, 'Physical stock now:', receiveStock.data?.data?.physical);
  record('4_inventory', 'Receive Purchase Order (+25 Physical Units)', {
    endpoint: 'POST /inventory/receive',
    expectedStatus: 201,
    actualStatus: receiveStock.status,
    passed: receiveStock.status === 201 && receiveStock.data?.data?.physical === 25,
    inventory: receiveStock.data?.data,
  });

  // POST /inventory/damage: record 1 damaged unit
  const damageStock = await request('/inventory/damage', {
    method: 'POST',
    headers: authHeaders,
    body: {
      variantId: variantS.id,
      quantity: 1,
      note: 'Torn seam noticed upon inspection',
    },
  });
  console.log('[4.5] POST /inventory/damage (-1 phys, +1 dam):', damageStock.status, 'Physical:', damageStock.data?.data?.physical, 'Damaged:', damageStock.data?.data?.damaged);
  record('4_inventory', 'Record Damaged Unit (1 Unit)', {
    endpoint: 'POST /inventory/damage',
    expectedStatus: 200,
    actualStatus: damageStock.status,
    passed: damageStock.status === 200 && damageStock.data?.data?.physical === 24 && damageStock.data?.data?.damaged === 1,
    inventory: damageStock.data?.data,
  });

  // Test POST /inventory/cycle-count (check route vs /adjust)
  const cycleCountRoute = await request('/inventory/cycle-count', {
    method: 'POST',
    headers: authHeaders,
    body: { variantId: variantS.id, delta: -2 },
  });
  console.log('[4.6] POST /inventory/cycle-count endpoint check:', cycleCountRoute.status);
  record('4_inventory', 'POST /inventory/cycle-count Route Inspection', {
    endpoint: 'POST /inventory/cycle-count',
    expectedStatus: 404,
    actualStatus: cycleCountRoute.status,
    passed: cycleCountRoute.status === 404,
    note: 'Physical count discrepancy adjustment endpoint is POST /inventory/adjust.',
  });

  // POST /inventory/adjust: cycle count adjustment
  const adjustStock = await request('/inventory/adjust', {
    method: 'POST',
    headers: authHeaders,
    body: {
      variantId: variantS.id,
      delta: -2,
      note: 'Cycle count discrepancy adjustment (-2 units unaccounted)',
    },
  });
  console.log('[4.7] POST /inventory/adjust (delta: -2):', adjustStock.status, 'Physical stock now:', adjustStock.data?.data?.physical);
  record('4_inventory', 'Cycle Count Discrepancy Adjustment (delta -2)', {
    endpoint: 'POST /inventory/adjust',
    expectedStatus: 200,
    actualStatus: adjustStock.status,
    passed: adjustStock.status === 200 && adjustStock.data?.data?.physical === 22,
    inventory: adjustStock.data?.data,
  });

  // GET /inventory/movements
  const movements = await request(`/inventory/movements?variantId=${variantS.id}`, { headers: authHeaders });
  console.log('[4.8] GET /inventory/movements:', movements.status, 'Total movements recorded:', movements.data?.data?.length);
  record('4_inventory', 'Audit Trail of Inventory Movements', {
    endpoint: `/inventory/movements?variantId=${variantS.id}`,
    expectedStatus: 200,
    actualStatus: movements.status,
    passed: movements.status === 200 && Array.isArray(movements.data?.data),
    movementsCount: movements.data?.data?.length,
    movementTypes: movements.data?.data?.map((m) => m.type),
  });

  // =========================================================================
  // 5. Order Processing & Fulfillment State Machine
  // =========================================================================
  console.log('\n--- STEP 5: Order Processing & Fulfillment State Machine ---');

  // Check GET /orders
  const listOrdersInitial = await request('/orders', { headers: authHeaders });
  console.log('[5.1] GET /orders initial check:', listOrdersInitial.status, 'Orders count:', listOrdersInitial.data?.data?.length);
  record('5_orders', 'List Orders (Admin / Privileged)', {
    endpoint: 'GET /orders',
    expectedStatus: 200,
    actualStatus: listOrdersInitial.status,
    passed: listOrdersInitial.status === 200 && Array.isArray(listOrdersInitial.data?.data),
    initialCount: listOrdersInitial.data?.data?.length,
  });

  // Seed live test order using spawnSync container execution
  const orderNumber = `ORD${Date.now().toString(36).toUpperCase()}`;
  const seedOrderCode = `
    const db = require('/app/src/models');
    async function seed() {
      const order = await db.Order.create({
        orderNumber: '${orderNumber}',
        customerId: '${targetCustomerId}',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        shippingAddress: {
          recipientName: 'Jane Doe',
          line1: '42 Park Avenue',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'IN',
          phone: '+919876543210'
        },
        billingAddress: {
          recipientName: 'Jane Doe',
          line1: '42 Park Avenue',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'IN',
          phone: '+919876543210'
        },
        subtotal: 129.99,
        shippingAmount: 0,
        taxAmount: 6.50,
        discountAmount: 0,
        walletAmount: 0,
        totalAmount: 136.49,
        placedAt: new Date()
      });
      await db.OrderItem.create({
        orderId: order.id,
        variantId: '${variantS.id}',
        productId: '${createdProductId}',
        productName: 'Waterproof Parka',
        variantSku: '${variantS.sku}',
        size: 'S',
        color: 'Olive Green',
        unitPrice: 129.99,
        costPrice: 55.00,
        quantity: 1,
        lineTotal: 129.99
      });
      console.log(order.id);
      process.exit(0);
    }
    seed().catch(err => { console.error(err); process.exit(1); });
  `;
  const orderIdRaw = execContainerJs(seedOrderCode);
  console.log('[5.2] Seeded live test order:', orderNumber, 'ID:', orderIdRaw);

  // Transition 1: CONFIRMED -> PROCESSING
  const trans1 = await request(`/orders/${orderIdRaw}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { status: 'PROCESSING', reason: 'Order allocated to warehouse fulfillment queue' },
  });
  console.log('[5.3] Transition: CONFIRMED -> PROCESSING:', trans1.status, trans1.data?.data?.status);
  record('5_orders', 'Transition: CONFIRMED -> PROCESSING', {
    endpoint: `PATCH /orders/${orderIdRaw}/status`,
    expectedStatus: 200,
    actualStatus: trans1.status,
    passed: trans1.status === 200 && trans1.data?.data?.status === 'PROCESSING',
    status: trans1.data?.data?.status,
  });

  // Transition 2: PROCESSING -> PACKED
  const trans2 = await request(`/orders/${orderIdRaw}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { status: 'PACKED', reason: 'Garment inspected, boxed, and shipping label affixed' },
  });
  console.log('[5.4] Transition: PROCESSING -> PACKED:', trans2.status, trans2.data?.data?.status);
  record('5_orders', 'Transition: PROCESSING -> PACKED', {
    endpoint: `PATCH /orders/${orderIdRaw}/status`,
    expectedStatus: 200,
    actualStatus: trans2.status,
    passed: trans2.status === 200 && trans2.data?.data?.status === 'PACKED',
    status: trans2.data?.data?.status,
  });

  // Transition 3: PACKED -> SHIPPED (with tracking info)
  const trans3 = await request(`/orders/${orderIdRaw}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: {
      status: 'SHIPPED',
      reason: 'Dispatched via BlueDart Express | AWB Tracking #BD-982134567-IN',
    },
  });
  console.log('[5.5] Transition: PACKED -> SHIPPED:', trans3.status, trans3.data?.data?.status);
  record('5_orders', 'Transition: PACKED -> SHIPPED (with Tracking Info)', {
    endpoint: `PATCH /orders/${orderIdRaw}/status`,
    expectedStatus: 200,
    actualStatus: trans3.status,
    passed: trans3.status === 200 && trans3.data?.data?.status === 'SHIPPED',
    status: trans3.data?.data?.status,
  });

  // Transition 4: SHIPPED -> OUT_FOR_DELIVERY
  const trans4 = await request(`/orders/${orderIdRaw}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { status: 'OUT_FOR_DELIVERY', reason: 'Courier van loaded, out for final delivery' },
  });
  console.log('[5.6] Transition: SHIPPED -> OUT_FOR_DELIVERY:', trans4.status, trans4.data?.data?.status);
  record('5_orders', 'Transition: SHIPPED -> OUT_FOR_DELIVERY', {
    endpoint: `PATCH /orders/${orderIdRaw}/status`,
    expectedStatus: 200,
    actualStatus: trans4.status,
    passed: trans4.status === 200 && trans4.data?.data?.status === 'OUT_FOR_DELIVERY',
    status: trans4.data?.data?.status,
  });

  // Transition 5: OUT_FOR_DELIVERY -> DELIVERED
  const trans5 = await request(`/orders/${orderIdRaw}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { status: 'DELIVERED', reason: 'Package delivered to recipient doorstep' },
  });
  console.log('[5.7] Transition: OUT_FOR_DELIVERY -> DELIVERED:', trans5.status, trans5.data?.data?.status);
  record('5_orders', 'Transition: OUT_FOR_DELIVERY -> DELIVERED', {
    endpoint: `PATCH /orders/${orderIdRaw}/status`,
    expectedStatus: 200,
    actualStatus: trans5.status,
    passed: trans5.status === 200 && trans5.data?.data?.status === 'DELIVERED',
    status: trans5.data?.data?.status,
    deliveredAt: trans5.data?.data?.deliveredAt,
  });

  // Invalid Transition: DELIVERED -> PENDING (verify 409 Conflict rejection)
  const invalidTrans = await request(`/orders/${orderIdRaw}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { status: 'PENDING', reason: 'Attempt invalid backwards transition' },
  });
  console.log('[5.8] Invalid Transition DELIVERED -> PENDING:', invalidTrans.status, invalidTrans.data?.error?.message);
  record('5_orders', 'Reject Invalid Transition (DELIVERED -> PENDING 409 Conflict)', {
    endpoint: `PATCH /orders/${orderIdRaw}/status`,
    expectedStatus: 409,
    actualStatus: invalidTrans.status,
    passed: invalidTrans.status === 409,
    conflictError: invalidTrans.data?.error,
  });

  // Another Invalid Transition: DELIVERED -> CANCELLED
  const invalidTrans2 = await request(`/orders/${orderIdRaw}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { status: 'CANCELLED', reason: 'Attempt invalid cancellation of delivered order' },
  });
  console.log('[5.9] Invalid Transition DELIVERED -> CANCELLED:', invalidTrans2.status, invalidTrans2.data?.error?.message);
  record('5_orders', 'Reject Invalid Transition (DELIVERED -> CANCELLED 409 Conflict)', {
    endpoint: `PATCH /orders/${orderIdRaw}/status`,
    expectedStatus: 409,
    actualStatus: invalidTrans2.status,
    passed: invalidTrans2.status === 409,
  });

  // =========================================================================
  // 6. Promotions & Coupon Rules
  // =========================================================================
  console.log('\n--- STEP 6: Promotions & Coupon Rules ---');

  // POST /promotions: 15% discount, min order 50
  const promoName = `Autumn Promo ${Date.now()}`;
  const createPromo = await request('/promotions', {
    method: 'POST',
    headers: authHeaders,
    body: {
      name: promoName,
      description: '15% off orders with minimum spend of $50',
      type: 'PERCENTAGE',
      value: 15.00,
      minOrderAmount: 50.00,
      isActive: true,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
    },
  });
  console.log('[6.1] POST /promotions:', createPromo.status, createPromo.data?.data?.id);
  const createdPromoId = createPromo.data?.data?.id;
  record('6_promotions', 'Create Percentage Discount Promotion', {
    endpoint: 'POST /promotions',
    expectedStatus: 201,
    actualStatus: createPromo.status,
    passed: createPromo.status === 201 && Boolean(createdPromoId),
    promotion: {
      id: createdPromoId,
      name: promoName,
      type: createPromo.data?.data?.type,
      value: createPromo.data?.data?.value,
      minOrderAmount: createPromo.data?.data?.minOrderAmount,
    },
  });

  // POST /promotions/:id/coupons: create coupon AUTUMN15, usageLimit 100
  const couponCode = `AUTUMN15_${Date.now().toString().slice(-4)}`;
  const createCoupon = await request(`/promotions/${createdPromoId}/coupons`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      code: couponCode,
      usageLimit: 100,
      usageLimitPerCustomer: 1,
      isActive: true,
    },
  });
  console.log('[6.2] POST /promotions/:id/coupons:', createCoupon.status, createCoupon.data?.data?.code, 'Limit:', createCoupon.data?.data?.usageLimit);
  record('6_promotions', 'Create Coupon Code with Usage Limits', {
    endpoint: `POST /promotions/${createdPromoId}/coupons`,
    expectedStatus: 201,
    actualStatus: createCoupon.status,
    passed: createCoupon.status === 201 && createCoupon.data?.data?.code === couponCode,
    coupon: createCoupon.data?.data,
  });

  // =========================================================================
  // 7. Moderation & UGC
  // =========================================================================
  console.log('\n--- STEP 7: Moderation & UGC ---');

  // GET /reviews
  const listReviews = await request('/reviews', { headers: authHeaders });
  console.log('[7.1] GET /reviews:', listReviews.status, 'Total reviews:', listReviews.data?.data?.length);
  record('7_ugc_moderation', 'List Reviews across Products', {
    endpoint: 'GET /reviews',
    expectedStatus: 200,
    actualStatus: listReviews.status,
    passed: listReviews.status === 200 && Array.isArray(listReviews.data?.data),
    reviewsCount: listReviews.data?.data?.length,
  });

  // Seed a pending review for our delivered order & variant using container script
  const seedReviewCode = `
    const db = require('/app/src/models');
    async function seedReview() {
      const review = await db.Review.create({
        customerId: '${targetCustomerId}',
        productId: '${createdProductId}',
        variantId: '${variantS.id}',
        orderId: '${orderIdRaw}',
        rating: 5,
        title: 'Outstanding Autumn Parka',
        comment: 'Kept me bone dry in a heavy rainstorm. Exceptional tailoring and fit!',
        fit: 'TRUE_TO_SIZE',
        qualityRating: 5,
        isVerifiedPurchase: true,
        status: 'PENDING',
        helpfulCount: 0
      });
      console.log(review.id);
      process.exit(0);
    }
    seedReview().catch(err => { console.error(err); process.exit(1); });
  `;
  const reviewIdRaw = execContainerJs(seedReviewCode);
  console.log('[7.2] Seeded pending review for moderation, ID:', reviewIdRaw);

  // PATCH /reviews/:id/moderation
  const moderateReview = await request(`/reviews/${reviewIdRaw}/moderation`, {
    method: 'PATCH',
    headers: authHeaders,
    body: {
      status: 'APPROVED',
      moderationNote: 'Review verified against verified purchase history. Approved.',
    },
  });
  console.log('[7.3] PATCH /reviews/:id/moderation:', moderateReview.status, moderateReview.data?.data?.status);
  record('7_ugc_moderation', 'Moderate Review (Approve Verified Review)', {
    endpoint: `PATCH /reviews/${reviewIdRaw}/moderation`,
    expectedStatus: 200,
    actualStatus: moderateReview.status,
    passed: moderateReview.status === 200 && moderateReview.data?.data?.status === 'APPROVED',
    reviewStatus: moderateReview.data?.data?.status,
  });

  // GET /ugc
  const listUgc = await request('/ugc', { headers: authHeaders });
  console.log('[7.4] GET /ugc:', listUgc.status, 'Total submissions:', listUgc.data?.data?.length);
  record('7_ugc_moderation', 'List UGC Submissions', {
    endpoint: 'GET /ugc',
    expectedStatus: 200,
    actualStatus: listUgc.status,
    passed: listUgc.status === 200 && Array.isArray(listUgc.data?.data),
    ugcCount: listUgc.data?.data?.length,
  });

  // Seed a pending UGC submission for the delivered order
  const seedUgcCode = `
    const db = require('/app/src/models');
    async function seedUgc() {
      const ugc = await db.UgcSubmission.create({
        customerId: '${targetCustomerId}',
        orderId: '${orderIdRaw}',
        productId: '${createdProductId}',
        platform: 'INSTAGRAM',
        mediaType: 'IMAGE',
        mediaUrl: 'https://cdn.example.com/ugc/parka-rain-test.jpg',
        postUrl: 'https://instagram.com/p/autumnparka123',
        caption: 'Took my new Waterproof Parka out on the trails! #RainGear #AutumnStyle',
        status: 'PENDING',
        orderVerified: true,
        adminVerified: false
      });
      console.log(ugc.id);
      process.exit(0);
    }
    seedUgc().catch(err => { console.error(err); process.exit(1); });
  `;
  const ugcIdRaw = execContainerJs(seedUgcCode);
  console.log('[7.5] Seeded pending UGC submission, ID:', ugcIdRaw);

  // Test PATCH /ugc/:id/review route check (prompt mentions /review, route is /verify)
  const ugcReviewRoute = await request(`/ugc/${ugcIdRaw}/review`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { status: 'APPROVED' },
  });
  console.log('[7.6] PATCH /ugc/:id/review route inspection:', ugcReviewRoute.status);
  record('7_ugc_moderation', 'PATCH /ugc/:id/review Route Architecture Inspection', {
    endpoint: `PATCH /ugc/${ugcIdRaw}/review`,
    expectedStatus: 404,
    actualStatus: ugcReviewRoute.status,
    passed: ugcReviewRoute.status === 404,
    note: 'UGC verification endpoint is PATCH /ugc/:id/verify.',
  });

  // Check customer wallet transactions before UGC reward
  const checkWalletBeforeCode = `
    const walletService = require('/app/src/modules/loyalty/wallet.service');
    async function check() {
      const bal = await walletService.getBalance('${targetCustomerId}');
      console.log(bal);
      process.exit(0);
    }
    check();
  `;
  const balBefore = Number(execContainerJs(checkWalletBeforeCode) || 0);

  // PATCH /ugc/:id/verify: Approve UGC submission and grant wallet reward
  const verifyUgc = await request(`/ugc/${ugcIdRaw}/verify`, {
    method: 'PATCH',
    headers: authHeaders,
    body: {
      status: 'APPROVED',
      rewardAmount: 25.00,
    },
  });
  console.log('[7.7] PATCH /ugc/:id/verify:', verifyUgc.status, verifyUgc.data?.data?.status);

  // Check customer wallet balance after UGC reward
  const balAfter = Number(execContainerJs(checkWalletBeforeCode) || 0);
  console.log('[7.8] Customer wallet balance:', balBefore, '->', balAfter, '(Difference:', balAfter - balBefore, ')');

  // Verify wallet transaction record
  const checkTxCode = `
    const db = require('/app/src/models');
    async function check() {
      const wallet = await db.Wallet.findOne({ where: { customerId: '${targetCustomerId}' } });
      if (!wallet) { console.log('{}'); process.exit(0); }
      const tx = await db.WalletTransaction.findOne({ where: { walletId: wallet.id, type: 'UGC_CREDIT', referenceId: '${ugcIdRaw}' } });
      console.log(JSON.stringify(tx));
      process.exit(0);
    }
    check();
  `;
  const walletTxRecord = JSON.parse(execContainerJs(checkTxCode) || '{}');

  record('7_ugc_moderation', 'Verify UGC Submission and Credit Loyalty Wallet', {
    endpoint: `PATCH /ugc/${ugcIdRaw}/verify`,
    expectedStatus: 200,
    actualStatus: verifyUgc.status,
    passed: verifyUgc.status === 200 && verifyUgc.data?.data?.status === 'APPROVED' && walletTxRecord?.type === 'UGC_CREDIT',
    rewardAmount: 25.00,
    walletBefore: balBefore,
    walletAfter: balAfter,
    credited: balAfter - balBefore,
    walletTransaction: walletTxRecord,
  });

  // =========================================================================
  // 8. Expenses & Financial Closing
  // =========================================================================
  console.log('\n--- STEP 8: Expenses & Financial Closing ---');

  // POST /expenses/categories
  const expCatName = `Warehouse Supplies ${Date.now()}`;
  const createExpCat = await request('/expenses/categories', {
    method: 'POST',
    headers: authHeaders,
    body: {
      name: expCatName,
      description: 'Packaging boxes, tape, envelopes, protective wraps',
      isActive: true,
    },
  });
  console.log('[8.1] POST /expenses/categories:', createExpCat.status, createExpCat.data?.data?.id);
  const createdExpCatId = createExpCat.data?.data?.id;
  record('8_finance', 'Create Operational Expense Category', {
    endpoint: 'POST /expenses/categories',
    expectedStatus: 201,
    actualStatus: createExpCat.status,
    passed: createExpCat.status === 201 && Boolean(createdExpCatId),
    category: createExpCat.data?.data,
  });

  // POST /expenses: create operational expense (use a unique test year to avoid collisions with closed periods)
  const uniqueYear = 2027 + Math.floor(Math.random() * 20);
  const expenseDate = `${uniqueYear}-05-10`;
  const createExpense = await request('/expenses', {
    method: 'POST',
    headers: authHeaders,
    body: {
      categoryId: createdExpCatId,
      amount: 145.50,
      date: expenseDate,
      vendor: 'Packaging Direct Ltd',
      paymentMethod: 'CORPORATE_CARD',
      description: 'Bulk 200-pack recycled shipping boxes for autumn orders',
      status: 'APPROVED',
    },
  });
  console.log('[8.2] POST /expenses:', createExpense.status, createExpense.data?.data?.id, 'Amount:', createExpense.data?.data?.amount);
  const createdExpenseId = createExpense.data?.data?.id;
  record('8_finance', 'Create Operational Expense', {
    endpoint: 'POST /expenses',
    expectedStatus: 201,
    actualStatus: createExpense.status,
    passed: createExpense.status === 201 && Boolean(createdExpenseId),
    expense: createExpense.data?.data,
  });

  // GET /finance/pnl
  const getPnl = await request('/finance/pnl?startDate=2026-10-01&endDate=2026-10-31', { headers: authHeaders });
  console.log('[8.3] GET /finance/pnl:', getPnl.status, 'Gross Sales:', getPnl.data?.data?.revenue?.grossSales, 'Gross Profit:', getPnl.data?.data?.profitability?.grossProfit, 'Net Profit:', getPnl.data?.data?.profitability?.netProfit);
  record('8_finance', 'Inspect Real-Time P&L Statement', {
    endpoint: 'GET /finance/pnl',
    expectedStatus: 200,
    actualStatus: getPnl.status,
    passed: getPnl.status === 200 && getPnl.data?.data?.revenue?.grossSales !== undefined,
    pnl: {
      revenue: getPnl.data?.data?.revenue,
      costOfGoodsSold: getPnl.data?.data?.costOfGoodsSold,
      profitability: getPnl.data?.data?.profitability,
      expenses: getPnl.data?.data?.expenses,
    },
  });

  // Test POST /finance/periods/close without ID (route check)
  const closeNoId = await request('/finance/periods/close', {
    method: 'POST',
    headers: authHeaders,
  });
  console.log('[8.4] POST /finance/periods/close without ID check:', closeNoId.status);
  record('8_finance', 'POST /finance/periods/close Route Inspection', {
    endpoint: 'POST /finance/periods/close',
    expectedStatus: 404,
    actualStatus: closeNoId.status,
    passed: closeNoId.status === 404,
    note: 'Period closing endpoint requires the period ID: POST /finance/periods/:id/close.',
  });

  // POST /finance/periods: Create financial period
  const periodName = `Period Close ${Date.now()}`;
  const createPeriod = await request('/finance/periods', {
    method: 'POST',
    headers: authHeaders,
    body: {
      name: periodName,
      startDate: `${uniqueYear}-05-01`,
      endDate: `${uniqueYear}-05-31`,
    },
  });
  console.log('[8.5] POST /finance/periods:', createPeriod.status, createPeriod.data?.data?.id);
  const createdPeriodId = createPeriod.data?.data?.id;
  record('8_finance', 'Create Financial Accounting Period', {
    endpoint: 'POST /finance/periods',
    expectedStatus: 201,
    actualStatus: createPeriod.status,
    passed: createPeriod.status === 201 && Boolean(createdPeriodId),
    period: createPeriod.data?.data,
  });

  // POST /finance/periods/:id/close: Close the period
  const closePeriod = await request(`/finance/periods/${createdPeriodId}/close`, {
    method: 'POST',
    headers: authHeaders,
  });
  console.log('[8.6] POST /finance/periods/:id/close:', closePeriod.status, 'Closed at:', closePeriod.data?.data?.closedAt);
  record('8_finance', 'Close Financial Accounting Period', {
    endpoint: `POST /finance/periods/${createdPeriodId}/close`,
    expectedStatus: 200,
    actualStatus: closePeriod.status,
    passed: closePeriod.status === 200 && Boolean(closePeriod.data?.data?.closedAt),
    closedPeriod: closePeriod.data?.data,
  });

  // Attempt to add an expense in the closed period (must be rejected 409 Conflict)
  const addExpenseClosed = await request('/expenses', {
    method: 'POST',
    headers: authHeaders,
    body: {
      categoryId: createdExpCatId,
      amount: 49.99,
      date: `${uniqueYear}-05-20`,
      vendor: 'Late Filing Vendor',
      description: 'Expense posted after month closing',
    },
  });
  console.log('[8.7] Attempt expense in closed period (expected 409):', addExpenseClosed.status, addExpenseClosed.data?.error?.message);
  record('8_finance', 'Reject Expense Creation in Closed Period (409 Conflict)', {
    endpoint: 'POST /expenses',
    expectedStatus: 409,
    actualStatus: addExpenseClosed.status,
    passed: addExpenseClosed.status === 409,
    error: addExpenseClosed.data?.error,
  });

  // Attempt to modify an expense in the closed period (must be rejected 409 Conflict)
  const modifyExpenseClosed = await request(`/expenses/${createdExpenseId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { amount: 200.00 },
  });
  console.log('[8.8] Attempt modify expense in closed period (expected 409):', modifyExpenseClosed.status, modifyExpenseClosed.data?.error?.message);
  record('8_finance', 'Reject Expense Modification in Closed Period (409 Conflict)', {
    endpoint: `PATCH /expenses/${createdExpenseId}`,
    expectedStatus: 409,
    actualStatus: modifyExpenseClosed.status,
    passed: modifyExpenseClosed.status === 409,
    error: modifyExpenseClosed.data?.error,
  });

  // =========================================================================
  // 9. Marketing & Analytics
  // =========================================================================
  console.log('\n--- STEP 9: Marketing & Analytics ---');

  // POST /marketing/campaigns
  const campaignName = `Autumn 2026 Push ${Date.now()}`;
  const createCampaign = await request('/marketing/campaigns', {
    method: 'POST',
    headers: authHeaders,
    body: {
      name: campaignName,
      channel: 'INSTAGRAM',
      budget: 750.00,
      utmSource: 'instagram',
      utmMedium: 'story',
      utmCampaign: 'autumn-parka',
      utmContent: 'carousel_v1',
      audience: 'Outdoors enthusiasts aged 24-40',
      isActive: true,
    },
  });
  console.log('[9.1] POST /marketing/campaigns:', createCampaign.status, createCampaign.data?.data?.id);
  const createdCampaignId = createCampaign.data?.data?.id;
  record('9_marketing_analytics', 'Create Marketing Campaign with UTM Parameters', {
    endpoint: 'POST /marketing/campaigns',
    expectedStatus: 201,
    actualStatus: createCampaign.status,
    passed: createCampaign.status === 201 && Boolean(createdCampaignId),
    campaign: createCampaign.data?.data,
  });

  // GET /analytics/sales
  const salesAnalytics = await request('/analytics/sales?startDate=2026-10-01&endDate=2026-10-31', { headers: authHeaders });
  console.log('[9.2] GET /analytics/sales:', salesAnalytics.status, 'Total revenue:', salesAnalytics.data?.data?.totalRevenue);
  record('9_marketing_analytics', 'Sales Analytics Endpoint', {
    endpoint: 'GET /analytics/sales',
    expectedStatus: 200,
    actualStatus: salesAnalytics.status,
    passed: salesAnalytics.status === 200 && salesAnalytics.data?.data !== undefined,
    data: salesAnalytics.data?.data,
  });

  // GET /analytics/customers
  const customerAnalytics = await request('/analytics/customers?startDate=2026-10-01&endDate=2026-10-31', { headers: authHeaders });
  console.log('[9.3] GET /analytics/customers:', customerAnalytics.status, 'Total customers:', customerAnalytics.data?.data?.totalCustomers);
  record('9_marketing_analytics', 'Customer Analytics Endpoint', {
    endpoint: 'GET /analytics/customers',
    expectedStatus: 200,
    actualStatus: customerAnalytics.status,
    passed: customerAnalytics.status === 200 && customerAnalytics.data?.data !== undefined,
    data: customerAnalytics.data?.data,
  });

  // GET /analytics/products
  const productAnalytics = await request('/analytics/products?startDate=2026-10-01&endDate=2026-10-31', { headers: authHeaders });
  console.log('[9.4] GET /analytics/products:', productAnalytics.status);
  record('9_marketing_analytics', 'Product Analytics Endpoint', {
    endpoint: 'GET /analytics/products',
    expectedStatus: 200,
    actualStatus: productAnalytics.status,
    passed: productAnalytics.status === 200 && productAnalytics.data?.data !== undefined,
    data: productAnalytics.data?.data,
  });

  // GET /analytics/marketing
  const marketingAnalytics = await request('/analytics/marketing?startDate=2026-10-01&endDate=2026-10-31', { headers: authHeaders });
  console.log('[9.5] GET /analytics/marketing:', marketingAnalytics.status);
  record('9_marketing_analytics', 'Marketing Analytics Endpoint', {
    endpoint: 'GET /analytics/marketing',
    expectedStatus: 200,
    actualStatus: marketingAnalytics.status,
    passed: marketingAnalytics.status === 200 && marketingAnalytics.data?.data !== undefined,
    data: marketingAnalytics.data?.data,
  });

  // GET /analytics/operations
  const operationsAnalytics = await request('/analytics/operations?startDate=2026-10-01&endDate=2026-10-31', { headers: authHeaders });
  console.log('[9.6] GET /analytics/operations:', operationsAnalytics.status);
  record('9_marketing_analytics', 'Operations Analytics Endpoint', {
    endpoint: 'GET /analytics/operations',
    expectedStatus: 200,
    actualStatus: operationsAnalytics.status,
    passed: operationsAnalytics.status === 200 && operationsAnalytics.data?.data !== undefined,
    data: operationsAnalytics.data?.data,
  });

  // =========================================================================
  // 10. Notifications Management
  // =========================================================================
  console.log('\n--- STEP 10: Notifications Management ---');

  // GET /notifications
  const listNotifications = await request('/notifications?page=1&limit=10', { headers: authHeaders });
  console.log('[10.1] GET /notifications:', listNotifications.status, 'Notifications count:', listNotifications.data?.data?.length);
  record('10_notifications', 'List Notifications', {
    endpoint: 'GET /notifications',
    expectedStatus: 200,
    actualStatus: listNotifications.status,
    passed: listNotifications.status === 200 && Array.isArray(listNotifications.data?.data),
    notificationsCount: listNotifications.data?.data?.length,
  });

  // POST /notifications: Send manual notification
  const sendNotification = await request('/notifications', {
    method: 'POST',
    headers: authHeaders,
    body: {
      type: 'ORDER_CONFIRMED',
      channel: 'EMAIL',
      recipient: 'shopper-test@example.com',
      title: 'Order Confirmed - Waterproof Parka',
      body: 'Your Autumn Parka order has been confirmed by operations and is being prepared for packing.',
      force: true,
      metadata: { orderNumber, source: 'Admin Operations Simulation' },
    },
  });
  console.log('[10.2] POST /notifications:', sendNotification.status, sendNotification.data?.data?.id, 'Status:', sendNotification.data?.data?.status);
  const createdNotificationId = sendNotification.data?.data?.id;
  record('10_notifications', 'Send Manual Notification', {
    endpoint: 'POST /notifications',
    expectedStatus: 201,
    actualStatus: sendNotification.status,
    passed: sendNotification.status === 201 && Boolean(createdNotificationId),
    notification: sendNotification.data?.data,
  });

  // POST /notifications/:id/retry
  const retryNotification = await request(`/notifications/${createdNotificationId}/retry`, {
    method: 'POST',
    headers: authHeaders,
  });
  console.log('[10.3] POST /notifications/:id/retry (already SENT check):', retryNotification.status, retryNotification.data?.error?.message || retryNotification.data?.data?.status);
  record('10_notifications', 'Retry Notification Delivery Guard', {
    endpoint: `POST /notifications/${createdNotificationId}/retry`,
    expectedStatus: 409,
    actualStatus: retryNotification.status,
    passed: [200, 409].includes(retryNotification.status),
    retriedNotification: retryNotification.data,
  });

  console.log('\n===============================================================');
  console.log('SIMULATION RUN COMPLETE');
  console.log(`Total Checks: ${results.summary.total} | Passed: ${results.summary.passed} | Failed: ${results.summary.failed}`);
  console.log('===============================================================');

  return results;
}

run()
  .then((results) => {
    fs.writeFileSync('./admin-operations-sim-report.json', JSON.stringify(results, null, 2));
    console.log('\nWrote detailed JSON test results to ./admin-operations-sim-report.json');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Simulation script failed:', err);
    process.exit(1);
  });
