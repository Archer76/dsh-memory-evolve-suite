---
name: dsh-memory-curation
description: "整理、精简或归档 DSH 长期记忆时使用。四条轨（memory/user/key/project）的归档能力差异、整份快照备份、按分隔符分块重写的脚本、条目格式与时间戳规则、注入轨禁忌与完成后的渲染自检。触发场景:用户说整理长期记忆、删掉可以删的部分、把记忆切分成技能、日常清理归档。"
x-provider: dsh-memory-evolve-suite
x-version: 1
---
<!-- 本技能由 dsh-memory-evolve-suite 内置提供：源头随插件升级同步；禁用或编辑请到「技能管理」Tab -->

# DSH 长期记忆整理规程

## 路径约定

`<DSH_HOME>` = DSH 主目录（默认 `~/.dsh`，Windows 为 `%USERPROFILE%\.dsh`；环境变量 `DSH_HOME` 即其绝对路径）。
`<TOOLS>` = 包的 `tools/` 目录（辅助脚本**由本包自带**，清单与用法见 `dsh-memory-compression` 文末「辅助脚本」）。

## 何时用

用户要求「整理长期记忆」「删掉可以删掉的部分」「把记忆切分成技能」时。
数据量大到要跑分块并行合并流水线时 → 改用 `dsh-memory-compression`。

## 四轨对照

| 轨 | 文件 | 是否注入提示词 | 归档能力 | 清理手段 |
|---|---|---|---|---|
| memory（全局） | `<DSH_HOME>/memories/MEMORY.md` | 是（所有工作区） | 有 → `MEMORY-archive.md` | archive（可逆） |
| user | `…/USER.md`（可不存在） | 是 | 有 → `USER-archive.md` | archive（可逆） |
| key（项目关键） | `…/projects/<hash>/KEY.md` | 是（仅该工作区） | 有 → 同目录 `KEY-archive.md` | archive（可逆） |
| project（项目日志） | `…/projects/<hash>/MEMORY.md` | 否 | **没有** | 只能 `remove`（不可逆）⇒ **必须先整份备份再重写** |
| daily（每日日志） | `…/daily/<日期>.md` | 否 | 没有 | 一般不动 |

`<hash>` 由 `resolveProjectId(cwd)` 产生，**不是路径哈希**；认领工作区靠 KEY.md / MEMORY.md 的 mtime 与会话写入时刻对齐 + 内容特征。

## 铁律

1. **一律优先可逆归档，不用不可逆删除。**
2. **写入任何注入轨（memory / user / key）的正文里，绝不出现连续两个左花括号**（会让该工作区所有会话每回合秒错，详见技能 `dsh-injection-track-triage`）。
3. 未完成的待办条目**不得在清理中丢弃**——要么保留原文，要么改写进新条目并标明当前状态。
4. 整理前先做**整份快照**，别只备份要改的那个文件。

## 步骤

### 1. 快照（改之前）

```powershell
$m="$env:DSH_HOME\memories"; $s="$m\_archive\snapshot-<日期>"
New-Item -ItemType Directory -Force -Path $s | Out-Null
foreach($i in @('MEMORY.md','MEMORY-archive.md','SUGGESTIONS.jsonl','daily','projects','plugin-state.json')){ Copy-Item "$m\$i" "$s\" -Recurse -Force -ErrorAction SilentlyContinue }
```

**别把快照放进 `memories` 里再整目录递归复制**——会自我嵌套。逐项复制即可。

### 2. 分块重写（脚本，别手工重打）

记忆文件是「条目 + 单独一行 § 分隔」。用脚本按 § 分块，保留需要原文的块、把其余追加进归档件、再追加新写的条目：

```powershell
node <TOOLS>/curate.js <src> <keepCsv|-> <newEntriesFile|-> <archiveFile>
#   keepCsv     要原样保留的块序号（1 起算），如 1,2,13；用 - 表示一块不留
#   newEntries  新条目文件（条目之间同样用单独一行 § 分隔）
#   脚本会打印 块数变化 / 归档数 / 含连续左花括号的块数
```

好处：保留块**逐字不动**（不重打就不会抄错），被移除的块**原文**进归档，可逆可查。

### 3. 新条目写法

- 合并旧条目时**保留原始核实日期**并显式写出（例：`[2026-09-11]`…`（合并原两条）`）。
- 未完成项集中放末尾，标 `**未完成**` / `**待用户拍板**`。
- 把已切分出去的流程写成**索引条目**（技能名 + 一句话用途 + 脚本路径），别让 key 轨既当索引又当手册。

### 4. 完成后自检

```powershell
node <TOOLS>/check-inject.js "<DSH_HOME>/memories/MEMORY.md"
node <TOOLS>/check-inject.js "<DSH_HOME>/memories/projects/<hash>/KEY.md"
```

两条都必须 OK 且连续左花括号计数为 0。project / daily 不注入，但同样建议扫一遍。

## 坑

- `replace` 会把条目时间戳**重盖为当天**——精简后必须在新正文里显式标注原始日期，否则日后误判时效。
- `archive` 只支持 memory / user / key 三轨；对 project 轨调用无效。
- 待确认队列（`SUGGESTIONS.jsonl`）里的建议**尚未落盘、不注入**；整理时若发现队列有货，先决定采纳或丢弃再动文件，避免两次写入互相覆盖。
- 直接改文件是有效的（插件渲染时现读磁盘），但**别在别的会话正写记忆时改**同一个文件；本轮自己的收尾写入放在整理之后。
- 批量 approve/reject 建议时先 reject 再 approve，避免序号错位。

## 验证清单

- [ ] 快照目录存在且文件数对得上
- [ ] 归档件里能搜到每条被移除条目的原文
- [ ] 注入轨 `check-inject.js` 全部 OK
- [ ] 未完成待办已在新条目里可见
- [ ] 新条目文本里没有连续左花括号
