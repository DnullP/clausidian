# Clausidian

AI 智慧體用来管理 Obsidian 保险库的 CLI 工具组。零依赖。支持**所有** AI 智慧体——Claude Code、Cursor、Copilot、Cline、Windsurf、Codex 等等。

## 文件

| 文件 | 用途 |
|------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 系统设计、缓存层、性能优化 |
| [CHANGELOG.md](CHANGELOG.md) | 版本历史和发布说明 |
| [docs/](docs/README.md) | 测试计划、功能计划、分析报告 |
| [scaffold/AGENT.md](scaffold/AGENT.md) | 智慧体快速参考（命令、约定） |
| [skill/SKILL.md](skill/SKILL.md) | Claude Code 的 `/obsidian` 技能 |

## 为什么

AI 智慧体擅长管理知识，但需要结构。`clausidian` 提供：

- **结构化保险库**——带有 frontmatter 约定、模板和自动链接
- **CLI 接口**——任何智慧体都可以调用，无需特定于智慧体的集成
- **自动索引**——标签索引、知识图谱、目录索引
- **智慧体配置**——为 Claude Code、Cursor、Copilot 开箱即用生成

您的智慧体读取保险库的 `AGENT.md`，学习约定，并使用 `clausidian` CLI 创建笔记、日志、评论——所有内容都有正确的元数据和双向链接。

## 安装

```bash
npm install -g clausidian
```

## 快速开始

```bash
# 安装
npm install -g clausidian

# 初始化新保险库
clausidian init ~/my-vault
cd ~/my-vault

# 设置 Claude Code 集成（MCP 服务器 + /obsidian 技能）
clausidian setup ~/my-vault

# 创建今天的日志
clausidian journal

# 创建项目笔记
clausidian note "构建 API" project --tags "backend,api"

# 捕获想法
clausidian capture "使用向量搜索进行笔记检索"

# 搜索笔记
clausidian search "API" --type resource

# 列出活跃项目
clausidian list project --status active

# 生成周评
clausidian review

# 生成月评
clausidian review monthly

# 哪些笔记链接到这个？
clausidian backlinks "build-api"

# 更新笔记元数据
clausidian update "build-api" --status active --summary "核心 API"

# 归档已完成的项目
clausidian archive "old-project"

# 保险库统计
clausidian stats

# 生成 Mermaid 知识图谱
clausidian graph

# 查找孤立笔记（无入站链接）
clausidian orphans

# 标签管理
clausidian tag list
clausidian tag rename "old-tag" "new-tag"

# 重建索引
clausidian sync

# 重命名笔记（更新所有引用）
clausidian rename "build-api" "API Gateway"

# 移动笔记到不同类型
clausidian move "my-idea" project

# 合并两个笔记
clausidian merge "draft-api" "build-api"

# 查找重复笔记
clausidian duplicates --threshold 0.4

# 查找损坏的链接
clausidian broken-links

# 批量操作
clausidian batch tag --type idea --add "needs-review"
clausidian batch archive --tag "deprecated"
clausidian batch update --type project --set-status active

# 导出 / 导入
clausidian export vault-backup.json
clausidian export --format markdown --type project
clausidian import notes.json

# 正则表达式搜索
clausidian search "API.*v[23]" --regex

# 智能链接
clausidian link --dry-run          # 预览缺失链接
clausidian link                    # 创建双向链接

# 活动时间线
clausidian timeline --days 7
clausidian timeline --type project

# 保险库质量
clausidian validate
clausidian relink --dry-run        # 预览损坏链接修复
clausidian relink                  # 自动修复损坏链接

# 标记收藏
clausidian pin "important-note"
clausidian pin list
clausidian unpin "important-note"

# 每日仪表板
clausidian daily

# 改进建议
clausidian suggest

# 字数统计
clausidian count
clausidian count --type project

# 待办事项
clausidian agenda
clausidian agenda --all

# 保险库变更日志
clausidian changelog --days 14

# 图谱探索
clausidian neighbors "my-project" --depth 3

# 随机抽取
clausidian random 3
clausidian random --type idea

# 下一步工作建议
clausidian focus
```

## 保险库结构

初始化后，您的保险库如下所示：

```
my-vault/
├── areas/          # 长期重点领域
├── projects/       # 具体项目及目标
├── resources/      # 参考资料
├── journal/        # 日常日志和周评
├── ideas/          # 草稿想法
├── templates/      # 笔记模板（{{}} 占位符）
├── _index.md       # 保险库索引
├── _tags.md        # 标签→笔记映射（自动生成）
├── _graph.md       # 知识图谱（自动生成）
├── CONVENTIONS.md  # 编写和智慧体规则
├── AGENT.md        # 智慧体指令
├── .claude/commands/  # Claude Code 斜杠命令
├── .cursor/rules/     # Cursor 规则
└── .github/copilot/   # Copilot 指令
```

## 工作原理

### 对人类
1. 在 Obsidian 中打开保险库
2. 在保险库目录中启动您的 AI 智慧体
3. 智慧体读取 `AGENT.md` 并知道如何操作

### 对智慧体
智慧体使用 CLI 命令管理笔记：

```bash
# 智慧体在您的终端中运行这些命令
clausidian note "学习 Rust" project --tags "coding,learning"
clausidian capture "新功能想法"
clausidian sync
```

每个命令：
- 创建有正确 frontmatter 的笔记
- 自动查找和链接相关笔记
- 更新标签索引 (`_tags.md`) 和知识图谱 (`_graph.md`)
- 维护双向 `related` 链接

### Frontmatter 架构

每个笔记都有结构化的 YAML frontmatter：

```yaml
---
title: "我的笔记"
type: project          # area | project | resource | journal | idea
tags: [backend, api]
created: 2026-03-27
updated: 2026-03-27
status: active         # active | draft | archived
summary: "用于智慧体检索的单行描述"
related: ["[[other-note]]", "[[another-note]]"]
---
```

## 命令

| 命令 | 描述 |
|------|------|
| `init <path>` | 初始化新保险库和智慧体配置 |
| `journal` | 创建/打开今天的日志条目 |
| `note <title> <type>` | 创建笔记（area/project/resource/idea） |
| `capture <idea>` | 快速将想法捕获到 `ideas/` |
| `read <note>` | 读取笔记的完整内容（支持 `--section`） |
| `recent [days]` | 显示最近更新的笔记（默认：7 天） |
| `delete <note>` | 删除笔记并清理引用 |
| `search <keyword>` | 全文搜索所有笔记 |
| `list [type]` | 列出带筛选器的笔记 |
| `review` | 从日志生成周评 |
| `review monthly` | 从周评和日志生成月评 |
| `sync` | 重建 `_tags.md` 和 `_graph.md` 索引 |
| `backlinks <note>` | 显示链接到给定笔记的笔记 |
| `update <note>` | 更新笔记 frontmatter（状态、标签、摘要） |
| `archive <note>` | 将笔记状态设置为归档 |
| `stats` | 显示保险库统计（计数、热门标签、孤立笔记） |
| `graph` | 生成 Mermaid 知识图谱图 |
| `orphans` | 查找无入站链接的笔记 |
| `tag list` | 列出所有标签及计数 |
| `tag rename <old> <new>` | 在整个保险库中重命名标签 |
| `patch <note>` | 按标题编辑特定部分（`--heading`、`--append/--prepend/--replace`） |
| `rename <note> <title>` | 重命名笔记并更新所有引用 |
| `move <note> <type>` | 将笔记移动到不同类型/目录 |
| `merge <source> <target>` | 将源笔记合并到目标（正文 + 标签 + 引用） |
| `duplicates` | 按相似度查找潜在重复笔记 |
| `broken-links` | 查找指向不存在笔记的损坏 `[[wikilinks]]` |
| `batch update` | 批量更新匹配笔记（`--set-status`、`--set-summary`） |
| `batch tag` | 批量添加/删除标签（`--add`、`--remove`） |
| `batch archive` | 批量归档匹配笔记 |
| `export [output]` | 导出笔记为 JSON 或 markdown（`--format json\|markdown`） |
| `import <file>` | 从 JSON 或 markdown 文件导入笔记 |
| `link` | 自动链接相关但未链接的笔记（`--dry-run`、`--threshold`） |
| `timeline` | 按时间顺序显示活动订阅源（`--days`、`--type`、`--limit`） |
| `validate` | 检查 frontmatter 完整性并查找问题 |
| `pin <note>` | 将笔记标记为收藏 |
| `unpin <note>` | 取消标记笔记 |
| `pin list` | 显示所有已标记笔记 |
| `relink` | 用最近的匹配项修复损坏的链接（`--dry-run`） |
| `suggest` | 可操作的保险库改进建议（孤立笔记、陈旧笔记、标签合并） |
| `daily` | 每日仪表板（日志状态、活动、收藏、项目） |
| `count` | 字数/行数/笔记计数统计（`--type`） |
| `agenda` | 日志和项目中的待办事项（`--days`、`--all`） |
| `changelog [output]` | 从最近活动生成保险库变更日志（`--days`） |
| `neighbors <note>` | 显示 N 跳内连接的笔记（`--depth`） |
| `random [count]` | 随机抽取笔记进行巧合评论 |
| `focus` | 建议下一步工作（标记 > 动力 > 陈旧 > 想法） |
| `health` | 保险库健康评分（完整性、连接性、新鲜度、组织） |
| `setup [vault-path]` | 为 Claude Code 安装 MCP 服务器和 `/obsidian` 技能 |
| `watch` | 文件更改时自动重建索引 |
| `serve` | 启动 MCP 服务器（stdio 传输） |
| `hook <event>` | 处理智慧体 hook 事件 |

### 标志

| 标志 | 描述 |
|------|------|
| `--vault <path>` | 保险库根目录（默认：cwd 或 `$OA_VAULT`） |
| `--type <type>` | 按笔记类型筛选 |
| `--tag <tag>` | 按标签筛选 |
| `--status <status>` | 按状态筛选 |
| `--recent <days>` | 显示最近 N 天更新的笔记 |
| `--date <YYYY-MM-DD>` | 指定日期进行日志/评论 |
| `--year <YYYY>` | 月评年份 |
| `--month <MM>` | 月评月份（1-12） |
| `--summary <text>` | 设置笔记摘要（用于更新） |
| `--tags <a,b,c>` | 设置标签（用于笔记/更新） |
| `--regex` | 将搜索关键字视为正则表达式模式 |
| `--threshold <0-1>` | 重复相似度阈值（默认：0.5） |
| `--format <json\|md>` | 导出格式（默认：json） |
| `--set-status <status>` | 批量更新新状态 |
| `--add <tag>` | 要添加的标签（批量标签） |
| `--remove <tag>` | 要删除的标签（批量标签） |
| `--all` | 扫描所有笔记以获取日程（不仅仅是最近的） |
| `--depth <N>` | 邻接图的最大跳数（默认：2） |
| `--dry-run` | 预览更改而不应用（用于链接、重新链接） |
| `--days <N>` | 时间线查看回溯天数（默认：30） |
| `--limit <N>` | 时间线的最大条目数（默认：50） |

## 模糊笔记查找

接受笔记名称的命令支持模糊匹配——无需键入确切文件名：

```bash
# 精确
clausidian read build-api

# 不区分大小写
clausidian read Build-API

# 部分匹配
clausidian read vector          # 找到 "vector-search"

# 标题匹配
clausidian read "Build API"     # 找到 "build-api"
```

适用于：`read`、`delete`、`update`、`archive`、`patch`、`backlinks`、`rename`、`move`、`merge`、`pin`、`unpin`。

## 搜索相关性

搜索结果按相关性分数排列：

| 匹配位置 | 分数 |
|---------|------|
| 标题 | 10 |
| 文件名 | 8 |
| 标签 | 5 |
| 摘要 | 3 |
| 正文 | 1 |

```bash
clausidian search "API"         # 标题匹配首先出现
clausidian search "API.*v2" --regex   # 正则表达式模式匹配
```

## JSON 输出

所有命令都支持 `--json` 以获得机器可读的输出：

```bash
clausidian search "API" --json
clausidian stats --json
clausidian list project --status active --json
```

## 标题级编辑

在不重写整个文件的情况下编辑笔记的特定部分：

```bash
# 追加到部分
clausidian patch "my-project" --heading "TODO" --append "- [ ] 新任务"

# 替换部分内容
clausidian patch "my-project" --heading "Notes" --replace "更新的笔记"

# 读取部分
clausidian patch "my-project" --heading "TODO"
```

## Claude Code 设置（一条命令）

```bash
clausidian setup ~/my-vault
```

这会自动：
1. 将 `/obsidian` 技能安装到 `~/.claude/skills/obsidian/`
2. 在 `~/.claude/.mcp.json` 中注册 MCP 服务器
3. 重启后，在任何 Claude Code 会话中输入 `/obsidian` 以管理您的保险库

## MCP 服务器

作为 [MCP](https://modelcontextprotocol.io/) 服务器运行，供 AI 助手使用（Claude Desktop、Cursor 等）：

```json
{
  "mcpServers": {
    "clausidian": {
      "command": "clausidian",
      "args": ["serve", "--vault", "/path/to/vault"]
    }
  }
}
```

公开 44 个工具：journal、note、capture、search、list、read、recent、delete、backlinks、update、archive、patch、stats、orphans、graph、health、sync、tag_list、tag_rename、rename、move、merge、duplicates、broken_links、batch_update、batch_tag、batch_archive、export、neighbors、random、focus 等。

## 保险库健康

```bash
clausidian health
```

在 4 个维度上评分您的保险库（每个 0-100）：
- **完整性** — frontmatter 质量（标题、类型、标签、摘要、创建时间）
- **连接性** — 笔记之间的链接和关系
- **新鲜度** — 笔记最近更新的时间
- **组织** — 标签、类型、命名约定、摘要

## 智慧体 Hook

与您的智慧体 hook 系统集成以进行自动日志记录：

### Claude Code

添加到您的 Claude Code 设置（`~/.claude/settings.json`）：

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "clausidian hook session-stop --vault ~/my-vault"
          }
        ]
      }
    ]
  }
}
```

### Cron / LaunchD

```bash
# 每日反填 — 从 git 历史创建日志
clausidian hook daily-backfill --vault ~/my-vault --scan-root ~/projects

# 周评
clausidian review --vault ~/my-vault

# 月评
clausidian review monthly --vault ~/my-vault
```

## 知识沉淀（v0.9+）

五个自动规则帮助知识从日志沉淀到永久笔记中：

| 规则 | 命令 | 作用 |
|------|------|------|
| A1：提升建议 | `review` | 扫描周日志以查找出现 2+ 天的主题→建议提升为项目/资源 |
| A2：想法温度 | `health` | 跟踪想法新鲜度：新建、活跃、冻结（14 天）、归档（30 天） |
| A3：陈旧检测 | `review monthly` | 标记资源 >60 天陈旧、活跃项目 >30 天休眠、死亡想法 |
| A4：结论提取 | `hook session-stop` | 基于内容自动用 #conclusion 或 #resolved 标记日志 |
| A5：链接建议 | `sync` | 查找共享 2+ 标签但缺失相关链接的笔记对 |

这些规则作为现有命令的一部分自动运行——无需额外设置。随着时间推移，它们确保您的保险库保持组织：想法被提升或归档、陈旧笔记被标记、笔记之间的连接被浮出水面。

## 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `OA_VAULT` | 默认保险库路径 | cwd |
| `OA_TIMEZONE` | 日期时区 | UTC |

## 智慧体兼容性

`clausidian init` 为多个智慧体生成配置文件：

| 智慧体 | 配置位置 |
|--------|---------|
| Claude Code | `.claude/commands/`（斜杠命令） |
| Cursor | `.cursor/rules/obsidian.md` |
| GitHub Copilot | `.github/copilot/instructions.md` |
| 任何智慧体 | `AGENT.md`（通用指令） |

所有智慧体都读取 `AGENT.md`，它告诉他们使用 `clausidian` CLI。无需特定于智慧体的代码。

## 自定义

### 模板
编辑 `templates/` 中的文件以自定义笔记结构。使用 `{{PLACEHOLDER}}` 语法。

### 约定
编辑 `CONVENTIONS.md` 以更改 frontmatter 规则、命名约定或智慧体行为。

### 语言
模板用英语提供。将模板内容替换为您首选的语言——CLI 只关心 `{{}}` 占位符，不关心内容语言。

## 从 obsidian-agent 迁移

如果您从 `obsidian-agent` 升级：

```bash
npm uninstall -g obsidian-agent
npm install -g clausidian
```

CLI 命令和保险库结构完全兼容——只有二进制名称改变了。

## 开发

```bash
npm test
```

需要 Node.js >= 18。测试使用 `node:test` ——零开发依赖。

## 许可证

MIT
