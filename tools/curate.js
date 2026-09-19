// Split a DSH memory track file into § blocks, keep some, archive the rest,
// then append new hand-written entries. Node (not PS 5.1) for UTF-8 safety.
//
// Usage: node curate.js <srcFile> <keepCsv|-> <newEntriesFile|-> <archiveFile>
//   keepCsv      1-based block indices to keep verbatim, e.g. 1,2,13
//   newEntries   file with new entries (blocks separated by a lone § line)
//   archiveFile  removed blocks are appended here
const fs = require('fs');
const [src, keepCsv, newFile, archiveFile] = process.argv.slice(2);
if (!src || keepCsv === undefined) {
  console.error('用法: node curate.js <srcFile> <keepCsv|-> <newEntriesFile|-> <archiveFile>');
  console.error('  keepCsv     要原样保留的块序号（1 起算），如 1,2,13；用 - 表示一块不留');
  console.error('  newEntries  新条目文件（条目之间用单独一行 § 分隔），无则用 -');
  console.error('  archiveFile 被移除块的归档文件');
  process.exit(2);
}
if (!src) { console.error('usage: node curate.js <src> <keepCsv|-> <newFile|-> <archive>'); process.exit(2); }

const read = (p) => fs.readFileSync(p, 'utf8');
const blocks = (t) => t.split(/\r?\n\s*§\s*\r?\n/).map((s) => s.trim()).filter(Boolean);

const original = read(src);
const all = blocks(original);
const keepIdx = (keepCsv && keepCsv !== '-')
  ? keepCsv.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 1)
  : [];
const keepSet = new Set(keepIdx);
const kept = all.filter((_, i) => keepSet.has(i + 1));
const removed = all.filter((_, i) => !keepSet.has(i + 1));

const newText = (newFile && newFile !== '-') ? read(newFile).trim() : '';
const finalBlocks = [...kept];
if (newText) finalBlocks.push(...blocks(newText));

fs.writeFileSync(src, finalBlocks.join('\n§\n') + '\n', 'utf8');

if (removed.length && archiveFile && archiveFile !== '-') {
  let arch = fs.existsSync(archiveFile) ? read(archiveFile).replace(/\s+$/, '') : '';
  const add = removed.join('\n§\n');
  arch = arch ? arch + '\n§\n' + add + '\n' : add + '\n';
  fs.writeFileSync(archiveFile, arch, 'utf8');
}

const bad = finalBlocks.filter((b) => b.includes('{{')).length;
console.log(`${src}`);
console.log(`  blocks: ${all.length} -> kept ${kept.length} + new ${finalBlocks.length - kept.length} = ${finalBlocks.length}`);
console.log(`  archived: ${removed.length} -> ${archiveFile}`);
console.log(`  sanity: blocks containing double-left-brace = ${bad}`);
