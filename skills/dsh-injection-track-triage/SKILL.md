---
name: dsh-injection-track-triage
description: "DSH 某个工作区「发什么都秒错、回合启动瞬间结束、没有任何模型调用」时使用。定位注入轨（memory/user/key）正文里的连续两个左花括号毒源，解压多帧 zstd 会话落盘做时间线取证，用 renderContextSections 复现并验证修复；改文件即时生效，无需重启。触发场景:某个工作区每回合秒错、报 malformed prompt variable reference、别的会话正常只有它坏。"
x-provider: dsh-memory-evolve-suite
x-version: 1
---
<!-- 本技能由 dsh-memory-evolve-suite 内置提供：源头随插件升级同步；禁用或编辑请到「技能管理」Tab -->

# 注入轨毒源排查与修复（DSH「秒错」故障）

## 路径约定

`<DSH_HOME>` = DSH 主目录（默认 `~/.dsh`）；`<TOOLS>` = 包的 `tools/` 目录（辅助脚本**由本包自带**）。

## 何时用

- 某个工作区发任何消息都立刻失败，回合在启动瞬间结束，**没有任何模型调用**（错误时间与发送时间几乎同秒）。
- 错误信息含 `malformed prompt variable reference … in context "memory:snapshot"`。
- 同一台机器上别的工作区正常——故障是**按工作区**隔离的，这一点本身就是入口。

## 根因（两条分支，同一件事）

`dsh-memory-evolve-suite` 把项目 KEY 记忆注册为提示词 context `memory:snapshot`（每步渲染、现读磁盘）；
`@deepseek-ai/dsh-system-prompt` 的 `interpolate()` 扫到**连续两个左花括号**就当作变量引用：

| 分支 | 条件 | 文案 | 位置 |
|---|---|---|---|
| A | 构不成完整的简单变量组，且其后文本里还有右花括号 | `… at "…" (references are complete simple … groups)` | `lib/index.js:158` |
| B | 构成了组，但名字不合法（中文 / 大写 / 含空格） | `… "…" (variable names match …)` | `lib/index.js:164` |

（行号为观察时的版本；随 DSH 升级可能漂移，按文案特征认，别按行号认。）

两条都抛在**系统提示词组装阶段**，早于任何模型调用——所以不是模型、不是网络、不是会话损坏。

**危险窗口**：key 轨的条目先进待确认队列，**被确认落盘的那一刻**起毒才生效。所以「前几回合还正常、某一回合起全错」是标准形态。

## 步骤

### 0. 先排除模型/网络
看错误回合的时间戳：与用户发送时间几乎同秒 ⇒ 组装期故障，直接进第 1 步，别再查网络。

### 1. 取证（会话落盘）

```powershell
node <TOOLS>/ztail.js "<DSH_HOME>/sessions/<workspace>/<sessionId>/session.v3.jsonl.zstd" 25
```

该脚本用 Node 逐帧解 zstd 后统计 `turn/end` 的 `reason`、给出首/末次报错时间与去重后的错误文案。

**必须逐帧解**：`session.v3.jsonl.zstd` 是多帧 zstd 拼接，Node 的 `zstdDecompressSync` 只解第一帧——按魔数 `28 B5 2F FD` 切帧再逐帧解（`zdump.js` 即此实现）。

### 2. 定案（时间对齐）
把**首个 error 回合的时间**与候选注入轨文件的 mtime 对齐。项目目录名**不是** cwd 的路径哈希（`resolveProjectId(cwd)`），别反推；用 KEY.md / MEMORY.md 的 mtime 与会话写入时刻对齐，再按内容特征认领是哪个工作区。

### 3. 搜毒源

```powershell
Select-String -Path "<DSH_HOME>\memories\*" -Pattern '\{\{' -Recurse   # 用 grep 工具亦可
```

注入轨 = `MEMORY.md`（全局）、`projects\<hash>\KEY.md`（本项目）。`USER.md` 若存在同样注入。project / daily 两轨**不注入**，不触发。

### 4. 复现（定案证据）

```powershell
node <TOOLS>/check-inject.js "<注入轨文件路径>"
```

它用与 DSH 同款的 `renderContextSections` 跑一遍。若报 THROW 且**文案与会话日志逐字一致**，闭环成立。

### 5. 修复

- 先备份：`Copy-Item KEY.md KEY.md.bak-bracefix-<日期>`。
- 把每处连续左花括号**拆开**（中间插一个空格），并在同段落补一句说明「此处原字面是连续花括号，为避开提示词插值刻意留了空格」——否则日后会被谁当成笔误改回去。
- **不要删条目**：毒源条目往往正是有用的知识，拆括号即可。

### 6. 验证与交付

- 重跑 `check-inject.js` 应显示 OK 且「连续左花括号 = 0」。
- 插件每步现读磁盘 ⇒ **改完即时生效，不需要重启 dsh web**。让用户在原会话里再发一次即可。
- 顺带检查 project / daily 轨是否也有同样写法（不注入，但同样建议规避）。

### 7. 收尾（防复发）

把「铁律」写进**全局 memory 轨**。只写在某一个工作区的 key 轨是无效的：全局轨进每个工作区，key 轨只进那一个——本故障正是因此在 26 小时内复发过一次。

## 坑

- 别用 Node 的 `zstdDecompressSync` 直接吃整个会话文件：只会解出第一帧，看着"只有前几条"。
- 报错文案有 A / B 两种，别因为措辞变了就当成另一类问题。
- 别去重启 dsh web——重启杀不掉磁盘上的毒，还会打断进行中的会话。
- 修复后若该工作区仍有错，检查**别的注入轨**（全局 MEMORY / USER）是否也带毒。
- **摘要注入开着时更隐蔽**：正文里的毒可能不注入（只注入摘要行），于是脚本判 THROW 而工作区并没瘫——见 `dsh-memory-compression` 第 0 步。修复时两处都要清。

## 验证清单

- [ ] `ztail.js` 显示末次 error 之后不再新增
- [ ] `check-inject.js` 对全部注入轨均为 OK
- [ ] 注入轨全文连续左花括号计数为 0
- [ ] 全局 memory 轨已含铁律
- [ ] 用户在原会话复测通过
