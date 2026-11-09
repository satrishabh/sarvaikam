// Run inside the Learn app pod: node deploy/verify-content-storage.cjs
// Uses Workload Identity, prints no credentials or signed URLs, and removes only
// its own uniquely named smoke-test object. Does not create a catalogue resource.
const { createHash, randomUUID } = require('node:crypto');
const bucket = process.env.GCP_CONTENT_BUCKET;
const account = process.env.GCP_SIGNING_SERVICE_ACCOUNT;
if (bucket !== 'cotent_bucket' || !account?.startsWith('sarvaikam-content@')) {
  throw new Error('Expected configured Learn storage identity');
}
const object = `_storage-check/${randomUUID()}.txt`;
const content = 'Sarvaikam private storage check\n';
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g,
  ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
const path = '/' + bucket + '/' + object.split('/').map(encode).join('/');
const hash = value => createHash('sha256').update(value).digest('hex');
let accessToken;
let created = false;
async function checked(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Storage check request failed: HTTP ${response.status}`);
  return response;
}
async function signedUrl(method, additionalHeaders = {}, additionalQuery = {}) {
  const timestamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = timestamp.slice(0, 8);
  const scope = `${day}/auto/storage/goog4_request`;
  const headers = { host: 'storage.googleapis.com', ...additionalHeaders };
  const names = Object.keys(headers).sort();
  const query = {
    'X-Goog-Algorithm': 'GOOG4-RSA-SHA256',
    'X-Goog-Credential': `${account}/${scope}`,
    'X-Goog-Date': timestamp,
    'X-Goog-Expires': '120',
    'X-Goog-SignedHeaders': names.join(';'),
    ...additionalQuery,
  };
  const canonicalQuery = Object.entries(query).map(([key, value]) => [encode(key), encode(value)])
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join('&');
  const canonicalHeaders = names.map(name => `${name}:${headers[name].trim()}\n`).join('');
  const request = [method, path, canonicalQuery, canonicalHeaders, names.join(';'), 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['GOOG4-RSA-SHA256', timestamp, scope, hash(request)].join('\n');
  const response = await checked(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${account}:signBlob`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: Buffer.from(stringToSign).toString('base64') }),
  });
  const signed = await response.json();
  const signature = Buffer.from(signed.signedBlob, 'base64').toString('hex');
  return `https://storage.googleapis.com${path}?${canonicalQuery}&X-Goog-Signature=${signature}`;
}
async function main() {
  const tokenResponse = await checked('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
    headers: { 'Metadata-Flavor': 'Google' },
  });
  accessToken = (await tokenResponse.json()).access_token;
  if (!accessToken) throw new Error('Workload Identity did not supply credentials');
  console.log('PASS Workload Identity token acquisition');
  try {
    const headers = { 'content-type': 'text/plain', 'content-length': String(Buffer.byteLength(content)) };
    const upload = await signedUrl('PUT', headers, { ifGenerationMatch: '0' });
    await checked(upload, { method: 'PUT', headers, body: content });
    created = true;
    console.log('PASS IAM signing and signed PUT with exact byte length');
    const download = await signedUrl('GET');
    const actual = await (await checked(download)).text();
    if (actual !== content) throw new Error('Downloaded content mismatch');
    console.log('PASS signed GET and content integrity');
    const anonymous = await fetch(`https://storage.googleapis.com${path}`, { signal: AbortSignal.timeout(30000) });
    if (anonymous.status !== 401 && anonymous.status !== 403) throw new Error('Unexpected anonymous access response');
    console.log('PASS anonymous access denied');
  } finally {
    if (created) {
      await checked(`https://storage.googleapis.com/storage/v1/b/${encode(bucket)}/o/${encode(object)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log('PASS smoke-test live object removed (bucket retention policies still apply)');
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
