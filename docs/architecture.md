# 架构说明

## 技术栈

- 前端：React + TypeScript + Vite
- UI：TailwindCSS + shadcn 风格基础组件
- 数据传输：Supabase Realtime（优先使用 WebSocket）+ TanStack Query 轮询兜底
- 变更与缓存：TanStack Query 乐观更新 + 回滚
- 渲染：HTML Canvas 棋盘（带静态层缓存）
- 数据库定时任务：Supabase Cron（`pg_cron`）

## 主要模块

- `src/hooks/use-gomoku-game.ts`
  - 鉴权初始化
  - 玩家公开对战 ID（`profiles.public_id`）的设置与更新
  - 邀请生命周期管理
  - 乐观落子与失败回滚
  - 回合倒计时与超时自动落子
  - Realtime 订阅与轮询兜底
  - 基于当前会话的活跃对局控制（不会自动续接旧对局）
- `src/components/game/*`
  - 面向对局的 UI 组件
- `src/components/game/gomoku-canvas.tsx`
  - 棋盘绘制流程
  - 静态棋盘缓存层 + 动态棋子层
- `src/components/ui/*`
  - 可复用的基础 UI 组件

## 同步策略

- 主通道：Supabase Realtime `postgres_changes`
- 兜底通道：TanStack Query `refetchInterval`
- 变更会先乐观写入本地 Query Cache，再等待服务端确认
- 当相关 Realtime 通道健康时关闭轮询，仅在实时同步不可用时启用轮询

## 落子一致性

- 客户端不再通过两次独立请求分别写入 `moves` 和 `games.current_turn`
- 服务端的 `public.play_move(...)` 会在一个数据库事务里完成回合校验、落子写入、胜负/平局判定和回合切换
- 在落子 mutation 执行期间，棋盘会临时锁定，防止同一回合内快速点击产生重复提交

## 对局生命周期

- 邀请被接受并创建 `games` 记录后，对局开始
- 对局结束后，客户端会显示结果状态（`Victory/Defeat/Draw`），释放该局 Realtime 连接，并清空当前会话中的活跃对局
- 想开始下一局必须重新发送邀请；页面重新打开时不会自动恢复上一局

## 数据维护

- `public.purge_app_data()` 会清空 `profiles`、`invites`、`games`、`moves` 和 `rematch_votes`
- 对于长期闲置的部署，Supabase Cron 会每 3 天执行一次清理
- 该维护任务不会删除 `auth.users`，这是刻意保留的
