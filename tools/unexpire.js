// unexpire.js — 过期审计的落盘执行器：**字面替换**，块外内容逐字不动。
//
// 用法: node unexpire.js <keyFile> <archiveFile> <edits.json> [--write]
//   keyFile      要清理的轨文件（如 .../projects/<hash>/KEY.md）
//   archiveFile  归档文件（被替换掉的原文逐字追加于此）
//   edits.json   替换表，两种形态都接受：
//                  [[编号, 定位说明, 原文, 新文], ...]
//                  [{"id":1,"note":"…","find":"…","replace":"…"}, ...]
//   --write      真正落盘；缺省空跑（只校验，不写）
//
// 对**每一处**替换都强制两项校验：①原文在该轨里唯一命中（否则不知道该改哪一处）；
// ②新文不含连续两个左花括号（否则会把工作区毒瘫）。任一不过即整体拒写。
// 落盘前还会复读一次磁盘，确认读取后没有别的会话写过（并发保全）；落盘后复读比对。
const fs = require('fs');

const argv = process.argv.slice(2);
const write = argv.includes('--write');
const positional = argv.filter((a) => !a.startsWith('--'));
const [keyFile, archiveFile, editsFile] = positional;
if (!keyFile || !archiveFile || !editsFile) {
  console.error('用法: node unexpire.js <keyFile> <archiveFile> <edits.json> [--write]');
  console.error('  edits.json 形如 [[1,"定位说明","原文（须唯一命中）","新文"], ...]');
  process.exit(2);
}

const rawEdits = JSON.parse(fs.readFileSync(editsFile, 'utf8'));
const EDITS = rawEdits.map((e) => Array.isArray(e)
  ? { id: e[0], why: e[1], find: e[2], rep: e[3] }
  : { id: e.id, why: e.note ?? e.why, find: e.find, rep: e.replace ?? e.rep });

const text = fs.readFileSync(keyFile, 'utf8');
const crlf = /\r\n/.test(text);
let out = text;
const removed = [];
let bad = 0;

for (const { id, why, find, rep } of EDITS) {
  if (!find || !rep) { console.log('SKIP  #' + id + ' 缺少 find/replace'); bad++; continue; }
  const n = out.split(find).length - 1;
  const poison = (rep.match(/\{\{/g) || []).length;
  if (n !== 1 || poison) {
    console.log('FAIL  #' + id + ' 命中=' + n + ' 新文双花括号=' + poison + '  «' + why + '»');
    if (n !== 1) console.log('      find 前 60 字: ' + find.slice(0, 60));
    bad++;
    continue;
  }
  out = out.replace(find, rep);
  removed.push({ id, why, old: find });
  console.log('OK    #' + id + '  ' + why);
}

console.log('---');
console.log('行尾: ' + (crlf ? 'CRLF' : 'LF'));
console.log('编辑数: ' + EDITS.length + '  失败: ' + bad);
console.log('字节: ' + Buffer.byteLength(text, 'utf8') + ' -> ' + Buffer.byteLength(out, 'utf8'));
const cnt = (s) => s.split(/\r?\n[ \t]*§[ \t]*\r?\n/).length;
console.log('条目(§)数: ' + cnt(text) + ' -> ' + cnt(out) + '  （必须相等）');
console.log('双花括号: ' + (text.match(/\{\{/g) || []).length + ' -> ' + (out.match(/\{\{/g) || []).length + '  （必须 0）');
console.log('缺 [summary: 的块: ' + out.split(/\r?\n[ \t]*§[ \t]*\r?\n/).filter((b) => !b.includes('[summary:')).length);

if (bad) { console.log('\n有空跑失败项，未落盘。'); process.exit(1); }
if (!write) { console.log('\n空跑通过（未落盘）。加 --write 落盘。'); process.exit(0); }

// 并发保全：落盘前复读，确认磁盘内容仍与刚才读到的基线一致
const now = fs.readFileSync(keyFile, 'utf8');
if (now !== text) {
  console.log('\n拒绝落盘：该轨在本轮读取后被别的会话改过（' + text.length + ' -> ' + now.length + ' 字符）。');
  process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
fs.copyFileSync(keyFile, keyFile + '.bak-unexpire-' + stamp);
const header = '\n\n---\n\n## 过期记忆清理（' + today + '）：被更新条目否定的旧说法\n\n'
  + '以下原文段落在 ' + today + ' 的审计中被判定为**已被更晚条目明文否定**，已从轨中移除或改写；此处逐字留档，可随时移回。\n'
  + '判定依据是「后条明确说前条作废/已取代/已落地/已裁定」，共 ' + removed.length + ' 处。\n';
const arcAppend = removed.map((r) => '\n### #' + r.id + ' ' + r.why + '\n（旧文，逐字）\n' + r.old + '\n').join('');
fs.appendFileSync(archiveFile, header + arcAppend, 'utf8');
fs.writeFileSync(keyFile, out, 'utf8');

const back = fs.readFileSync(keyFile, 'utf8');
console.log('\n已落盘。复读校验：');
console.log('  字节 ' + Buffer.byteLength(back, 'utf8') + '  条目 ' + cnt(back) + '  双花括号 ' + (back.match(/\{\{/g) || []).length);
console.log('  归档追加 ' + removed.length + ' 段 -> ' + archiveFile);
