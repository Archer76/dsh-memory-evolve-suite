// Print source/shape of user messages in a decompressed DSH session dump.
const fs = require('fs');
const file = process.argv[2];
if (!file) { console.error('usage: node msgsrc.js <decompressed-session.jsonl>'); process.exit(2); }
const lines = fs.readFileSync(file, 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  let o;
  try { o = JSON.parse(line); } catch { continue; }
  const pick = (m) => {
    if (!m) return null;
    return { id: m.id, role: m.role, source: m.source, keys: Object.keys(m).sort() };
  };
  if (o.type === 'user/message' && o.data?.source?.kind && o.data.source.kind !== 'skill-catalog') {
    console.log(`L${i + 1} ${o.type} seq=${o.seq} ${new Date(o.time).toLocaleString('zh-CN', { hour12: false })} ${JSON.stringify(pick(o.data))}`);
  }
  if (o.type === 'agent/inbox/spliced' && o.data?.inserted?.length) {
    const it = o.data.inserted[0];
    const txt = (it.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(' ').slice(0, 40);
    console.log(`L${i + 1} spliced seq=${o.seq} ${new Date(o.time).toLocaleString('zh-CN', { hour12: false })} ${JSON.stringify(pick(it))} text=${JSON.stringify(txt)}`);
  }
}
