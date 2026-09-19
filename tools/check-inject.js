// check-inject.js — 复刻 DSH 的提示词插值，判定某条注入轨会不会在系统提示词组装阶段抛错。
//
// 用法: node check-inject.js <轨文件路径>
// 输出: OK / THROW + 连续左花括号计数 + 渲染字符数（该轨每回合真实注入量）。
//       THROW 时退出码为 1，便于脚本判定。
//
// 插值实现在 @deepseek-ai/dsh-system-prompt 里。本脚本按顺序自动定位它：
//   1. 环境变量 DSH_SYSTEM_PROMPT_MODULE（直接指向 lib/index.js，最可靠）
//   2. $DSH_SOURCE/node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js
//   3. $DSH_HOME/source/current/node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js
//   4. npx 缓存扫描：%LOCALAPPDATA%\npm-cache\_npx\*\node_modules\... 与 ~/.npm/_npx/*/...
//   5. 从当前工作目录 require.resolve
// 全部落空时给出明确提示，不会静默失败。
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

const REL = path.join('node_modules', '@deepseek-ai', 'dsh-system-prompt', 'lib', 'index.js');
const trackFile = process.argv[2];
if (!trackFile) {
  console.error('用法: node check-inject.js <轨文件路径>');
  console.error('  例: node check-inject.js "' + path.join(process.env.DSH_HOME || '~/.dsh', 'memories', 'MEMORY.md') + '"');
  process.exit(2);
}
if (!fs.existsSync(trackFile)) {
  console.error('轨文件不存在: ' + trackFile);
  process.exit(2);
}

function* candidates() {
  if (process.env.DSH_SYSTEM_PROMPT_MODULE) yield process.env.DSH_SYSTEM_PROMPT_MODULE;
  if (process.env.DSH_SOURCE) yield path.join(process.env.DSH_SOURCE, REL);
  yield path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'source', 'current', REL);
  const roots = [];
  if (process.env.LOCALAPPDATA) roots.push(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx'));
  roots.push(path.join(os.homedir(), '.npm', '_npx'));
  for (const root of roots) {
    let entries = [];
    try { entries = fs.readdirSync(root); } catch { continue; }
    for (const entry of entries) yield path.join(root, entry, REL);
  }
}

function locate() {
  for (const candidate of candidates()) {
    try { if (fs.existsSync(candidate)) return candidate; } catch { /* 忽略不可读路径 */ }
  }
  try { return require.resolve('@deepseek-ai/dsh-system-prompt/lib/index.js'); } catch { /* 未安装 */ }
  return undefined;
}

(async () => {
  const target = locate();
  if (!target) {
    console.error('找不到 @deepseek-ai/dsh-system-prompt —— 无法复刻插值行为。');
    console.error('请用环境变量指定它的 lib/index.js 绝对路径后重跑：');
    console.error('  DSH_SYSTEM_PROMPT_MODULE=<DSH 安装目录>/node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js');
    process.exit(3);
  }
  const mod = await import(pathToFileURL(target).href);
  const text = fs.readFileSync(trackFile, 'utf8');
  const braces = [...text.matchAll(/\{\{/g)];
  try {
    const out = mod.renderContextSections({ contexts: [{ name: 'memory:snapshot', text }], variables: {} });
    console.log(`OK  ${trackFile}`);
    console.log(`    double-left-braces found: ${braces.length}   rendered chars: ${out[0]?.text?.length ?? 0}`);
  } catch (error) {
    console.log(`THROW  ${trackFile}`);
    console.log(`    ${error.message}`);
    process.exitCode = 1;
  }
})();
