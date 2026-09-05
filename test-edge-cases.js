const API_BASE = process.env.API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runEdgeCaseTests() {
  console.log(`\n==================================================`);
  console.log(`🚀 RUNNING EDGE-CASE & STRESS TEST SUITE ON: ${API_BASE}`);
  console.log(`==================================================\n`);

  // --- EDGE CASE 1: Reserve Product with 0 Stock ---
  console.log('[Test 1] Attempting to reserve an Out-of-Stock product (Item Gamma / ID 3)...');
  const resZero = await request('/reservations', {
    method: 'POST',
    body: JSON.stringify({ productId: 3, quantity: 1 }),
  });
  assert(resZero.status === 400, 'Rejects reservation when stock = 0 with HTTP 400');

  // --- EDGE CASE 2: Non-existent Product ID ---
  console.log('\n[Test 2] Attempting to reserve a non-existent product ID (ID 9999)...');
  const resNotFound = await request('/reservations', {
    method: 'POST',
    body: JSON.stringify({ productId: 9999, quantity: 1 }),
  });
  assert(resNotFound.status === 400 || resNotFound.status === 404, 'Rejects invalid product ID cleanly');

  // --- EDGE CASE 3: Invalid Quantities (Negative / Zero) ---
  console.log('\n[Test 3] Attempting invalid payload: zero or negative quantity...');
  const resNeg = await request('/reservations', {
    method: 'POST',
    body: JSON.stringify({ productId: 2, quantity: 0 }),
  });
  assert(resNeg.status === 400, 'Rejects quantity = 0 with HTTP 400');

  // --- EDGE CASE 4: Checkout Double-Spending ---
  console.log('\n[Test 4] Reserving Item Beta (ID 2) and attempting Double Checkout...');
  const holdRes = await request('/reservations', {
    method: 'POST',
    body: JSON.stringify({ productId: 2, quantity: 1 }),
  });
  assert(holdRes.status === 201, 'Creates initial active reservation');
  const reservationId = holdRes.data.id;

  const checkout1 = await request(`/checkout/${reservationId}`, { method: 'POST' });
  assert(checkout1.status === 201 || checkout1.status === 200, 'First checkout completes successfully');

  const checkout2 = await request(`/checkout/${reservationId}`, { method: 'POST' });
  assert(checkout2.status === 400, 'Second identical checkout fails with HTTP 400 (Cannot double-complete)');

  // --- EDGE CASE 5: Concurrency Burst (Pessimistic Lock Defense) ---
  console.log('\n[Test 5] Simulating 20 Concurrent Users fighting for Item Alpha (Stock = 1)...');
  const burstRequests = Array.from({ length: 20 }, (_, i) =>
    request('/reservations', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, quantity: 1 }),
    }).then((res) => ({ user: i + 1, ...res })),
  );

  const burstResults = await Promise.all(burstRequests);
  const successes = burstResults.filter((r) => r.status === 201);
  const rejections = burstResults.filter((r) => r.status === 400);

  console.log(`-> Burst results: ${successes.length} Succeeded, ${rejections.length} Rejected`);
  assert(successes.length === 1, 'Exactly 1 request succeeded under heavy contention');
  assert(rejections.length === 19, 'Exactly 19 requests rejected cleanly with HTTP 400');

  // --- EDGE CASE 6: Verify Database Consistency ---
  console.log('\n[Test 6] Verifying product stock values directly from API...');
  const prodRes = await request('/products/1');
  assert(prodRes.data.stock === 0, 'Item Alpha stock was decremented to exactly 0 (No overselling)');

  console.log(`\n==================================================`);
  console.log(`🎉 ALL EDGE CASES AND CONCURRENCY TESTS PASSED!`);
  console.log(`==================================================\n`);
}

runEdgeCaseTests();