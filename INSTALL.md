# dsh-memory-evolve-suite

DSH 长期记忆插件 + 内置记忆运维技能 + 配套辅助脚本，一份装完。

## 装它

```bash
dsh plugin --profile <profile> add <本目录绝对路径>
```

装好后**不要**再手动往 profile 的插件名册里插同一行：本包自带 `cordis.patch.yml`（bundle patch），`dsh plugin add` 会把它自动插进去；重复的 id 会让加载器崩。

改过包名/目录名的话，下面三处必须保持**逐字相同**，否则网页半会"加载了却没注册"（界面静默缺功能）：

| 位置 | 值 |
|---|---|
| `package.json` 的 `name` | `dsh-memory-evolve-suite` |
| `cordis.patch.yml` 的 `id` 与 `name` | `dsh-memory-evolve-suite` |
| `lib/client.js` 首行的注册 `id` | `dsh-memory-evolve-suite` |

## 包里有什么

### 1. 插件本体

分层长期记忆（全局 / 用户 / 项目 / 分支 / 每日）、记忆自我进化（经验沉淀 + 自动创建技能）、技能管理、待办管理、外部 CLI 调度（kimi / codex / grok / hermes）、临时便签，以及 WebUI 管理界面。工具入口：`memory`、`dtodo`、`skill_manage` 等。

### 2. 内置技能（`skills/`，7 份）

插件启动时把它们同步进用户技能库（默认 `~/.agents/skills`，每份一个目录），随系统提示词注入、所有会话可用；启用/禁用与编辑入口在 WebUI 的「技能管理」Tab。

| 技能 | 用来做什么 |
|---|---|
| `dsh-memory-compression` | 注入轨（memory/user/key）过大时的压缩流水线：体检归因、快照与并发保全、按主题分块并行合并、令牌级事实校验、staging 装配与归档，以及过期审计与摘要注入的开法与收益预期 |
| `dsh-memory-curation` | 日常整理：四轨（memory/user/key/project/daily）的归档能力差异、整份快照、按 § 分块重写、条目格式与时间戳规则、渲染自检 |
| `dsh-injection-track-triage` | 某工作区「发什么都秒错、无任何模型调用」时的毒源排查：定位注入轨里的连续左花括号、多帧 zstd 会话取证、`renderContextSections` 复现与验证 |
| `kimi-cli-calling` / `codex-cli-calling` / `grok-cli-calling` / `hermes-cli-calling` | 外部 CLI 调度适配器（随插件原有提供） |

**同步与升级语义**：每份技能的 frontmatter 带 `x-version`。用户库里没有该技能 → 装上；源头 `x-version` 更高 → 覆盖；其它情况不动（保护你对 SKILL.md 的本地编辑）。注意保护是**单向**的：**升级插件会覆盖这些技能里的本地编辑**，想长期保留改动就另建一个自己的技能名。

### 3. 辅助脚本（`tools/`，14 个 + 1 份示例）

记忆压缩、过期审计与会话取证的命令行工具，全部参数化、无外部依赖（除 `check-inject.js` 需要 `@deepseek-ai/dsh-system-prompt`，见下）。

| 脚本 | 用途 |
|---|---|
| `check-inject.js` | 复刻 DSH 的插值渲染某条注入轨：报 OK/THROW、连续左花括号数、**渲染字符数**（每回合真实注入量） |
| `check-summaries.js` | 格式体检：缺 `[summary:…]` 的块、摘要超 120 字、摘要含右方括号、双花括号计数 |
| `curate.js` | 按 § 分块整理：保留指定块、被移除块的原文进归档、追加新条目 |
| `track-index.js` | 打印每块的「编号 \| 日期 \| 字节 \| 标题」索引 |
| `track-summaries.js` | 打印每块的摘要行 |
| `verify-merge.js` | 校验合并稿没丢事实：原条目的标识符/数值是否都还在，覆盖表是否齐全 |
| `verify-hard.js` | 把令牌缺失分成软缺/硬缺，只报硬缺并定位回原条目编号 |
| `assemble.js` | 装配压缩版到 staging 文件，**不动原轨**（便于先复核） |
| `assemble-and-swap.js` | 装配 + 安全检查 + 备份 + 落盘 + 被取代原文逐字归档；默认演练 |
| `unexpire.js` | 过期审计落盘器：逐处字面替换，强制「唯一命中」与「新文无双花括号」，落盘前复读比对 |
| `ztail.js` | 会话时间线：逐帧解多帧 zstd，统计每回合结束原因、报错时间与文案 |
| `zscan.js` | 扫出报错回合与 error payload |
| `zdump.js` | 多帧 zstd 解包器（会话日志是多帧拼接，Node 自带的只解第一帧） |
| `msgsrc.js` | 打印用户消息的来源与形状（判定消息出自哪个渠道） |

**怎么用**：直接在包内调用（`node <本目录>/tools/ztail.js <会话文件>`），或把整个 `tools/` 复制到 `<DSH_HOME>/tools/` 再按技能正文里的 `<TOOLS>/xxx.js` 调用。每支脚本的完整参数、行为与退出码写在脚本头部注释，也在技能 `dsh-memory-compression` 文末的「辅助脚本」一节。

两个注意点：

- `tools/` 自带一个内容为 `{"type": "commonjs"}` 的 `package.json`。这些脚本是 CommonJS，**单独复制某个 `.js` 到别处**时如果目标目录属于一个 ESM 包，会报 `require is not defined`——连这个 `package.json` 一起复制即可。
- `check-inject.js` 需要 DSH 的插值实现来复刻行为，它按 `DSH_SYSTEM_PROMPT_MODULE` 环境变量 → `$DSH_SOURCE` → `$DSH_HOME/source/current` → npx 缓存 → 当前工作目录的顺序自动查找；全找不到时退出码 3 并打印指定方法，不会静默失败。
- `unexpire.js` 的替换表是外置的 JSON，格式见 `tools/edits.example.json`。

## 验证

```bash
node --test tests/bundled-skills.test.js   # 内置技能：清单、格式、同步与版本保护
node --test tests/tools.test.js            # 辅助脚本：语法、无参提示、合成夹具上跑通整条流水线
```

（`tools.test.js` 会自己造一份临时夹具：快照 → 分块 → verify-merge/verify-hard → assemble → assemble-and-swap → unexpire → curate，跑完自动清理。）

## 卸载

从 profile 的插件名册里移除该行、删掉 `node_modules/dsh-memory-evolve-suite`。**技能库里的文件不会自动删除**——同步器只往下推、不往回收，需要时手动删 `~/.agents/skills/` 下的对应目录。

## 来源与许可

基于 `dsh-memory-evolve` v0.1.0（作者 csyangwen，MIT，`https://github.com/csyangwen/dsh-memory-evolve`）修改而来：包名改为 `dsh-memory-evolve-suite`、版本 0.2.0，新增上述 3 份技能与 `tools/`、`tests/`，并对应调整 `lib/coi/skills-sync.js` 的内置技能清单（4 → 7 项）；上游的功能逻辑未改。原始 `LICENSE` 保留在包根。
