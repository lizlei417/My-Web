(() => {
  "use strict";

  const Core = window.ScheduleCore;
  const config = window.SUPABASE_CONFIG || {};
  let portalClient = null;
  try {
    if (window.parent !== window) portalClient = window.parent.portalSupabaseClient || null;
  } catch {}
  const db = portalClient || (window.supabase && config.url && config.anonKey
    ? window.supabase.createClient(config.url, config.anonKey)
    : null);
  const TABLES = {
    series: "schedule_series",
    overrides: "schedule_occurrence_overrides",
    deadlines: "schedule_deadlines",
  };
  const GUEST_SESSION_KEY = "portalGuestSession";
  const LOCAL_KEYS = {
    series: "user:guest:schedule:series:v1",
    overrides: "user:guest:schedule:overrides:v1",
    deadlines: "user:guest:schedule:deadlines:v1",
  };
  const COLORS = [
    ["pink", "樱粉", "#e9a7ad"],
    ["orange", "杏橙", "#e8b184"],
    ["yellow", "奶黄", "#dcc86e"],
    ["mint", "薄荷", "#9fcfac"],
    ["blue", "浅蓝", "#7fa9eb"],
    ["lavender", "薰衣草", "#a995dc"],
    ["purple", "雾紫", "#c99add"],
  ];
  const COLOR_MAP = Object.fromEntries(COLORS.map(([key, , value]) => [key, value]));
  const PERIOD_OPTIONS = [
    { value: "daily", label: "日" },
    { value: "weekly", label: "周" },
    { value: "biweekly", label: "两周" },
    { value: "monthly", label: "月" },
  ];
  const TIME_HOUR_OPTIONS = Array.from({ length: 24 }, (_, value) => ({ value, label: String(value).padStart(2, "0") }));
  const TIME_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, value) => ({ value, label: String(value).padStart(2, "0") }));
  const MONTH_NAMES = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ];
  const YEAR_MONTH_NAMES = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月",
  ];
  const YEAR_WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
  const EMOJIS = ["📍", "👤", "👥", "📚", "💻", "📝", "📞", "☕", "🍚", "🚇", "🛒", "🏃", "🎬", "⭐", "❤️"];
  const $ = (selector) => document.querySelector(selector);
  const elements = {
    weekRange: $("#weekRange"), weekHeader: $("#weekHeader"), timeAxis: $("#timeAxis"),
    daysGrid: $("#daysGrid"), previousWeek: $("#previousWeek"),
    nextWeek: $("#nextWeek"), todayWeek: $("#todayWeek"), hoverCard: $("#hoverCard"),
    weekView: $("#weekView"), yearView: $("#yearView"), yearGrid: $("#yearGrid"),
    viewSwitcher: $("#viewSwitcher"), viewButtons: [...document.querySelectorAll("[data-schedule-view]")],
    weekActions: $("#weekActions"), yearActions: $("#yearActions"),
    previousYear: $("#previousYear"), currentYear: $("#currentYear"), nextYear: $("#nextYear"),
    yearControlLabel: $("#yearControlLabel"),
    dateJump: $("#dateJump"), dateJumpTrigger: $("#dateJumpTrigger"), dateJumpLabel: $("#dateJumpLabel"),
    dateJumpPanel: $("#dateJumpPanel"), dateJumpMonthTitle: $("#dateJumpMonthTitle"),
    dateJumpGrid: $("#dateJumpGrid"), dateJumpPendingLabel: $("#dateJumpPendingLabel"),
    dateJumpPrevYear: $("#dateJumpPrevYear"), dateJumpPrevMonth: $("#dateJumpPrevMonth"),
    dateJumpNextMonth: $("#dateJumpNextMonth"), dateJumpNextYear: $("#dateJumpNextYear"),
    dateJumpCancel: $("#dateJumpCancel"), dateJumpConfirm: $("#dateJumpConfirm"),
    deadlinePopover: $("#deadlinePopover"), deadlineDateTitle: $("#deadlineDateTitle"),
    deadlineList: $("#deadlineList"), addDeadline: $("#addDeadline"), eventDialog: $("#eventDialog"),
    eventForm: $("#eventForm"), eventDialogTitle: $("#eventDialogTitle"), eventTitle: $("#eventTitle"),
    eventStart: $("#eventStart"), eventEnd: $("#eventEnd"), colorPicker: $("#colorPicker"),
    eventStartTrigger: $("#eventStartTrigger"), eventEndTrigger: $("#eventEndTrigger"),
    eventStartLabel: $("#eventStartLabel"), eventEndLabel: $("#eventEndLabel"),
    timePickerPanel: $("#timePickerPanel"), timePickerTitle: $("#timePickerTitle"),
    timeHourWheel: $("#timeHourWheel"), timeMinuteWheel: $("#timeMinuteWheel"),
    timePickerCancel: $("#timePickerCancel"), timePickerConfirm: $("#timePickerConfirm"),
    eventNote: $("#eventNote"), emojiToggle: $("#emojiToggle"), emojiPopup: $("#emojiPopup"),
    recurrenceToggle: $("#recurrenceToggle"), recurrenceSummary: $("#recurrenceSummary"),
    recurrencePanel: $("#recurrencePanel"), repeatEnabled: $("#repeatEnabled"), wheelPicker: $("#wheelPicker"),
    periodWheel: $("#periodWheel"), valueWheel: $("#valueWheel"), eventError: $("#eventError"),
    deleteEvent: $("#deleteEvent"), deadlineDialog: $("#deadlineDialog"), deadlineForm: $("#deadlineForm"),
    deadlineDialogTitle: $("#deadlineDialogTitle"), deadlineSelectedDate: $("#deadlineSelectedDate"),
    deadlineTitle: $("#deadlineTitle"), deadlineNote: $("#deadlineNote"), deadlineError: $("#deadlineError"),
    deadlineEmojiToggle: $("#deadlineEmojiToggle"), deadlineEmojiPopup: $("#deadlineEmojiPopup"),
    deleteDeadline: $("#deleteDeadline"), choiceDialog: $("#choiceDialog"), choiceTitle: $("#choiceTitle"),
    choiceMessage: $("#choiceMessage"), choiceActions: $("#choiceActions"), choiceCancel: $("#choiceCancel"),
    toast: $("#toast"),
  };

  const state = {
    weekStart: Core.startOfWeek(new Date()), scheduleView: "week", year: new Date().getFullYear(),
    anchorDate: Core.formatDateKey(new Date()),
    selectedJumpDate: "", pendingJumpDate: "", dateJumpCursor: null,
    series: [], overrides: [], deadlines: [], identity: null, loadVersion: 0,
    selectedDeadlineDate: "", eventContext: null, deadlineContext: null,
    selectedColor: "blue", recurrence: { type: "none", value: 0 }, choiceResolve: null,
    deadlineCloseTimer: null, clockTimer: null, transition: null,
    timePickerTarget: null, timePickerDraft: "", expandedDeadlineIds: new Set(),
  };

  function uid(prefix) {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function nowIso() { return new Date().toISOString(); }

  function dateLabel(dateValue, includeYear = false) {
    const date = Core.parseLocalDate(dateValue);
    if (!date) return dateValue;
    return date.toLocaleDateString("zh-CN", {
      ...(includeYear ? { year: "numeric" } : {}), month: "long", day: "numeric",
    });
  }

  function fullDateLabel(dateValue) {
    const date = Core.parseLocalDate(dateValue);
    return `${dateLabel(dateValue, true)} ${Core.WEEKDAY_LABELS[Core.mondayIndex(date)]}`;
  }

  function dateJumpLabel(dateValue) {
    const date = Core.parseLocalDate(dateValue);
    if (!date) return "";
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function renderDateJumpLabel() {
    const value = dateJumpLabel(state.selectedJumpDate);
    elements.dateJumpLabel.textContent = value;
    elements.dateJumpTrigger.classList.toggle("has-value", Boolean(value));
    elements.dateJumpTrigger.setAttribute("aria-label", value ? `选择日期，当前 ${value}` : "选择日期");
  }

  function renderDateJumpCalendar() {
    const cursor = state.dateJumpCursor;
    if (!(cursor instanceof Date) || Number.isNaN(cursor.getTime())) return;
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1, 12).getDay();
    const dayCount = new Date(year, month + 1, 0, 12).getDate();
    const cellCount = Math.ceil((firstWeekday + dayCount) / 7) * 7;
    const today = Core.formatDateKey(new Date());
    const fragment = document.createDocumentFragment();

    elements.dateJumpMonthTitle.textContent = `${year}年 ${MONTH_NAMES[month]}`;
    for (let index = 0; index < cellCount; index += 1) {
      const day = index - firstWeekday + 1;
      if (day < 1 || day > dayCount) {
        const empty = document.createElement("span");
        empty.className = "calendar-empty";
        empty.setAttribute("aria-hidden", "true");
        fragment.append(empty);
        continue;
      }
      const dateValue = `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(day);
      button.dataset.date = dateValue;
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", fullDateLabel(dateValue));
      button.setAttribute("aria-selected", String(dateValue === state.pendingJumpDate));
      button.classList.toggle("today", dateValue === today);
      button.classList.toggle("selected", dateValue === state.pendingJumpDate);
      button.addEventListener("click", () => {
        state.pendingJumpDate = dateValue;
        renderDateJumpCalendar();
        elements.dateJumpGrid.querySelector(`[data-date="${dateValue}"]`)?.focus();
      });
      fragment.append(button);
    }
    elements.dateJumpGrid.replaceChildren(fragment);
    elements.dateJumpPendingLabel.textContent = state.pendingJumpDate;
  }

  function moveDateJumpMonth(monthDelta) {
    const cursor = state.dateJumpCursor;
    if (!(cursor instanceof Date) || Number.isNaN(cursor.getTime())) return;
    state.dateJumpCursor = new Date(cursor.getFullYear(), cursor.getMonth() + monthDelta, 1, 12);
    renderDateJumpCalendar();
  }

  function openDateJump() {
    const anchor = Core.parseLocalDate(state.selectedJumpDate || state.anchorDate)
      || Core.parseLocalDate(Core.formatDateKey(new Date()));
    state.pendingJumpDate = Core.formatDateKey(anchor);
    state.dateJumpCursor = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
    renderDateJumpCalendar();
    elements.dateJumpPanel.hidden = false;
    elements.dateJumpPanel.setAttribute("aria-hidden", "false");
    elements.dateJumpTrigger.setAttribute("aria-expanded", "true");
    setTimeout(() => {
      const selectedDay = elements.dateJumpGrid.querySelector(".selected");
      (selectedDay || elements.dateJumpPrevMonth).focus();
    }, 20);
  }

  function closeDateJump() {
    elements.dateJumpPanel.hidden = true;
    elements.dateJumpPanel.setAttribute("aria-hidden", "true");
    elements.dateJumpTrigger.setAttribute("aria-expanded", "false");
  }

  function applyDateJump() {
    const selectedDate = Core.parseLocalDate(state.pendingJumpDate);
    if (!selectedDate) return showToast("请选择有效日期");
    state.selectedJumpDate = state.pendingJumpDate;
    state.anchorDate = state.pendingJumpDate;
    state.weekStart = Core.startOfWeek(selectedDate);
    closeDateJump();
    renderSchedule();
  }

  function shiftWeek(dayCount) {
    const nextAnchor = Core.addDays(state.anchorDate, dayCount);
    state.anchorDate = Core.formatDateKey(nextAnchor);
    if (state.selectedJumpDate) state.selectedJumpDate = state.anchorDate;
    state.weekStart = Core.startOfWeek(nextAnchor);
    renderSchedule();
  }

  function goToToday() {
    const today = new Date();
    state.anchorDate = Core.formatDateKey(today);
    state.selectedJumpDate = "";
    state.pendingJumpDate = "";
    state.weekStart = Core.startOfWeek(today);
    closeDateJump();
    renderSchedule();
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => elements.toast.classList.remove("show"), 3200);
  }

  function applyTheme(theme) {
    if (!theme) return;
    const root = document.documentElement;
    if (theme.theme) root.style.setProperty("--theme", theme.theme);
    if (theme.deep) root.style.setProperty("--theme-deep", theme.deep);
    if (theme.soft) root.style.setProperty("--theme-soft", theme.soft);
    if (theme.rgb) root.style.setProperty("--theme-rgb", theme.rgb);
  }

  function requestLogin() {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "portal:request-login" }, "*");
    }
    showToast("请先选择邮箱登录或游客登录");
  }

  function identitySignature(identity) {
    return identity ? `${identity.isGuest ? "guest" : "account"}:${identity.id}` : "anonymous";
  }

  async function setIdentity(user) {
    const identity = user?.id ? {
      id: String(user.id), email: user.email || "", isGuest: Boolean(user.isGuest),
    } : null;
    if (identitySignature(identity) === identitySignature(state.identity)) return;
    if (state.transition) cleanupScheduleTransition(state.transition, state.transition.targetView);
    const version = ++state.loadVersion;
    state.identity = identity;
    state.series = [];
    state.overrides = [];
    state.deadlines = [];
    closeAllFloating();
    renderSchedule();
    if (!identity) return;
    if (identity.isGuest) {
      state.series = readGuest("series");
      state.overrides = readGuest("overrides");
      state.deadlines = readGuest("deadlines");
      if (version === state.loadVersion) renderSchedule();
      return;
    }
    if (!db) {
      showToast("Supabase 未配置，账号日程暂时无法读取");
      return;
    }
    await loadCloud(version);
  }

  function safeJson(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readGuest(kind) { return safeJson(LOCAL_KEYS[kind]); }
  function writeGuest(kind, rows) { localStorage.setItem(LOCAL_KEYS[kind], JSON.stringify(rows)); }

  async function loadCloud(version) {
    const userId = state.identity?.id;
    const requests = Object.entries(TABLES).map(async ([kind, table]) => {
      const query = db.from(table).select("*").eq("user_id", userId);
      const { data, error } = await query;
      if (error) throw Object.assign(error, { scheduleKind: kind });
      return [kind, data || []];
    });
    try {
      const rows = await Promise.all(requests);
      if (version !== state.loadVersion || state.identity?.id !== userId) return;
      rows.forEach(([kind, data]) => { state[kind] = data; });
      renderSchedule();
    } catch (error) {
      console.error("Schedule cloud load failed", error);
      showToast(`云端日程读取失败：${error.message || "请先执行建表 SQL"}`);
    }
  }

  function applyViewChrome(view) {
    const yearMode = view === "year";
    elements.weekView.hidden = yearMode;
    elements.yearView.hidden = !yearMode;
    elements.dateJump.hidden = yearMode;
    elements.weekActions.hidden = yearMode;
    elements.yearActions.hidden = !yearMode;
    elements.viewSwitcher.classList.toggle("is-year", yearMode);
    elements.viewButtons.forEach((button) => {
      const active = button.dataset.scheduleView === view;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("active", active);
    });
  }

  function renderSchedule() {
    if (state.transition) return;
    applyViewChrome(state.scheduleView);
    if (state.scheduleView === "year") renderYear();
    else renderWeek();
  }

  function setScheduleView(view) {
    if (!["week", "year"].includes(view) || state.scheduleView === view || state.transition) return;
    transitionScheduleView(view);
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function trackAnimation(token, element, keyframes, options) {
    if (!element?.animate) return null;
    const animation = element.animate(keyframes, { fill: "both", ...options });
    token.animations.push(animation);
    return animation;
  }

  function waitForAnimations(animations) {
    return Promise.all(animations.filter(Boolean).map((animation) => animation.finished.catch(() => null)));
  }

  function lockScheduleTransition(token) {
    state.transition = token;
    document.body.classList.add("schedule-transitioning");
    elements.viewSwitcher.setAttribute("aria-busy", "true");
    elements.viewButtons.forEach((button) => { button.disabled = true; });
  }

  function cleanupScheduleTransition(token, finalView = token?.targetView) {
    if (!token || state.transition !== token) return;
    token.animations.forEach((animation) => animation.cancel());
    token.sourceBoard?.classList.remove("calendar-fade-source");
    token.targetBoard?.classList.remove("calendar-fade-target");
    document.body.classList.remove("schedule-transitioning");
    elements.viewSwitcher.removeAttribute("aria-busy");
    elements.viewButtons.forEach((button) => { button.disabled = false; });
    state.scheduleView = finalView || state.scheduleView;
    state.transition = null;
    renderSchedule();
  }

  async function transitionScheduleView(targetView) {
    closeAllFloating();
    closeDateJump();
    const sourceView = state.scheduleView;
    if (targetView === "year") {
      const anchor = Core.parseLocalDate(state.anchorDate);
      state.year = anchor ? anchor.getFullYear() : new Date().getFullYear();
      renderYear();
    } else {
      renderWeek();
    }
    const token = {
      sourceView, targetView,
      sourceBoard: sourceView === "week" ? elements.weekView : elements.yearView,
      targetBoard: targetView === "week" ? elements.weekView : elements.yearView,
      animations: [],
    };
    lockScheduleTransition(token);
    try {
      applyViewChrome(targetView);
      elements.weekView.hidden = false;
      elements.yearView.hidden = false;
      token.sourceBoard.classList.add("calendar-fade-source");
      token.targetBoard.classList.add("calendar-fade-target");
      await nextFrame();
      if (state.transition !== token) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const duration = reduceMotion ? 60 : 180;
      const easing = "cubic-bezier(.2,.7,.3,1)";
      const animations = [
        trackAnimation(token, token.sourceBoard, [
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: reduceMotion ? "translateY(0)" : "translateY(-2px)" },
        ], { duration, easing }),
        trackAnimation(token, token.targetBoard, [
          { opacity: 0, transform: reduceMotion ? "translateY(0)" : "translateY(2px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration, easing }),
      ];
      await waitForAnimations(animations);
    } catch (error) {
      console.error("Schedule view transition failed", error);
    } finally {
      cleanupScheduleTransition(token, targetView);
    }
  }

  function shiftYear(delta) {
    state.year += delta;
    closeAllFloating();
    renderSchedule();
  }

  function goToCurrentYear() {
    state.year = new Date().getFullYear();
    closeAllFloating();
    renderSchedule();
  }

  function renderWeek() {
    const dates = Core.weekDates(state.weekStart);
    renderDateJumpLabel();
    renderWeekRange(dates);
    renderWeekHeader(dates);
    renderTimeAxis();
    renderDays(dates);
  }

  function deadlinesForYear(year) {
    return Core.groupDeadlinesByDate(state.deadlines, year);
  }

  function renderYear() {
    elements.weekRange.textContent = `${state.year} 年度概览`;
    elements.yearControlLabel.textContent = String(state.year);
    const today = Core.formatDateKey(new Date());
    const deadlineMap = deadlinesForYear(state.year);
    const fragment = document.createDocumentFragment();

    YEAR_MONTH_NAMES.forEach((monthName, monthIndex) => {
      const calendar = Core.monthCalendar(state.year, monthIndex);
      const month = document.createElement("section");
      month.className = "year-month";
      month.setAttribute("aria-labelledby", `year-month-${state.year}-${monthIndex}`);

      const title = document.createElement("h2");
      title.id = `year-month-${state.year}-${monthIndex}`;
      title.textContent = monthName;
      const weekdays = document.createElement("div");
      weekdays.className = "year-weekdays";
      weekdays.setAttribute("aria-hidden", "true");
      weekdays.replaceChildren(...YEAR_WEEKDAYS.map((label, index) => {
        const item = document.createElement("span");
        item.textContent = label;
        if (index > 4) item.className = "weekend";
        return item;
      }));
      const days = document.createElement("div");
      days.className = "year-days";
      days.setAttribute("role", "grid");
      days.setAttribute("aria-label", `${state.year}年${monthIndex + 1}月`);

      const cells = calendar.cells.map((dateValue, index) => {
        if (!dateValue) {
          const empty = document.createElement("span");
          empty.className = "year-day-empty";
          empty.setAttribute("aria-hidden", "true");
          return empty;
        }
        const date = Core.parseLocalDate(dateValue);
        const rows = deadlineMap.get(dateValue) || [];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "year-day";
        button.dataset.date = dateValue;
        button.setAttribute("role", "gridcell");
        button.setAttribute("aria-label", `${fullDateLabel(dateValue)}${rows.length ? `，${rows.length} 个 DDL` : ""}`);
        button.classList.toggle("weekend", index % 7 > 4);
        button.classList.toggle("today", dateValue === today);
        button.classList.toggle("has-deadlines", rows.length > 0);
        button.classList.toggle("all-completed", rows.length > 0 && rows.every((row) => row.completed));
        const number = document.createElement("span");
        number.className = "year-day-number";
        number.textContent = String(date.getDate());
        button.append(number);
        button.addEventListener("click", () => {
          hideEventHover();
          if (!state.identity) return requestLogin();
          state.anchorDate = dateValue;
          state.weekStart = Core.startOfWeek(dateValue);
          state.selectedJumpDate = dateValue;
          openDeadlinePopover(dateValue, button);
        });
        if (rows.length) {
          button.addEventListener("pointerenter", () => showYearDeadlineHover(dateValue, rows, button));
          button.addEventListener("pointerleave", hideEventHover);
          button.addEventListener("focus", () => showYearDeadlineHover(dateValue, rows, button));
          button.addEventListener("blur", hideEventHover);
        }
        return button;
      });
      const weekRows = Array.from({ length: 6 }, (_, weekIndex) => {
        const row = document.createElement("div");
        row.className = "year-week-row";
        row.dataset.weekIndex = String(weekIndex);
        row.append(...cells.slice(weekIndex * 7, weekIndex * 7 + 7));
        return row;
      });
      days.replaceChildren(...weekRows);
      month.append(title, weekdays, days);
      fragment.append(month);
    });
    elements.yearGrid.replaceChildren(fragment);
  }

  function showYearDeadlineHover(dateValue, rows, anchor) {
    elements.hoverCard.innerHTML = "";
    elements.hoverCard.classList.add("year-deadline-preview");
    const title = document.createElement("strong");
    title.textContent = fullDateLabel(dateValue);
    const kicker = document.createElement("span");
    kicker.className = "year-hover-kicker";
    kicker.textContent = "DDL";
    elements.hoverCard.append(title, kicker);
    rows.slice(0, 3).forEach((row) => {
      const item = document.createElement("p");
      item.className = row.completed ? "completed" : "";
      item.textContent = `${row.completed ? "✓" : "•"} ${row.title}`;
      elements.hoverCard.append(item);
    });
    if (rows.length > 3) {
      const remaining = document.createElement("p");
      remaining.className = "year-hover-more";
      remaining.textContent = `还有 ${rows.length - 3} 项`;
      elements.hoverCard.append(remaining);
    }
    elements.hoverCard.hidden = false;
    positionFloating(elements.hoverCard, anchor.getBoundingClientRect(), { prefer: "right" });
  }

  function renderWeekRange(dates) {
    const start = Core.parseLocalDate(dates[0]);
    const end = Core.parseLocalDate(dates[6]);
    const sameYear = start.getFullYear() === end.getFullYear();
    elements.weekRange.textContent = sameYear
      ? `${dateLabel(dates[0], true)} — ${dateLabel(dates[6])}`
      : `${dateLabel(dates[0], true)} — ${dateLabel(dates[6], true)}`;
  }

  function renderWeekHeader(dates) {
    const today = Core.formatDateKey(new Date());
    const fragment = document.createDocumentFragment();
    const corner = document.createElement("div");
    corner.className = "corner-cell";
    fragment.append(corner);
    dates.forEach((dateValue, index) => {
      const date = Core.parseLocalDate(dateValue);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `day-heading${dateValue === today ? " today" : ""}`;
      button.dataset.date = dateValue;
      const unfinished = state.deadlines.some((item) => item.due_date === dateValue && !item.completed);
      button.innerHTML = `<span class="date">${date.getMonth() + 1}/${date.getDate()}</span><span class="weekday">${Core.WEEKDAY_LABELS[index]}</span>${unfinished ? '<span class="deadline-alert">!</span>' : ""}`;
      button.addEventListener("click", (event) => {
        if (!state.identity) return requestLogin();
        openDeadlinePopover(dateValue, event.currentTarget);
      });
      if (window.matchMedia("(hover: hover)").matches) {
        button.addEventListener("pointerenter", () => {
          if (state.identity) openDeadlinePopover(dateValue, button);
        });
        button.addEventListener("pointerleave", scheduleDeadlineClose);
      }
      fragment.append(button);
    });
    elements.weekHeader.replaceChildren(fragment);
  }

  function renderTimeAxis() {
    const fragment = document.createDocumentFragment();
    for (let hour = 0; hour <= 24; hour += 2) {
      const label = document.createElement("span");
      label.className = "time-label";
      label.style.top = `${(hour / 24) * 100}%`;
      label.textContent = `${String(hour).padStart(2, "0")}:00`;
      fragment.append(label);
    }
    elements.timeAxis.replaceChildren(fragment);
  }

  function renderDays(dates) {
    const today = Core.formatDateKey(new Date());
    const occurrences = Core.expandWeek(state.series, state.overrides, state.weekStart);
    const fragment = document.createDocumentFragment();
    dates.forEach((dateValue) => {
      const column = document.createElement("div");
      column.className = `day-column${dateValue === today ? " today" : ""}`;
      column.dataset.date = dateValue;
      column.setAttribute("aria-label", fullDateLabel(dateValue));
      column.addEventListener("click", (event) => {
        if (event.target.closest(".schedule-event")) return;
        const rect = column.getBoundingClientRect();
        const raw = Math.max(0, Math.min(1439, ((event.clientY - rect.top) / rect.height) * 1440));
        const start = Math.min(1425, Math.round(raw / 15) * 15);
        openEventEditor({ date: dateValue, startMinutes: start });
      });
      const layer = document.createElement("div");
      layer.className = "event-layer";
      const dayEvents = Core.layoutOverlap(occurrences.filter((item) => item.occurrence_date === dateValue));
      dayEvents.forEach((event) => layer.append(createEventBlock(event)));
      if (dateValue === today) layer.append(createCurrentTimeLine());
      column.append(layer);
      fragment.append(column);
    });
    elements.daysGrid.replaceChildren(fragment);
    scheduleClockRefresh();
  }

  function createEventBlock(event) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "schedule-event";
    const laneCount = Math.max(1, Number(event.lane_count) || 1);
    const laneIndex = Math.max(0, Math.min(laneCount - 1, Number(event.lane) || 0));
    const laneWidth = 100 / laneCount;
    const laneGap = 4;
    button.style.setProperty("--event-color", COLOR_MAP[event.color] || COLOR_MAP.blue);
    button.style.top = `${(event.start_minutes / 1440) * 100}%`;
    button.style.height = `${Math.max(0, ((event.end_minutes - event.start_minutes) / 1440) * 100)}%`;
    button.style.left = `calc(${laneIndex * laneWidth}% + ${laneGap / 2}px)`;
    button.style.width = `calc(${laneWidth}% - ${laneGap}px)`;
    button.dataset.lane = String(laneIndex);
    button.dataset.laneCount = String(laneCount);
    if (event.end_minutes - event.start_minutes === 60) button.classList.add("schedule-event--one-hour");
    button.title = `${event.title} ${event.start_time.slice(0, 5)}–${event.end_time.slice(0, 5)}`;
    const title = document.createElement("span");
    title.textContent = event.title;
    const time = document.createElement("time");
    time.className = "schedule-event-time";
    time.textContent = `${event.start_time.slice(0, 5)}-${event.end_time.slice(0, 5)}`;
    button.append(title, time);
    button.addEventListener("click", (clickEvent) => {
      clickEvent.stopPropagation();
      openEventEditor({ occurrence: event });
    });
    if (window.matchMedia("(hover: hover)").matches) {
      button.addEventListener("pointerenter", () => showEventHover(event, button));
      button.addEventListener("pointerleave", hideEventHover);
      button.addEventListener("focus", () => showEventHover(event, button));
      button.addEventListener("blur", hideEventHover);
    }
    return button;
  }

  function createCurrentTimeLine() {
    const now = new Date();
    const line = document.createElement("div");
    line.className = "current-time";
    line.style.top = `${((now.getHours() * 60 + now.getMinutes()) / 1440) * 100}%`;
    const label = document.createElement("time");
    label.textContent = Core.minutesToTime(now.getHours() * 60 + now.getMinutes());
    line.append(label);
    return line;
  }

  function scheduleClockRefresh() {
    clearTimeout(state.clockTimer);
    const delay = (60 - new Date().getSeconds()) * 1000 + 30;
    state.clockTimer = setTimeout(() => {
      if (!state.transition && state.scheduleView === "week"
        && Core.weekDates(state.weekStart).includes(Core.formatDateKey(new Date()))) renderWeek();
    }, delay);
  }

  function showEventHover(event, anchor) {
    const repeat = Core.recurrenceLabel(event);
    elements.hoverCard.innerHTML = "";
    elements.hoverCard.classList.remove("year-deadline-preview");
    const strong = document.createElement("strong");
    strong.textContent = event.title;
    const date = document.createElement("p");
    date.textContent = fullDateLabel(event.occurrence_date);
    const time = document.createElement("p");
    time.textContent = `${event.start_time.slice(0, 5)}–${event.end_time.slice(0, 5)}`;
    elements.hoverCard.append(strong, date, time);
    if (event.note) {
      const note = document.createElement("p");
      note.className = "event-hover-note";
      note.textContent = event.note;
      elements.hoverCard.append(note);
    }
    if ((event.recurrence_type || "none") !== "none") {
      const recurrence = document.createElement("p");
      recurrence.className = "repeat-line";
      recurrence.textContent = repeat;
      elements.hoverCard.append(recurrence);
    }
    elements.hoverCard.hidden = false;
    positionFloating(elements.hoverCard, anchor.getBoundingClientRect(), { prefer: "right" });
  }

  function hideEventHover() { elements.hoverCard.hidden = true; }

  function positionFloating(floating, rect, { prefer = "bottom" } = {}) {
    const gap = 8;
    const width = floating.offsetWidth || 286;
    const height = floating.offsetHeight || 180;
    let left = prefer === "right" ? rect.right + gap : rect.left + rect.width / 2 - width / 2;
    let top = prefer === "right" ? rect.top : rect.bottom + gap;
    if (left + width > window.innerWidth - 10) left = Math.max(10, rect.left - width - gap);
    if (left < 10) left = 10;
    if (top + height > window.innerHeight - 10) top = Math.max(10, rect.top - height - gap);
    floating.style.left = `${left}px`;
    floating.style.top = `${top}px`;
  }

  function openDeadlinePopover(dateValue, anchor) {
    clearTimeout(state.deadlineCloseTimer);
    if (state.selectedDeadlineDate !== dateValue) state.expandedDeadlineIds.clear();
    state.selectedDeadlineDate = dateValue;
    elements.deadlineDateTitle.textContent = fullDateLabel(dateValue);
    renderDeadlineList();
    elements.deadlinePopover.classList.add("open");
    elements.deadlinePopover.setAttribute("aria-hidden", "false");
    positionFloating(elements.deadlinePopover, anchor.getBoundingClientRect());
  }

  function scheduleDeadlineClose() {
    clearTimeout(state.deadlineCloseTimer);
    state.deadlineCloseTimer = setTimeout(closeDeadlinePopover, 220);
  }

  function closeDeadlinePopover() {
    state.expandedDeadlineIds.clear();
    elements.deadlinePopover.classList.remove("open");
    elements.deadlinePopover.setAttribute("aria-hidden", "true");
  }

  function renderDeadlineList() {
    const rows = state.deadlines
      .filter((item) => item.due_date === state.selectedDeadlineDate)
      .sort((a, b) => Number(a.completed) - Number(b.completed) || String(a.created_at).localeCompare(String(b.created_at)));
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "deadline-empty";
      empty.textContent = "这一天还没有 DDL";
      elements.deadlineList.replaceChildren(empty);
      return;
    }
    elements.deadlineList.replaceChildren(...rows.map((row) => {
      const item = document.createElement("article");
      item.className = `deadline-item${row.completed ? " completed" : ""}`;
      const check = document.createElement("button");
      check.type = "button";
      check.className = "deadline-check";
      check.textContent = row.completed ? "✓" : "";
      check.setAttribute("aria-label", row.completed ? "取消完成" : "标记完成");
      check.addEventListener("click", () => toggleDeadline(row));
      const hasNote = Boolean(row.note?.trim());
      const copy = document.createElement(hasNote ? "button" : "div");
      copy.className = "deadline-copy";
      if (hasNote) {
        copy.type = "button";
        copy.setAttribute("aria-expanded", String(state.expandedDeadlineIds.has(row.id)));
      }
      const title = document.createElement("strong");
      title.textContent = row.title;
      copy.append(title);
      if (hasNote) {
        const note = document.createElement("p");
        note.className = "deadline-note";
        note.textContent = row.note;
        note.setAttribute("aria-hidden", String(!state.expandedDeadlineIds.has(row.id)));
        copy.append(note);
        copy.addEventListener("click", () => {
          const expanded = state.expandedDeadlineIds.has(row.id);
          if (expanded) state.expandedDeadlineIds.delete(row.id);
          else state.expandedDeadlineIds.add(row.id);
          note.setAttribute("aria-hidden", String(expanded));
          copy.setAttribute("aria-expanded", String(!expanded));
        });
      }
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "deadline-edit";
      edit.textContent = "···";
      edit.setAttribute("aria-label", "编辑 DDL");
      edit.addEventListener("click", () => openDeadlineEditor(row.due_date, row));
      item.append(check, copy, edit);
      return item;
    }));
  }

  function openDialog(layer) {
    layer.classList.add("open");
    layer.setAttribute("aria-hidden", "false");
  }

  function closeDialog(layer) {
    layer.classList.remove("open");
    layer.setAttribute("aria-hidden", "true");
  }

  function closeAllFloating() {
    hideEventHover();
    closeDeadlinePopover();
    closeDateJump();
    closeDialog(elements.eventDialog);
    closeDialog(elements.deadlineDialog);
    if (elements.choiceDialog.classList.contains("open")) resolveChoice(null);
    elements.emojiPopup.hidden = true;
  }

  function defaultColorKey() {
    let theme = null;
    try { theme = JSON.parse(localStorage.getItem("theme") || "null"); } catch {}
    const match = COLORS.find(([, , value]) => value.toLowerCase() === String(theme?.theme || "").toLowerCase());
    return match?.[0] || "blue";
  }

  function setColor(color) {
    state.selectedColor = COLOR_MAP[color] ? color : "blue";
    elements.colorPicker.querySelectorAll(".color-dot").forEach((button) => {
      button.classList.toggle("selected", button.dataset.color === state.selectedColor);
    });
  }

  function buildColorPicker() {
    elements.colorPicker.replaceChildren(...COLORS.map(([key, label, value]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-dot";
      button.dataset.color = key;
      button.style.setProperty("--dot", value);
      button.title = label;
      button.setAttribute("aria-label", label);
      button.addEventListener("click", () => setColor(key));
      return button;
    }));
  }

  function normalizePickerTime(value) {
    const minutes = Core.timeToMinutes(value);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes >= 1440) return "00:00";
    return Core.minutesToTime(minutes);
  }

  function setEventTime(target, value) {
    const normalized = normalizePickerTime(value);
    const input = target === "end" ? elements.eventEnd : elements.eventStart;
    const label = target === "end" ? elements.eventEndLabel : elements.eventStartLabel;
    input.value = normalized;
    label.textContent = normalized;
  }

  function updateTimePickerDraft(part, value) {
    const [hour, minute] = normalizePickerTime(state.timePickerDraft).split(":").map(Number);
    state.timePickerDraft = Core.minutesToTime((part === "hour" ? Number(value) : hour) * 60 + (part === "minute" ? Number(value) : minute));
  }

  function renderTimePicker() {
    const [hour, minute] = normalizePickerTime(state.timePickerDraft).split(":").map(Number);
    renderWheel(elements.timeHourWheel, TIME_HOUR_OPTIONS, hour, (value) => updateTimePickerDraft("hour", value));
    renderWheel(elements.timeMinuteWheel, TIME_MINUTE_OPTIONS, minute, (value) => updateTimePickerDraft("minute", value));
  }

  function openTimePicker(target) {
    const input = target === "end" ? elements.eventEnd : elements.eventStart;
    state.timePickerTarget = target;
    state.timePickerDraft = normalizePickerTime(input.value);
    elements.timePickerTitle.textContent = target === "end" ? "选择结束时间" : "选择开始时间";
    elements.timePickerPanel.hidden = false;
    elements.eventStartTrigger.setAttribute("aria-expanded", String(target === "start"));
    elements.eventEndTrigger.setAttribute("aria-expanded", String(target === "end"));
    elements.emojiPopup.hidden = true;
    renderTimePicker();
  }

  function closeTimePicker({ focus = false } = {}) {
    const target = state.timePickerTarget;
    elements.timePickerPanel.hidden = true;
    elements.eventStartTrigger.setAttribute("aria-expanded", "false");
    elements.eventEndTrigger.setAttribute("aria-expanded", "false");
    state.timePickerTarget = null;
    state.timePickerDraft = "";
    if (focus && target) (target === "end" ? elements.eventEndTrigger : elements.eventStartTrigger).focus();
  }

  function confirmTimePicker() {
    if (!state.timePickerTarget) return;
    const target = state.timePickerTarget;
    setEventTime(target, state.timePickerDraft);
    closeTimePicker({ focus: true });
  }

  function openEventEditor({ date, startMinutes = 540, occurrence = null }) {
    if (!state.identity) return requestLogin();
    hideEventHover();
    elements.eventForm.reset();
    elements.eventError.textContent = "";
    elements.recurrencePanel.hidden = true;
    elements.recurrenceToggle.setAttribute("aria-expanded", "false");
    elements.emojiPopup.hidden = true;
    closeTimePicker();
    if (occurrence) {
      const series = state.series.find((item) => item.id === occurrence.series_id);
      state.eventContext = { date: occurrence.occurrence_date, occurrence, series };
      elements.eventDialogTitle.textContent = "编辑日程";
      elements.eventTitle.value = occurrence.title || "";
      setEventTime("start", occurrence.start_time.slice(0, 5));
      setEventTime("end", occurrence.end_time.slice(0, 5));
      elements.eventNote.value = occurrence.note || "";
      setColor(occurrence.color || "blue");
      state.recurrence.type = series?.recurrence_type || "none";
      state.recurrence.value = state.recurrence.type === "monthly"
        ? Number(series?.recurrence_monthday || Core.parseLocalDate(occurrence.occurrence_date).getDate())
        : Number(series?.recurrence_weekday ?? Core.mondayIndex(Core.parseLocalDate(occurrence.occurrence_date)));
      elements.repeatEnabled.checked = state.recurrence.type !== "none";
      elements.deleteEvent.hidden = false;
    } else {
      state.eventContext = { date };
      elements.eventDialogTitle.textContent = "添加日程";
      setEventTime("start", Core.minutesToTime(startMinutes));
      setEventTime("end", Core.minutesToTime(Math.min(1439, startMinutes + 60)));
      setColor(defaultColorKey());
      state.recurrence = { type: "none", value: Core.mondayIndex(Core.parseLocalDate(date)) };
      elements.repeatEnabled.checked = false;
      elements.deleteEvent.hidden = true;
    }
    renderRecurrenceControls();
    openDialog(elements.eventDialog);
    setTimeout(() => elements.eventTitle.focus(), 40);
  }

  function renderRecurrenceControls() {
    const enabled = elements.repeatEnabled.checked;
    if (!enabled) state.recurrence.type = "none";
    else if (state.recurrence.type === "none") state.recurrence.type = "weekly";
    elements.wheelPicker.hidden = !enabled;
    elements.recurrenceSummary.textContent = enabled ? recurrenceSummaryFromState() : "不重复";
    if (!enabled) return;
    renderWheel(elements.periodWheel, PERIOD_OPTIONS, state.recurrence.type, (value) => {
      const previous = state.recurrence.type;
      state.recurrence.type = value;
      const origin = Core.parseLocalDate(state.eventContext.date);
      if (value === "monthly" && previous !== "monthly") state.recurrence.value = origin.getDate();
      if ((value === "weekly" || value === "biweekly") && previous !== "weekly" && previous !== "biweekly") {
        state.recurrence.value = Core.mondayIndex(origin);
      }
      renderRecurrenceValueWheel();
      elements.recurrenceSummary.textContent = recurrenceSummaryFromState();
    });
    renderRecurrenceValueWheel();
  }

  function renderRecurrenceValueWheel() {
    if (state.recurrence.type === "daily") {
      elements.valueWheel.hidden = true;
      return;
    }
    elements.valueWheel.hidden = false;
    const options = state.recurrence.type === "monthly"
      ? Array.from({ length: 31 }, (_, index) => ({ value: index + 1, label: `${index + 1}日` }))
      : Core.WEEKDAY_LABELS.map((label, index) => ({ value: index, label }));
    const allowed = options.some((item) => Number(item.value) === Number(state.recurrence.value));
    if (!allowed) state.recurrence.value = options[0].value;
    renderWheel(elements.valueWheel, options, state.recurrence.value, (value) => {
      state.recurrence.value = Number(value);
      elements.recurrenceSummary.textContent = recurrenceSummaryFromState();
    });
  }

  function renderWheel(wheel, options, selectedValue, onChange) {
    wheel.onscroll = null;
    const nodes = options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `wheel-option${String(option.value) === String(selectedValue) ? " selected" : ""}`;
      button.dataset.value = option.value;
      button.textContent = option.label;
      button.addEventListener("click", () => selectWheelOption(wheel, options, option.value, onChange));
      return button;
    });
    wheel.replaceChildren(...nodes);
    const index = Math.max(0, options.findIndex((option) => String(option.value) === String(selectedValue)));
    requestAnimationFrame(() => { wheel.scrollTop = index * 36; });
    let timer;
    wheel.onscroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const nextIndex = Math.max(0, Math.min(options.length - 1, Math.round(wheel.scrollTop / 36)));
        selectWheelOption(wheel, options, options[nextIndex].value, onChange, false);
      }, 90);
    };
  }

  function selectWheelOption(wheel, options, value, onChange, smooth = true) {
    const index = options.findIndex((option) => String(option.value) === String(value));
    wheel.querySelectorAll(".wheel-option").forEach((node) => node.classList.toggle("selected", node.dataset.value === String(value)));
    wheel.scrollTo({ top: Math.max(0, index) * 36, behavior: smooth ? "smooth" : "auto" });
    onChange(value);
  }

  function recurrenceSummaryFromState() {
    const type = state.recurrence.type;
    if (type === "daily") return "每日";
    if (type === "weekly") return `每周 · ${Core.WEEKDAY_LABELS[state.recurrence.value]}`;
    if (type === "biweekly") return `每两周 · ${Core.WEEKDAY_LABELS[state.recurrence.value]}`;
    if (type === "monthly") return `每月 · ${state.recurrence.value}日`;
    return "不重复";
  }

  function eventPayload() {
    const recurrenceType = elements.repeatEnabled.checked ? state.recurrence.type : "none";
    const startDate = Core.nextMatchingDate(state.eventContext.date, recurrenceType, state.recurrence.value);
    return {
      user_id: state.identity.id,
      title: elements.eventTitle.value.trim(),
      note: elements.eventNote.value.trim(),
      color: state.selectedColor,
      start_date: startDate,
      start_time: elements.eventStart.value,
      end_time: elements.eventEnd.value,
      recurrence_type: recurrenceType,
      recurrence_weekday: ["weekly", "biweekly"].includes(recurrenceType) ? Number(state.recurrence.value) : null,
      recurrence_monthday: recurrenceType === "monthly" ? Number(state.recurrence.value) : null,
      recurrence_until: null,
      updated_at: nowIso(),
    };
  }

  function validateEvent(payload) {
    if (!payload.title) return "请填写日程标题";
    const start = Core.timeToMinutes(payload.start_time);
    const end = Core.timeToMinutes(payload.end_time);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "请输入合法的开始和结束时间";
    if (end <= start) return "结束时间必须晚于开始时间；跨午夜请拆成两个日程";
    return "";
  }

  async function saveEvent(event) {
    event.preventDefault();
    if (!state.identity) return requestLogin();
    if (!elements.timePickerPanel.hidden) confirmTimePicker();
    const payload = eventPayload();
    const error = validateEvent(payload);
    elements.eventError.textContent = error;
    if (error) return;
    const context = state.eventContext;
    try {
      if (!context.occurrence) {
        await createSeries(payload);
      } else if ((context.series?.recurrence_type || "none") === "none") {
        await updateSeries(context.series.id, payload);
      } else {
        const choice = await chooseOccurrenceAction("修改", [
          { value: "single", label: "仅修改此次" },
          { value: "future", label: "修改此次及之后" },
        ]);
        if (!choice) return;
        if (choice === "single") {
          await upsertOverride({
            user_id: state.identity.id,
            series_id: context.series.id,
            occurrence_date: context.occurrence.occurrence_date,
            action: "modified",
            override_title: payload.title,
            override_note: payload.note,
            override_color: payload.color,
            override_start_time: payload.start_time,
            override_end_time: payload.end_time,
            updated_at: nowIso(),
          });
        } else {
          const cutoff = Core.formatDateKey(Core.addDays(context.occurrence.occurrence_date, -1));
          await updateSeries(context.series.id, { recurrence_until: cutoff, updated_at: nowIso() });
          payload.start_date = Core.nextMatchingDate(context.occurrence.occurrence_date, payload.recurrence_type, state.recurrence.value);
          await createSeries(payload);
        }
      }
      closeDialog(elements.eventDialog);
      renderSchedule();
    } catch (saveError) {
      console.error("Schedule save failed", saveError);
      elements.eventError.textContent = saveError.message || "保存失败";
    }
  }

  async function createSeries(payload) {
    const row = { id: uid("series"), created_at: nowIso(), ...payload };
    if (state.identity.isGuest) {
      state.series.push(row);
      writeGuest("series", state.series);
      return row;
    }
    const { data, error } = await db.from(TABLES.series).insert({ ...payload, created_at: row.created_at }).select().single();
    if (error) throw error;
    state.series.push(data);
    return data;
  }

  async function updateSeries(id, patch) {
    if (state.identity.isGuest) {
      state.series = state.series.map((row) => row.id === id ? { ...row, ...patch } : row);
      writeGuest("series", state.series);
      return;
    }
    const { data, error } = await db.from(TABLES.series).update(patch).eq("id", id).eq("user_id", state.identity.id).select().single();
    if (error) throw error;
    state.series = state.series.map((row) => row.id === id ? data : row);
  }

  async function removeSeries(id) {
    if (state.identity.isGuest) {
      state.series = state.series.filter((row) => row.id !== id);
      state.overrides = state.overrides.filter((row) => row.series_id !== id);
      writeGuest("series", state.series);
      writeGuest("overrides", state.overrides);
      return;
    }
    const { error } = await db.from(TABLES.series).delete().eq("id", id).eq("user_id", state.identity.id);
    if (error) throw error;
    state.series = state.series.filter((row) => row.id !== id);
    state.overrides = state.overrides.filter((row) => row.series_id !== id);
  }

  async function upsertOverride(payload) {
    const existing = state.overrides.find((row) => row.series_id === payload.series_id && row.occurrence_date === payload.occurrence_date);
    const row = { id: existing?.id || uid("override"), created_at: existing?.created_at || nowIso(), ...existing, ...payload };
    if (state.identity.isGuest) {
      state.overrides = state.overrides.filter((item) => !(item.series_id === row.series_id && item.occurrence_date === row.occurrence_date));
      state.overrides.push(row);
      writeGuest("overrides", state.overrides);
      return;
    }
    const cloudPayload = { ...payload, created_at: row.created_at };
    const { data, error } = await db.from(TABLES.overrides)
      .upsert(cloudPayload, { onConflict: "series_id,occurrence_date" }).select().single();
    if (error) throw error;
    state.overrides = state.overrides.filter((item) => !(item.series_id === data.series_id && item.occurrence_date === data.occurrence_date));
    state.overrides.push(data);
  }

  async function deleteCurrentEvent() {
    const context = state.eventContext;
    if (!context?.occurrence || !state.identity) return;
    try {
      if ((context.series?.recurrence_type || "none") === "none") {
        const confirmed = await confirmDelete("删除日程", `确定删除「${context.occurrence.title}」吗？删除后无法恢复。`);
        if (!confirmed) return;
        await removeSeries(context.series.id);
      } else {
        const choice = await chooseOccurrenceAction("删除", [
          { value: "single", label: "仅删除此次" },
          { value: "future", label: "删除此次及之后" },
        ]);
        if (!choice) return;
        if (choice === "single") {
          await upsertOverride({
            user_id: state.identity.id,
            series_id: context.series.id,
            occurrence_date: context.occurrence.occurrence_date,
            action: "deleted",
            updated_at: nowIso(),
          });
        } else if (context.occurrence.occurrence_date <= context.series.start_date) {
          await removeSeries(context.series.id);
        } else {
          await updateSeries(context.series.id, {
            recurrence_until: Core.formatDateKey(Core.addDays(context.occurrence.occurrence_date, -1)),
            updated_at: nowIso(),
          });
        }
      }
      closeDialog(elements.eventDialog);
      renderSchedule();
    } catch (error) {
      console.error("Schedule delete failed", error);
      elements.eventError.textContent = error.message || "删除失败";
    }
  }

  function chooseOccurrenceAction(verb, actions) {
    return showChoiceDialog({
      title: "这是重复日程",
      message: `请选择要${verb}的范围。过去的日程不会被改变。`,
      actions,
    });
  }

  function confirmDelete(title, message) {
    return showChoiceDialog({
      title,
      message,
      actions: [{ value: "delete", label: "确认删除", danger: true }],
    }).then((choice) => choice === "delete");
  }

  function showChoiceDialog({ title, message, actions }) {
    elements.choiceTitle.textContent = title;
    elements.choiceMessage.textContent = message;
    elements.choiceActions.replaceChildren(...actions.map((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      if (action.danger) button.classList.add("danger-choice");
      button.addEventListener("click", () => resolveChoice(action.value));
      return button;
    }));
    return new Promise((resolve) => {
      state.choiceResolve = resolve;
      openDialog(elements.choiceDialog);
      setTimeout(() => elements.choiceActions.querySelector("button")?.focus(), 20);
    });
  }

  function resolveChoice(value) {
    closeDialog(elements.choiceDialog);
    const resolve = state.choiceResolve;
    state.choiceResolve = null;
    if (resolve) resolve(value);
  }

  function openDeadlineEditor(dateValue, row = null) {
    if (!state.identity) return requestLogin();
    state.deadlineContext = { date: dateValue, row };
    elements.deadlineForm.reset();
    elements.deadlineError.textContent = "";
    elements.deadlineDialogTitle.textContent = row ? "编辑 DDL" : "添加 DDL";
    elements.deadlineSelectedDate.textContent = fullDateLabel(dateValue);
    elements.deadlineTitle.value = row?.title || "";
    elements.deadlineNote.value = row?.note || "";
    elements.deadlineEmojiPopup.hidden = true;
    elements.deadlineEmojiToggle.setAttribute("aria-expanded", "false");
    elements.deleteDeadline.hidden = !row;
    closeDeadlinePopover();
    openDialog(elements.deadlineDialog);
    setTimeout(() => elements.deadlineTitle.focus(), 40);
  }

  async function saveDeadline(event) {
    event.preventDefault();
    if (!state.identity) return requestLogin();
    const context = state.deadlineContext;
    const title = elements.deadlineTitle.value.trim();
    if (!title) {
      elements.deadlineError.textContent = "请填写 DDL 名称";
      return;
    }
    const payload = {
      user_id: state.identity.id,
      due_date: context.date,
      title,
      note: elements.deadlineNote.value.trim(),
      completed: context.row?.completed || false,
      updated_at: nowIso(),
    };
    try {
      if (context.row) await updateDeadline(context.row.id, payload);
      else await createDeadline(payload);
      closeDialog(elements.deadlineDialog);
      renderSchedule();
    } catch (error) {
      console.error("Deadline save failed", error);
      elements.deadlineError.textContent = error.message || "保存失败";
    }
  }

  async function createDeadline(payload) {
    const row = { id: uid("ddl"), created_at: nowIso(), ...payload };
    if (state.identity.isGuest) {
      state.deadlines.push(row);
      writeGuest("deadlines", state.deadlines);
      return;
    }
    const { data, error } = await db.from(TABLES.deadlines).insert({ ...payload, created_at: row.created_at }).select().single();
    if (error) throw error;
    state.deadlines.push(data);
  }

  async function updateDeadline(id, patch) {
    if (state.identity.isGuest) {
      state.deadlines = state.deadlines.map((row) => row.id === id ? { ...row, ...patch } : row);
      writeGuest("deadlines", state.deadlines);
      return;
    }
    const { data, error } = await db.from(TABLES.deadlines).update(patch).eq("id", id).eq("user_id", state.identity.id).select().single();
    if (error) throw error;
    state.deadlines = state.deadlines.map((row) => row.id === id ? data : row);
  }

  async function toggleDeadline(row) {
    if (!state.identity) return requestLogin();
    try {
      await updateDeadline(row.id, { completed: !row.completed, updated_at: nowIso() });
      renderSchedule();
      renderDeadlineList();
    } catch (error) {
      console.error("Deadline toggle failed", error);
      showToast(`DDL 更新失败：${error.message || "未知错误"}`);
    }
  }

  async function deleteDeadline() {
    const row = state.deadlineContext?.row;
    if (!row) return;
    const confirmed = await confirmDelete("删除 DDL", `确定删除「${row.title}」吗？删除后无法恢复。`);
    if (!confirmed) return;
    try {
      if (state.identity.isGuest) {
        state.deadlines = state.deadlines.filter((item) => item.id !== row.id);
        writeGuest("deadlines", state.deadlines);
      } else {
        const { error } = await db.from(TABLES.deadlines).delete().eq("id", row.id).eq("user_id", state.identity.id);
        if (error) throw error;
        state.deadlines = state.deadlines.filter((item) => item.id !== row.id);
      }
      closeDialog(elements.deadlineDialog);
      renderSchedule();
    } catch (error) {
      console.error("Deadline delete failed", error);
      elements.deadlineError.textContent = error.message || "删除失败";
    }
  }

  function buildEmojiPopup(popup, toggle, input) {
    popup.replaceChildren(...EMOJIS.map((emoji) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = emoji;
      button.addEventListener("click", () => {
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        input.setRangeText(emoji, start, end, "end");
        input.focus();
        popup.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
      });
      return button;
    }));
  }

  function toggleEmojiPopup(popup, toggle, otherPopup, otherToggle) {
    const open = popup.hidden;
    otherPopup.hidden = true;
    otherToggle.setAttribute("aria-expanded", "false");
    popup.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  }

  function closeEmojiPopups() {
    elements.emojiPopup.hidden = true;
    elements.emojiToggle.setAttribute("aria-expanded", "false");
    elements.deadlineEmojiPopup.hidden = true;
    elements.deadlineEmojiToggle.setAttribute("aria-expanded", "false");
  }

  async function bootstrapIdentity() {
    let guest = false;
    try { guest = localStorage.getItem(GUEST_SESSION_KEY) === "1"; } catch {}
    if (guest) return setIdentity({ id: "guest", email: "游客", isGuest: true });
    if (!db) return setIdentity(null);
    const { data, error } = await db.auth.getSession();
    if (error) console.error("Schedule auth session failed", error);
    await setIdentity(data?.session?.user || null);
  }

  function bindEvents() {
    elements.viewButtons.forEach((button) => {
      button.addEventListener("click", () => setScheduleView(button.dataset.scheduleView));
    });
    elements.previousWeek.addEventListener("click", () => shiftWeek(-7));
    elements.nextWeek.addEventListener("click", () => shiftWeek(7));
    elements.todayWeek.addEventListener("click", goToToday);
    elements.previousYear.addEventListener("click", () => shiftYear(-1));
    elements.currentYear.addEventListener("click", goToCurrentYear);
    elements.nextYear.addEventListener("click", () => shiftYear(1));
    elements.dateJumpTrigger.addEventListener("click", () => {
      if (elements.dateJumpPanel.hidden) openDateJump();
      else closeDateJump();
    });
    elements.dateJumpPrevYear.addEventListener("click", () => moveDateJumpMonth(-12));
    elements.dateJumpPrevMonth.addEventListener("click", () => moveDateJumpMonth(-1));
    elements.dateJumpNextMonth.addEventListener("click", () => moveDateJumpMonth(1));
    elements.dateJumpNextYear.addEventListener("click", () => moveDateJumpMonth(12));
    elements.dateJumpCancel.addEventListener("click", closeDateJump);
    elements.dateJumpConfirm.addEventListener("click", applyDateJump);
    elements.eventStartTrigger.addEventListener("click", () => openTimePicker("start"));
    elements.eventEndTrigger.addEventListener("click", () => openTimePicker("end"));
    elements.timePickerCancel.addEventListener("click", () => closeTimePicker({ focus: true }));
    elements.timePickerConfirm.addEventListener("click", confirmTimePicker);
    elements.eventForm.addEventListener("submit", saveEvent);
    elements.deadlineForm.addEventListener("submit", saveDeadline);
    elements.deleteEvent.addEventListener("click", deleteCurrentEvent);
    elements.deleteDeadline.addEventListener("click", deleteDeadline);
    elements.addDeadline.addEventListener("click", () => openDeadlineEditor(state.selectedDeadlineDate));
    elements.deadlinePopover.addEventListener("pointerenter", () => clearTimeout(state.deadlineCloseTimer));
    elements.deadlinePopover.addEventListener("pointerleave", scheduleDeadlineClose);
    elements.deadlinePopover.querySelector("[data-close-deadlines]").addEventListener("click", closeDeadlinePopover);
    elements.recurrenceToggle.addEventListener("click", () => {
      const open = elements.recurrencePanel.hidden;
      elements.recurrencePanel.hidden = !open;
      elements.recurrenceToggle.setAttribute("aria-expanded", String(open));
    });
    elements.repeatEnabled.addEventListener("change", renderRecurrenceControls);
    elements.emojiToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleEmojiPopup(elements.emojiPopup, elements.emojiToggle, elements.deadlineEmojiPopup, elements.deadlineEmojiToggle);
    });
    elements.deadlineEmojiToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleEmojiPopup(elements.deadlineEmojiPopup, elements.deadlineEmojiToggle, elements.emojiPopup, elements.emojiToggle);
    });
    elements.choiceCancel.addEventListener("click", () => resolveChoice(null));
    document.querySelectorAll("[data-close-dialog]").forEach((button) => {
      button.addEventListener("click", () => {
        const layer = button.closest(".dialog-layer");
        if (layer === elements.eventDialog) closeTimePicker();
        closeDialog(layer);
      });
    });
    document.querySelectorAll(".dialog-layer").forEach((layer) => {
      layer.addEventListener("mousedown", (event) => {
        if (event.target !== layer) return;
        if (layer === elements.eventDialog) return;
        if (layer === elements.choiceDialog) resolveChoice(null);
        else closeDialog(layer);
      });
    });
    document.addEventListener("click", (event) => {
      const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (!event.target.closest("#emojiPopup, #emojiToggle, #deadlineEmojiPopup, #deadlineEmojiToggle")) closeEmojiPopups();
      if (!event.target.closest("#deadlinePopover, .day-heading, .year-day")) closeDeadlinePopover();
      if (!eventPath.includes(elements.dateJump) && !event.target.closest("#dateJump")) closeDateJump();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (elements.eventDialog.classList.contains("open")) {
        if (!elements.timePickerPanel.hidden) closeTimePicker({ focus: true });
        return;
      }
      if (!elements.dateJumpPanel.hidden) return closeDateJump();
      if (elements.choiceDialog.classList.contains("open")) return resolveChoice(null);
      if (elements.deadlineDialog.classList.contains("open")) return closeDialog(elements.deadlineDialog);
      closeDeadlinePopover();
      hideEventHover();
    });
    window.addEventListener("message", (event) => {
      if (event.source !== window.parent || event.data?.type !== "portal:auth-state") return;
      setIdentity(event.data.user || null);
    });
    window.addEventListener("storage", (event) => {
      if (event.key === "theme" && event.newValue) {
        try { applyTheme(JSON.parse(event.newValue)); } catch {}
      }
      if ([GUEST_SESSION_KEY, "portalCurrentUserId", ...Object.values(LOCAL_KEYS)].includes(event.key)) bootstrapIdentity();
    });
    window.addEventListener("resize", () => {
      if (state.transition) cleanupScheduleTransition(state.transition, state.transition.targetView);
    });
    window.addEventListener("pagehide", () => {
      if (state.transition) cleanupScheduleTransition(state.transition, state.transition.targetView);
    });
    if (db) db.auth.onAuthStateChange((_event, session) => {
      const guest = localStorage.getItem(GUEST_SESSION_KEY) === "1";
      setIdentity(guest ? { id: "guest", email: "游客", isGuest: true } : session?.user || null);
    });
  }

  buildColorPicker();
  buildEmojiPopup(elements.emojiPopup, elements.emojiToggle, elements.eventNote);
  buildEmojiPopup(elements.deadlineEmojiPopup, elements.deadlineEmojiToggle, elements.deadlineNote);
  bindEvents();
  renderSchedule();
  bootstrapIdentity();
  if (window.parent !== window) window.parent.postMessage({ type: "portal:request-auth-state" }, "*");
})();
