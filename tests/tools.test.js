/**
 * dsh-memory-evolve-suite — tools/ 里辅助工具的出厂自测。
 *
 * 在一个临时目录里合成一份最小夹具（快照 / 当前轨 / 分块稿 / 覆盖表 / 替换表），
 * 把整条流水线真跑一遍，验证改造后的参数化版本确实能工作：
 *   合成分块 → verify-merge（令牌零缺失）→ verify-hard（硬缺 0）→ assemble（staging）
 *   → assemble-and-swap（演练不写盘 / --write 落盘并归档）→ unexpire（空跑与落盘）
 *
 * 运行：node --test tests/tools.test.js
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOOLS = join(ROOT, 'tools')

/** 跑一个工具，返回 { code, out }（stdout+stderr 合并，便于断言提示语）。 */
function run(tool, args, cwd) {
  const r = spawnSync(process.execPath, [join(TOOLS, tool), ...args], {
    cwd: cwd ?? ROOT,
    encoding: 'utf8',
  })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

const BLOCK = {
  1: '[2026-01-01] [summary:第一条 alpha beta 42] 正文 A 含 token_x 与 3.14',
  2: '[2026-01-02] [summary:第二条 gamma] 正文 B 含 token_y',
  3: '[2026-01-03] [summary:第三条] 正文 C 含 token_z',
  4: '[2026-01-04] [summary:第四条] 正文 D 含 token_w，移速待校准',
  new: '[2026-01-05] [summary:快照后新增] 正文 E 含 token_new',
}
const SNAPSHOT = [BLOCK[1], BLOCK[2], BLOCK[3], BLOCK[4]].join('\n§\n') + '\n'
const CURRENT = SNAPSHOT + '§\n' + BLOCK.new + '\n'
// 合并稿必须保住原块的全部令牌（含日期里的 01/02/03/04 这些数值令牌）
const MERGED_C1 = '[2026-01-01] [summary:合并第一二条（原 01-02） alpha beta 42 gamma] 正文 A+B 含 token_x、token_y 与 3.14\n'
const MERGED_C2 = '[2026-01-03] [summary:合并第三四条（原 01-04）] 正文 C+D 含 token_z 与 token_w，移速已定案\n'

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-suite-tools-'))
  writeFileSync(join(dir, 'snapshot.md'), SNAPSHOT)
  writeFileSync(join(dir, 'KEY.md'), CURRENT)
  writeFileSync(join(dir, 'KEY-archive.md'), '')
  writeFileSync(join(dir, 'chunks.json'), JSON.stringify({ C1: [1, 2], C2: [3, 4] }, null, 1))
  writeFileSync(join(dir, 'merged-C1.md'), MERGED_C1)
  writeFileSync(join(dir, 'merged-C2.md'), MERGED_C2)
  writeFileSync(join(dir, 'cov-C1.md'), '原条目 1 → 合并稿第 1 条\n原条目 2 → 合并稿第 1 条\n')
  writeFileSync(join(dir, 'cov-C2.md'), '原条目 3 → 合并稿第 1 条\n原条目 4 → 合并稿第 1 条\n')
  writeFileSync(join(dir, 'edits-ok.json'), JSON.stringify([[1, '示例：移速口径已定案', '移速待校准', '移速已定案']]))
  writeFileSync(join(dir, 'edits-miss.json'), JSON.stringify([[1, '示例：命中 0 次', '绝不存在的一串字', '新文']]))
  return dir
}

test('tools/ 下每个 .js 都通过语法检查，且无参运行给出用法而非抛栈', () => {
  const files = readdirSync(TOOLS).filter((f) => f.endsWith('.js'))
  assert.ok(files.length >= 14, `tools/ 下脚本过少：${files.length}`)
  for (const f of files) {
    const chk = spawnSync(process.execPath, ['--check', join(TOOLS, f)], { encoding: 'utf8' })
    assert.equal(chk.status, 0, `${f} 语法检查失败：${chk.stderr}`)
    const { code, out } = run(f, [])
    assert.notEqual(code, 0, `${f} 无参运行竟然成功了`)
    assert.ok(/用法|usage/.test(out), `${f} 无参运行未给出用法提示：${out.slice(0, 200)}`)
    assert.ok(!/at Object\.|at Module\.|node:internal/.test(out), `${f} 无参运行抛了栈：${out.slice(0, 200)}`)
  }
})

test('verify-merge：令牌零缺失、覆盖表无缺号', () => {
  const dir = fixture()
  try {
    const { code, out } = run('verify-merge.js', [dir, join(dir, 'snapshot.md')])
    assert.equal(code, 0)
    assert.match(out, /编号分配：4\/4/, out)
    assert.match(out, /令牌总体：\d+\/\d+ 保留（缺失 0/, out)
    assert.ok(!/❌/.test(out), out)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('verify-hard：本例硬缺为 0，并写出明细文件', () => {
  const dir = fixture()
  try {
    const { code, out } = run('verify-hard.js', [dir, join(dir, 'snapshot.md')])
    assert.equal(code, 0)
    assert.match(out, /硬缺合计 0/, out)
    assert.ok(existsSync(join(dir, 'hard-missing.json')))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('assemble：staging = 合并稿条目 + 快照后新增条目（逐字保留）', () => {
  const dir = fixture()
  try {
    const { code, out } = run('assemble.js', [dir, join(dir, 'KEY.md'), join(dir, 'snapshot.md')])
    assert.equal(code, 0, out)
    const staging = readFileSync(join(dir, 'final-KEY.md'), 'utf8')
    const blocks = staging.split(/\r?\n\s*§\s*\r?\n/).map((s) => s.trim()).filter(Boolean)
    assert.equal(blocks.length, 3, staging)
    assert.ok(staging.includes('token_new'), '快照后新增的条目没有被逐字保留')
    assert.equal(readFileSync(join(dir, 'KEY.md'), 'utf8'), CURRENT, 'assemble 不得改动原轨')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('assemble-and-swap：演练不写盘，--write 才落盘并归档', () => {
  const dir = fixture()
  try {
    const args = [dir, join(dir, 'KEY.md'), join(dir, 'KEY-archive.md'), join(dir, 'snapshot.md')]
    const dry = run('assemble-and-swap.js', args)
    assert.equal(dry.code, 0, dry.out)
    assert.match(dry.out, /安全检查通过/, dry.out)
    assert.match(dry.out, /演练模式/)
    assert.equal(readFileSync(join(dir, 'KEY.md'), 'utf8'), CURRENT, '演练模式改了盘')

    const wet = run('assemble-and-swap.js', [...args, '--write'])
    assert.equal(wet.code, 0, wet.out)
    const after = readFileSync(join(dir, 'KEY.md'), 'utf8')
    assert.notEqual(after, CURRENT, '--write 没有落盘')
    assert.ok(after.includes('token_new'), '新增条目在落盘后丢失')
    assert.ok(readFileSync(join(dir, 'KEY-archive.md'), 'utf8').includes('token_x'), '被取代的原文没有归档')
    assert.ok(readdirSync(dir).some((f) => f.startsWith('KEY.md.bak-premerge-')), '缺少备份')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('unexpire：空跑不写盘、命中 0 次时拒写、--write 后归档并备份', () => {
  const dir = fixture()
  try {
    const key = join(dir, 'KEY.md')
    const arc = join(dir, 'KEY-archive.md')

    const dry = run('unexpire.js', [key, arc, join(dir, 'edits-ok.json')])
    assert.equal(dry.code, 0, dry.out)
    assert.match(dry.out, /空跑通过/)
    assert.equal(readFileSync(key, 'utf8'), CURRENT, '空跑改了盘')

    const miss = run('unexpire.js', [key, arc, join(dir, 'edits-miss.json')])
    assert.equal(miss.code, 1, miss.out)
    assert.match(miss.out, /命中=0/, miss.out)

    const wet = run('unexpire.js', [key, arc, join(dir, 'edits-ok.json'), '--write'])
    assert.equal(wet.code, 0, wet.out)
    assert.ok(readFileSync(key, 'utf8').includes('移速已定案'), '替换未生效')
    assert.ok(!readFileSync(key, 'utf8').includes('移速待校准'), '旧写法仍在')
    assert.ok(readFileSync(arc, 'utf8').includes('移速待校准'), '旧文没有逐字归档')
    assert.ok(readdirSync(dir).some((f) => f.startsWith('KEY.md.bak-unexpire-')), '缺少备份')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('curate：按 § 分块，保留块逐字不动、被移除块原文进归档', () => {
  const dir = fixture()
  try {
    const src = join(dir, 'KEY.md')
    const arc = join(dir, 'curated-archive.md')
    const { code, out } = run('curate.js', [src, '1,2', '-', arc])
    assert.equal(code, 0, out)
    const kept = readFileSync(src, 'utf8')
    assert.ok(kept.includes('token_x') && kept.includes('token_y'), kept)
    assert.ok(!kept.includes('token_z'), kept)
    assert.ok(readFileSync(arc, 'utf8').includes('token_z'), '被移除的块没有进归档')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('check-summaries：摘要体检与双花括号计数', () => {
  const dir = fixture()
  try {
    const { code, out } = run('check-summaries.js', [join(dir, 'KEY.md')])
    assert.equal(code, 0, out)
    assert.match(out, /块数 5/, out)
    assert.match(out, /缺 summary: 无/, out)
    assert.match(out, /连续左花括号: 0/, out)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('check-inject：能找到插值模块则渲染成功，找不到则给出明确指引', () => {
  const dir = fixture()
  try {
    const { code, out } = run('check-inject.js', [join(dir, 'KEY.md')])
    if (code === 0) {
      assert.match(out, /^OK/, out)
      assert.match(out, /rendered chars: \d+/, out)
    } else {
      // 本机没装 DSH 时的合法路径：必须明确告诉用户怎么指定模块，而不是抛栈
      assert.equal(code, 3, out)
      assert.match(out, /DSH_SYSTEM_PROMPT_MODULE/, out)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
