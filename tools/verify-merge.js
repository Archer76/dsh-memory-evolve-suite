// verify-merge.js — 校验分块合并稿：机械地证明「没有丢事实」，不靠子代理自述。
//
// 用法: node verify-merge.js <chunksDir> <snapshotFile> [chunksJson]
//   chunksDir     存放 merged-<块名>.md 与 cov-<块名>.md 的工作目录
//   snapshotFile  压缩前的轨文件快照（条目原文的来源）
//   chunksJson    块定义，缺省 <chunksDir>/chunks.json，形如：
//                 { "C1": [2,7,9], "C2": [1,3] }   ← 键即块名，值是该块覆盖的原条目编号（1 起算）
// 检查两项：①覆盖表是否覆盖本块全部分配到的条目；②原条目里的标识符/数值是否都还在合并稿里。
// 注意：令牌缺失不等于丢事实（写法差异会造成误报），用 verify-hard.js 做软/硬缺判定。
const fs = require('fs');
const path = require('path');

const [chunksDir, snapshotFile, chunksJsonArg] = process.argv.slice(2);
if (!chunksDir || !snapshotFile) {
  console.error('用法: node verify-merge.js <chunksDir> <snapshotFile> [chunksJson]');
  process.exit(2);
}
const chunksJson = chunksJsonArg || path.join(chunksDir, 'chunks.json');
if (!fs.existsSync(chunksJson)) {
  console.error('找不到块定义: ' + chunksJson);
  console.error('请提供 chunks.json（形如 {"C1":[2,7,9],"C2":[1,3]}）或用第三个参数指定。');
  process.exit(2);
}
const CHUNKS = JSON.parse(fs.readFileSync(chunksJson, 'utf8'));

const blocks = (t) => t.split(/\r?\n\s*§\s*\r?\n/).map((s) => s.trim()).filter(Boolean);
const originals = blocks(fs.readFileSync(snapshotFile, 'utf8'));

const allIdx = new Set([].concat(...Object.values(CHUNKS)));
const highest = allIdx.size ? Math.max(...allIdx) : 0;
if (originals.length !== highest) {
  console.log(`⚠️ 快照原条目数 ${originals.length}，而块定义覆盖到编号 ${highest}`);
}

// 令牌：标识符/路径/文件名，以及 ≥2 位的数字（公式常数、编号、阈值都是事实）
function tokens(text) {
  const out = new Set();
  for (const m of text.matchAll(/[A-Za-z_][A-Za-z0-9_.\-/]{2,}/g)) out.add(m[0]);
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) if (m[0].length >= 2) out.add(m[0]);
  return out;
}

let totalMissing = 0;
let totalTokens = 0;
const perChunk = [];

for (const [name, idx] of Object.entries(CHUNKS)) {
  const mergedPath = path.join(chunksDir, `merged-${name}.md`);
  const covPath = path.join(chunksDir, `cov-${name}.md`);
  if (!fs.existsSync(mergedPath)) { console.log(`❌ ${name}: 缺 merged 文件`); continue; }
  const merged = fs.readFileSync(mergedPath, 'utf8');
  const mergedTokens = tokens(merged);
  const mergedBlocks = blocks(merged);

  // 覆盖表
  const covText = fs.existsSync(covPath) ? fs.readFileSync(covPath, 'utf8') : '';
  const covIdx = new Set();
  for (const m of covText.matchAll(/原条目\s*(\d+)/g)) covIdx.add(Number(m[1]));

  const src = idx.map((i) => originals[i - 1]).join('\n');
  const srcTokens = tokens(src);
  const missing = [...srcTokens].filter((t) => !mergedTokens.has(t));
  totalMissing += missing.length;
  totalTokens += srcTokens.size;

  const covMissing = idx.filter((i) => !covIdx.has(i));
  perChunk.push({
    name,
    entries: idx.length,
    bytes: Buffer.byteLength(src),
    mergedBytes: Buffer.byteLength(merged),
    mergedBlocks: mergedBlocks.length,
    tokMiss: `${missing.length}/${srcTokens.size}`,
    covMissing: covMissing.join(',') || '无',
    sampleMissing: missing.slice(0, 12),
  });
}

console.log('\n块   原条目  原字节  合并字节  合并条数  令牌缺失   覆盖表缺号');
for (const r of perChunk) {
  console.log(`${r.name.padEnd(4)} ${String(r.entries).padStart(5)} ${String(r.bytes).padStart(7)} ${String(r.mergedBytes).padStart(9)} ${String(r.mergedBlocks).padStart(9)} ${r.tokMiss.padStart(9)}   ${r.covMissing}`);
}
const notAssigned = [...Array(originals.length)].map((_, i) => i + 1).filter((i) => !allIdx.has(i));
console.log(`\n编号分配：${allIdx.size}/${originals.length}${notAssigned.length ? '，未分配 ' + notAssigned.join(',') : ''}`);
console.log(`令牌总体：${totalTokens - totalMissing}/${totalTokens} 保留（缺失 ${totalMissing}，${totalTokens ? ((1 - totalMissing / totalTokens) * 100).toFixed(1) : '0.0'}%）`);
console.log('\n各块缺失样例（若有）：');
for (const r of perChunk) if (r.sampleMissing.length) console.log(`  ${r.name}: ${r.sampleMissing.join(' ')}`);
