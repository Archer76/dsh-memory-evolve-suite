// Timeline of turns and their end reasons for a DSH session log.
// Usage: node ztail.js <session.v3.jsonl.zstd> [maxTurns]
const fs = require('fs');
const zlib = require('zlib');
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function decompressAll(buf) {
  const idx = [];
  let i = buf.indexOf(MAGIC, 0);
  while (i !== -1) { idx.push(i); i = buf.indexOf(MAGIC, i + 4); }
  const chunks = [];
  for (let k = 0; k < idx.length; k++) {
    const start = idx[k], end = k + 1 < idx.length ? idx[k + 1] : buf.length;
    try { chunks.push(zlib.zstdDecompressSync(buf.subarray(start, end))); }
    catch (e) { chunks.push(Buffer.from(`{"type":"__frame_error","msg":${JSON.stringify(e.message)}}\n`)); }
  }
  return Buffer.concat(chunks).toString('utf8');
}

// 时区：默认用本机本地时区；要与他人对照日志时设 DSH_TOOLS_TZ=Asia/Shanghai 固定下来。
const TZ = process.env.DSH_TOOLS_TZ || undefined;
const ts = (ms) => new Date(ms).toLocaleString('zh-CN', { timeZone: TZ, hour12: false });
const src = process.argv[2];
const max = Number(process.argv[3] || 40);
if (!src) { console.error('usage: node ztail.js <session.v3.jsonl.zstd> [maxTurns]'); process.exit(2); }
const text = decompressAll(fs.readFileSync(src));
const events = [];
for (const line of text.split('\n')) { if (!line) continue; try { events.push(JSON.parse(line)); } catch {} }

const errs = events.filter(e => e.type === 'turn/end' && e.data?.reason?.kind === 'error');
const ends = events.filter(e => e.type === 'turn/end');
console.log(`file: ${src}`);
console.log(`events=${events.length} turns=${ends.length} errored=${errs.length}`);
if (errs.length) {
  console.log(`first error: ${ts(errs[0].time)}  last error: ${ts(errs[errs.length - 1].time)}`);
  const seen = new Map();
  for (const e of errs) { const m = e.data.reason.error?.message || '?'; seen.set(m, (seen.get(m) || 0) + 1); }
  console.log('--- distinct error messages ---');
  for (const [m, c] of seen) console.log(`x${c}  ${m}`);
}
console.log(`--- last ${max} turns ---`);
const recent = ends.slice(-max);
for (const e of recent) {
  const r = e.data.reason || {};
  const kind = r.kind;
  let extra = '';
  if (kind === 'error') extra = ` :: ${r.error?.message || ''}`;
  else if (r.turn !== undefined) extra = '';
  console.log(`turn ${e.data.turn} @ ${ts(e.time)} -> ${kind}${extra}`);
}
// last user messages
console.log('--- last user inputs ---');
const users = events.filter(e => e.type === 'agent/inbox/spliced' && e.data?.inserted?.length);
for (const e of users.slice(-6)) {
  const it = e.data.inserted[0];
  const txt = (it.content || []).filter(c => c.type === 'text').map(c => c.text).join(' ');
  console.log(`@${ts(e.time)} ${JSON.stringify(txt).slice(0, 200)}`);
}
