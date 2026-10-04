const crypto = require('crypto');

const BASE_URL = 'http://127.0.0.1:4100';
const secret = '62GFIHYA-gh1HZ8x0LgxXGqypnRgPw0uWf9gVgz7FgMvvfWpIbKH2ccLcd_mqma6';
const userId = 'ec72946f-af98-4d37-bb9c-59452dd9254f';
const sessionId = '89d105ae-411f-48c5-bda5-1d2f00161355';

function createToken(uid, sid) {
  function base64url(buf) {
    return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        sub: uid,
        sid: sid,
        typ: 'access',
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const sig = base64url(crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

async function runLocalAITests() {
  const token = createToken(userId, sessionId);
  console.log('Using active session token for testing...');

  // 1. Check AI Status
  console.log('\n--- 1. Checking /api/ai/status ---');
  const statusRes = await fetch(`${BASE_URL}/api/ai/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const statusData = await statusRes.json();
  console.log('AI Status Response:', JSON.stringify(statusData, null, 2));

  // 2. Test Docs Text Assist
  console.log('\n--- 2. Testing /api/ai/docs/assist (Summarize with Llama 3.3 70B) ---');
  const docRes = await fetch(`${BASE_URL}/api/ai/docs/assist`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task: 'summarize',
      text: 'QubSuite is an all-in-one collaborative workspace that brings documents, spreadsheets, cloud drive storage, and dynamic form builders together. With persistent WebSockets and real-time CRDT synchronization, teams can edit documents simultaneously without conflict. It connects to Cloudflare Workers AI for autonomous document co-authoring and formula creation.',
    }),
  });
  const docData = await docRes.json();
  console.log('Docs Assist Output:\n', docData.data?.result || JSON.stringify(docData, null, 2));

  // 3. Test Sheets Formula Generator
  console.log('\n--- 3. Testing /api/ai/sheets/formula (Qwen 2.5 Coder 32B) ---');
  const sheetRes = await fetch(`${BASE_URL}/api/ai/sheets/formula`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instruction: 'Sum the values in column B where column A is "Completed" and column C is greater than 50',
    }),
  });
  const sheetData = await sheetRes.json();
  console.log('Sheets Formula Output:\n', JSON.stringify(sheetData.data || sheetData, null, 2));

  // 4. Test Form Schema Generator
  console.log('\n--- 4. Testing /api/ai/forms/generate (Llama 3.3 70B JSON mode) ---');
  const formRes = await fetch(`${BASE_URL}/api/ai/forms/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: 'Employee Annual Performance Self-Review',
      fieldCount: 3,
    }),
  });
  const formData = await formRes.json();
  console.log('Forms Generated Output:\n', JSON.stringify(formData.data || formData, null, 2));
}

runLocalAITests();
