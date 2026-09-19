// assemble-and-swap.js — 装配 + 落盘压缩版轨文件，并把被取代的原文逐字归档（可逆）。
//
// 用法: node assemble-and-swap.js <chunksDir> <keyFile> <archiveFile> <snapshotFile> [chunksJson] [--write]
//   chunksDir     存放 merged-<块名>.md 的工作目录；块序 = chunks.json 的键顺序
//   keyFile       要替换的轨文件（如 .../projects/<hash>/KEY.md）
//   archiveFile   归档文件（被取代的原文逐字追加于此，如 KEY-archive.md）
//   snapshotFile  压缩前的快照（判定「哪些是快照后新增」的依据）
//   --write       真正落盘；缺省只演练
//
// 落盘前的安全检查（任一项不过即拒写）：合并稿非空、全文无双花括号、每条都有 [summary:…]、
// 新增条目数与快照差相符、条目数确实减少。落盘时先备份、再写、写后复读比对。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const positional = argv.filter((a) => !a.startsWith('--'));
const [chunksDir, keyFile, archiveFile, snapshotFile] = positional;
if (!chunksDir || !keyFile || !archiveFile || !snapshotFile) {
  console.error('用法: node assemble-and-swap.js <chunksDir> <keyFile> <archiveFile> <snapshotFile> [chunksJson] [--write]');
  process.exit(2);
}
const chunksJson = positional[4] || path.join(chunksDir, 'chunks.json');
if (!fs.existsSync(chunksJson)) { console.error('找不到块定义: ' + chunksJson); process.exit(2); }
const CHUNKS = JSON.parse(fs.readFileSync(chunksJson, 'utf8'));
const ORDER = Object.keys(CHUNKS);

const blocks = (t) => t.split(/\r?\n\s*§\s*\r?\n/).map((s) => s.trim()).filter(Boolean);
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const fmt = (n) => n.toLocaleString('en-US');
const today = new Date().toISOString().slice(0, 10);

const missing = ORDER.filter((n) => !fs.existsSync(path.join(chunksDir, `merged-${n}.md`)));
if (missing.length) { console.error('缺合并稿：' + missing.join(', ')); process.exit(1); }

const merged = [];
for (const name of ORDER) merged.push(...blocks(fs.readFileSync(path.join(chunksDir, `merged-${name}.md`), 'utf8')));

const snapBlocks = blocks(fs.readFileSync(snapshotFile, 'utf8'));
const snapSet = new Set(snapBlocks.map(hash));
const currentRaw = fs.readFileSync(keyFile, 'utf8');
const current = blocks(currentRaw);
const carried = current.filter((b) => !snapSet.has(hash(b)));    // 快照之后新写入的 → 逐字保留
const archivable = current.filter((b) => snapSet.has(hash(b)));  // 被合并稿取代的 → 归档

const final = [...merged, ...carried];
const finalRaw = final.join('\n§\n') + '\n';

// —— 安全检查 ——
const problems = [];
if (!merged.length) problems.push('合并稿为空');
if (final.filter((b) => b.includes('{{')).length) problems.push('存在连续两个左花括号的条目');
// 与插件 parseEntrySummary 同语义：先剥掉头部标记（[id] / [日期] / [git …] / [branch:…] / [dsh-only]），
// 再要求紧跟 [summary:…]。故「[日期] [summary:…]」是合规写法。
const hasSummary = (b) => /^(?:\[[^\]]*\]\s*)*\[summary:/.test(b);
const noSummary = final.filter((b) => !hasSummary(b));
if (noSummary.length) problems.push(`${noSummary.length} 条缺 [summary:] 首行`);
if (carried.length !== current.length - snapBlocks.length) problems.push('新增条目数与本快照差不符，请复核');
if (final.length >= current.length) problems.push('条目数未减少，疑似装配错误');

console.log(`合并稿 ${ORDER.length} 块 → ${merged.length} 条`);
console.log(`新增条目（快照后写入，逐字保留）${carried.length} 条`);
carried.forEach((b) => console.log('   + ' + b.split('\n')[0].replace(/\s+/g, ' ').slice(0, 78)));
console.log(`被取代并归档 ${archivable.length} 条`);
console.log(`轨文件：${current.length} 条 / ${fmt(Buffer.byteLength(currentRaw))} 字节  →  ${final.length} 条 / ${fmt(Buffer.byteLength(finalRaw))} 字节`);
console.log('渲染量：跑 check-inject.js 复核（本脚本不代跑）');
console.log(problems.length ? '❌ 安全检查未通过：\n   - ' + problems.join('\n   - ') : '✅ 安全检查通过（无双花括号、条目全带 summary、条目数已减少）');

if (!WRITE) { console.log('\n（演练模式，未写盘。确认无误后加 --write 执行。）'); process.exit(problems.length ? 1 : 0); }
if (problems.length) { console.error('拒绝写盘：先解决上述问题。'); process.exit(1); }

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const bak = `${keyFile}.bak-premerge-${stamp}`;
fs.copyFileSync(keyFile, bak);
console.log('备份：' + bak);

fs.writeFileSync(keyFile, finalRaw, 'utf8');
const header = `\n§\n【${today} 合并归档】以下 ${archivable.length} 条为压缩前该轨的原始条目，逐字保留，可随时移回。\n§\n`;
fs.appendFileSync(archiveFile, header + archivable.join('\n§\n') + '\n', 'utf8');

const after = blocks(fs.readFileSync(keyFile, 'utf8'));
console.log(`已写盘：${keyFile} ${after.length} 条 / ${fmt(Buffer.byteLength(fs.readFileSync(keyFile, 'utf8')))} 字节；归档 ${archiveFile} ${fmt(Buffer.byteLength(fs.readFileSync(archiveFile, 'utf8')))} 字节`);
if (after.length !== final.length) console.error('⚠️ 写后条目数与预期不符，请复核（可能有并发写入）。');
