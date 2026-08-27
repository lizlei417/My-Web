(function scheduleCoreFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ScheduleCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const DAY_MS = 86400000;
  const WEEKDAY_LABELS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
  const WEEK_VIEW_START_MINUTES = 6 * 60;
  const WEEK_VIEW_END_MINUTES = 24 * 60;
  const WEEK_VIEW_DURATION_MINUTES = WEEK_VIEW_END_MINUTES - WEEK_VIEW_START_MINUTES;

  function parseLocalDate(value) {
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    return formatDateKey(date) === value ? date : null;
  }

  function formatDateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function addDays(value, count) {
    const date = parseLocalDate(value) || parseLocalDate(formatDateKey(value));
    date.setDate(date.getDate() + count);
    return date;
  }

  function diffDays(fromValue, toValue) {
    const from = parseLocalDate(fromValue);
    const to = parseLocalDate(toValue);
    if (!from || !to) return NaN;
    return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
      - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / DAY_MS);
  }

  function mondayIndex(date) {
    return (date.getDay() + 6) % 7;
  }

  function startOfWeek(value) {
    const date = value instanceof Date ? parseLocalDate(value) : parseLocalDate(value);
    return addDays(date, -mondayIndex(date));
  }

  function weekDates(weekStart) {
    return Array.from({ length: 7 }, (_, index) => formatDateKey(addDays(weekStart, index)));
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function monthCalendar(year, monthIndex) {
    const normalized = new Date(Number(year), Number(monthIndex), 1, 12);
    const calendarYear = normalized.getFullYear();
    const calendarMonth = normalized.getMonth();
    const dayCount = daysInMonth(calendarYear, calendarMonth);
    const leading = mondayIndex(normalized);
    const cells = Array.from({ length: 42 }, (_, index) => {
      const day = index - leading + 1;
      if (day < 1 || day > dayCount) return null;
      return formatDateKey(new Date(calendarYear, calendarMonth, day, 12));
    });
    return { year: calendarYear, monthIndex: calendarMonth, dayCount, leading, cells };
  }

  function groupDeadlinesByDate(deadlineRows, year) {
    const prefix = `${Number(year)}-`;
    const grouped = new Map();
    (deadlineRows || []).forEach((deadline) => {
      const dateValue = String(deadline?.due_date || "");
      if (!dateValue.startsWith(prefix) || !parseLocalDate(dateValue)) return;
      if (!grouped.has(dateValue)) grouped.set(dateValue, []);
      grouped.get(dateValue).push(deadline);
    });
    grouped.forEach((rows) => rows.sort((a, b) => Number(a.completed) - Number(b.completed)
      || String(a.created_at || "").localeCompare(String(b.created_at || ""))));
    return grouped;
  }

  function timeToMinutes(value) {
    const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(value || ""));
    if (!match) return NaN;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours === 24 && minutes === 0) return 1440;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
    return hours * 60 + minutes;
  }

  function minutesToTime(total) {
    const minutes = Math.max(0, Math.min(1440, Math.round(Number(total) || 0)));
    if (minutes === 1440) return "24:00";
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }

  function matchesSeriesDate(series, dateValue) {
    const date = parseLocalDate(dateValue);
    const start = parseLocalDate(series.start_date);
    if (!date || !start || date < start) return false;
    if (series.recurrence_until && dateValue > series.recurrence_until) return false;
    const type = series.recurrence_type || "none";
    if (type === "none") return dateValue === series.start_date;
    if (type === "daily") return true;
    if (type === "weekly") return mondayIndex(date) === Number(series.recurrence_weekday);
    if (type === "biweekly") {
      return mondayIndex(date) === Number(series.recurrence_weekday)
        && Math.floor(diffDays(series.start_date, dateValue) / 7) % 2 === 0;
    }
    if (type === "monthly") return date.getDate() === Number(series.recurrence_monthday);
    return false;
  }

  function nextMatchingDate(dateValue, recurrenceType, recurrenceValue) {
    const start = parseLocalDate(dateValue);
    if (!start || recurrenceType === "none" || recurrenceType === "daily") return dateValue;
    if (recurrenceType === "weekly" || recurrenceType === "biweekly") {
      const offset = (Number(recurrenceValue) - mondayIndex(start) + 7) % 7;
      return formatDateKey(addDays(start, offset));
    }
    if (recurrenceType === "monthly") {
      const wanted = Number(recurrenceValue);
      for (let offset = 0; offset < 240; offset += 1) {
        const year = start.getFullYear() + Math.floor((start.getMonth() + offset) / 12);
        const month = (start.getMonth() + offset) % 12;
        if (wanted > daysInMonth(year, month)) continue;
        const candidate = new Date(year, month, wanted, 12);
        if (candidate >= start) return formatDateKey(candidate);
      }
    }
    return dateValue;
  }

  function applyOverride(series, dateValue, override) {
    if (override?.action === "deleted") return null;
    if (!override) return { ...series, occurrence_date: dateValue };
    if (override.action !== "modified") return { ...series, occurrence_date: dateValue };
    return {
      ...series,
      title: override.override_title ?? series.title,
      note: override.override_note ?? series.note,
      color: override.override_color ?? series.color,
      start_time: override.override_start_time ?? series.start_time,
      end_time: override.override_end_time ?? series.end_time,
      occurrence_date: dateValue,
      is_override: true,
    };
  }

  function expandWeek(seriesRows, overrideRows, weekStart) {
    const dates = weekDates(weekStart);
    const overrides = new Map((overrideRows || []).map((row) => [`${row.series_id}|${row.occurrence_date}`, row]));
    const occurrences = [];
    (seriesRows || []).forEach((series) => {
      dates.forEach((dateValue) => {
        if (!matchesSeriesDate(series, dateValue)) return;
        const occurrence = applyOverride(series, dateValue, overrides.get(`${series.id}|${dateValue}`));
        if (!occurrence) return;
        occurrences.push({
          ...occurrence,
          series_id: series.id,
          occurrence_date: dateValue,
          occurrence_id: `${series.id}|${dateValue}`,
          start_minutes: timeToMinutes(occurrence.start_time),
          end_minutes: timeToMinutes(occurrence.end_time),
        });
      });
    });
    return occurrences;
  }

  function layoutOverlap(events) {
    const sorted = [...events]
      .filter((event) => Number.isFinite(event.start_minutes)
        && Number.isFinite(event.end_minutes))
      .sort((a, b) => a.start_minutes - b.start_minutes || b.end_minutes - a.end_minutes || String(a.occurrence_id).localeCompare(String(b.occurrence_id)));
    const groups = [];
    let group = [];
    let groupEnd = -1;
    sorted.forEach((event) => {
      if (group.length && event.start_minutes >= groupEnd) {
        groups.push(group);
        group = [];
        groupEnd = -1;
      }
      group.push(event);
      groupEnd = Math.max(groupEnd, event.end_minutes);
    });
    if (group.length) groups.push(group);

    return groups.flatMap((members) => {
      const boundaries = members.flatMap((event) => [
        { minute: event.start_minutes, delta: 1 },
        { minute: event.end_minutes, delta: -1 },
      ]).sort((a, b) => a.minute - b.minute || a.delta - b.delta);
      let activeCount = 0;
      let maxConcurrency = 0;
      boundaries.forEach(({ delta }) => {
        activeCount += delta;
        maxConcurrency = Math.max(maxConcurrency, activeCount);
      });

      const laneEnds = [];
      const assigned = members.map((event) => {
        let lane = laneEnds.findIndex((end) => end <= event.start_minutes);
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = event.end_minutes;
        return { ...event, lane };
      });
      const laneCount = Math.max(1, maxConcurrency);
      return assigned.map((event) => ({ ...event, lane_count: laneCount }));
    });
  }

  function recurrenceLabel(series) {
    const type = series.recurrence_type || "none";
    if (type === "none") return "不重复";
    if (type === "daily") return "每日";
    if (type === "weekly") return `每周 · ${WEEKDAY_LABELS[Number(series.recurrence_weekday)]}`;
    if (type === "biweekly") return `每两周 · ${WEEKDAY_LABELS[Number(series.recurrence_weekday)]}`;
    if (type === "monthly") return `每月 · ${Number(series.recurrence_monthday)}日`;
    return "不重复";
  }

  return {
    WEEKDAY_LABELS,
    WEEK_VIEW_DURATION_MINUTES,
    WEEK_VIEW_END_MINUTES,
    WEEK_VIEW_START_MINUTES,
    addDays,
    daysInMonth,
    diffDays,
    expandWeek,
    formatDateKey,
    groupDeadlinesByDate,
    layoutOverlap,
    matchesSeriesDate,
    minutesToTime,
    mondayIndex,
    monthCalendar,
    nextMatchingDate,
    parseLocalDate,
    recurrenceLabel,
    startOfWeek,
    timeToMinutes,
    weekDates,
  };
});
