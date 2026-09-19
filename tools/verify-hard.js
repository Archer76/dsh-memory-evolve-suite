// verify-hard.js — 把 verify-merge.js 报出的「缺失令牌」分成软缺与硬缺，避免误报淹掉真问题。
//
// 用法: node verify-hard.js <chunksDir> <snapshotFile> [chunksJson]   （参数同 verify-merge.js）
// 判据: 令牌在合并稿里作为子串出现（含大小写差异），或按非字母数字字符拆段后每段都还在
//       → 判为**软缺**（只是换了写法，例如 a/b/c 改写成顿号连接、BOSS 2.6 对 BOSS2.6）；
//       两者都不成立才是**硬缺**（真丢事实），并把硬缺令牌定位回原条目编号。
// 明细写入 <chunksDir>/hard-missing.json，供定向修复用。
const fs = require('fs');
const path = require('path');

const [chunksDir, snapshotFile, chunksJsonArg] = process.argv.slice(2);
if (!chunksDir || !snapshotFile) {
  console.error('用法: node verify-hard.js <chunksDir> <snapshotFile> [chunksJson]');
  process.exit(2);
}
const chunksJson = chunksJsonArg || path.join(chunksDir, 'chunks.json');
if (!fs.existsSync(chunksJson)) {
  console.error('找不到块定义: ' + chunksJson);
  process.exit(2);
}
const CHUNKS = JSON.parse(fs.readFileSync(chunksJson, 'utf8'));

const blocks = (t) => t.split(/\r?\n\s*§\s*\r?\n/).map((s) => s.trim()).filter(Boolean);
const originals = blocks(fs.readFileSync(snapshotFile, 'utf8'));

function tokens(text) {
  const out = new Set();
  for (const m of text.matchAll(/[A-Za-z_][A-Za-z0-9_.\-/]{2,}/g)) out.add(m[0]);
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) if (m[0].length >= 2) out.add(m[0]);
  return out;
}
const segments = (t) => t.split(/[^A-Za-z0-9_]+/).filter((s) => s.length >= 3);

let hardTotal = 0;
const report = {};
for (const [name, idx] of Object.entries(CHUNKS)) {
  const mergedPath = path.join(chunksDir, `merged-${name}.md`);
  if (!fs.existsSync(mergedPath)) { console.log(`❌ ${name}: 缺 merged 文件`); continue; }
  const merged = fs.readFileSync(mergedPath, 'utf8');
  const mergedTokens = tokens(merged);
  const mergedLower = merged.toLowerCase();
  const src = idx.map((i) => originals[i - 1]).join('\n');
  const missing = [...tokens(src)].filter((t) => !mergedTokens.has(t));
  const hard = [];
  for (const t of missing) {
    const segs = segments(t);
    // 软缺的两种情形：①令牌作为子串出现在稿里（含大小写差异，例如 primitives 在
    // dsh-client-ui-primitives 中、Origin 写作 origin）；②拆段后每段都在。
    const soft = mergedLower.includes(t.toLowerCase())
      || (segs.length > 1 && segs.every((s) => mergedLower.includes(s.toLowerCase())));
    if (!soft) hard.push(t);
  }
  // 把硬缺令牌定位到原条目编号
  const where = {};
  for (const t of hard) {
    const hits = idx.filter((i) => originals[i - 1].includes(t));
    where[t] = hits.join('/');
  }
  hardTotal += hard.length;
  report[name] = { missing: missing.length, hard, where };
  console.log(`\n=== ${name}：缺失 ${missing.length}（软缺 ${missing.length - hard.length}，**硬缺 ${hard.length}**）`);
  if (hard.length) for (const t of hard) console.log(`   硬缺 ${t}  ← 原条目 ${where[t]}`);
}
console.log(`\n硬缺合计 ${hardTotal}`);
const outFile = path.join(chunksDir, 'hard-missing.json');
fs.writeFileSync(outFile, JSON.stringify(report, null, 1), 'utf8');
console.log('明细已写 ' + outFile);
