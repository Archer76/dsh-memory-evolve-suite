// Scan DSH session logs for errored turns.
// Usage: node zscan.js <session.v3.jsonl.zstd>
// Prints turn/end events whose reason indicates error/abort, plus error payloads.
const fs = require('fs');
const zlib = require('zlib');

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function decompressAll(buf) {
  const idx = [];
  let i = buf.indexOf(MAGIC, 0);
  while (i !== -1) { idx.push(i); i = buf.indexOf(MAGIC, i + 4); }
  const chunks = [];
  for (let k = 0; k < idx.length; k++) {
    const start = idx[k];
    const end = k + 1 < idx.length ? idx[k + 1] : buf.length;
    try { chunks.push(zlib.zstdDecompressSync(buf.subarray(start, end))); }
    catch (e) { chunks.push(Buffer.from(`{"__frame_error":"${e.message}"}\n`)); }
  }
  return Buffer.concat(chunks).toString('utf8');
}

const src = process.argv[2];
if (!src) { console.error('usage: node zscan.js <session.v3.jsonl.zstd>'); process.exit(2); }
const text = decompressAll(fs.readFileSync(src));
const lines = text.split('\n').filter(Boolean);
const events = [];
for (const line of lines) {
  try { events.push(JSON.parse(line)); } catch { /* partial line */ }
}
const count = {};
for (const e of events) { const k = e.type || e.kind || '?'; count[k] = (count[k] || 0) + 1; }
console.log(`file: ${src}`);
console.log(`events: ${events.length}  types: ${JSON.stringify(count)}`);
console.log('--- turn/end & errors ---');
for (const e of events) {
  const t = e.type || e.kind;
  if (t === 'turn/end' || t === 'turn/error' || t === 'error' || t === 'session/error') {
    const reason = e.data?.reason ?? e.reason ?? e.data ?? {};
    console.log(`[${t}] ts=${e.ts || e.timestamp || ''} ${JSON.stringify(reason).slice(0, 2000)}`);
  }
}
// last few user/assistant messages
const msgs = events.filter(e => (e.type === 'message' || e.type === 'session/event') );
console.log('--- tail ---');
for (const e of events.slice(-12)) {
  const s = JSON.stringify(e);
  console.log(s.length > 800 ? s.slice(0, 800) + '…' : s);
}
