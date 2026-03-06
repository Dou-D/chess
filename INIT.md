# 五子棋（网页端）开发执行 Prompt

你是本项目的全栈工程师。请按以下要求从 0 到 1 完成一个可部署的双人在线五子棋网页应用。

## 目标

- 构建一个前端网页小游戏：五子棋（15x15 棋盘）。
- 使用 Supabase 作为后端（数据库 + Realtime + 行级权限）。
- 支持双人对战邀请流程：
  1. 玩家 A 输入玩家 B 的用户 ID 发起邀请。
  2. 玩家 B 同意邀请。
  3. 双方进入同一局房间并开始对局。
- 前端通过 GitHub Actions 自动部署。
- 使用 Cloudflare 免费 CDN 加速（推荐部署到 Cloudflare Pages）。
- 包管理器固定为 pnpm。

## 技术栈约束

- 前端：Vite + React + TypeScript。
- 状态与网络：`@supabase/supabase-js`。
- 样式：原生 CSS（响应式，移动端可用）。
- 构建工具：pnpm。

## 核心功能清单

1. 用户系统

- 使用 Supabase Auth 匿名登录（或邮箱登录，匿名优先以降低使用门槛）。
- 首屏展示当前用户 ID，支持一键复制。

2. 对战邀请

- 输入对方 ID，创建 `pending` 邀请。
- 被邀请方实时收到邀请。
- 被邀请方可点击“同意”或“拒绝”。
- 同意后生成一局 `games` 记录，并写入黑白双方玩家 ID。

3. 游戏对局

- 15x15 棋盘，黑棋先手。
- 仅轮到自己时可落子。
- 每次落子写入 Supabase（`moves` 表），双方实时同步。
- 自动判定胜负（五子连线：横/竖/斜）。
- 对局结束后显示结果并禁止继续落子。

4. 稳定性与体验

- 断线重连后可恢复当前对局状态。
- 防重复落子、防越权落子（前端校验 + RLS）。
- 有基础错误提示（网络错误、权限错误、邀请失效）。

## 数据库设计（Supabase）

- `profiles`：`id (uuid, pk)`、`created_at`
- `invites`：
  - `id (uuid, pk)`
  - `from_user (uuid)`
  - `to_user (uuid)`
  - `status (text: pending/accepted/rejected/cancelled)`
  - `game_id (uuid, nullable)`
  - `created_at`
- `games`：
  - `id (uuid, pk)`
  - `black_player (uuid)`
  - `white_player (uuid)`
  - `status (text: waiting/playing/finished)`
  - `winner (uuid, nullable)`
  - `current_turn (uuid)`
  - `created_at`
- `moves`：
  - `id (bigint, pk)`
  - `game_id (uuid)`
  - `player_id (uuid)`
  - `x (int)`
  - `y (int)`
  - `move_index (int)`
  - `created_at`

## 安全要求（必须实现）

- 对所有表开启 RLS。
- 邀请读写仅允许邀请双方访问。
- 对局读写仅允许黑白双方访问。
- 落子 insert policy：
  - 仅游戏参与者可写入。
  - 仅在 `games.status='playing'` 且 `current_turn=auth.uid()` 时允许。
  - 坐标需在合法范围（可在 DB 约束或前端+触发器双重限制）。

## 实施步骤（执行顺序）

1. 初始化项目

- 使用 pnpm 创建 Vite React TS 项目。
- 安装依赖：`@supabase/supabase-js`。

2. 配置 Supabase

- 编写 `supabase/schema.sql`（表、索引、RLS、policy）。
- 在 Supabase SQL Editor 执行。
- 配置前端环境变量：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。

3. 实现业务模块

- `auth`：匿名登录并缓存会话。
- `invite`：发送、订阅、同意/拒绝邀请。
- `game`：加载棋局、落子、胜负判断、实时同步。

4. UI 页面

- 顶部：当前用户 ID。
- 左侧：发起邀请区域（输入对方 ID + 发送）。
- 右侧：收到的邀请列表（同意/拒绝）。
- 下方：棋盘与对局状态（谁执子、轮到谁、胜者）。

5. 部署链路

- GitHub Actions：
  - `pnpm install`
  - `pnpm build`
  - 上传 `dist` 并部署到 Cloudflare Pages
- 在 GitHub Secrets 配置 Cloudflare 凭据。

6. 验收标准

- 两个浏览器（或隐私窗口）使用不同用户 ID 可互相邀请。
- 对方同意后立即进入同一局并实时落子。
- 非自己回合无法落子。
- 一方五连后正确结束对局。
- 推送到 `main` 分支后自动部署成功，Cloudflare Pages URL 可访问。

## 输出要求

- 提供完整项目目录与关键文件代码。
- 提供 Supabase SQL 一键执行脚本。
- 提供 GitHub Actions 与 Cloudflare Pages 的配置说明。
- 明确列出需要人工操作的步骤（例如创建 Supabase 项目、填写 Secrets）。
