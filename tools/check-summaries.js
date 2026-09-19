// check-summaries.js — 单条注入轨的条目格式体检（只看文件，不渲染、不联网）。
//
// 用法: node check-summaries.js <轨文件>
// 检查: ①每个 § 块首行是否有 [summary:…]
//       ②摘要是否超过 120 字
//       ③摘要内是否含右方括号（会截断摘要解析）
//       ④全文是否含连续两个左花括号（注入毒源）
// 另打印块数与字节/字符数，便于前后对比。
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('用法: node check-summaries.js <轨文件>'); process.exit(2); }
const text = fs.readFileSync(file, 'utf8');
const blocks = text.split(/\r?\n[ \t]*§[ \t]*\r?\n/);
const noSum = [], over = [], bracket = [];
blocks.forEach((b, i) => {
  const first = b.split(/\r?\n/)[0];
  const m = first.match(/\[summary:([^\]]*)\]/);
  if (!m) { noSum.push(i + 1); return; }
  const s = m[1];
  if (s.length > 120) over.push((i + 1) + ':' + s.length);
  if (s.includes(']')) bracket.push(i + 1);
});
console.log('文件 ' + file);
console.log('块数 ' + blocks.length);
console.log('缺 summary: ' + (noSum.length ? noSum.join(',') : '无'));
console.log('summary 超 120 字: ' + (over.length ? over.join(' ') : '无'));
console.log('summary 内含右方括号: ' + (bracket.length ? bracket.join(',') : '无'));
console.log('连续左花括号: ' + (text.match(/\{\{/g) || []).length + '  （必须 0）');
console.log('文件字节 ' + Buffer.byteLength(text, 'utf8') + '  字符 ' + text.length);
