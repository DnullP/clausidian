---
title: Writing & Agent Conventions
type: meta
updated: 2026-07-04
---

# Conventions

## Type → 目录 → 语义

| type | 目录 | 语义 |
|------|------|------|
| `resource` | `resources/wiki/` | **词条 (wiki entry)**：原子词条笔记（Evergreen Note）——解释概念、对比方案、记录知识，严格模板化 |
| `resource` | `resources/` | **文章 (article)**：长文阅读——深度分析、教程、设计文档，自由结构，不需要词条模板 |
| `area` | `areas/` | MOC 聚合页（Map of Content）——组织一个主题域，主要靠链接 |
| `project` | `projects/` | 有目标、有进度、有产出——不是解释概念，是推动完成一件事 |
| `idea` | `ideas/` | Fleeting Note（碎片捕捉）——原始想法，无需结构，之后可升级 |
| `journal` | `journal/` | 每日日志 |

### Type 决策框架

创建笔记前，用 litmus test 确定 type。**必须全部满足**才算通过：

**resource**（自包含引用文章）：
- [ ] 内容是自成一体的概念解释、方案对比或知识总结
- [ ] 独立于具体项目时间线，一年后仍有参考价值
- [ ] 没有 action items、checkbox 或进度追踪
- [ ] 目的是"让人理解 X"，不是"推动完成 X"

> 一句话：**"这是一篇关于 X 的维基词条"** → resource（词条）

**文章（article）**——也是 `type: resource`，但放在 `resources/` 而非 `resources/wiki/`：
- [ ] 是长篇深度阅读，不是可供快速查阅的词条
- [ ] 结构自由，段落驱动（你是在"读一篇文章"而不是"查一个概念"）
- [ ] maturity、strict section template 等词条约束**不适用**
- [ ] 目的可以是教导、分析、设计论证——不限于"解释 X"

> 一句话：**"这是我想坐下来慢慢读的一篇文章"** → resource（文章，放 `resources/`）

**project**（目标驱动的工作）：
- [ ] 有明确的目标或交付物（goal / deadline）
- [ ] 有 action items、checkbox 或进度追踪
- [ ] 有开始和预期结束时间
- [ ] 产出不只是知识，还有具体结果（代码、设计、决策）

> 一句话：**"我正在做 X，预计 Y 时间完成"** → project

**area**（主题导航页）：
- [ ] 主要内容是 [[链接]] 到其他笔记
- [ ] 为某个知识领域提供导航结构
- [ ] 持续维护，没有结束日期

> 一句话：**"想了解 X 领域，从这篇开始"** → area

**idea**（未加工想法）：
- [ ] 原始、未提炼的想法或问题
- [ ] 不需要正式结构
- [ ] 可能之后升级为 resource / project

> 一句话：**"我突然想到……"** → idea

### 常见判错场景

| 内容 | 容易错判为 | 实际应为 | 原因 |
|------|-----------|---------|------|
| 深入分析某个技术方案的对比文章 | project | resource | 没有目标/截止，纯解释性内容 |
| 有初步结构的学习计划但尚未执行 | resource | project | 有 goal + checkbox 进度 |
| 对多个概念的梳理和总结 | project | area (MOC) | 主要是链接和导航，不是产出 |

### Hook 强制校验

`PostToolUse` hook 会在每次 Write/Edit 后自动检查：
- `type` frontmatter 是否与实际目录匹配
- 不匹配时**报错阻断**，agent 必须修正后再提交

> **没有例外。** type 写错比目录写错更严重——目录可以用 mv 改，type 错了知识图谱就乱了。

### Wiki 子目录组织

`resources/wiki/` 是**所有词条笔记的根目录**。词条可在此根目录下按主题建立子目录归类（如 `resources/wiki/ai/skill/`），但**无论在哪一层子目录，笔记 type 始终是 `resource`**——子目录只是组织方式，不影响笔记类型。

**移动词条时，目标路径必须保持在 `resources/wiki/` 子树内。** 用户说"把 A 移到 X/Y 下"，就是移到 `resources/wiki/X/Y/`。

## 词条规范（resources/wiki/ 专用）

> 以下规则**仅适用** `resources/wiki/` 下的词条笔记。`resources/` 下的文章不受此模板约束。

### 文件名

- **英文小写连字符**，由 `clausidian note` 自动从标题 slug 生成：`Area (PARA)` → `area-para.md`，`Backpropagation` → `backpropagation.md`
- **禁止中文文件名**：中文写在 `title` 和 `aliases` 中
- **文件名无需手动干预**，CLI 自动处理 slugify
- **aliases 必须包含至少一个别名**，英文文件名配中文别名，反之亦然
- `_index.md` 为目录索引文件，不受此约束

### Frontmatter（必填）

```yaml
---
title: "中文标题"            # 词条显示名称
type: resource
tags: [tag1, tag2]           # 分类标签
aliases: ["English Name"]    # 硬约束：至少一个别名（文件名英文 ↔ 别名中文）
maturity: seedling           # seedling → budding → evergreen
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active               # active | archived | draft（不用 seedling 等值）
summary: "一句话简介"         # TL;DR
source: ""                   # 外部来源（可选）
related: ["[[note-a]]"]      # 关联笔记 — 必须是 YAML list of strings 格式
---
```

### Body 结构

```
## Description    — 直白介绍，类似维基第一段
## Definition     — 形式化定义（名词/公式/定理，非形式化概念可删除此段）
## Discussion     — 宽泛讨论：第一性原理、关键洞见、比较分析……什么重要写什么
## Examples       — 具体例子，可分子章节
## Connections    — See Also，列出前文未嵌入的关联词条 + 为什么相关
```

> **First-mention linking (首次提及链接原则)**: Wikilinks should be embedded inline in the body at the first mention of a related concept, NOT piled in Connections. Example:
> ```markdown
> ## Description
> LSM-Tree is the core data structure behind [[leveldb]], optimized for write-heavy workloads.
> ```
> The `clausidian link` command auto-detects first mentions and inserts inline wikilinks when applying links. Connections is for related notes that don't naturally appear in the body text.

### Body 质量要求

- **禁止 `<br>` 标签**：使用 markdown 空行分段，不使用 HTML 换行标签
- **代码块标注语言**：\`\`\` 后必须标注语言（如 `bash`、`yaml`、`python`）

## 文章规范（resources/ 专用）

> `resources/` 下的文章**不适用**词条的 section template 和 maturity/aliases 硬约束。

### Frontmatter（必填）

```yaml
---
title: "文章标题"
type: resource
tags: [tag1, tag2]
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active               # active | archived | draft
summary: "一句话简介"
source: ""                   # 外部来源（可选）
related: ["[[note-a]]"]      # 关联笔记 — 必须是 YAML list of strings 格式
---
```

### 与词条的关键差异

| 维度 | 词条 (resources/wiki/) | 文章 (resources/) |
|------|----------------------|-------------------|
| `maturity` | 必填 | 可选 |
| `aliases` | 必填，至少一个 | 可选 |
| Body 结构 | Description/Definition/Discussion/Examples/Connections | 自由结构 |
| 目的 | 快速查阅、概念解释 | 深度阅读、分析论证 |
| 验证 | scan-resources.py + check-aliases.py | 仅 check-note-creation.py |

## MOC 规范（area 专用）

```yaml
---
title: "主题名称"
type: area
tags: [moc]
aliases: ["Topic Name"]
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active
summary: "覆盖的知识领域概述"
related: []
---
```

Body 结构：`## Overview` → `## Core Concepts`（按子主题分组 `[[link]]`） → `## Entry Points` → `## Structure Notes` → `## Orphan Concepts`

## 通用 Frontmatter 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | ✓ | 笔记标题 |
| `type` | ✓ | resource / area / project / idea / journal |
| `tags` | ✓ | 标签列表 `[tag1, tag2]` |
| `aliases` | (wiki) | 至少一个别名，英文文件名 ↔ 中文别名 |
| `maturity` | (wiki) | seedling → budding → evergreen |
| `created` | ✓ | 创建日期 `YYYY-MM-DD` |
| `updated` | ✓ | 最后更新日期 |
| `status` | ✓ | active / archived / draft |
| `summary` | ✓ | 一句话摘要，用于搜索和索引 |
| `source` | - | 外部来源 URL |
| `related` | ✓ | 关联笔记 `["[[note-a]]", "[[note-b]]"]` |
| `goal` | (project) | 项目目标 |
| `deadline` | (project) | 截止日期 |

## 文件命名

- **词条笔记**：英文小写连字符，如 `gradient-descent.md`
- **Journal**：日期格式 `YYYY-MM-DD.md`
- **Review**：周 `YYYY-Www-review.md`，月 `YYYY-MM-review.md`
- 每个目录有 `_index.md` 作为自动索引

## 内容规则

- 标题用 `#`，段落标题用 `##`
- 内部链接用 `[[filename]]`，不加 `.md` 后缀
- 代码块标注语言
- 修改笔记后更新 `updated` 字段

## 验证机制

| 机制 | 触发时机 | 检查内容 |
|------|----------|----------|
| `clausidian validate` | SessionStart / 手动运行 | frontmatter 完整性、status 合法值、wiki 词条专项（文件名中文、aliases、maturity、<br>、related 格式、文章区误放词条） |
| `enforce-clausidian.py` | PreToolUse (Bash\|Write\|Edit) | 拦截直接 Write/Edit → 路由到 MCP；Bash 写需 `# clausidian-edit-ok: <原因>` |

```bash
# 全面验证
clausidian validate
```

## Bash 准入标记

MCP 工具无法覆盖的极少场景（如运行自定义合规脚本），可通过 Bash 命令加准入标记操作 vault 文件。

**标记格式**：`# clausidian-edit-ok: <具体原因>`

**硬约束**：
- 必须带 `:` 和原因，原因最少 5 个字符
- 仅 Bash 可用，Write/Edit 工具一律拒绝
- 不可用于 MCP 已覆盖的操作（aliases/related/maturity 等 frontmatter 字段已全面支持，用 `clausidian update` 即可）
- Python 脚本内含 vault `.md` 文件写入路径时，同样需要 Bash 命令带标记（`.claude/scripts/` 下的合规工具自动豁免）

```bash
# 正确用法
python3 fix-frontmatter.py  # clausidian-edit-ok: 修复 related 字段 YAML 格式（MCP update 不支持）
```

## Agent 规则

1. **创建词条**用 `clausidian note "标题" resource/wiki`，自动应用 `templates/resource.md` 模板并创建在 `resources/wiki/` 子目录下
2. **词条规范约束仅限 `resources/wiki/`**，验证脚本只扫描该目录。文章放在 `resources/` 下，不受词条模板限制
3. **创建文章**（长文、教程、设计文档）时，放在 `resources/` 下，用 `type: resource` 但不需要 `maturity`/`aliases` 字段
4. **Body 禁止 `<br>` 标签**，使用 markdown 空行分段
5. **移动词条始终在 `resources/wiki/` 内**。用户说"移到 X/Y 下"，目标路径即 `resources/wiki/X/Y/`，不要移到 wiki 目录外
6. **子目录移动用 `clausidian move`**，支持同 type 内任意子目录迁移（如 `resources/wiki/kubernetes/` → `resources/wiki/etcd/`），type 保持不变
7. **修改现有笔记**优先用 `clausidian patch` 或 `clausidian update`
8. **重命名**用 `clausidian rename`（自动更新所有 `[[引用]]`）
9. **修改后**更新 `updated` 字段
10. **建立链接**用 `clausidian link` 自动发现，或手动加 `[[link]]`
11. **清理后**运行 `clausidian sync` 重建索引
12. **MCP 无法覆盖时**用 Bash 准入标记 `# clausidian-edit-ok: <原因>`，不可滥用

## CLI 速查

```bash
clausidian journal                         # 今日日记
clausidian capture "想法"                   # 快速捕捉
clausidian search "关键词"                  # 全文搜索
clausidian list --type resource             # 列出所有 resource 笔记
clausidian rename "旧名" "new-name"         # 重命名（自动更新引用）
clausidian link                             # 自动发现缺失链接
clausidian review                           # 周回顾
clausidian sync                             # 重建索引
clausidian validate                         # 验证 frontmatter

# 词条验证（仅 resources/wiki/）
python3 ~/.claude/scripts/scan-resources.py
```
