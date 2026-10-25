'use strict';

const { spec } = require('../src/docs/swagger');

describe('OpenAPI / Swagger Audit Test Suite', () => {
  it('generates a valid OpenAPI 3.0.3 specification object', () => {
    expect(spec).toBeDefined();
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toContain('Clothing Commerce');
  });

  it('contains security schemes and bearerAuth JWT definition', () => {
    expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth.type).toBe('http');
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });

  it('contains all required top-level domain tags', () => {
    const registeredTagNames = (spec.tags || []).map((t) => t.name);
    const expectedTags = [
      'Health',
      'Auth',
      'Users',
      'Customers',
      'Catalog',
      'Discovery',
      'Inventory',
      'Cart',
      'Promotions',
      'Checkout',
      'Orders',
      'Payments',
      'Loyalty',
      'Referrals',
      'Reviews',
      'UGC',
      'Expenses',
      'Finance',
      'Marketing',
      'Analytics',
      'Notifications',
    ];

    expectedTags.forEach((tag) => {
      expect(registeredTagNames).toContain(tag);
    });
  });

  it('verifies paths are discovered across module controllers with proper schemas', () => {
    const paths = Object.keys(spec.paths || {});
    expect(paths.length).toBeGreaterThanOrEqual(15);

    // Verify key operations exist
    expect(spec.paths['/health/live']).toBeDefined();
    expect(spec.paths['/notifications']).toBeDefined();
    expect(spec.paths['/expenses']).toBeDefined();
    expect(spec.paths['/finance/pnl']).toBeDefined();
    expect(spec.paths['/marketing/campaigns']).toBeDefined();
    expect(spec.paths['/analytics/sales']).toBeDefined();

    // Verify each operation has valid responses and tags
    paths.forEach((path) => {
      const pathItem = spec.paths[path];
      const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];

      httpMethods.forEach((method) => {
        const operation = pathItem[method];
        if (operation) {
          expect(operation.responses).toBeDefined();
          expect(Array.isArray(operation.tags)).toBe(true);
          expect(operation.tags.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
