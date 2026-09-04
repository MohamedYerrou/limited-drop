const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTest() {
  console.log('--- 1. Creating a Limited Product (Stock = 1) ---');
  const productRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/products',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      name: 'Sony PS5 Pro Limited Drop',
      description: 'Exclusive release with only 1 unit',
      price: 699.99,
      stock: 1,
    }
  );

  const product = productRes.body;
  console.log(`Created Product #${product.id} with Stock: ${product.stock}\n`);

  console.log('--- 2. Firing 10 Concurrent Reservation Requests Simultaneously ---');
  const attempts = Array.from({ length: 10 }, (_, i) => ({
    user: `User-${i + 1}`,
  }));

  // Fire all requests at the exact same instant using Promise.all
  const results = await Promise.all(
    attempts.map(async (u) => {
      const res = await request(
        {
          hostname: 'localhost',
          port: 3000,
          path: '/reservations',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          productId: product.id,
          quantity: 1,
        }
      );
      return { user: u.user, status: res.status, data: res.body };
    })
  );

  console.log('--- Results ---');
  let successes = 0;
  let failures = 0;

  results.forEach((r) => {
    if (r.status === 201) {
      console.log(`[201 SUCCESS] ${r.user} secured Reservation #${r.data.id}`);
      successes++;
    } else {
      console.log(`[${r.status} REJECTED] ${r.user}: ${r.data?.message}`);
      failures++;
    }
  });

  console.log(`\nSummary: ${successes} Succeeded, ${failures} Rejected.`);

  console.log('\n--- 3. Verifying Final Product Stock in Database ---');
  const finalProductRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/products/${product.id}`,
    method: 'GET',
  });
  console.log(`Final Database Stock: ${finalProductRes.body.stock}`);

  if (successes === 1 && failures === 9 && finalProductRes.body.stock === 0) {
    console.log('\n VERDICT: RACE CONDITION TEST PASSED! No overselling occurred.');
  } else {
    console.log('\n VERDICT: TEST FAILED! Check transaction isolation.');
  }
}

runTest().catch(console.error);