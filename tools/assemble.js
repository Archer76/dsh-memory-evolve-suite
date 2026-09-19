// assemble.js — 把分块合并稿装配成压缩版的 staging 文件，**不动原轨**。
//
// 用法: node assemble.js <chunksDir> <keyFile> <snapshotFile> [chunksJson] [--out <stagingFile>]
//   chunksDir     存放 merged-<块名>.md 的工作目录；块序 = chunks.json 的键顺序
//   keyFile       当前轨文件（用于找出快照之后被别的会话新写入的条目）
//   snapshotFile  压缩前的快照（判定「哪些是新增」的依据）
//   --out         输出路径，缺省 <chunksDir>/final-KEY.md
//
// 装配规则：合并稿（按块序）+ 快照之后新增的条目**逐字保留**、附在末尾。
// 落盘由 assemble-and-swap.js 另一步完成，便于先复核这一份。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const outValue = outIdx !== -1 ? argv[outIdx + 1] : undefined;
// --out 的值不参与位置参数，其余非 -- 开头的按顺序取（没有 --out 时不得误删第一个参数）
const positional = argv.filter((a, i) => !a.startsWith('--') && !(outIdx !== -1 && i === outIdx + 1));
const [chunksDir, keyFile, snapshotFile] = positional;
if (!chunksDir || !keyFile || !snapshotFile) {
  console.error('用法: node assemble.js <chunksDir> <keyFile> <snapshotFile> [chunksJson] [--out <stagingFile>]');
  process.exit(2);
}
const chunksJson = positional[3] || path.join(chunksDir, 'chunks.json');
if (!fs.existsSync(chunksJson)) { console.error('找不到块定义: ' + chunksJson); process.exit(2); }
const CHUNKS = JSON.parse(fs.readFileSync(chunksJson, 'utf8'));
const ORDER = Object.keys(CHUNKS);
const OUT = outValue || path.join(chunksDir, 'final-KEY.md');

const blocks = (t) => t.split(/\r?\n\s*§\s*\r?\n/).map((s) => s.trim()).filter(Boolean);
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');

const missing = ORDER.filter((n) => !fs.existsSync(path.join(chunksDir, `merged-${n}.md`)));
if (missing.length) { console.error('尚未生成：' + missing.map((n) => `merged-${n}.md`).join(', ')); process.exit(1); }

const merged = [];
for (const name of ORDER) merged.push(...blocks(fs.readFileSync(path.join(chunksDir, `merged-${name}.md`), 'utf8')));

const snapBlocks = blocks(fs.readFileSync(snapshotFile, 'utf8'));
const snapSet = new Set(snapBlocks.map(hash));
const current = blocks(fs.readFileSync(keyFile, 'utf8'));
const carried = current.filter((b) => !snapSet.has(hash(b)));
const archivable = current.filter((b) => snapSet.has(hash(b)));

const final = [...merged, ...carried];
fs.writeFileSync(OUT, final.join('\n§\n') + '\n', 'utf8');

const bad = final.filter((b) => b.includes('{{')).length;
console.log(`合并稿：${ORDER.length} 块 → ${merged.length} 条`);
console.log(`新增条目（快照后写入，逐字保留）：${carried.length} 条` + (carried.length ? ' —— ' + carried.map((b) => b.split('\n')[0].replace(/\s+/g, ' ').slice(0, 60)).join(' | ') : ''));
console.log(`待归档（快照里存在、已被合并稿取代的）：${archivable.length} 条`);
console.log(`staging：${OUT}`);
console.log(`  条目 ${current.length} → ${final.length}；字节 ${Buffer.byteLength(fs.readFileSync(keyFile, 'utf8'))} → ${Buffer.byteLength(fs.readFileSync(OUT, 'utf8'))}`);
console.log(`  含连续两个左花括号的条目：${bad}`);
console.log('  下一步：先跑 check-inject.js 复核渲染量，再用 assemble-and-swap.js 落盘。');
