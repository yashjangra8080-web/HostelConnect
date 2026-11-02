process.env.NODE_ENV = 'test';
import request from 'supertest';
import { app } from '../server/src/index.js';
import { pool, closeAllPools } from '../server/src/db.js';

interface BenchmarkResult {
  endpoint: string;
  totalRequests: number;
  minMs: number;
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  passedP95: boolean;
}

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))];
}

async function benchmarkEndpoint(
  name: string,
  fn: () => Promise<any>,
  concurrency: number = 5,
  totalRequests: number = 50
): Promise<BenchmarkResult> {
  const timings: number[] = [];
  const queue = Array.from({ length: totalRequests }, (_, i) => i);

  async function worker() {
    while (queue.length > 0) {
      queue.pop();
      const start = performance.now();
      await fn();
      const duration = performance.now() - start;
      timings.push(duration);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  timings.sort((a, b) => a - b);
  const sum = timings.reduce((acc, t) => acc + t, 0);
  const mean = sum / timings.length;
  const p95 = percentile(timings, 95);

  return {
    endpoint: name,
    totalRequests,
    minMs: Number(timings[0].toFixed(2)),
    meanMs: Number(mean.toFixed(2)),
    p50Ms: Number(percentile(timings, 50).toFixed(2)),
    p90Ms: Number(percentile(timings, 90).toFixed(2)),
    p95Ms: Number(p95.toFixed(2)),
    p99Ms: Number(percentile(timings, 99).toFixed(2)),
    maxMs: Number(timings[timings.length - 1].toFixed(2)),
    passedP95: p95 < 300,
  };
}

async function main() {
  console.log('================================================================================');
  console.log('HostelConnect Phase 10: High-Throughput Load Testing & Allotment Benchmark');
  console.log('Target: P95 Latency < 300 ms across all main read endpoints (2,000 students dataset)');
  console.log('================================================================================\n');

  // Authenticate Admin session
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ login_id: 'admin', password: 'Password@123' });

  const adminCookies = adminLogin.headers['set-cookie'] || [];
  const token = adminCookies.find((c: string) => c.startsWith('token='))?.split(';')[0] || '';
  const csrf = adminCookies.find((c: string) => c.startsWith('csrf_token='))?.split(';')[0] || '';
  const adminCookie = `${token}; ${csrf}`;

  const endpointsToTest = [
    {
      name: 'GET /api/pool (Transparency Pool, 50 rows)',
      fn: () => request(app).get('/api/pool?page=1&pageSize=50').set('Cookie', adminCookie),
    },
    {
      name: 'GET /api/rooms/board (Occupancy Board, All Hostels)',
      fn: () => request(app).get('/api/rooms/board').set('Cookie', adminCookie),
    },
    {
      name: 'GET /api/notices (Notice Hub Listing)',
      fn: () => request(app).get('/api/notices').set('Cookie', adminCookie),
    },
    {
      name: 'GET /api/search?q=Aarav (Universal Full-Text Search)',
      fn: () => request(app).get('/api/search?q=Aarav').set('Cookie', adminCookie),
    },
    {
      name: 'GET /api/mess/refunds (Manager Refund Ledger)',
      fn: () => request(app).get('/api/mess/refunds?month=10&year=2026&hostel_id=1').set('Cookie', adminCookie),
    },
  ];

  const results: BenchmarkResult[] = [];

  for (const ep of endpointsToTest) {
    process.stdout.write(`Benchmarking ${ep.name}... `);
    const res = await benchmarkEndpoint(ep.name, ep.fn, 5, 50);
    console.log(`P95: ${res.p95Ms} ms ${res.passedP95 ? '✓ [PASS]' : '✗ [FAIL]'}`);
    results.push(res);
  }

  // Benchmark Full Allotment Run on 2,000-student dataset using a dedicated benchmark cycle
  console.log('\nBenchmarking Full Allotment Run on 2,000-student dataset (sp_run_allotment)...');
  const BENCHMARK_CYCLE_ID = 8888;
  await pool.query('DELETE FROM allotments WHERE cycle_id = ?', [BENCHMARK_CYCLE_ID]);
  await pool.query('DELETE FROM applications WHERE cycle_id = ?', [BENCHMARK_CYCLE_ID]);
  await pool.query('DELETE FROM allotment_cycles WHERE cycle_id = ?', [BENCHMARK_CYCLE_ID]);

  await pool.query(`
    INSERT INTO allotment_cycles (cycle_id, academic_year, status, opened_on, closed_on)
    VALUES (?, '2026-27', 'CLOSED', '2026-07-01', '2026-07-31')
  `, [BENCHMARK_CYCLE_ID]);

  // Clone cycle 1 applications to benchmark cycle
  await pool.query(`
    INSERT INTO applications (cycle_id, student_id, distance_km, verification_status, status, applied_at)
    SELECT ?, student_id, distance_km, verification_status, 'PENDING', applied_at
    FROM applications
    WHERE cycle_id = 1
  `, [BENCHMARK_CYCLE_ID]);

  const allotmentTimings: number[] = [];
  try {
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      await pool.query('CALL sp_run_allotment(?, 1)', [BENCHMARK_CYCLE_ID]);
      const duration = performance.now() - start;
      allotmentTimings.push(duration);
    }
  } finally {
    await pool.query('DELETE FROM allotments WHERE cycle_id = ?', [BENCHMARK_CYCLE_ID]);
    await pool.query('DELETE FROM applications WHERE cycle_id = ?', [BENCHMARK_CYCLE_ID]);
    await pool.query('DELETE FROM allotment_cycles WHERE cycle_id = ?', [BENCHMARK_CYCLE_ID]);
  }

  allotmentTimings.sort((a, b) => a - b);
  const avgAllotment = allotmentTimings.reduce((a, b) => a + b, 0) / allotmentTimings.length;
  console.log(`Full Allotment Run (1,150 applicants, 300 beds) Executed in: Min ${allotmentTimings[0].toFixed(2)} ms | Mean ${avgAllotment.toFixed(2)} ms | Max ${allotmentTimings[allotmentTimings.length - 1].toFixed(2)} ms`);

  console.log('\n================================================================================');
  console.log('SUMMARY TABLE');
  console.log('================================================================================');
  console.table(
    results.map((r) => ({
      Endpoint: r.endpoint,
      Requests: r.totalRequests,
      'Min (ms)': r.minMs,
      'Mean (ms)': r.meanMs,
      'P50 (ms)': r.p50Ms,
      'P90 (ms)': r.p90Ms,
      'P95 (ms)': r.p95Ms,
      'P99 (ms)': r.p99Ms,
      'Target <300ms': r.passedP95 ? 'PASS' : 'FAIL',
    }))
  );

  const allPassed = results.every((r) => r.passedP95);
  console.log(`\nFinal Verdict: ${allPassed ? 'ALL READ ENDPOINTS SATISFIED P95 < 300 MS' : 'ONE OR MORE ENDPOINTS EXCEEDED 300 MS'}`);

  await closeAllPools();
  process.exit(allPassed ? 0 : 1);
}

main().catch(async (err) => {
  console.error('[Load Test Runner] Error:', err);
  await closeAllPools();
  process.exit(1);
});
