# dsh-memory-evolve-suite

> **一句话**：给 DSH 装上跨会话长期记忆、四轨待办、技能自我进化与外部 AI 调度，并额外内置三份「记忆运维」技能与 14 个配套脚本——**记忆会自己长大，也能自己减重**。

相关文档：[详细功能说明](README-详细说明.md) · [记忆与审查规则](docs/rules.md) · [COI 调度](docs/COI-调度.md) · [记忆同步](docs/记忆同步.md) · [更新日志](docs/CHANGELOG.md) · [上游原文：使用场景指南](docs/上游-使用场景指南.md) · [English](README.en.md)

---

## 关于本包（再分发构建）

**本包是 `dsh-memory-evolve-suite`，不是原版。** 它基于原作者 **csyangwen** 的 **[dsh-memory-evolve](https://github.com/csyangwen/dsh-memory-evolve)** v0.1.0（MIT 许可）制作，**插件本体的功能逻辑未做任何改动**，差别只有四项：

| 项 | 内容 |
|---|---|
| 包与插件名 | 由 `dsh-memory-evolve` 改为 `dsh-memory-evolve-suite`。插件行 id、客户端注册 id、日志标签、配置键名、锁与缓存目录名同步改名，因此**可与上游原版并存安装、互不覆盖** |
| 内置技能 | `skills/` 由 4 份增至 7 份，新增 `dsh-memory-compression`、`dsh-memory-curation`、`dsh-injection-track-triage` |
| 辅助脚本 | 新增 `tools/`：14 个参数化的记忆压缩、过期审计与会话取证脚本（已通用化，不含任何私人数据） |
| 出厂测试 | 新增 `tests/bundled-skills.test.js`、`tests/tools.test.js` |

**想要原版**：`dsh plugin --profile web add github:csyangwen/dsh-memory-evolve`。

**关于自动更新**：版本检测（`lib/update.js`）需要一个可 `git fetch` 的远端。本包已发布在 `https://github.com/Archer76/dsh-memory-evolve-suite`：用 `git clone` 克隆后安装，「版本」页即可检测新版本并一键更新（更新走 `git fetch` + `checkout --detach`，不动你的记忆数据）。从本地目录或 zip 安装时没有远端，该页会提示不支持自动检测——这是预期行为，不影响任何记忆功能。

---

## 快速开始（安装）

插件包内自带 `cordis.patch.yml`（`dsh.bundle.patch` 声明），`dsh plugin add` 安装后 **host 端自动注册，无需任何手动配置**。以 web profile 为例，两步装好：

```sh
# 0.（可选）想用「版本」页自动更新就先克隆——这样插件目录自带 git 远端
git clone https://github.com/Archer76/dsh-memory-evolve-suite.git

# 1. 安装到 profile（把 <本包目录> 换成克隆或解压出来的这个目录；也接受 link:<路径>）
dsh plugin --profile web add <本包目录>

# 2. 重启 dsh web 即生效
```

> ⚠️ **不要再往 `~/.dsh/profiles/web/cordis.patch.yml` 手动 insert 本插件**：bundle patch 已自动注册，重复 insert 同 id 会让加载器报 duplicate loader entry id 无法启动。

**修改默认配置**（如开启回合内记忆审查）：在 profile 的 `cordis.patch.yml` 用 id 覆盖（顶层写法，非 insert）：

```yaml
- id: dsh-memory-evolve-suite
  config:
    reviewEnabled: true      # 开启回合内记忆审查（默认关）
    reviewInterval: 10       # 每 10 个用户回合审查一次
```

**临时禁用**（插件异常导致 DSH 起不来时，等修复后取消；无需卸载）：

```yaml
- id: dsh-memory-evolve-suite
  disabled: true
```

**从旧版本升级**：若你此前按旧文档手动 insert 过，请删掉 profile patch 里的 insert 行（否则与 bundle 自动注册重复）。

**卸载**：`dsh plugin --profile web remove dsh-memory-evolve-suite`。插件效果随卸载清理；但**技能库里的文件不会自动删除**——同步器只往下推、不往回收，需要时手动删 `~/.agents/skills/` 下的对应目录。

**如果你要改包名**：下面四处必须保持**逐字相同**，否则浏览器半边会「加载了却没注册」（界面静默缺功能）：`package.json` 的 `name`、`cordis.patch.yml` 里那行的 `id` 与 `name`、`lib/index.js` 的 `export const name`、`lib/client.js` 首行的注册 `id`。改完记得跑一次 `node scripts/build.mjs`（该脚本会把 `package.json` 的 name 烘进客户端产物）。

---

## 包里有什么

### 1. 插件本体：功能一览

配置键写在 profile 的 `cordis.patch.yml`（顶层 id 覆盖，见上）。

| 功能 | 说明 | 相关配置键 |
|---|---|---|
| **五轨记忆** | 全局 `MEMORY.md` · 用户 `USER.md` · 项目 `projects/<hash>/MEMORY.md` · 项目关键 `KEY.md` · 每日 `daily/YYYY-MM-DD.md`；git 分支感知，按工作目录自动归档 | — |
| **摘要注入（渐进披露）** | `key` 轨只注入一句话摘要 `[summary:…]`，需要全文时用 `memory expand` 加载——大轨不再每回合灌进系统提示词 | `keyProgressiveDisclosure`、`keyFullInjectThreshold`、`keyFullInjectCharLimit` |
| **回合内自我审查** | 每 N 个用户回合由独立评审模型审一遍，产出记忆/技能建议，进待确认队列 | `reviewEnabled`、`reviewInterval`、`reviewMode` |
| **技能自我进化与技能管理** | 经验沉淀成技能、技能库浏览与启停、技能投稿待采纳 | `skillReviewEnabled` |
| **回合内写保护** | 防止一回合内反复写同一轨；超阈值限流 | `perTurnDailyWrites`、`perTurnKeyWrites`、`perTurnProjectWrites`、`perTurnWriteGuard`、`writeGuardThreshold` |
| **四轨待办** | 生活 / 工作 / 项目（按工作目录隔离）/ 每日，四象限与到期提醒 | `todoEnabled` |
| **记忆同步** | 多设备共享同一份项目记忆，冲突可见 | `syncEnabled` |
| **会话评审员** | 旁路观察会话、按需问答与注入，可见度可调 | `advisorEnabled`、`advisorPanelEnabled`、`advisorProvider`、`advisorModel`、`advisorSystemPrompt`、`advisorInfoInject`、`advisorImmuneTurns`、`advisorMaxMessages`、`advisorMaxQueued`、`advisorCallTimeoutMs`、`advisorSteerSeverities` |
| **COI 外部 CLI 调度** | 把任务派给 kimi / codex / grok / hermes 或任意自定义 CLI，会话分层、进度可见 | `coiEnabled` |
| **会话编排与广播** | 拉起多个内部会话协同；向会话群广播消息（可带图） | `broadcastEnabled`、`broadcastImageEnabled` |
| **会话搜索与取图** | 检索历史会话；按需取会话中的图片 | `sessionEnabled`、`sessionSearchEnabled`、`sessionImageQueryEnabled` |
| **本地文件搜索** | 语义/关键词检索本机文件，结果可回填记忆 | `searchDocsEnabled`、`searchDocsMode` |
| **提示词管理器** | 维护可复用提示词库，按需注入会话 | `promptsEnabled` |
| **模型设置** | 在界面里管理模型与路由 | `modelsEnabled` |
| **界面设置** | 样式级小功能的开关收纳 | `uiSettingsEnabled` |
| **会话书签与分支** | 长会话打点、回跳、分叉 | `bookmarkEnabled` |
| **无限画板** | 散落素材集中摆放与渲染 | `canvasEnabled` |
| **通知与渠道直发** | 站内通知铃；把结果直接发到已接入的 IM 渠道 | `notifyEnabled`、`channelSendEnabled` |
| **工作区写协调** | 多会话同写一个工作区时的锁与快照 | `wsCoordEnabled`、`wsCoordEnforceWrite`、`wsCoordSnapshot` |

**暴露给模型的工具**：记忆与技能 —— `memory`、`memory_suggest`、`skill_manage`、`memory_review_status`；待办 —— `dtodo`；搜索 —— `memory_evolve_search_local_files`；提示词 / 模型 —— `de_prompts`、`de_models`；通知与渠道 —— `de_notify`、`de_channel_send`；会话 —— `de_session`、`de_session_search`、`de_session_images`、`de_broadcast`；画板 —— `de_canvas`；外部 CLI 调度 —— `de_coi`、`de_coi_dispatch`、`de_coi_status`、`de_coi_wait`、`de_coi_cancel`、`de_coi_adapters`；工作区写协调 —— `de_ws_declare`、`de_ws_status`、`de_ws_release`。（另有斜杠命令 `memory_review`、`memory_evolve_search_files`。）

**WebUI 主要页面**：记忆文件、技能、待办、设置、模型、记忆同步、COI 调度、界面设置、书签、画板、广播、提示词、评审员面板、记忆队列、版本。

### 2. 内置技能（`skills/`，7 份）

插件启动时把它们同步进用户技能库（默认 `~/.agents/skills`，每份一个目录），随系统提示词注入、所有会话可用；启用/禁用与编辑入口在 WebUI 的「技能管理」Tab。

| 技能 | 用来做什么 |
|---|---|
| `dsh-memory-compression` | 注入轨（memory/user/key）过大时的压缩流水线：体检归因、快照与并发保全、按主题分块并行合并、令牌级事实校验、staging 装配与归档，以及过期审计与摘要注入的开法与收益预期 |
| `dsh-memory-curation` | 日常整理：四轨的归档能力差异、整份快照、按 § 分块重写、条目格式与时间戳规则、渲染自检 |
| `dsh-injection-track-triage` | 某工作区「发什么都秒错、无任何模型调用」时的毒源排查：定位注入轨里的连续左花括号、多帧 zstd 会话取证、复现与验证 |
| `kimi-cli-calling` / `codex-cli-calling` / `grok-cli-calling` / `hermes-cli-calling` | 外部 CLI 调度适配器（随插件原有提供） |

**同步与升级语义**：每份技能的 frontmatter 带 `x-version`。用户库里没有该技能 → 装上；源头 `x-version` 更高 → 覆盖；其它情况不动（保护你对 SKILL.md 的本地编辑）。注意保护是**单向**的：**升级插件会覆盖这些技能里的本地编辑**，想长期保留改动就另建一个自己的技能名。

### 3. 辅助脚本（`tools/`，14 个 + 1 份示例）

记忆压缩、过期审计与会话取证的命令行工具，全部参数化、无外部依赖（`check-inject.js` 例外，见下）。

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

**怎么用**：直接在包内调用（`node <本包目录>/tools/ztail.js <会话文件>`），或把整个 `tools/` 复制到 `<DSH_HOME>/tools/` 再按技能正文里的 `<TOOLS>/xxx.js` 调用。每支脚本的完整参数、行为与退出码写在脚本头部注释，也在技能 `dsh-memory-compression` 文末的「辅助脚本」一节。

- `tools/` 自带一个内容为 `{"type": "commonjs"}` 的 `package.json`：这些脚本是 CommonJS，**单独复制某个 `.js` 到别处**时若目标目录属于一个 ESM 包会报 `require is not defined`，连这个 `package.json` 一起复制即可。
- `check-inject.js` 需要 DSH 的插值实现来复刻行为，按 `DSH_SYSTEM_PROMPT_MODULE` → `$DSH_SOURCE` → `$DSH_HOME/source/current` → npx 缓存 → 当前工作目录的顺序自动查找；全找不到时退出码 3 并打印指定方法，不会静默失败。
- `unexpire.js` 的替换表是外置 JSON，格式见 `tools/edits.example.json`。

### 4. 出厂测试

```bash
node --test tests/bundled-skills.test.js   # 内置技能：清单、格式、同步与版本保护
node --test tests/tools.test.js            # 辅助脚本：语法、无参提示、合成夹具上跑通整条流水线
```

（`tools.test.js` 会自己造一份临时夹具：快照 → 分块 → verify-merge/verify-hard → assemble → assemble-and-swap → unexpire → curate，跑完自动清理。）

---

## 存储位置

| 内容 | 位置 |
|---|---|
| 记忆轨 | `<DSH_HOME>/memories/MEMORY.md`、`USER.md`、`daily/YYYY-MM-DD.md`、`projects/<hash>/MEMORY.md`、`projects/<hash>/KEY.md` |
| 运行期配置 | `<DSH_HOME>/memories/plugin-state.json`（界面改配置落这里，扛重启） |
| 用户技能库 | `~/.agents/skills/<技能名>/SKILL.md` |
| 归档 | 同目录下的 `*-archive.md`（可移回主记忆） |

## 来源与许可

基于 `dsh-memory-evolve` v0.1.0（作者 csyangwen，MIT，`https://github.com/csyangwen/dsh-memory-evolve`）修改而来：包名改为 `dsh-memory-evolve-suite`、版本 0.3.0，新增上述 3 份技能与 `tools/`、`tests/`，并对应调整 `lib/coi/skills-sync.js` 的内置技能清单（4 → 7 项）；上游的功能逻辑未改。上游两篇使用场景指南保留在 `docs/上游-使用场景指南.md` 与 `docs/上游-使用场景指南.en.md`（其中的包名与安装命令已对齐本包）。原始 `LICENSE` 保留在包根。
