/**
 * dsh-memory-evolve-suite — 内置技能（skills/）的出厂回归测试。
 *
 * 验证三件事，收件人装机后跑 `node --test tests/bundled-skills.test.js` 即可自证：
 *   1. BUILTIN_SKILLS 清单与包内 skills/ 目录一一对应，且每个都是合规 SKILL.md；
 *   2. 同步器能把它们落地到用户技能库（~/.agents/skills），二次同步幂等；
 *   3. 版本保护的**单向**语义：用户在本地编辑后（x-version 未变）不被覆盖；
 *      只有源头 x-version 提高时才覆盖——反方向（源版本更低）不会回退用户侧。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUILTIN_SKILLS, syncBuiltinSkills } from '../lib/coi/skills-sync.js'
import { isSkillName, parseFrontmatter } from '../lib/skills.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_SKILLS = join(ROOT, 'skills')

/** 建一个一次性用户技能库，测试结束由调用方清理。 */
function tempUserSkills() {
  return mkdtempSync(join(tmpdir(), 'dsh-suite-skills-'))
}

test('BUILTIN_SKILLS 与包内 skills/ 目录一一对应', () => {
  assert.ok(BUILTIN_SKILLS.length >= 7, `内置技能不应少于 7 个，实际 ${BUILTIN_SKILLS.length}`)
  for (const name of BUILTIN_SKILLS) {
    assert.ok(isSkillName(name), `${name} 不是合法 kebab-case 技能名`)
    assert.ok(existsSync(join(PLUGIN_SKILLS, name, 'SKILL.md')), `包内缺少 skills/${name}/SKILL.md`)
  }
  // 本套件随包附带的三份记忆运维技能必须在列
  for (const name of ['dsh-memory-compression', 'dsh-memory-curation', 'dsh-injection-track-triage']) {
    assert.ok(BUILTIN_SKILLS.includes(name), `BUILTIN_SKILLS 未登记 ${name}`)
  }
})

test('每个内置技能都是合规 SKILL.md', () => {
  for (const name of BUILTIN_SKILLS) {
    const text = readFileSync(join(PLUGIN_SKILLS, name, 'SKILL.md'), 'utf8')
    const parsed = parseFrontmatter(text)
    assert.ok(parsed !== undefined, `${name}: frontmatter 不合规（需 --- 起始、含单行 name 与 description）`)
    assert.equal(parsed.name, name, `${name}: frontmatter name 与目录名不一致`)
    assert.ok(parsed.description.length > 0, `${name}: description 为空`)
    assert.ok(parsed.body.trim().length > 200, `${name}: 正文过短`)
    // 同步器的版本判据用 /^---\n/ 与 /^x-version:\s*(\d+)\s*$/m 且不带 \r 容错：
    // CRLF 会让 x-version 读成 0，升级保护静默失效。故强制 LF。
    assert.ok(!text.includes('\r'), `${name}: 含 CR，必须使用 LF 换行`)
    assert.match(text, /^x-version:\s*\d+\s*$/m, `${name}: 缺少可解析的 x-version`)
    // 铁律：注入进上下文的文本不得出现连续两个左花括号
    assert.ok(!text.includes('{{'), `${name}: 含连续左花括号`)
  }
})

test('同步器落地全部内置技能，且内容与源头逐字一致', () => {
  const user = tempUserSkills()
  try {
    const results = syncBuiltinSkills(PLUGIN_SKILLS, user)
    assert.equal(results.length, BUILTIN_SKILLS.length)
    for (const r of results) {
      assert.equal(r.action, 'synced', `${r.name} 首次同步应为 synced，实际 ${r.action}`)
      const dest = join(user, r.name, 'SKILL.md')
      assert.ok(existsSync(dest), `${r.name} 未落地`)
      assert.equal(readFileSync(dest, 'utf8'), readFileSync(join(PLUGIN_SKILLS, r.name, 'SKILL.md'), 'utf8'))
    }
  } finally {
    rmSync(user, { recursive: true, force: true })
  }
})

test('二次同步幂等', () => {
  const user = tempUserSkills()
  try {
    syncBuiltinSkills(PLUGIN_SKILLS, user)
    const again = syncBuiltinSkills(PLUGIN_SKILLS, user)
    assert.ok(again.every((r) => r.action === 'unchanged'), `二次同步应全部 unchanged：${JSON.stringify(again)}`)
  } finally {
    rmSync(user, { recursive: true, force: true })
  }
})

test('版本保护：本地编辑不被覆盖，源头升版才覆盖（且不回退）', () => {
  const user = tempUserSkills()
  const name = 'dsh-memory-compression'
  const srcFile = join(PLUGIN_SKILLS, name, 'SKILL.md')
  const original = readFileSync(srcFile, 'utf8')
  const destFile = join(user, name, 'SKILL.md')
  try {
    syncBuiltinSkills(PLUGIN_SKILLS, user)

    // ① 用户本地编辑、x-version 不变 → 不得覆盖
    const marker = '<!-- local-edit-marker -->'
    writeFileSync(destFile, readFileSync(destFile, 'utf8') + `\n${marker}\n`)
    const afterEdit = syncBuiltinSkills(PLUGIN_SKILLS, user)
    assert.equal(afterEdit.find((r) => r.name === name)?.action, 'unchanged', '用户编辑被覆盖了')
    assert.ok(readFileSync(destFile, 'utf8').includes(marker), '用户编辑内容丢失')

    // ② 源头 x-version 提高 → 覆盖（升级路径可用）
    writeFileSync(srcFile, original.replace(/^x-version:\s*\d+$/m, 'x-version: 99'))
    const afterBump = syncBuiltinSkills(PLUGIN_SKILLS, user)
    assert.equal(afterBump.find((r) => r.name === name)?.action, 'synced', '升版未触发覆盖')
    assert.ok(!readFileSync(destFile, 'utf8').includes(marker), '升版后用户侧未换成源版本')

    // ③ 还原源头为更低版本 → 属正常语义，不应回退用户侧
    writeFileSync(srcFile, original)
    const afterRestore = syncBuiltinSkills(PLUGIN_SKILLS, user)
    assert.equal(afterRestore.find((r) => r.name === name)?.action, 'unchanged', '版本保护被破坏（低版本不应回退用户侧）')
  } finally {
    writeFileSync(srcFile, original)
    rmSync(user, { recursive: true, force: true })
  }
})
