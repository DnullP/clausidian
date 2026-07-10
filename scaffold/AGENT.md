# Obsidian Vault — Claude Code 集成

本 vault 与 Claude Code 深度整合。AI agent 通过以下方式操作 vault：

- **MCP 工具**（推荐）：使用 `/obsidian` skill 或直接调用 clausidian MCP 工具
- **CLI 命令**：终端执行 `clausidian` 命令
- **Hooks 自动化**：`session-start` / `pre-tool-use` / `session-stop` 自动捕获上下文

## 行为准则

在操作本 vault 之前，**必须先阅读 [[CONVENTIONS]]**。核心约定：

1. **创建词条**用 `clausidian note "标题" resource/wiki/<topic>` 或 MCP `mcp__clausidian__note(type="resource/wiki/<topic>")`（创建在 `resources/wiki/<topic>/` 下），创建文章用 `resource`（创建在 `resources/` 下），不直接 Write 文件。**词条禁止用裸 `type="resource"`——会落到文章区而非 wiki 区。**
2. **文件名英文，标题中文**，别名至少一个（aliases 硬约束）
3. **移动词条始终在 `resources/wiki/` 内**，子目录移动用 `clausidian move`
4. **修改笔记**优先用 `clausidian patch` 或 `clausidian update`
5. **重命名**用 `clausidian rename`（自动更新所有 `[[引用]]`）
6. **修改后**更新 `updated` 字段
7. **建立链接**用 `clausidian link` 自动发现，或手动加 `[[link]]`

## Vault 结构

| 目录 | 用途 |
|------|------|
| `resources/wiki/` | 原子词条笔记（Wiki 词条，受词条规范约束） |
| `resources/` | 文章（长篇深度阅读，结构自由，不受词条模板约束） |
| `areas/` | MOC 聚合页（概念网络的入口索引） |
| `projects/` | 研究专题 / 有明确产出的项目 |
| `journal/` | 每日日志、周/月回顾 |
| `ideas/` | 碎片想法、快速捕捉 |

## 快速上手

```bash
# 读取笔记
clausidian read "note-name"
clausidian read "note-name" --section "Discussion"

# 浏览 vault
clausidian list --type resource     # 列出所有词条
clausidian recent 7                 # 最近 7 天更新
clausidian stats                    # vault 统计概览
clausidian daily                    # 每日仪表盘

# 创建
clausidian journal                  # 今日日记
clausidian note "标题" resource/wiki/<topic>  # 创建词条（必须在 wiki 子目录下）
clausidian note "标题" resource               # 创建文章
clausidian capture "碎片想法"       # 快速捕捉

# 搜索与发现
clausidian search "关键词"          # 全文搜索
clausidian search "pattern" --regex # 正则搜索
clausidian backlinks "note-name"    # 反向链接
clausidian neighbors "note" --depth 3  # N 跳图谱探索
clausidian orphans                  # 孤岛笔记
clausidian random 3                 # 偶遇式发现
```

## 编辑与管理

```bash
# 编辑笔记
clausidian patch "note" --heading "Discussion" --append "新增内容"
clausidian patch "note" --heading "See Also" --append "[[related-note]]"  # 自动创建缺失标题
clausidian patch "note" --heading "Discussion" --after_line "关键洞见" --append "补充说明"  # 段落级精确定位
clausidian update "note" --status active --summary "更新摘要"
clausidian archive "old-note"
clausidian delete "obsolete-note"

# 标签
clausidian tag list
clausidian tag rename "old" "new"

# 重构
clausidian rename "old-name" "new-name"    # 重命名 + 更新所有引用
clausidian move "note" project             # 换类型/目录
clausidian merge "source" "target"         # 合并笔记
```

## 批量操作

```bash
clausidian batch tag --type resource --add "needs-review"
clausidian batch archive --tag "deprecated"
clausidian batch update --type project --set-status active
```

## 回顾与分析

```bash
clausidian review                   # 周回顾
clausidian review monthly           # 月回顾
clausidian agenda                   # 待办事项
clausidian timeline --days 7        # 活动时间线
clausidian changelog --days 14      # 变更日志
clausidian count                    # 字数/行数统计
clausidian suggest                  # 改进建议
clausidian focus                    # 下一步工作建议
```

## 链接与健康维护

```bash
# 智能链接
clausidian link --dry-run           # 预览缺失链接
clausidian link                     # 自动建立链接

# 修复
clausidian relink --dry-run         # 预览坏链修复
clausidian relink                   # 自动修复坏链
clausidian broken-links             # 查找断链

# 健康检查
clausidian health                   # vault 健康评分
clausidian validate                 # frontmatter 完整性
clausidian duplicates               # 重复笔记检测
clausidian graph                    # Mermaid 知识图谱

# 索引维护
clausidian sync                     # 重建索引
```

## 导入导出

```bash
clausidian export backup.json
clausidian import notes.json
```

## 收藏管理

```bash
clausidian pin "important-note"
clausidian pin list
clausidian unpin "important-note"
```

## 导航文件

- `_index.md` — vault 全局索引
- `_tags.md` — 标签索引
- `_graph.md` — 知识图谱
- `CONVENTIONS.md` — **写作规范（操作前必读）**
- `templates/` — 笔记模板

## 合规防线

Vault 操作受两层 hook 保护，确保规范执行：

| 阶段 | 机制 | 检查范围 |
|------|------|----------|
| SessionStart | `clausidian validate` | frontmatter 完整性 + wiki 词条专项检查 |
| PreToolUse | `enforce-clausidian.py` | Write/Edit → MCP；Bash 写需 `# clausidian-edit-ok: <原因>` |

MCP 工具可覆盖所有日常操作（aliases/related/maturity 等 frontmatter 已全面支持）。极少场景可通过 Bash 命令加准入标记绕过：
```bash
python3 fix-script.py  # clausidian-edit-ok: 运行自定义合规脚本
```

标记必须带具体原因（最少 5 字），不可用于 MCP 已覆盖的操作。

## 环境变量

- `OA_VAULT` — vault 路径（无需每次 `--vault`）
- `OA_TIMEZONE` — 时区（默认 UTC）

所有命令均支持 `--json` 输出机器可读格式。
