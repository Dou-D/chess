# Supabase 配置与迁移说明

## 必需的数据表

- `profiles`
- `invites`
- `games`
- `moves`
- `rematch_votes`

必要字段：

- `profiles.public_id`（唯一，用于邀请时查找对方）

## 应用 Schema

在 Supabase 的 SQL Editor 中执行 `supabase/schema.sql`。

该 Schema 还会创建：

- `public.play_move(uuid, int, int)`：用于原子落子
- `public.purge_app_data()`：用于清空应用业务数据
- 一个名为 `purge-gomoku-app-data-every-3-days` 的 Supabase Cron 定时任务

## 已部署项目的迁移说明

如果你的项目已经使用过旧版 Schema，请重新执行完整的 `schema.sql`，或至少确认以下内容已存在：

- `alter table public.profiles add column public_id ...`
- `public_id` 的唯一索引
- `profiles` 的查询策略允许读取 `public_id` 非空的行

## Realtime 发布配置

请确保以下表已加入 `supabase_realtime` publication：

- `public.invites`
- `public.games`
- `public.moves`

快捷 SQL：

```sql
alter publication supabase_realtime add table public.invites;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.moves;
```

## 原子落子 RPC

前端现在通过 `public.play_move(...)` 完成落子，而不是手动执行以下两步：

1. 先写入 `public.moves`
2. 再更新 `public.games.current_turn`

也就是：

1. 先写入 `public.moves`
2. 再更新 `public.games.current_turn`

这样做的目的，是消除之前快速点击时可能在同一回合内提交多次落子的竞态窗口。

这个函数负责：

- 校验当前是否轮到该玩家
- 拒绝向已有棋子的格子落子
- 分配 `move_index`
- 写入本次落子
- 判定胜利或平局
- 更新 `games.current_turn` 或对局最终结果

## 定时清理

该 Schema 会启用 `pg_cron`，并注册以下定时任务：

- 任务名：`purge-gomoku-app-data-every-3-days`
- 调度表达式：`0 3 */3 * *`
- 时间基准：UTC

清理范围：

- `public.profiles`
- `public.invites`
- `public.games`
- `public.moves`
- `public.rematch_votes`

不会清理：

- `auth.users`

原因：

- 这样既能清空项目业务表，又能避免过于激进地删除 Supabase Auth 账号

如果你之后想停用这个任务，执行：

```sql
select cron.unschedule(jobid)
from cron.job
where jobname = 'purge-gomoku-app-data-every-3-days';
```

## 开源版本：关闭自动清库

对于开源复用场景来说，“每 3 天自动删除一次数据”通常不适合作为默认行为。

更推荐的做法是：

- 保留原子落子 RPC `public.play_move(...)`
- 仅移除定时清理任务
- 除非你的部署本身有明确的数据保留策略，否则保留历史对局数据

如果你已经执行过默认 `schema.sql`，但想切换到“不自动清库”的版本，可以执行：

```sql
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'purge-gomoku-app-data-every-3-days'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

drop function if exists public.purge_app_data();
```

可选：

```sql
drop extension if exists pg_cron;
```

只有在你的 Supabase 项目没有其他 Cron 任务时，才建议删除 `pg_cron` 扩展。

为什么这种版本更适合开源使用者：

- 避免在共享部署或公开部署中发生意外数据丢失
- 保留对局历史，方便调试和后续产品迭代
- 仍然保留原子落子修复、乐观更新体验和全部游戏逻辑

换句话说：

- `public.play_move(...)` 应当保留
- `public.purge_app_data()` 和 `purge-gomoku-app-data-every-3-days` 属于部署策略，可按需删除
