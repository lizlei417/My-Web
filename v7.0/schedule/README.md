# 日程纪要（My-Web v7.0）

入口：`v7.0/index.html?page=schedule/index.html`

## Supabase 初始化

1. 保持使用 `v7.0/supabase-config.js` 中现有的项目 URL 和 anon public key。
2. 在该 Supabase 项目的 SQL Editor 中执行 [`schedule-setup.sql`](schedule-setup.sql)。
3. 不需要也不应把 `service_role` key 放入前端。

SQL 新建三张表：

- `schedule_series`：普通单次日程和重复 series。`recurrence_type` 为 `none`、`daily`、`weekly`、`biweekly` 或 `monthly`。
- `schedule_occurrence_overrides`：重复 occurrence 的 `deleted` / `modified` 例外；`series_id + occurrence_date` 唯一。
- `schedule_deadlines`：独立的 DDL，保存日期、标题、备注与完成状态。

三张表均带 `user_id`，已启用 RLS，并分别限制登录用户只能 select / insert / update / delete 自己的数据。SQL 同时创建日期索引、更新时间触发器和必要约束；可重复执行。

## 游客与未登录数据

未登录时页面可浏览当前周空表，但所有新增、编辑和删除入口都会请求 portal 打开登录面板，不会写本地数据。

游客数据仅写入当前浏览器，并固定使用以下隔离 key：

- `user:guest:schedule:series:v1`
- `user:guest:schedule:overrides:v1`
- `user:guest:schedule:deadlines:v1`

代码不会读取旧的全局 `scheduleEvents` 一类 key，也不会自动把游客数据迁移到邮箱账号。

## 重复规则与 occurrence

重复日程只保存一条 series。页面打开某周时，`core.js` 扫描该周七个本地日期，按规则动态生成 occurrence，不会预生成未来几年的记录。

- 每日：从 `start_date` 起每天出现。
- 每周：在指定星期出现。
- 每两周：以 `start_date` 所在周期为锚点，每隔两周出现。
- 每月：只在指定日出现；没有 29 / 30 / 31 日的月份直接跳过。

“仅删除此次”写入 `deleted` override；“仅修改此次”写入 `modified` override。“此次及之后”会把旧 series 的 `recurrence_until` 截到前一天，修改操作再从当前日期创建新 series，因此过去 occurrence 不受影响。

## 页面算法

- 日期始终用本地 `Date(year, monthIndex, day)` helper 处理，不解析裸 `YYYY-MM-DD` 为 UTC。
- 时间统一换算为 `0..1440` 分钟，再转换成纵向百分比。
- 同一天先按 interval 组成 overlap group，再为每组分配稳定 lane；整条日程在其完整持续时间内保持同一栏宽。
- DDL 不进入时间轴，日期右上角 `!` 仅代表该日仍有未完成 DDL。

## 文件

- `index.html`：页面结构与编辑浮层。
- `styles.css`：周表、响应式布局、低饱和视觉和 Apple 风格滚轮。
- `core.js`：可独立测试的日期、重复展开和 overlap 算法。
- `app.js`：渲染、交互、身份切换、guest / Supabase 持久化。
- `schedule-setup.sql`：Supabase 表、索引、约束、触发器与 RLS。
