---
name: obsidian
version: 1.1.0
description: |
  Claude Code 的 Obsidian 深度整合 — 通过 MCP 工具和 hooks 管理 PARA 知识库。
  觸發詞（繁體中文優先）: 記筆記、寫日記、搜知識庫、記錄想法、知識管理、查筆記、整理筆記、回顧、記憶同步、Context、會話開始、會話結束
  Triggers (English): journal, capture, search notes, weekly review, obsidian, vault, memory, context, session, log work
---

# /obsidian — Obsidian Vault 管理

通过 clausidian MCP 工具操作知识库。从任何项目目录都能用。

## Setup

如果还没安装，运行 `clausidian setup` 自动配置 MCP server + skill。

## Vault 基本信息

- **路径:** 由 `$OA_VAULT` 环境变量指定（运行 `clausidian setup` 时配置）
- **结构:** PARA — `areas/` `projects/` `resources/` `journal/` `ideas/`
- **索引:** `_index.md` `_tags.md` `_graph.md`（自动维护）
- **规范:** 完整 frontmatter。`[[filename]]` 链接（无 .md）。小写连字符文件名。

## 触发关键词（全能力）

| 语言 | 关键词 |
|------|--------|
| 中文 | 记笔记、写日记、搜知识库、记录想法、查笔记、整理笔记、回顾、周回顾、月回顾、知识管理、记一下、写入 vault、更新笔记、归档、**自动检查**、**知识分析**、**焦点建议**、**优化链接**、**综合搜索**、**智能工作流**、**优先级排序**、**趋势分析** |
| English | journal, capture, search notes, log work, weekly review, monthly review, vault stats, find notes, obsidian, knowledge base, read note, **auto-check**, **analyze knowledge**, **focus**, **optimize links**, **smart search**, **workflow**, **priority**, **trends**, **insights** |

## Intent → Tool 路由

根据用户意图选择正确的 MCP 工具：

| 意图 | MCP 工具 | 参数 |
|------|---------|------|
| 写日记 / 建日志 | `journal` | `{date?}` |
| 记录当前工作到日志 | `journal` → `patch` | 先建日志，再 append 到 Records |
| 记想法 / capture | `capture` | `{idea: "text"}` |
| 建新笔记 | `note` | `{title, type, tags?, summary?}` — type 未给时询问 |
| 读笔记内容 | `read` | `{note, section?}` |
| 搜索知识 | `search` | `{keyword, type?, tag?, status?}` |
| 列出笔记 | `list` | `{type?, tag?, status?, recent?}` |
| 最近更新 | `recent` | `{days?: 7}` |
| 更新 metadata | `update` | `{note, status?, tags?, summary?}` |
| 编辑段落 | `patch` | `{note, heading, append?/prepend?/replace?}` |
| 归档笔记 | `archive` | `{note}` |
| 删除笔记 | `delete` | `{note}` — 自动清理引用 |
| 反向链接 | `backlinks` | `{note}` |
| 孤岛笔记 | `orphans` | `{}` |
| 统计 | `stats` | `{}` |
| 健康检查 | `health` | `{}` |
| 知识图谱 | `graph` | `{type?}` — 输出 Mermaid |
| 重建索引 | `sync` | `{}` |
| 标签列表 | `tag_list` | `{}` |
| 重命名标签 | `tag_rename` | `{old_tag, new_tag}` |
| 重命名笔记 | `rename` | `{note, new_title}` — 更新所有引用 |
| 搬移笔记 | `move` | `{note, new_type}` — 换类型/目录 |
| 合并笔记 | `merge` | `{source, target}` — body+tags 合并，引用重定向 |
| 查重复 | `duplicates` | `{threshold?: 0.5}` — 相似度检测 |
| 查坏链接 | `broken_links` | `{}` — 找不存在的 [[link]] |
| 批量更新 | `batch_update` | `{type?, tag?, status?, set_status?, set_summary?}` |
| 批量加标签 | `batch_tag` | `{type?, tag?, add?, remove?}` |
| 批量归档 | `batch_archive` | `{type?, tag?, status?}` |
| 导出笔记 | `export` | `{type?, tag?, format?: "json", output?}` |
| 智能连结 | `link` | `{dry_run?: false, threshold?: 0.3}` — 自动发现并建立缺失链接 |
| 活动时间线 | `timeline` | `{days?: 30, type?, limit?: 50}` — 按时间排列的活动 |
| 校验笔记 | `validate` | `{}` — 检查 frontmatter 完整性 |
| 钉选笔记 | `pin` | `{note}` — 标记为收藏 |
| 取消钉选 | `unpin` | `{note}` |
| 钉选列表 | `pin_list` | `{}` — 所有收藏笔记 |
| 修复坏链 | `relink` | `{dry_run?: false}` — fuzzy match 修复 |
| 改进建议 | `suggest` | `{limit?: 10}` — 孤岛/过期/缺标签/坏链 |
| 每日仪表盘 | `daily` | `{}` — journal+活动+钉选+项目 |
| 字数统计 | `count` | `{type?}` — 按类型统计字数/行数 |
| 待办事项 | `agenda` | `{days?: 7, all?: false}` — 从日志和项目提取未完成 TODO |
| 变更日志 | `changelog` | `{days?: 7}` — 按日期分组的变更记录 |
| 图谱探索 | `neighbors` | `{note, depth?: 2}` — N 跳内的关联笔记 |
| 随机笔记 | `random` | `{count?: 1, type?, status?}` — 偶遇式发现 |
| 聚焦建议 | `focus` | `{}` — 按优先级建议下一步工作 |
| 在 Obsidian 打开 | `open` | `{note?, reveal?}` — macOS only |
| 剪贴板快捷笔记 | `quicknote` | `{prefix?}` — 从剪贴板捕获 |
| 周回顾 | **CLI:** `clausidian review` | |
| 月回顾 | **CLI:** `clausidian review monthly` | |
| 导入笔记 | **CLI:** `clausidian import <file>` | |
| **[Agent 强化]** | | |
| 知识缺口分析 | `analyze_knowledge_gaps` | `{type?: "project", depth?: 2}` — 找出孤岛和缺链接笔记 |
| 关键见解提取 | `extract_key_insights` | `{days?: 7, top?: 10}` — 从最近笔记提取核心见解 |
| 趋势检测 | `detect_trends` | `{scope?: "topics", period?: 30}` — 识别热点和知识演变 |
| 模式识别 | `pattern_recognition` | `{type?: "similarity"}` — 发现内容模式和聚类 |
| 智能工作流执行 | `run_auto_workflow` | `{name: "daily-health-check\|weekly-link-optimize\|..."}` |
| 优先级分析 | `analyze_priority` | `{method?: "recency+impact"}` — 计算工作优先级 |
| 多源搜索 | `multi_source_search` | `{query, sources: ["vault", "memory", "git"]}` — 跨源查询 |
| 活动追踪融合 | `trace_activity` | `{span?: 90, aggregate?: true}` — git+vault 活动统一视图 |
| 自主决策引擎 | `autonomous_decision` | `{context?: current}` — Agent 自主推荐和执行 |
| 健康驱动清理 | `health_driven_action` | `{auto_execute?: false}` — 基于健康度自动清理 |

## 工作流模式

### 1. 记录今天工作

```
1. journal()                          — 确保今天的日志存在
2. patch({note: "YYYY-MM-DD",         — 追加工作记录到 Records
         heading: "Records",
         append: "- 完成了 XXX"})
```

### 2. 快速捕捉想法

```
1. capture({idea: "想法内容"})          — 建立 ideas/ 笔记
2. search({keyword: "相关词"})          — 查找关联笔记
3. 如果找到关联 → 建议用 update 互相链接
```

### 3. 每日总结

```
1. journal()                          — 确保日志存在
2. recent({days: 1})                  — 查看今天改了什么
3. patch(heading: "Records", append)  — 填入工作记录
4. patch(heading: "Tomorrow", append) — 填入明日计划
```

### 4. 周回顾

```
1. Bash: clausidian review
2. list({type: "project", status: "active"})  — 活跃项目
3. recent({days: 7})                          — 本周更新
4. 读取生成的 review 并补充项目进展
```

### 5. 月回顾

```
1. Bash: clausidian review monthly
2. stats()                             — vault 统计
3. list({type: "project"})             — 所有项目状态
4. 读取生成的 review 并补充里程碑
```

### 6. 查知识

```
1. search({keyword: "关键词"})          — 全文搜索
2. read({note: "最相关的结果"})          — 读取内容
3. backlinks({note: "该笔记"})          — 查看关联上下文
4. 综合笔记内容回答用户问题
```

### 7. 整理笔记 / 维护

```
1. health()                            — 健康分数
2. orphans()                           — 孤岛笔记
3. broken_links()                      — 坏链接
4. duplicates()                        — 重复检测
5. stats()                             — 统计概览
6. tag_list()                          — 标签检查
7. 建议: 链接孤岛、修复坏链、合并重复笔记/标签
```

### 8. 批量操作

```
1. batch_tag({type: "idea", add: "needs-review"})   — 给所有 idea 加标签
2. batch_archive({tag: "deprecated"})                — 批量归档
3. batch_update({type: "project", set_status: "active"}) — 批量状态
```

### 9. 重构笔记

```
1. rename({note: "old-name", new_title: "New Name"}) — 重命名+更新引用
2. move({note: "my-idea", new_type: "project"})      — idea 升级为 project
3. merge({source: "draft", target: "main-note"})     — 合并草稿到主笔记
```

### 10. 知识库健康检查

```
1. validate()          — 找出 frontmatter 问题
2. broken_links()      — 坏链接
3. relink({dry_run: true})  — 预览修复方案
4. relink()            — 自动修复
5. link({dry_run: true})    — 预览缺失链接
6. link()              — 建立链接
7. health()            — 综合健康分
```

### 11. 每日开始

```
1. daily()              — 一览全局
2. journal()            — 确保日志存在
3. suggest()            — 查看改进建议
4. 根据建议执行 link/relink/archive 等
```

## 写作规范

1. **Frontmatter 必填:** title, type, tags, created, updated, status, summary
2. **Type:** area / project / resource / journal / idea
3. **文件名:** 小写连字符 (`my-note.md`)，journal 用 `YYYY-MM-DD.md`
4. **链接:** `[[filename]]` 不加 `.md` 后缀
5. **修改后:** 更新 `updated` 字段，call `sync` 重建索引
6. **Related:** 主动维护双向链接

## macOS 专属功能

```
1. open({note: "my-note"})              — 在 Obsidian.app 打开笔记
2. open({reveal: true, note: "my-note"})— 在 Finder 中显示
3. open()                               — 打开整个 vault
4. quicknote()                          — 剪贴板内容 → idea 笔记
5. clausidian launchd install       — 安装定时任务 (daily backfill + weekly review)
6. clausidian launchd status        — 查看定时任务状态
```

## Claude Code 深度整合 + Agent 强化（v1.2+）

### Phase 1-4: Claude Code 基础集成

| 功能 | 使用 | 说明 |
|------|------|------|
| Memory 同步 | `memory sync [--dry-run]` | 同步 vault 笔记到 Claude memory |
| Context 注入 | `context-for-topic "主题"` | 快速获取主题相关的 vault context（RAG）|
| CLAUDE.md 管理 | `claude-md inject --global` | 自动注入 vault context 到 CLAUDE.md |
| Hook 自动化 | `hook session-start/pre-tool-use` | 自动记录工作活动和每日 context |

### Phase 5: Agent 强化能力包（NEW）

#### 1. 🤖 智能工作流自动化

自动执行知识库的日常维护和优化任务：

```
Auto-Workflows:
├─ daily-health-check()      — 每日运行：检查孤岛、坏链、重复笔记
├─ weekly-link-optimize()    — 每周：发现缺失链接并建立连接
├─ monthly-tag-consolidate() — 每月：整合相似标签、清理已弃用标签
├─ auto-archive-stale()      — 自动归档无更新超过 90 天的笔记
└─ focus-generator()         — 基于最近活动生成今日焦点建议
```

触发方式：
- Agent 可在任何时刻自主执行：`auto workflow <workflow-name>`
- Fallback CLI：`clausidian workflow <name>`
- Hook 集成：`session-start` 自动运行日检查

#### 2. 🧠 AI 驱动的知识分析

深度理解 vault 内容，发现隐藏的知识模式：

```
Smart Analysis Commands:
├─ analyze-knowledge-gaps()     — 识别缺失的知识领域
│  ├─ 按主题找出孤岛笔记
│  ├─ 识别知识孤点（缺链接）
│  └─ 建议补充的知识点
│
├─ extract-key-insights()       — 从笔记中提取关键见解
│  ├─ 自动识别关键词和核心概念
│  ├─ 生成主题摘要
│  └─ 发现知识之间的隐含联系
│
├─ trend-detection()            — 识别知识和工作趋势
│  ├─ 最常接触的主题
│  ├─ 工作热点变化
│  └─ 活动模式分析
│
└─ pattern-recognition()        — 发现笔记模式
   ├─ 重复主题识别
   ├─ 内容相似度聚类
   └─ 知识演变追踪
```

使用示例：
- `analyze("know-gaps" in "projects")`  — 项目知识缺口
- `extract("insights" for last_7_days)` — 最近一周关键发现
- `trend("topics" in "areas")`          — 知识领域热度

#### 3. 🔗 多源信息整合

在 Obsidian、Claude Memory、Git 历史之间建立智能桥梁：

```
Multi-Source Integration:
├─ claude-memory ↔ vault
│  ├─ sync() — 双向同步（vault notes marked memory:true）
│  ├─ augment() — 用 Claude memory 增强 vault context
│  └─ gap-fill() — 识别缺失信息来源
│
├─ git-history ↔ vault
│  ├─ backfill-journal() — 从 git commits 补填日志
│  ├─ project-timeline() — 追踪项目演变（commits → vault）
│  └─ activity-trace() — 活动足迹关联
│
└─ cross-source-query()
   ├─ 同时搜索 vault + memory + git
   ├─ 融合多源结果排序
   └─ 生成统一的知识视图
```

高级搜索：
- `search("topic" in ["vault", "memory", "git"])`
- `context-for-topic("architecture", depth=3, sources="all")`
- `trace("project-evolution", span=last_90_days)`

#### 4. 🎯 Agent 自主决策能力

让 agent 基于 vault 状态和工作优先级自动做出决策：

```
Autonomous Decision Engine:
├─ next-action-recommendation()
│  ├─ 基于优先级、健康度、最近活动
│  ├─ 建议链接、归档、重构
│  └─ 提供执行或跳过选项
│
├─ priority-analyzer()
│  ├─ 工作优先级计算（recency + relevance + impact）
│  ├─ 识别阻塞项（uncompleted in active projects）
│  └─ 生成焦点排名
│
├─ health-driven-action()
│  ├─ 根据 health() 分数自动清理
│  ├─ 自动修复坏链接（relink with confidence > 0.8）
│  ├─ 合并过时重复笔记
│  └─ 清理已弃用标签
│
└─ context-aware-workflow()
   ├─ 根据当前会话上下文推荐工作
   ├─ 识别相关笔记自动注入
   └─ 建议相关项目切换
```

自主执行示例：
- Agent 在 session-start 时：自动检查优先级、建议焦点工作
- Agent 发现 health < 0.7 时：自动执行清理工作流
- Agent 发现孤岛笔记时：自动分析并建议关联或归档
- Agent 完成工作后：自动更新 vault 状态和 tomorrow 计划

### 使用建议

Agent 现在可以：
1. ✅ 完全自主管理 vault 健康（无需人工干预）
2. ✅ 主动发现和利用知识图谱中的机会
3. ✅ 跨源融合信息，提供统一的知识视图
4. ✅ 基于优先级和上下文自动调整工作流
5. ✅ 预测性维护（提前发现问题）

## 工作流速度优化

基于以上强化能力：

| 工作流 | 之前 | 之后 | 改进 |
|--------|------|------|------|
| 日常维护 | 手动 10-15min | 自动 <1min | ~90% 节省 |
| 知识搜索 | 单源 2-3min | 多源 <30s | 实时完整 |
| 焦点生成 | 手动决定 | AI 自主推荐 | 持续优化 |
| 链接优化 | 周回顾手工 | 每日自动 | 实时最优 |
| 优先级调整 | 月回顾评估 | 连续自适应 | 动态敏捷 |

## CLI Fallback

MCP 不支持的命令用 Bash（OA_VAULT 已通过 setup 配置）：

```bash
clausidian review                # 周回顾
clausidian review monthly        # 月回顾
clausidian hook daily-backfill   # 从 git 历史建日志
```
