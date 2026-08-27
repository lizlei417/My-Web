(() => {
  "use strict";

  const STORAGE_NAME = "bookkeepingLedger:v1";
  const RATE_REFERENCE_DATE = "2026-08-26";
  const RATE_BASIS = `HKD@${RATE_REFERENCE_DATE}`;
  const CURRENCIES = {
    HKD: { name: "港币", symbol: "HK$", rate: 1, digits: 2 },
    CNY: { name: "人民币", symbol: "¥", rate: 1.166293, digits: 2 },
    USD: { name: "美元", symbol: "$", rate: 7.838118, digits: 2 },
    EUR: { name: "欧元", symbol: "€", rate: 9.1463, digits: 2 },
    JPY: { name: "日元", symbol: "¥", rate: 0.049274, digits: 0 },
    GBP: { name: "英镑", symbol: "£", rate: 10.683307, digits: 2 }
  };
  const CATEGORY_COLORS = ["#e49b76", "#78a9d8", "#8d9ee0", "#b18ec9", "#e78aa6", "#65ad9a", "#d98b8b", "#dfaa6d", "#6faac4", "#9b8ec9"];
  const CATEGORY_EMOJIS = ["🍜", "🍚", "☕", "🍎", "🛒", "🧴", "🧻", "👕", "🚇", "🚌", "🚕", "⛽", "🏠", "💡", "📱", "🎮", "🎬", "🎵", "📚", "✏️", "💊", "🏃", "✈️", "🐾", "🎁", "💼", "💻", "📈", "💰", "✨", "↩️", "🌱"];

  const DEFAULT_CATEGORIES = [
    { id: "exp-food", type: "expense", name: "饮食", icon: "🍜", color: "#e49b76", locked: false },
    { id: "exp-daily", type: "expense", name: "日用品", icon: "🧴", color: "#78a9d8", locked: false },
    { id: "exp-transport", type: "expense", name: "交通", icon: "🚇", color: "#8d9ee0", locked: false },
    { id: "exp-home", type: "expense", name: "居住", icon: "🏠", color: "#b18ec9", locked: false },
    { id: "exp-entertain", type: "expense", name: "娱乐", icon: "🎮", color: "#e78aa6", locked: false },
    { id: "exp-study", type: "expense", name: "学习", icon: "📚", color: "#65ad9a", locked: false },
    { id: "exp-health", type: "expense", name: "健康", icon: "💊", color: "#d98b8b", locked: false },
    { id: "exp-other", type: "expense", name: "其他", icon: "✨", color: "#a6adba", locked: true },
    { id: "inc-salary", type: "income", name: "工资", icon: "💼", color: "#67b89a", locked: false },
    { id: "inc-bonus", type: "income", name: "奖金", icon: "🎁", color: "#7facdf", locked: false },
    { id: "inc-invest", type: "income", name: "理财", icon: "📈", color: "#8c9fdf", locked: false },
    { id: "inc-parttime", type: "income", name: "兼职", icon: "💻", color: "#c28fc8", locked: false },
    { id: "inc-refund", type: "income", name: "退款", icon: "↩️", color: "#dfaa6d", locked: false },
    { id: "inc-other", type: "income", name: "其他", icon: "✨", color: "#a6adba", locked: true }
  ];

  const els = Object.fromEntries([
    "greetingText", "displayCurrencySelect", "rangePresets", "customRange", "rangeStart", "rangeEnd", "applyRangeButton", "rangeCaption",
    "expenseTotal", "incomeTotal", "expenseComparison", "incomeHint",
    "chartTypeControl", "categoryDonut", "donutLabel", "donutTotal", "categoryLegend", "insightText", "trendChart", "trendTitle", "trendPeriodControl", "trendZoomNote", "baseCurrencyNote",
    "transactionCount", "searchInput", "typeFilter", "categoryFilter", "convertedCurrencyHeader", "ledgerBody", "ledgerEmpty", "ledgerNoteTooltip",
    "addTransactionButton", "emptyAddButton", "railRecordButton", "manageCategoriesButton", "railCategoryButton", "resetDemoButton",
    "transactionDrawer", "drawerTitle", "transactionForm", "transactionId", "transactionTypeSwitch", "transactionType",
    "transactionTitle", "transactionAmount", "transactionCurrency", "ratePreview", "transactionDate",
    "transactionNote", "transactionError", "categoryPicker", "quickAddCategoryButton", "deleteTransactionButton",
    "categoryModal", "categoryManagerTabs", "categoryManagerList", "categoryEditorForm", "editingCategoryId", "categoryEditorCaption", "cancelCategoryEditButton",
    "categoryEmojiTrigger", "selectedCategoryEmoji", "categoryEmojiPopover", "newCategoryName", "saveCategoryButton",
    "confirmDialog", "confirmTitle", "confirmMessage", "confirmCancel", "confirmAccept", "toast"
  ].map((id) => [id, document.getElementById(id)]));

  const pad = (value) => String(value).padStart(2, "0");
  const localDateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const localDateTimeValue = (date = new Date()) => `${localDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const addDays = (date, amount) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next; };
  const atTime = (date, hours, minutes = 0) => { const next = new Date(date); next.setHours(hours, minutes, 0, 0); return localDateTimeValue(next); };
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const dateOnly = (dateTime) => String(dateTime || "").slice(0, 10);

  const rememberedPortalUser = () => {
    try {
      if (localStorage.getItem("portalGuestSession") === "1") return { id: "guest", email: "游客", isGuest: true };
      const id = localStorage.getItem("portalCurrentUserId") || "";
      if (!id) return null;
      return { id, email: localStorage.getItem("portalCurrentUserEmail") || "", isGuest: false };
    } catch {
      return null;
    }
  };

  let authUser = window.portalCurrentUser || rememberedPortalUser();
  let initialized = false;
  const currentStorageKey = () => authUser?.id ? `user:${authUser.id}:${STORAGE_NAME}` : "";

  const applyPortalTheme = (rawTheme = null) => {
    try {
      const theme = typeof rawTheme === "string"
        ? JSON.parse(rawTheme)
        : (rawTheme || JSON.parse(localStorage.getItem("theme") || "null"));
      if (!theme) return;
      const root = document.documentElement;
      if (theme.theme) root.style.setProperty("--theme", theme.theme);
      if (theme.deep) root.style.setProperty("--theme-deep", theme.deep);
      if (theme.soft) root.style.setProperty("--theme-soft", theme.soft);
      if (theme.rgb) root.style.setProperty("--theme-rgb", theme.rgb);
    } catch {}
  };

  const formatDisplay = (amountHkd, compact = false) => {
    const currency = CURRENCIES[displayCurrency] || CURRENCIES.HKD;
    const number = Number(amountHkd || 0) / rateFor(displayCurrency);
    if (compact && Math.abs(number) >= 10000) return `${currency.symbol}${(number / 10000).toFixed(Math.abs(number) >= 100000 ? 0 : 1)}万`;
    return `${currency.symbol}${number.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatOriginal = (record) => {
    const currency = CURRENCIES[record.currency] || CURRENCIES.HKD;
    return `${currency.symbol}${Number(record.amount || 0).toLocaleString("zh-CN", {
      minimumFractionDigits: currency.digits,
      maximumFractionDigits: currency.digits
    })} ${record.currency}`;
  };

  const formatHkd = (amountHkd) => `HK$${Number(amountHkd || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  const categoryById = (id) => state.categories.find((category) => category.id === id) || {
    id: "unknown", type: "expense", name: "其他", icon: "✨", color: "#a6adba"
  };

  const rateFor = (currency) => CURRENCIES[currency]?.rate || 1;

  function seedTransactions() {
    const now = new Date();
    const raw = [
      [-1, 19, 10, "expense", "超市采购", "exp-daily", 188.6, "CNY", "微信", "洗衣液和日用品"],
      [-2, 12, 20, "expense", "午餐", "exp-food", 52, "HKD", "支付宝", "学校附近茶餐厅"],
      [-3, 9, 0, "income", "项目兼职", "inc-parttime", 1800, "CNY", "银行卡", "网页设计尾款"],
      [-4, 18, 45, "expense", "地铁月票", "exp-transport", 420, "HKD", "信用卡", ""],
      [-6, 20, 30, "expense", "朋友聚餐", "exp-food", 268, "CNY", "微信", ""],
      [-8, 14, 15, "expense", "课程教材", "exp-study", 36.5, "USD", "信用卡", "电子书"],
      [-10, 8, 30, "income", "月度工资", "inc-salary", 12800, "CNY", "银行卡", ""],
      [-12, 21, 0, "expense", "电影票", "exp-entertain", 96, "CNY", "支付宝", "两张票"],
      [-15, 16, 40, "expense", "感冒药", "exp-health", 78.5, "CNY", "微信", ""],
      [-18, 10, 20, "income", "商品退款", "inc-refund", 129, "CNY", "支付宝", "耳机退货"],
      [-21, 18, 10, "expense", "房租", "exp-home", 4200, "CNY", "银行卡", "本月房租"],
      [-24, 13, 10, "expense", "咖啡与甜点", "exp-food", 68, "CNY", "微信", ""],
      [-29, 11, 0, "expense", "机场快线", "exp-transport", 115, "HKD", "信用卡", ""],
      [-35, 9, 0, "income", "上月工资", "inc-salary", 12500, "CNY", "银行卡", ""]
    ];
    return raw.map(([offset, hours, minutes, type, title, categoryId, amount, currency, account, note], index) => ({
      id: `demo-${index + 1}`,
      type, title, categoryId, amount, currency, rate: rateFor(currency),
      amountHkd: Number((amount * rateFor(currency)).toFixed(2)),
      date: atTime(addDays(now, offset), hours, minutes), account, note,
      createdAt: new Date(now.getTime() - index * 1000).toISOString()
    }));
  }

  function defaultState() {
    return { rateReferenceDate: RATE_REFERENCE_DATE, rateBasis: RATE_BASIS, displayCurrency: "HKD", categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })), transactions: [] };
  }

  function loadState() {
    const storageKey = currentStorageKey();
    if (!storageKey) return defaultState();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && Array.isArray(saved.categories) && Array.isArray(saved.transactions)) {
        if (saved.rateBasis !== RATE_BASIS) {
          saved.transactions.forEach((record) => {
            record.rate = rateFor(record.currency);
            record.amountHkd = Number((Number(record.amount || 0) * record.rate).toFixed(2));
          });
          saved.rateReferenceDate = RATE_REFERENCE_DATE;
          saved.rateBasis = RATE_BASIS;
          saved.displayCurrency = "HKD";
          localStorage.setItem(storageKey, JSON.stringify(saved));
        }
        return saved;
      }
    } catch {}
    return defaultState();
  }

  let state = loadState();
  let displayCurrency = CURRENCIES[state.displayCurrency] ? state.displayCurrency : "HKD";
  let rangeMode = "month";
  let activeRange = rangeForMode(rangeMode);
  let chartType = "expense";
  let trendPeriod = "day";
  let trendUnitCount = 7;
  let managerType = "expense";
  let selectedCategoryId = "";
  let selectedCategoryEmoji = "✨";
  let toastTimer = 0;
  let confirmAction = null;
  const customSelectRegistry = new Map();
  const customDateRegistry = new Map();

  function closeCustomSelects(except = null) {
    customSelectRegistry.forEach((controller) => {
      if (controller !== except) controller.close();
    });
  }

  function enhanceSelect(select) {
    if (!select || customSelectRegistry.has(select)) return customSelectRegistry.get(select);
    const wrapper = document.createElement("span");
    wrapper.className = `custom-select custom-select--${select.id || "control"}`;
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.classList.add("native-select-hidden");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const trigger = document.createElement("button");
    trigger.className = "custom-select-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = '<span></span><i aria-hidden="true"></i>';
    const menu = document.createElement("span");
    menu.className = "custom-select-menu";
    menu.id = `custom-select-menu-${select.id || uid("select")}`;
    menu.setAttribute("role", "listbox");
    menu.hidden = true;
    trigger.setAttribute("aria-controls", menu.id);
    wrapper.append(trigger, menu);

    const controller = {
      select, wrapper, trigger, menu,
      close() {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        wrapper.classList.remove("open");
        wrapper.classList.remove("drop-up");
      },
      open() {
        closeCustomSelects(controller);
        closeCustomDates();
        menu.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        wrapper.classList.add("open");
        requestAnimationFrame(() => {
          const triggerRect = trigger.getBoundingClientRect();
          const expectedHeight = Math.min(menu.scrollHeight, 292) + 9;
          const spaceBelow = window.innerHeight - triggerRect.bottom;
          wrapper.classList.toggle("drop-up", spaceBelow < expectedHeight && triggerRect.top > spaceBelow);
          menu.querySelector('[aria-selected="true"]')?.focus();
        });
      },
      refresh() {
        const selected = select.selectedOptions[0] || select.options[0];
        trigger.querySelector("span").textContent = selected?.textContent || "请选择";
        trigger.setAttribute("aria-label", `${select.getAttribute("aria-label") || "选择"}：${selected?.textContent || "未选择"}`);
        const chunks = [];
        [...select.children].forEach((child) => {
          if (child.tagName === "OPTGROUP") {
            chunks.push(`<span class="custom-select-group">${escapeHtml(child.label)}</span>`);
            [...child.children].forEach((option) => chunks.push(`<button class="custom-select-option" type="button" role="option" data-value="${escapeHtml(option.value)}" aria-selected="${option.selected}">${escapeHtml(option.textContent)}</button>`));
          } else if (child.tagName === "OPTION") {
            chunks.push(`<button class="custom-select-option" type="button" role="option" data-value="${escapeHtml(child.value)}" aria-selected="${child.selected}">${escapeHtml(child.textContent)}</button>`);
          }
        });
        menu.innerHTML = chunks.join("");
      }
    };
    customSelectRegistry.set(select, controller);
    controller.refresh();

    trigger.addEventListener("click", () => menu.hidden ? controller.open() : controller.close());
    trigger.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        controller.open();
      }
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-value]");
      if (!option) return;
      select.value = option.dataset.value;
      controller.refresh();
      controller.close();
      select.dispatchEvent(new Event("change", { bubbles: true }));
      trigger.focus();
    });
    menu.addEventListener("keydown", (event) => {
      const options = [...menu.querySelectorAll("[data-value]")];
      const currentIndex = options.indexOf(document.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        controller.close();
        trigger.focus();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        options[(currentIndex + direction + options.length) % options.length]?.focus();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        document.activeElement?.click();
      }
    });
    select.addEventListener("change", () => controller.refresh());
    return controller;
  }

  function refreshCustomSelect(select) {
    customSelectRegistry.get(select)?.refresh();
  }

  function setSelectValue(select, value) {
    select.value = value;
    refreshCustomSelect(select);
  }

  function closeCustomDates(except = null) {
    customDateRegistry.forEach((controller) => {
      if (controller !== except) controller.close();
    });
  }

  function setDateValue(input, value) {
    input.value = value;
    customDateRegistry.get(input)?.refresh();
  }

  function enhanceDateInput(input) {
    if (!input || customDateRegistry.has(input)) return customDateRegistry.get(input);
    const hasTime = input.type === "datetime-local";
    const wrapper = document.createElement("span");
    wrapper.className = `custom-date custom-date--${input.id}`;
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    input.classList.add("native-date-hidden");
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");

    const trigger = document.createElement("button");
    trigger.className = "custom-date-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = '<span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 8h16M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>';
    const panel = document.createElement("span");
    panel.className = "custom-date-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", hasTime ? "选择日期和时间" : "选择日期");
    panel.hidden = true;
    wrapper.append(trigger, panel);

    const controller = {
      input, wrapper, trigger, panel, hasTime,
      pendingDate: dateOnly(input.value) || localDateKey(),
      pendingHour: hasTime && input.value ? Number(input.value.slice(11, 13)) : new Date().getHours(),
      pendingMinute: hasTime && input.value ? Number(input.value.slice(14, 16)) : new Date().getMinutes(),
      viewDate: new Date(`${dateOnly(input.value) || localDateKey()}T00:00`),
      close() {
        panel.hidden = true;
        wrapper.classList.remove("open");
        wrapper.classList.remove("drop-up");
        trigger.setAttribute("aria-expanded", "false");
      },
      open() {
        closeCustomDates(controller);
        closeCustomSelects();
        const current = input.value || localDateTimeValue();
        controller.pendingDate = dateOnly(current) || localDateKey();
        controller.pendingHour = hasTime ? Number(current.slice(11, 13) || new Date().getHours()) : 0;
        controller.pendingMinute = hasTime ? Number(current.slice(14, 16) || new Date().getMinutes()) : 0;
        controller.viewDate = new Date(`${controller.pendingDate}T00:00`);
        controller.render();
        panel.hidden = false;
        wrapper.classList.add("open");
        trigger.setAttribute("aria-expanded", "true");
        requestAnimationFrame(() => {
          const triggerRect = trigger.getBoundingClientRect();
          const expectedHeight = panel.scrollHeight + 9;
          const spaceBelow = window.innerHeight - triggerRect.bottom;
          wrapper.classList.toggle("drop-up", spaceBelow < expectedHeight && triggerRect.top > spaceBelow);
        });
      },
      refresh() {
        const value = input.value;
        let label = "选择日期";
        if (value) {
          const [year, month, day] = dateOnly(value).split("-");
          label = `${year}/${month}/${day}`;
          if (hasTime) label += ` ${value.slice(11, 16)}`;
        }
        trigger.querySelector("span").textContent = label;
        const fieldName = input.closest("label")?.querySelector(":scope > span")?.textContent?.trim() || "日期";
        trigger.setAttribute("aria-label", `${fieldName}：${label}`);
      },
      render() {
        const year = controller.viewDate.getFullYear();
        const month = controller.viewDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const offset = (firstDay.getDay() + 6) % 7;
        const dayCount = new Date(year, month + 1, 0).getDate();
        const cells = Array.from({ length: 42 }, (_, index) => {
          const day = index - offset + 1;
          if (day < 1 || day > dayCount) return '<span class="custom-date-empty"></span>';
          const value = `${year}-${pad(month + 1)}-${pad(day)}`;
          const classes = [value === localDateKey() ? "today" : "", value === controller.pendingDate ? "selected" : ""].filter(Boolean).join(" ");
          return `<button class="${classes}" type="button" data-date="${value}" aria-pressed="${value === controller.pendingDate}">${day}</button>`;
        }).join("");
        panel.innerHTML = `<span class="custom-date-toolbar"><button type="button" data-date-action="previous" aria-label="上个月">‹</button><strong>${year}年 ${month + 1}月</strong><button type="button" data-date-action="next" aria-label="下个月">›</button></span>
          <span class="custom-date-weekdays"><i>一</i><i>二</i><i>三</i><i>四</i><i>五</i><i>六</i><i>日</i></span>
          <span class="custom-date-grid">${cells}</span>
          ${hasTime ? `<span class="custom-time-row"><label>小时<input data-time-part="hour" type="number" min="0" max="23" value="${pad(controller.pendingHour)}"></label><b>:</b><label>分钟<input data-time-part="minute" type="number" min="0" max="59" value="${pad(controller.pendingMinute)}"></label></span><span class="custom-date-actions"><button type="button" data-date-action="cancel">取消</button><button class="confirm" type="button" data-date-action="confirm">确定</button></span>` : ""}`;
      }
    };
    customDateRegistry.set(input, controller);
    controller.refresh();

    trigger.addEventListener("click", () => panel.hidden ? controller.open() : controller.close());
    panel.addEventListener("input", (event) => {
      if (event.target.dataset.timePart === "hour") controller.pendingHour = clamp(Number(event.target.value || 0), 0, 23);
      if (event.target.dataset.timePart === "minute") controller.pendingMinute = clamp(Number(event.target.value || 0), 0, 59);
    });
    panel.addEventListener("click", (event) => {
      // Rendering a newly selected day replaces the clicked button. Without
      // stopping this event here, the document-level outside-click handler
      // sees the now-detached target and closes the picker prematurely.
      event.stopPropagation();
      const action = event.target.closest("[data-date-action]")?.dataset.dateAction;
      const dateButton = event.target.closest("[data-date]");
      if (dateButton) {
        controller.pendingDate = dateButton.dataset.date;
        if (!hasTime) {
          setDateValue(input, controller.pendingDate);
          controller.close();
          input.dispatchEvent(new Event("change", { bubbles: true }));
          trigger.focus();
        } else controller.render();
        return;
      }
      if (action === "previous" || action === "next") {
        controller.viewDate.setMonth(controller.viewDate.getMonth() + (action === "next" ? 1 : -1), 1);
        controller.render();
      } else if (action === "cancel") controller.close();
      else if (action === "confirm") {
        const value = `${controller.pendingDate}T${pad(clamp(controller.pendingHour, 0, 23))}:${pad(clamp(controller.pendingMinute, 0, 59))}`;
        setDateValue(input, value);
        controller.close();
        input.dispatchEvent(new Event("change", { bubbles: true }));
        trigger.focus();
      }
    });
    return controller;
  }

  function persist() {
    const storageKey = currentStorageKey();
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
  }

  function loadForPortalUser(user) {
    const previousId = authUser?.id || "";
    authUser = user?.id ? { ...user } : null;
    window.portalCurrentUser = authUser;
    window.PortalAccountData?.useUser(authUser);
    if ((authUser?.id || "") === previousId && initialized) return;
    state = loadState();
    displayCurrency = CURRENCIES[state.displayCurrency] ? state.displayCurrency : "HKD";
    if (!initialized) return;
    setSelectValue(els.displayCurrencySelect, displayCurrency);
    renderAll();
  }

  function rangeForMode(mode) {
    const today = new Date();
    let start;
    let end = today;
    if (mode === "month") start = new Date(today.getFullYear(), today.getMonth(), 1);
    else if (mode === "last-month") {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (mode === "30-days") start = addDays(today, -29);
    else if (mode === "year") start = new Date(today.getFullYear(), 0, 1);
    else {
      start = new Date(els.rangeStart.value || localDateKey(new Date(today.getFullYear(), today.getMonth(), 1)));
      end = new Date(els.rangeEnd.value || localDateKey(today));
    }
    return { start: localDateKey(start), end: localDateKey(end) };
  }

  function recordsInRange() {
    return state.transactions.filter((record) => {
      const day = dateOnly(record.date);
      return day >= activeRange.start && day <= activeRange.end;
    });
  }

  function totalsFor(records) {
    return records.reduce((totals, record) => {
      totals[record.type] += Number(record.amountHkd || (record.amount * rateFor(record.currency)) || 0);
      return totals;
    }, { expense: 0, income: 0 });
  }

  function renderAll() {
    renderCurrencyLabels();
    renderRangeCaption();
    renderSummary();
    renderCategoryChart();
    renderTrend();
    renderCategoryFilter();
    renderLedger();
  }

  function renderCurrencyLabels() {
    const currency = CURRENCIES[displayCurrency];
    els.baseCurrencyNote.textContent = `统一折算为 ${displayCurrency}`;
    els.convertedCurrencyHeader.textContent = "金额 HKD";
    document.documentElement.dataset.displayCurrency = displayCurrency;
    if (els.displayCurrencySelect.value !== displayCurrency) setSelectValue(els.displayCurrencySelect, displayCurrency);
    document.title = `流光账本 · ${currency.name}视图`;
  }

  function renderRangeCaption() {
    const start = new Date(`${activeRange.start}T00:00`);
    const end = new Date(`${activeRange.end}T00:00`);
    const startLabel = `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日`;
    const endLabel = `${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`;
    els.rangeCaption.textContent = `${startLabel} — ${endLabel}`;
  }

  function renderSummary() {
    const records = recordsInRange();
    const totals = totalsFor(records);
    els.expenseTotal.textContent = formatDisplay(totals.expense);
    els.incomeTotal.textContent = formatDisplay(totals.income);
    els.incomeHint.textContent = `共 ${records.filter((record) => record.type === "income").length} 笔收入`;

    const start = new Date(`${activeRange.start}T00:00`);
    const end = new Date(`${activeRange.end}T00:00`);
    const duration = Math.round((end - start) / 86400000) + 1;
    const previousEnd = addDays(start, -1);
    const previousStart = addDays(previousEnd, -(duration - 1));
    const previousExpense = state.transactions
      .filter((record) => record.type === "expense" && dateOnly(record.date) >= localDateKey(previousStart) && dateOnly(record.date) <= localDateKey(previousEnd))
      .reduce((sum, record) => sum + Number(record.amountHkd || (record.amount * rateFor(record.currency)) || 0), 0);
    if (previousExpense > 0) {
      const difference = ((totals.expense - previousExpense) / previousExpense) * 100;
      els.expenseComparison.textContent = `较上一等长周期 ${difference >= 0 ? "增加" : "减少"} ${Math.abs(difference).toFixed(1)}%`;
      els.expenseComparison.className = difference <= 0 ? "positive" : "negative";
    } else {
      els.expenseComparison.textContent = "上一等长周期暂无支出";
      els.expenseComparison.className = "";
    }
  }

  function renderCategoryChart() {
    const relevant = recordsInRange().filter((record) => record.type === chartType);
    const grouped = new Map();
    relevant.forEach((record) => grouped.set(record.categoryId, (grouped.get(record.categoryId) || 0) + Number(record.amountHkd || (record.amount * rateFor(record.currency)) || 0)));
    const groups = [...grouped.entries()].map(([categoryId, value]) => ({ category: categoryById(categoryId), value })).sort((a, b) => b.value - a.value);
    const total = groups.reduce((sum, item) => sum + item.value, 0);
    els.donutLabel.textContent = chartType === "expense" ? "支出合计" : "收入合计";
    els.donutTotal.textContent = formatDisplay(total, true);
    els.categoryDonut.setAttribute("aria-label", `${chartType === "expense" ? "支出" : "收入"}分类占比，共${formatDisplay(total)}`);

    if (!total) {
      els.categoryDonut.style.background = "#edf1f7";
      els.categoryLegend.innerHTML = '<p class="legend-more">当前范围暂无可统计数据</p>';
      els.insightText.textContent = `记录${chartType === "expense" ? "支出" : "收入"}后，这里会生成分类洞察。`;
      return;
    }

    let cursor = 0;
    const gradient = groups.map(({ category, value }) => {
      const start = cursor;
      cursor += (value / total) * 100;
      return `${category.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    els.categoryDonut.style.background = `conic-gradient(${gradient.join(",")})`;
    const visibleGroups = groups.slice(0, 5);
    els.categoryLegend.innerHTML = visibleGroups.map(({ category, value }) => {
      const percent = (value / total) * 100;
      return `<div class="legend-row">
        <i class="legend-dot" style="background:${escapeHtml(category.color)}"></i>
        <div class="legend-copy"><strong>${escapeHtml(category.icon)} ${escapeHtml(category.name)}</strong><span>${percent.toFixed(1)}%</span></div>
        <span class="legend-value">${formatDisplay(value)}</span>
      </div>`;
    }).join("") + (groups.length > 5 ? `<p class="legend-more">另有 ${groups.length - 5} 个分类</p>` : "");

    const leader = groups[0];
    const leaderPercent = (leader.value / total) * 100;
    els.insightText.textContent = chartType === "expense"
      ? `“${leader.category.name}”是这段时间最大的支出分类，占 ${leaderPercent.toFixed(1)}%，共 ${formatDisplay(leader.value)}。`
      : `“${leader.category.name}”是这段时间最大的收入来源，占 ${leaderPercent.toFixed(1)}%，共 ${formatDisplay(leader.value)}。`;
  }

  function startOfTrendUnit(date, period = trendPeriod) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    if (period === "week") result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
    if (period === "month") result.setDate(1);
    return result;
  }

  function addTrendUnits(date, amount, period = trendPeriod) {
    const result = new Date(date);
    if (period === "day") result.setDate(result.getDate() + amount);
    else if (period === "week") result.setDate(result.getDate() + (amount * 7));
    else result.setMonth(result.getMonth() + amount, 1);
    return result;
  }

  function trendUnitDistance(start, end, period = trendPeriod) {
    if (period === "month") return ((end.getFullYear() - start.getFullYear()) * 12) + end.getMonth() - start.getMonth();
    const dayDistance = Math.round((end - start) / 86400000);
    return period === "week" ? Math.round(dayDistance / 7) : dayDistance;
  }

  function maxTrendUnits() {
    const anchor = startOfTrendUnit(new Date(`${activeRange.end}T00:00`));
    const eligible = state.transactions.filter((record) => dateOnly(record.date) <= activeRange.end);
    const earliest = eligible.length
      ? startOfTrendUnit(new Date(`${eligible.map((record) => dateOnly(record.date)).sort()[0]}T00:00`))
      : anchor;
    const recordedSpan = Math.max(1, trendUnitDistance(earliest, anchor) + 1);
    return Math.max(trendPeriod === "month" ? 6 : 7, recordedSpan);
  }

  function resetTrendUnitsForPeriod() {
    trendUnitCount = Math.min(7, maxTrendUnits());
  }

  function renderTrend() {
    const periodLabels = {
      day: { title: "每日收支", unit: "天" },
      week: { title: "每周收支", unit: "周" },
      month: { title: "每月收支", unit: "个月" }
    };
    const maximum = maxTrendUnits();
    trendUnitCount = clamp(trendUnitCount, Math.min(3, maximum), maximum);
    const anchor = startOfTrendUnit(new Date(`${activeRange.end}T00:00`));
    const buckets = [];
    for (let index = trendUnitCount - 1; index >= 0; index -= 1) {
      const bucketStart = addTrendUnits(anchor, -index);
      const nextStart = addTrendUnits(bucketStart, 1);
      const bucketEnd = new Date(nextStart.getTime() - 1);
      const startKey = localDateKey(bucketStart);
      const endKey = localDateKey(bucketEnd);
      const values = totalsFor(state.transactions.filter((record) => dateOnly(record.date) >= startKey && dateOnly(record.date) <= endKey));
      buckets.push({ start: bucketStart, end: bucketEnd, ...values });
    }
    const maxValue = Math.max(1, ...buckets.flatMap((bucket) => [bucket.expense, bucket.income]));
    els.trendTitle.textContent = periodLabels[trendPeriod].title;
    els.trendZoomNote.textContent = `当前 ${trendUnitCount} ${periodLabels[trendPeriod].unit} · 滚轮缩放`;
    els.trendChart.setAttribute("aria-label", `${periodLabels[trendPeriod].title}柱状图，当前显示${trendUnitCount}${periodLabels[trendPeriod].unit}`);
    els.trendChart.innerHTML = buckets.map((bucket) => {
      const expenseHeight = clamp((bucket.expense / maxValue) * 100, bucket.expense ? 2 : 0, 100);
      const incomeHeight = clamp((bucket.income / maxValue) * 100, bucket.income ? 2 : 0, 100);
      const startLabel = `${bucket.start.getMonth() + 1}/${bucket.start.getDate()}`;
      const endLabel = `${bucket.end.getMonth() + 1}/${bucket.end.getDate()}`;
      const label = trendPeriod === "month" ? `${bucket.start.getMonth() + 1}月` : startLabel;
      const rangeLabel = trendPeriod === "day"
        ? `${bucket.start.getFullYear()}年${bucket.start.getMonth() + 1}月${bucket.start.getDate()}日`
        : trendPeriod === "week"
          ? `${startLabel}–${endLabel}`
          : `${bucket.start.getFullYear()}年${bucket.start.getMonth() + 1}月`;
      return `<div class="trend-day" data-tooltip="${escapeHtml(rangeLabel)}&#10;支出 ${escapeHtml(formatDisplay(bucket.expense))}&#10;收入 ${escapeHtml(formatDisplay(bucket.income))}">
        <i class="trend-bar expense" style="height:${expenseHeight.toFixed(2)}%"></i>
        <i class="trend-bar income" style="height:${incomeHeight.toFixed(2)}%"></i>
        <span class="trend-day-label">${escapeHtml(label)}</span>
      </div>`;
    }).join("");
  }

  function renderCategoryFilter() {
    const current = els.categoryFilter.value || "all";
    const selectedType = els.typeFilter.value;
    const optionHtml = (category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.icon)} ${escapeHtml(category.name)}</option>`;
    let options = "";
    if (selectedType === "all") {
      const expenses = state.categories.filter((category) => category.type === "expense").map(optionHtml).join("");
      const incomes = state.categories.filter((category) => category.type === "income").map(optionHtml).join("");
      options = `<optgroup label="支出分类">${expenses}</optgroup><optgroup label="收入分类">${incomes}</optgroup>`;
    } else {
      options = state.categories.filter((category) => category.type === selectedType).map(optionHtml).join("");
    }
    els.categoryFilter.innerHTML = `<option value="all">全部分类</option>${options}`;
    const currentCategory = state.categories.find((category) => category.id === current);
    const canKeepCurrent = currentCategory && (selectedType === "all" || currentCategory.type === selectedType);
    els.categoryFilter.value = canKeepCurrent ? current : "all";
    refreshCustomSelect(els.categoryFilter);
  }

  function filteredLedgerRecords() {
    const query = els.searchInput.value.trim().toLocaleLowerCase("zh-CN");
    return recordsInRange().filter((record) => {
      if (els.typeFilter.value !== "all" && record.type !== els.typeFilter.value) return false;
      if (els.categoryFilter.value !== "all" && record.categoryId !== els.categoryFilter.value) return false;
      if (!query) return true;
      return `${record.title} ${record.note || ""} ${categoryById(record.categoryId).name}`.toLocaleLowerCase("zh-CN").includes(query);
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function renderLedger() {
    hideLedgerNoteTooltip();
    const records = filteredLedgerRecords();
    els.transactionCount.textContent = `${records.length} 笔`;
    els.ledgerEmpty.hidden = records.length > 0;
    els.ledgerBody.hidden = records.length === 0;
    let previousYear = "";
    let previousMonth = "";
    let previousDate = "";
    const rows = [];

    records.forEach((record) => {
      const recordDate = new Date(record.date);
      const validDate = !Number.isNaN(recordDate.getTime());
      const year = validDate ? String(recordDate.getFullYear()) : "未知年份";
      const month = validDate ? `${recordDate.getMonth() + 1}月` : "未知月份";
      const dateKey = validDate ? localDateKey(recordDate) : String(record.date || "未知日期");
      const dateLabel = validDate ? `${recordDate.getMonth() + 1}月${recordDate.getDate()}日` : "日期未设置";

      if (year !== previousYear) {
        rows.push(`<tr class="ledger-period-row ledger-period-year"><th colspan="4" scope="rowgroup">${escapeHtml(year)}${validDate ? "年" : ""}</th></tr>`);
        previousYear = year;
        previousMonth = "";
        previousDate = "";
      }
      if (month !== previousMonth) {
        rows.push(`<tr class="ledger-period-row ledger-period-month"><th colspan="4" scope="rowgroup">${escapeHtml(month)}</th></tr>`);
        previousMonth = month;
        previousDate = "";
      }
      if (dateKey !== previousDate) {
        rows.push(`<tr class="ledger-period-row ledger-period-date"><th colspan="4" scope="rowgroup">${escapeHtml(dateLabel)}</th></tr>`);
        previousDate = dateKey;
      }

      const category = categoryById(record.categoryId);
      const sign = record.type === "expense" ? "−" : "+";
      const amountHkd = Number(record.amountHkd || (record.amount * rateFor(record.currency)) || 0);
      const hasOriginalCurrency = record.currency !== "HKD";
      const originalLabel = `${sign}${formatOriginal(record)}`;
      rows.push(`<tr class="ledger-entry-row" data-record-id="${escapeHtml(record.id)}">
        <td><div class="transaction-event"><span class="category-avatar" style="color:${escapeHtml(category.color)};background:${escapeHtml(category.color)}1c">${escapeHtml(category.icon)}</span><span class="transaction-copy"><strong>${escapeHtml(record.title)}</strong><span class="transaction-note-wrap"><small class="transaction-note${record.note ? "" : " is-empty"}"${record.note ? "" : " aria-hidden=\"true\""}>${escapeHtml(record.note || "")}</small></span></span></div></td>
        <td><span class="category-tag" style="color:${escapeHtml(category.color)};background:${escapeHtml(category.color)}16">${escapeHtml(category.icon)} ${escapeHtml(category.name)}</span></td>
        <td><span class="ledger-amount${hasOriginalCurrency ? " has-original" : ""}"${hasOriginalCurrency ? ` tabindex="0" aria-label="折合港币 ${escapeHtml(sign + formatHkd(amountHkd))}，实际金额 ${escapeHtml(originalLabel)}"` : ""}><span class="amount-hkd ${record.type}">${sign}${formatHkd(amountHkd)}</span>${hasOriginalCurrency ? `<span class="original-currency-tooltip" role="tooltip"><small>实际金额</small><strong>${escapeHtml(originalLabel)}</strong></span>` : ""}</span></td>
        <td><div class="row-actions"><button class="row-action edit" type="button" data-edit-record aria-label="编辑 ${escapeHtml(record.title)}">✎</button><button class="row-action delete" type="button" data-delete-record aria-label="删除 ${escapeHtml(record.title)}">×</button></div></td>
      </tr>`);
    });
    els.ledgerBody.innerHTML = rows.join("");
    requestAnimationFrame(refreshLedgerNoteOverflow);
  }

  function hideLedgerNoteTooltip() {
    els.ledgerNoteTooltip.hidden = true;
    els.ledgerNoteTooltip.textContent = "";
  }

  function refreshLedgerNoteOverflow() {
    els.ledgerBody.querySelectorAll(".transaction-note:not(.is-empty)").forEach((note) => {
      const truncated = note.scrollWidth > note.clientWidth + 1;
      note.classList.toggle("is-truncated", truncated);
      if (truncated) {
        note.tabIndex = 0;
        note.setAttribute("aria-describedby", "ledgerNoteTooltip");
      } else {
        note.removeAttribute("tabindex");
        note.removeAttribute("aria-describedby");
      }
    });
  }

  function showLedgerNoteTooltip(note) {
    if (!note?.classList.contains("is-truncated")) return;
    els.ledgerNoteTooltip.textContent = note.textContent;
    els.ledgerNoteTooltip.hidden = false;
    els.ledgerNoteTooltip.style.visibility = "hidden";
    const noteRect = note.getBoundingClientRect();
    const tooltipRect = els.ledgerNoteTooltip.getBoundingClientRect();
    const margin = 12;
    const gap = 8;
    const left = clamp(noteRect.left, margin, window.innerWidth - tooltipRect.width - margin);
    const below = noteRect.bottom + gap;
    const top = below + tooltipRect.height <= window.innerHeight - margin
      ? below
      : Math.max(margin, noteRect.top - tooltipRect.height - gap);
    els.ledgerNoteTooltip.style.left = `${left}px`;
    els.ledgerNoteTooltip.style.top = `${top}px`;
    els.ledgerNoteTooltip.style.visibility = "visible";
  }

  function renderCategoryPicker(type, preferredId = "") {
    const categories = state.categories.filter((category) => category.type === type);
    if (!categories.some((category) => category.id === preferredId)) preferredId = categories[0]?.id || "";
    selectedCategoryId = preferredId;
    els.categoryPicker.innerHTML = categories.map((category) => `<button class="category-choice${category.id === preferredId ? " active" : ""}" type="button" data-category-id="${escapeHtml(category.id)}" style="--category-color:${escapeHtml(category.color)}"><span class="emoji">${escapeHtml(category.icon)}</span><span>${escapeHtml(category.name)}</span></button>`).join("");
  }

  function renderCategoryManager() {
    const categories = state.categories.filter((category) => category.type === managerType);
    els.categoryManagerList.innerHTML = categories.map((category) => {
      const used = state.transactions.filter((record) => record.categoryId === category.id).length;
      const description = category.locked ? "系统保留分类" : used ? `${used} 笔账目正在使用` : "尚未使用";
      return `<div class="category-manager-row${els.editingCategoryId.value === category.id ? " editing" : ""}" data-category-id="${escapeHtml(category.id)}">
        <button class="category-manager-main" type="button" data-edit-category aria-label="编辑 ${escapeHtml(category.name)}">
          <span class="category-avatar" style="color:${escapeHtml(category.color)};background:${escapeHtml(category.color)}1c">${escapeHtml(category.icon)}</span>
          <span><strong>${escapeHtml(category.name)}</strong><small>${description}</small></span>
        </button>
        <button type="button" data-delete-category ${category.locked ? "disabled" : ""} aria-label="删除 ${escapeHtml(category.name)}">×</button>
      </div>`;
    }).join("");
  }

  function renderEmojiPopover() {
    els.categoryEmojiPopover.innerHTML = CATEGORY_EMOJIS.map((emoji) => `<button class="emoji-option${emoji === selectedCategoryEmoji ? " active" : ""}" type="button" data-emoji="${escapeHtml(emoji)}" aria-label="选择 ${escapeHtml(emoji)}">${escapeHtml(emoji)}</button>`).join("");
    els.selectedCategoryEmoji.textContent = selectedCategoryEmoji;
  }

  function closeEmojiPopover() {
    els.categoryEmojiPopover.hidden = true;
    els.categoryEmojiTrigger.setAttribute("aria-expanded", "false");
  }

  function resetCategoryEditor(shouldFocus = false) {
    els.editingCategoryId.value = "";
    els.categoryEditorCaption.textContent = "新增分类";
    els.cancelCategoryEditButton.hidden = true;
    els.saveCategoryButton.textContent = "新增";
    els.newCategoryName.value = "";
    selectedCategoryEmoji = "✨";
    renderEmojiPopover();
    closeEmojiPopover();
    renderCategoryManager();
    if (shouldFocus) requestAnimationFrame(() => els.newCategoryName.focus());
  }

  function editCategory(category) {
    els.editingCategoryId.value = category.id;
    els.categoryEditorCaption.textContent = `编辑“${category.name}”`;
    els.cancelCategoryEditButton.hidden = false;
    els.saveCategoryButton.textContent = "保存修改";
    els.newCategoryName.value = category.name;
    selectedCategoryEmoji = category.icon;
    renderEmojiPopover();
    closeEmojiPopover();
    renderCategoryManager();
    requestAnimationFrame(() => els.newCategoryName.focus());
  }

  function updateRatePreview() {
    const code = els.transactionCurrency.value || "HKD";
    const amount = Number(els.transactionAmount.value || 0);
    const rate = rateFor(code);
    els.ratePreview.textContent = code === "HKD"
      ? `ECB ${RATE_REFERENCE_DATE} 参考：1 HKD = 1 HKD`
      : `ECB ${RATE_REFERENCE_DATE}：1 ${code} = ${rate} HKD${amount > 0 ? ` · 约 HK$${(amount * rate).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}`;
  }

  function openTransactionDrawer(record = null) {
    const type = record?.type || "expense";
    els.drawerTitle.textContent = record ? "编辑账目" : "记一笔";
    els.transactionId.value = record?.id || "";
    els.transactionType.value = type;
    els.transactionTitle.value = record?.title || "";
    els.transactionAmount.value = record?.amount ?? "";
    setSelectValue(els.transactionCurrency, record?.currency || "HKD");
    setDateValue(els.transactionDate, record?.date || localDateTimeValue());
    els.transactionNote.value = record?.note || "";
    els.transactionError.textContent = "";
    els.deleteTransactionButton.hidden = !record;
    els.transactionTypeSwitch.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.type === type));
    renderCategoryPicker(type, record?.categoryId || "");
    updateRatePreview();
    openLayer(els.transactionDrawer);
    requestAnimationFrame(() => els.transactionTitle.focus());
  }

  function closeTransactionDrawer() { closeLayer(els.transactionDrawer); }
  function openCategoryModal() { resetCategoryEditor(); openLayer(els.categoryModal); requestAnimationFrame(() => els.newCategoryName.focus()); }
  function closeCategoryModal() { closeEmojiPopover(); closeLayer(els.categoryModal); }

  function openLayer(element) {
    element.classList.add("open");
    element.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeLayer(element) {
    element.classList.remove("open");
    element.setAttribute("aria-hidden", "true");
    if (![els.transactionDrawer, els.categoryModal, els.confirmDialog].some((layer) => layer.classList.contains("open"))) document.body.classList.remove("modal-open");
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 2400);
  }

  function showConfirm(title, message, onAccept, acceptLabel = "确认删除") {
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    els.confirmAccept.textContent = acceptLabel;
    confirmAction = onAccept;
    openLayer(els.confirmDialog);
    requestAnimationFrame(() => els.confirmCancel.focus());
  }

  function closeConfirm() { confirmAction = null; closeLayer(els.confirmDialog); }

  function requestDeleteTransaction(record) {
    showConfirm("删除这笔账目？", `“${record.title}”删除后不可恢复，统计结果也会立即更新。`, () => {
      state.transactions = state.transactions.filter((item) => item.id !== record.id);
      persist();
      closeTransactionDrawer();
      renderAll();
      showToast("账目已删除");
    });
  }

  function greeting() {
    const hour = new Date().getHours();
    const prefix = hour < 6 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
    els.greetingText.textContent = `${prefix}，看清每一笔，也看见生活的方向。`;
  }

  function bindEvents() {
    [els.addTransactionButton, els.emptyAddButton, els.railRecordButton].forEach((button) => button.addEventListener("click", () => openTransactionDrawer()));
    [els.manageCategoriesButton, els.railCategoryButton].forEach((button) => button.addEventListener("click", openCategoryModal));
    document.querySelectorAll("[data-close-drawer]").forEach((button) => button.addEventListener("click", closeTransactionDrawer));
    document.querySelectorAll("[data-close-category-modal]").forEach((button) => button.addEventListener("click", closeCategoryModal));

    els.rangePresets.addEventListener("click", (event) => {
      const button = event.target.closest("[data-range]");
      if (!button) return;
      rangeMode = button.dataset.range;
      els.rangePresets.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      els.customRange.hidden = rangeMode !== "custom";
      if (rangeMode === "custom") {
        if (!els.rangeStart.value) setDateValue(els.rangeStart, activeRange.start);
        if (!els.rangeEnd.value) setDateValue(els.rangeEnd, activeRange.end);
        return;
      }
      activeRange = rangeForMode(rangeMode);
      renderAll();
    });

    els.applyRangeButton.addEventListener("click", () => {
      if (!els.rangeStart.value || !els.rangeEnd.value) return showToast("请选择开始和结束日期");
      if (els.rangeStart.value > els.rangeEnd.value) return showToast("开始日期不能晚于结束日期");
      activeRange = { start: els.rangeStart.value, end: els.rangeEnd.value };
      renderAll();
    });

    els.chartTypeControl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-chart-type]");
      if (!button) return;
      chartType = button.dataset.chartType;
      els.chartTypeControl.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      renderCategoryChart();
    });

    els.trendPeriodControl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-trend-period]");
      if (!button || button.dataset.trendPeriod === trendPeriod) return;
      trendPeriod = button.dataset.trendPeriod;
      els.trendPeriodControl.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      resetTrendUnitsForPeriod();
      renderTrend();
    });

    els.trendChart.addEventListener("wheel", (event) => {
      event.preventDefault();
      const maximum = maxTrendUnits();
      const direction = event.deltaY < 0 ? -1 : 1;
      const nextCount = clamp(trendUnitCount + direction, Math.min(3, maximum), maximum);
      if (nextCount === trendUnitCount) {
        showToast(direction < 0 ? "已缩放到最近 3 个单位" : "已显示可用的最完整范围");
        return;
      }
      trendUnitCount = nextCount;
      renderTrend();
    }, { passive: false });

    els.searchInput.addEventListener("input", renderLedger);
    els.typeFilter.addEventListener("change", () => {
      renderCategoryFilter();
      renderLedger();
    });
    els.categoryFilter.addEventListener("change", renderLedger);
    els.displayCurrencySelect.addEventListener("change", () => {
      displayCurrency = CURRENCIES[els.displayCurrencySelect.value] ? els.displayCurrencySelect.value : "HKD";
      state.displayCurrency = displayCurrency;
      persist();
      renderAll();
      showToast(`已切换为 ${displayCurrency} · ${CURRENCIES[displayCurrency].name}`);
    });

    els.ledgerBody.addEventListener("click", (event) => {
      const row = event.target.closest("[data-record-id]");
      if (!row) return;
      const record = state.transactions.find((item) => item.id === row.dataset.recordId);
      if (!record) return;
      if (event.target.closest("[data-delete-record]")) requestDeleteTransaction(record);
      else if (event.target.closest("[data-edit-record]")) openTransactionDrawer(record);
    });
    els.ledgerBody.addEventListener("mouseover", (event) => {
      showLedgerNoteTooltip(event.target.closest(".transaction-note.is-truncated"));
    });
    els.ledgerBody.addEventListener("mouseout", (event) => {
      const note = event.target.closest(".transaction-note.is-truncated");
      if (note && !note.contains(event.relatedTarget)) hideLedgerNoteTooltip();
    });
    els.ledgerBody.addEventListener("focusin", (event) => {
      showLedgerNoteTooltip(event.target.closest(".transaction-note.is-truncated"));
    });
    els.ledgerBody.addEventListener("focusout", (event) => {
      if (event.target.closest(".transaction-note.is-truncated")) hideLedgerNoteTooltip();
    });
    els.ledgerBody.closest(".ledger-table-wrap").addEventListener("scroll", hideLedgerNoteTooltip, { passive: true });
    window.addEventListener("resize", () => {
      hideLedgerNoteTooltip();
      requestAnimationFrame(refreshLedgerNoteOverflow);
    });

    els.transactionTypeSwitch.addEventListener("click", (event) => {
      const button = event.target.closest("[data-type]");
      if (!button) return;
      els.transactionType.value = button.dataset.type;
      els.transactionTypeSwitch.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      renderCategoryPicker(button.dataset.type);
    });

    els.categoryPicker.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category-id]");
      if (!button) return;
      selectedCategoryId = button.dataset.categoryId;
      els.categoryPicker.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    });

    els.transactionCurrency.addEventListener("change", updateRatePreview);
    els.transactionAmount.addEventListener("input", updateRatePreview);
    els.quickAddCategoryButton.addEventListener("click", () => {
      managerType = els.transactionType.value;
      els.categoryManagerTabs.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.categoryType === managerType));
      openCategoryModal();
    });

    els.transactionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const title = els.transactionTitle.value.trim();
      const amount = Number(els.transactionAmount.value);
      const type = els.transactionType.value;
      const date = els.transactionDate.value;
      const currency = els.transactionCurrency.value;
      if (!title) return void (els.transactionError.textContent = "请填写事件名称。");
      if (!Number.isFinite(amount) || amount <= 0) return void (els.transactionError.textContent = "金额必须大于 0。");
      if (!date) return void (els.transactionError.textContent = "请选择记账时间。");
      if (!state.categories.some((category) => category.id === selectedCategoryId && category.type === type)) return void (els.transactionError.textContent = "请选择一个事件分类。");
      const payload = {
        type, title, categoryId: selectedCategoryId, amount, currency,
        rate: rateFor(currency), amountHkd: Number((amount * rateFor(currency)).toFixed(2)),
        date, note: els.transactionNote.value.trim()
      };
      const existing = state.transactions.find((record) => record.id === els.transactionId.value);
      if (existing) Object.assign(existing, payload, { updatedAt: new Date().toISOString() });
      else state.transactions.push({ id: uid("tx"), ...payload, createdAt: new Date().toISOString() });
      persist();
      closeTransactionDrawer();
      renderAll();
      showToast(existing ? "账目已更新" : "已记下这笔账目");
    });

    els.deleteTransactionButton.addEventListener("click", () => {
      const record = state.transactions.find((item) => item.id === els.transactionId.value);
      if (record) requestDeleteTransaction(record);
    });

    els.categoryManagerTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category-type]");
      if (!button) return;
      managerType = button.dataset.categoryType;
      els.categoryManagerTabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      resetCategoryEditor();
    });

    els.categoryEmojiTrigger.addEventListener("click", () => {
      const willOpen = els.categoryEmojiPopover.hidden;
      els.categoryEmojiPopover.hidden = !willOpen;
      els.categoryEmojiTrigger.setAttribute("aria-expanded", String(willOpen));
    });

    els.categoryEmojiPopover.addEventListener("click", (event) => {
      const button = event.target.closest("[data-emoji]");
      if (!button) return;
      selectedCategoryEmoji = button.dataset.emoji;
      renderEmojiPopover();
      closeEmojiPopover();
      els.newCategoryName.focus();
    });

    els.cancelCategoryEditButton.addEventListener("click", () => resetCategoryEditor(true));

    els.categoryEditorForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = els.newCategoryName.value.trim();
      const editingId = els.editingCategoryId.value;
      const existing = state.categories.find((category) => category.id === editingId);
      if (!name) return showToast("请输入分类名称");
      if (state.categories.some((category) => category.id !== editingId && category.type === managerType && category.name.toLocaleLowerCase("zh-CN") === name.toLocaleLowerCase("zh-CN"))) return showToast("同类型中已有这个分类");
      if (existing) {
        Object.assign(existing, { name, icon: selectedCategoryEmoji });
      } else {
        const typeCount = state.categories.filter((category) => category.type === managerType).length;
        const created = { id: uid(managerType === "expense" ? "exp" : "inc"), type: managerType, name, icon: selectedCategoryEmoji, color: CATEGORY_COLORS[typeCount % CATEGORY_COLORS.length], locked: false };
        state.categories.push(created);
        if (els.transactionDrawer.classList.contains("open") && els.transactionType.value === managerType) selectedCategoryId = created.id;
      }
      persist();
      if (els.transactionDrawer.classList.contains("open") && els.transactionType.value === managerType) renderCategoryPicker(managerType, existing?.id || selectedCategoryId);
      resetCategoryEditor();
      renderAll();
      showToast(existing ? `已更新“${name}”` : `已新增“${name}”分类`);
    });

    els.categoryManagerList.addEventListener("click", (event) => {
      const row = event.target.closest("[data-category-id]");
      if (!row) return;
      const category = state.categories.find((item) => item.id === row.dataset.categoryId);
      if (!category) return;
      const deleteButton = event.target.closest("[data-delete-category]");
      if (!deleteButton) {
        editCategory(category);
        return;
      }
      if (deleteButton.disabled) return;
      const used = state.transactions.filter((record) => record.categoryId === category.id).length;
      showConfirm("删除这个分类？", used ? `“${category.name}”正在被 ${used} 笔账目使用；删除后，这些账目会归入同类型的“其他”。` : `“${category.name}”删除后不可恢复。`, () => {
        const fallback = state.categories.find((item) => item.type === category.type && item.locked);
        state.transactions.forEach((record) => { if (record.categoryId === category.id) record.categoryId = fallback.id; });
        state.categories = state.categories.filter((item) => item.id !== category.id);
        persist();
        if (els.editingCategoryId.value === category.id) resetCategoryEditor();
        else renderCategoryManager();
        renderAll();
        showToast(`已删除“${category.name}”`);
      });
    });

    els.confirmCancel.addEventListener("click", closeConfirm);
    els.confirmAccept.addEventListener("click", () => {
      const action = confirmAction;
      closeConfirm();
      action?.();
    });

    els.resetDemoButton.addEventListener("click", () => {
      showConfirm("清空账本？", "当前账号中的账目与自定义分类将被清空。", () => {
        state = defaultState();
        displayCurrency = "HKD";
        persist();
        els.searchInput.value = "";
        setSelectValue(els.typeFilter, "all");
        rangeMode = "month";
        activeRange = rangeForMode(rangeMode);
        trendPeriod = "day";
        trendUnitCount = 7;
        els.trendPeriodControl.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.trendPeriod === trendPeriod));
        els.rangePresets.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.range === rangeMode));
        els.customRange.hidden = true;
        renderAll();
        showToast("账本已清空");
      }, "确认清空");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (els.confirmDialog.classList.contains("open")) closeConfirm();
      else if (!els.categoryEmojiPopover.hidden) closeEmojiPopover();
      else if ([...customDateRegistry.values()].some((controller) => !controller.panel.hidden)) closeCustomDates();
      else if ([...customSelectRegistry.values()].some((controller) => !controller.menu.hidden)) closeCustomSelects();
      else if (els.categoryModal.classList.contains("open")) closeCategoryModal();
      else if (els.transactionDrawer.classList.contains("open")) closeTransactionDrawer();
    });

    document.addEventListener("click", (event) => {
      if (!els.categoryEmojiPopover.hidden && !event.target.closest(".emoji-picker-anchor")) closeEmojiPopover();
      if (!event.target.closest(".custom-select")) closeCustomSelects();
      if (!event.target.closest(".custom-date")) closeCustomDates();
    });
  }

  function init() {
    const currencyOptions = Object.entries(CURRENCIES).map(([code, currency]) => `<option value="${code}">${code} · ${currency.name}</option>`).join("");
    els.transactionCurrency.innerHTML = currencyOptions;
    els.displayCurrencySelect.innerHTML = currencyOptions;
    els.transactionCurrency.value = "HKD";
    els.displayCurrencySelect.value = displayCurrency;
    document.querySelectorAll("select").forEach(enhanceSelect);
    const monthRange = rangeForMode("month");
    els.rangeStart.value = monthRange.start;
    els.rangeEnd.value = monthRange.end;
    document.querySelectorAll('input[type="date"], input[type="datetime-local"]').forEach(enhanceDateInput);
    renderEmojiPopover();
    greeting();
    bindEvents();
    applyPortalTheme();
    initialized = true;
    renderAll();
    window.PortalAccountData?.useUser(authUser);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.type !== "portal:auth-state") return;
    loadForPortalUser(event.data.user || null);
  });

  window.addEventListener("storage", (event) => {
    if (event.key === "theme" && event.newValue) applyPortalTheme(event.newValue);
    if (event.key === currentStorageKey() && event.newValue) {
      state = loadState();
      displayCurrency = CURRENCIES[state.displayCurrency] ? state.displayCurrency : "HKD";
      if (initialized) renderAll();
    }
  });

  window.addEventListener("portal:account-data-restored", (event) => {
    const restoredUser = event.detail?.user;
    if (restoredUser?.id && restoredUser.id !== authUser?.id) authUser = { ...restoredUser };
    state = loadState();
    displayCurrency = CURRENCIES[state.displayCurrency] ? state.displayCurrency : "HKD";
    applyPortalTheme();
    if (initialized) {
      setSelectValue(els.displayCurrencySelect, displayCurrency);
      renderAll();
    }
  });

  init();
})();
