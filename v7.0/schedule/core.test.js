const assert = require("node:assert/strict");
const Core = require("./core.js");

const monday = Core.startOfWeek("2026-08-23");
assert.equal(Core.formatDateKey(monday), "2026-08-17", "周日仍应回到同周周一");
assert.deepEqual(Core.weekDates(Core.startOfWeek("2026-12-31")), [
  "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
]);
assert.equal(Core.timeToMinutes("14:15"), 855);
assert.equal(Core.timeToMinutes("24:00"), 1440);
assert.equal(Core.nextMatchingDate("2026-02-01", "monthly", 31), "2026-03-31");
assert.equal(Core.nextMatchingDate("2028-02-01", "monthly", 29), "2028-02-29");
assert.equal(Core.nextMatchingDate("2026-08-18", "weekly", 0), "2026-08-24");
assert.equal(Core.formatDateKey(Core.startOfWeek("2026-08-19")), "2026-08-17", "选择周三后应跳到该周周一");
assert.equal(Core.formatDateKey(Core.startOfWeek("2028-02-29")), "2028-02-28", "闰日应正确落到所在周");
assert.equal(Core.daysInMonth(2025, 1), 28, "2025 年二月应为 28 天");
assert.equal(Core.daysInMonth(2028, 1), 29, "2028 闰年二月应为 29 天");
assert.deepEqual(Core.monthCalendar(2026, 7).cells.slice(0, 7), [
  null, null, null, null, null, "2026-08-01", "2026-08-02",
], "年度月历应以周一为第一列");
assert.equal(Core.monthCalendar(2028, 1).cells.filter(Boolean).at(-1), "2028-02-29", "闰年年度月历应包含 2 月 29 日");
assert.equal(Core.monthCalendar(2026, 12).cells.find(Boolean), "2027-01-01", "跨年月份归一化应正确");
for (const year of [2025, 2026, 2027, 2028]) {
  for (let month = 0; month < 12; month += 1) {
    const calendar = Core.monthCalendar(year, month);
    const dates = calendar.cells.filter(Boolean);
    assert.equal(dates.length, Core.daysInMonth(year, month), `${year}-${month + 1} 日期数量应正确`);
    assert.equal(calendar.leading, Core.mondayIndex(Core.parseLocalDate(dates[0])), `${year}-${month + 1} 首日列应正确`);
    assert.equal(dates[0], `${year}-${String(month + 1).padStart(2, "0")}-01`, `${year}-${month + 1} 首日 key 应正确`);
  }
}
const sharedDeadlines = [
  { id: "a", due_date: "2026-08-27", title: "Test DDL", completed: false, created_at: "2026-08-01" },
  { id: "b", due_date: "2026-08-27", title: "交房租", completed: true, created_at: "2026-08-02" },
  { id: "c", due_date: "2026-08-27", title: "银行预约", completed: false, created_at: "2026-08-03" },
  { id: "d", due_date: "2027-01-01", title: "跨年事项", completed: false, created_at: "2026-12-01" },
];
let groupedDeadlines = Core.groupDeadlinesByDate(sharedDeadlines, 2026);
assert.equal(groupedDeadlines.get("2026-08-27").length, 3, "同日多条 DDL 应共享同一个日期分组");
assert.deepEqual(groupedDeadlines.get("2026-08-27").map((row) => row.id), ["a", "c", "b"], "未完成 DDL 应排在已完成项之前");
assert.equal(groupedDeadlines.has("2027-01-01"), false, "年度索引不应混入相邻年份事项");
sharedDeadlines[0].title = "Test DDL 已修改";
assert.equal(Core.groupDeadlinesByDate(sharedDeadlines, 2026).get("2026-08-27")[0].title, "Test DDL 已修改", "重新渲染应读取统一数据源中的修改");
const afterDelete = sharedDeadlines.filter((row) => row.due_date !== "2026-08-27");
groupedDeadlines = Core.groupDeadlinesByDate(afterDelete, 2026);
assert.equal(groupedDeadlines.has("2026-08-27"), false, "删除当天最后一项后日期分组应消失");
const selectedAnchorNextWeek = Core.addDays("2026-08-19", 7);
assert.equal(Core.formatDateKey(selectedAnchorNextWeek), "2026-08-26", "下一周应保留所选日期的星期位置");
assert.equal(Core.formatDateKey(Core.startOfWeek(selectedAnchorNextWeek)), "2026-08-24", "下一周应从所选日期所在周继续计算");
const crossMonthAnchor = Core.parseLocalDate("2026-09-02");
assert.equal(crossMonthAnchor.getMonth(), 8, "跨月星期应以 anchorDate 所在的九月作为目标月份");
assert.deepEqual(Core.weekDates(Core.startOfWeek(crossMonthAnchor)), [
  "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06",
], "跨月周视图仍应保留完整七列日期");
const crossYearAnchor = Core.parseLocalDate("2027-01-01");
assert.equal(crossYearAnchor.getFullYear(), 2027, "跨年星期应以 anchorDate 所在的 2027 年作为目标年份");
assert.equal(crossYearAnchor.getMonth(), 0, "跨年星期应落入 anchorDate 所在的一月");
assert.deepEqual(Core.weekDates(Core.startOfWeek(crossYearAnchor)), [
  "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
], "跨年动画仍应保留完整七列日期");
function monthRowFor(dateValue) {
  const date = Core.parseLocalDate(dateValue);
  const cells = Core.monthCalendar(date.getFullYear(), date.getMonth()).cells;
  const index = cells.indexOf(dateValue);
  return cells.slice(Math.floor(index / 7) * 7, Math.floor(index / 7) * 7 + 7);
}
assert.deepEqual(monthRowFor("2026-08-21"), [
  "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23",
], "普通同月星期应精确落到年度月历的 17 至 23 日行");
assert.deepEqual(monthRowFor("2026-09-02"), [
  null, "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06",
], "跨月目标行应保留周一空 cell，月外 8 月 31 日由 overlay 临时承接");
assert.deepEqual(monthRowFor("2027-01-01"), [
  null, null, null, null, "2027-01-01", "2027-01-02", "2027-01-03",
], "跨年目标行应落入 anchorDate 所在的一月并保留四个空 cell");

const daily = {
  id: "daily", title: "每日", start_date: "2026-08-19", start_time: "08:00", end_time: "08:30",
  recurrence_type: "daily",
};
assert.deepEqual(Core.expandWeek([daily], [], "2026-08-17").map((item) => item.occurrence_date), [
  "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23",
]);

const weekly = {
  id: "weekly", title: "每周一", start_date: "2026-08-01", start_time: "09:00", end_time: "10:00",
  recurrence_type: "weekly", recurrence_weekday: 0,
};
assert.deepEqual(
  Core.expandWeek([weekly], [], "2026-08-17").map((item) => item.occurrence_date),
  ["2026-08-17"],
);

const biweekly = { ...weekly, id: "biweekly", title: "每两周三", start_date: "2026-08-19", recurrence_type: "biweekly", recurrence_weekday: 2 };
assert.equal(Core.expandWeek([biweekly], [], "2026-08-17").length, 1);
assert.equal(Core.expandWeek([biweekly], [], "2026-08-24").length, 0);
assert.equal(Core.expandWeek([biweekly], [], "2026-08-31")[0].occurrence_date, "2026-09-02");

const monthly31 = { ...weekly, id: "monthly", title: "每月31日", start_date: "2026-01-31", recurrence_type: "monthly", recurrence_weekday: null, recurrence_monthday: 31 };
assert.equal(Core.expandWeek([monthly31], [], "2026-03-30")[0].occurrence_date, "2026-03-31");
assert.equal(Core.expandWeek([monthly31], [], "2026-04-27").length, 0, "四月没有31日，必须跳过");
const monthly1 = { ...monthly31, id: "monthly-1", start_date: "2026-01-01", recurrence_monthday: 1 };
const monthly29 = { ...monthly31, id: "monthly-29", start_date: "2028-01-29", recurrence_monthday: 29 };
const monthly30 = { ...monthly31, id: "monthly-30", start_date: "2026-01-30", recurrence_monthday: 30 };
assert.equal(Core.expandWeek([monthly1], [], "2026-08-31")[0].occurrence_date, "2026-09-01");
assert.equal(Core.expandWeek([monthly29], [], "2028-02-28")[0].occurrence_date, "2028-02-29");
assert.equal(Core.expandWeek([monthly30], [], "2026-04-27")[0].occurrence_date, "2026-04-30");
assert.equal(Core.expandWeek([monthly30], [], "2026-02-23").length, 0, "二月没有30日，必须跳过");

const overridden = Core.expandWeek([weekly], [{
  series_id: "weekly", occurrence_date: "2026-08-17", action: "modified", override_title: "只改这次",
  override_start_time: "14:15", override_end_time: "14:30",
}], "2026-08-17")[0];
assert.equal(overridden.title, "只改这次");
assert.equal(overridden.start_minutes, 855);

assert.equal(Core.expandWeek([weekly], [{
  series_id: "weekly", occurrence_date: "2026-08-17", action: "deleted",
}], "2026-08-17").length, 0);
assert.equal(Core.expandWeek([{ ...weekly, recurrence_until: "2026-08-16" }], [], "2026-08-17").length, 0, "此次及之后删除应由 recurrence_until 截断");

function compactLayout(events) {
  return Core.layoutOverlap(events).map(({ occurrence_id, lane, lane_count }) => ({ occurrence_id, lane, lane_count }));
}

assert.deepEqual(compactLayout([
  { occurrence_id: "A", start_minutes: 510, end_minutes: 630 },
  { occurrence_id: "B", start_minutes: 570, end_minutes: 600 },
]), [
  { occurrence_id: "A", lane: 0, lane_count: 2 },
  { occurrence_id: "B", lane: 1, lane_count: 2 },
], "08:30–10:30 与 09:30–10:00 应固定为左右两栏");

assert.deepEqual(compactLayout([
  { occurrence_id: "A", start_minutes: 840, end_minutes: 1020 },
  { occurrence_id: "B", start_minutes: 900, end_minutes: 960 },
]), [
  { occurrence_id: "A", lane: 0, lane_count: 2 },
  { occurrence_id: "B", lane: 1, lane_count: 2 },
], "14:00–17:00 与 15:00–16:00 应固定为左右两栏");

assert.deepEqual(compactLayout([
  { occurrence_id: "A", start_minutes: 840, end_minutes: 1080 },
  { occurrence_id: "B", start_minutes: 900, end_minutes: 1020 },
  { occurrence_id: "C", start_minutes: 960, end_minutes: 990 },
]), [
  { occurrence_id: "A", lane: 0, lane_count: 3 },
  { occurrence_id: "B", lane: 1, lane_count: 3 },
  { occurrence_id: "C", lane: 2, lane_count: 3 },
], "三事件组的最大并发为 3，整组宽度必须固定为三栏");

assert.deepEqual(compactLayout([
  { occurrence_id: "A", start_minutes: 540, end_minutes: 600 },
  { occurrence_id: "B", start_minutes: 570, end_minutes: 630 },
  { occurrence_id: "C", start_minutes: 600, end_minutes: 660 },
]), [
  { occurrence_id: "A", lane: 0, lane_count: 2 },
  { occurrence_id: "B", lane: 1, lane_count: 2 },
  { occurrence_id: "C", lane: 0, lane_count: 2 },
], "间接重叠应保持同组两栏，端点相接不算同时重叠");

console.log("schedule core tests passed");
