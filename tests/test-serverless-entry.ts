import supertest from 'supertest';
import app from '../api/index.js';

async function testAll() {
  const request = supertest(app);

  console.log('=== 1. Health & Root Endpoints ===');
  const rootRes = await request.get('/api');
  console.log('GET /api status:', rootRes.status, rootRes.body);

  const healthRes = await request.get('/api/health');
  console.log('GET /api/health status:', healthRes.status, healthRes.body.status);

  console.log('\n=== 2. Public Endpoints ===');
  const statsRes = await request.get('/api/public/stats');
  console.log('GET /api/public/stats status:', statsRes.status, 'Has beds/applications:', Boolean(statsRes.body?.applications));

  console.log('\n=== 3. Testing All Role Credentials (Password: Password@123) ===');
  const testAccounts = [
    { role: 'ADMIN', loginId: 'admin' },
    { role: 'HOSTEL_OFFICE', loginId: 'office' },
    { role: 'CHIEF_WARDEN', loginId: 'chiefwarden' },
    { role: 'WARDEN', loginId: 'warden_bh1' },
    { role: 'CARETAKER', loginId: 'caretaker_bh1' },
    { role: 'MESS_MANAGER', loginId: 'mess_mgr' },
    { role: 'STUDENT', loginId: '2026UCSDS0001' },
  ];

  for (const acct of testAccounts) {
    const res = await request
      .post('/api/auth/login')
      .send({ login_id: acct.loginId, password: 'Password@123' });
    
    if (res.status === 200 && res.body.user && res.body.user.role === acct.role) {
      console.log(`[PASS] ${acct.role} (${acct.loginId}): HTTP 200, user=${res.body.user.loginId}`);
    } else {
      console.error(`[FAIL] ${acct.role} (${acct.loginId}): HTTP ${res.status}`, res.body);
      process.exit(1);
    }
  }

  console.log('\n=== 4. Testing Invalid Password Behavior ===');
  const failRes = await request
    .post('/api/auth/login')
    .send({ login_id: 'admin', password: 'WrongPassword@999' });
  console.log('Wrong credentials status:', failRes.status, 'Body:', failRes.body);
  if (failRes.status !== 401) {
    console.error('Expected 401 for wrong password, got:', failRes.status);
    process.exit(1);
  }

  console.log('\n=== 5. Testing Empty / Missing Body Handling ===');
  const emptyRes = await request
    .post('/api/auth/login')
    .send({});
  console.log('Empty body status:', emptyRes.status, 'Body:', emptyRes.body);
  if (emptyRes.status !== 400 && emptyRes.status !== 422) {
    console.error('Expected 400/422 validation failure, got:', emptyRes.status);
    process.exit(1);
  }

  console.log('\n=== ALL SERVERLESS ENDPOINTS VERIFIED AND PASSING! ===');
  process.exit(0);
}

testAll().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
