// Multi-frame zstd dumper for DSH session logs.
// Usage: node zdump.js <session.v3.jsonl.zstd> [outFile]
// Node's zstdDecompressSync only decodes the first frame; session logs are
// concatenated frames, so scan for the magic 28 B5 2F FD and decode each.
const fs = require('fs');
const zlib = require('zlib');

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function decompressAll(buf) {
  const idx = [];
  let i = buf.indexOf(MAGIC, 0);
  while (i !== -1) { idx.push(i); i = buf.indexOf(MAGIC, i + 4); }
  const chunks = [];
  const errors = [];
  if (idx.length === 0) return { text: '', frames: 0, errors: ['no zstd frame found'] };
  for (let k = 0; k < idx.length; k++) {
    const start = idx[k];
    const end = k + 1 < idx.length ? idx[k + 1] : buf.length;
    try {
      chunks.push(zlib.zstdDecompressSync(buf.subarray(start, end)));
    } catch (e) {
      errors.push(`frame#${k} @${start}: ${e.message}`);
    }
  }
  return { text: Buffer.concat(chunks).toString('utf8'), frames: idx.length, errors };
}

const src = process.argv[2];
const out = process.argv[3];
if (!src) { console.error('usage: node zdump.js <file.zstd> [outFile]'); process.exit(2); }
const buf = fs.readFileSync(src);
const { text, frames, errors } = decompressAll(buf);
if (out) fs.writeFileSync(out, text, 'utf8');
else process.stdout.write(text);
console.error(`[zdump] file=${src} bytes=${buf.length} frames=${frames} text=${text.length} errors=${errors.length ? errors.join('; ') : 'none'}`);
