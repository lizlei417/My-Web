(() => {
  const layer = document.getElementById("moneyLedgerLayer");
  if (!layer) return;

  const DATA_KEY = "homeMoneyLedger:v1";
  const VISIBLE_KEY = "homeMoneyLedgerVisible:v1";
  let authUser = window.portalCurrentUser || null;
  let records = [];
  let selectedId = "";
  let filter = { start: "", end: "" };
  let interactionMode = "";
  let dragging = null;

  const uid = () => `money-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const userKey = (key) => authUser ? `user:${authUser.id}:${key}` : "";
  const today = () => new Date().toISOString().slice(0, 10);

  const readJson = (key, fallback) => {
    if (!key) return fallback;
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  const readVisible = () => {
    if (!authUser) return false;
    return localStorage.getItem(userKey(VISIBLE_KEY)) === "1";
  };

  const persist = () => writeJson(userKey(DATA_KEY), records);
  const persistVisible = (visible) => {
    if (!authUser) return;
    localStorage.setItem(userKey(VISIBLE_KEY), visible ? "1" : "0");
  };

  const formatMoney = (value) => Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const build = () => {
    layer.innerHTML = `
      <article class="money-ledger" hidden>
        <header class="money-ledger-head">
          <span class="money-ledger-icon" aria-hidden="true">¥</span>
          <div class="money-ledger-title"><strong>钱记</strong><span>把每一次克制，都变成看得见的积累</span></div>
          <button class="money-ledger-icon-button money-ledger-filter" type="button" title="筛选日期" aria-label="筛选日期">⌕</button>
          <button class="money-ledger-icon-button money-ledger-more" type="button" title="管理记录" aria-label="管理记录">···</button>
          <button class="money-ledger-icon-button money-ledger-close" type="button" title="关闭钱记" aria-label="关闭钱记">×</button>
        </header>
        <div class="money-ledger-toolbar">
          <button class="money-ledger-add" type="button">＋ 记一笔</button>
          <span class="money-ledger-filter-label">全部日期</span>
        </div>
        <div class="money-ledger-list"></div>
        <p class="money-ledger-total">很棒！你已累计节省 <strong>0.00</strong> 元！</p>
        <div class="money-ledger-menu">
          <button data-money-action="edit" type="button">编辑</button>
          <button class="danger" data-money-action="delete" type="button">删除</button>
        </div>
      </article>
      <section class="money-ledger-dialog" aria-hidden="true">
        <form class="money-ledger-dialog-card">
          <h2 class="money-ledger-dialog-title">新增记录</h2>
          <p class="money-ledger-dialog-message"></p>
          <div class="money-ledger-fields"></div>
          <p class="money-ledger-error"></p>
          <div class="money-ledger-dialog-actions">
            <button class="money-ledger-dialog-cancel" type="button">取消</button>
            <button class="money-ledger-dialog-confirm" type="submit">保存</button>
          </div>
        </form>
      </section>
    `;
  };

  build();

  const widget = layer.querySelector(".money-ledger");
  const list = layer.querySelector(".money-ledger-list");
  const total = layer.querySelector(".money-ledger-total strong");
  const filterLabel = layer.querySelector(".money-ledger-filter-label");
  const menu = layer.querySelector(".money-ledger-menu");
  const editModeButton = menu.querySelector('[data-money-action="edit"]');
  const deleteModeButton = menu.querySelector('[data-money-action="delete"]');
  const dialog = layer.querySelector(".money-ledger-dialog");
  const dialogForm = layer.querySelector(".money-ledger-dialog-card");
  const dialogTitle = layer.querySelector(".money-ledger-dialog-title");
  const dialogMessage = layer.querySelector(".money-ledger-dialog-message");
  const dialogFields = layer.querySelector(".money-ledger-fields");
  const dialogError = layer.querySelector(".money-ledger-error");
  const dialogConfirm = layer.querySelector(".money-ledger-dialog-confirm");
  let dialogSubmit = null;

  const filteredRecords = () => records
    .filter((record) => (!filter.start || record.date >= filter.start) && (!filter.end || record.date <= filter.end))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.updatedAt).localeCompare(String(a.updatedAt)));

  const render = () => {
    const shown = filteredRecords();
    if (!shown.some((record) => record.id === selectedId)) selectedId = shown[0]?.id || "";
    widget.classList.toggle("edit-mode", interactionMode === "edit");
    widget.classList.toggle("delete-mode", interactionMode === "delete");
    editModeButton.textContent = interactionMode === "edit" ? "退出编辑" : "编辑";
    deleteModeButton.textContent = interactionMode === "delete" ? "退出删除" : "删除";
    list.innerHTML = shown.length
      ? shown.map((record) => `
          <div class="money-ledger-row-wrap" data-record-id="${record.id}">
            <button class="money-ledger-row${record.id === selectedId ? " selected" : ""}" type="button"
              title="${interactionMode === "edit" ? "双击编辑这条记录" : "选择这条记录"}">
              <span class="money-ledger-event">${escapeHtml(record.event)}</span>
              <time class="money-ledger-date">${record.date}</time>
              <span class="money-ledger-amount">¥${formatMoney(record.amount)}</span>
            </button>
            <button class="money-ledger-row-delete" type="button" aria-label="删除 ${escapeHtml(record.event)}"
              title="删除这条记录">−</button>
          </div>
        `).join("")
      : '<p class="money-ledger-empty">这个时间范围还没有记录。<br>点击“记一笔”，把省下的钱记下来吧。</p>';
    const sum = shown.reduce((value, record) => value + Number(record.amount || 0), 0);
    total.textContent = formatMoney(sum);
    filterLabel.textContent = filter.start || filter.end
      ? `${filter.start || "最早"} 至 ${filter.end || "今天"}`
      : "全部日期";
  };

  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  const closeMenu = () => menu.classList.remove("open");

  const closeDialog = () => {
    dialog.classList.remove("open");
    layer.classList.remove("dialog-open");
    dialog.setAttribute("aria-hidden", "true");
    dialogSubmit = null;
  };

  const openDialog = ({ title, message = "", fields, confirm = "保存", danger = false, onSubmit }) => {
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    dialogFields.innerHTML = fields;
    dialogConfirm.textContent = confirm;
    dialogConfirm.classList.toggle("danger", danger);
    dialogError.textContent = "";
    dialogSubmit = onSubmit;
    layer.classList.add("dialog-open");
    dialog.classList.add("open");
    dialog.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => dialogFields.querySelector("input")?.focus());
  };

  const recordFields = (record) => {
    const value = record || {};
    return `
      <label class="money-ledger-field">事件<input name="event" maxlength="40" value="${escapeHtml(value.event || "")}" placeholder="例如：今天没有点外卖"></label>
      <label class="money-ledger-field">日期<input name="date" type="date" value="${value.date || today()}"></label>
      <label class="money-ledger-field">节省金额（元）<input name="amount" type="number" min="0.01" step="0.01" value="${value.amount || ""}" placeholder="0.00"></label>
    `;
  };

  const showRecordDialog = (record) => {
    openDialog({
      title: record ? "编辑记录" : "新增记录",
      message: record ? "修改后，累计节省金额会自动重新计算。" : "记下这次省钱的小事件。",
      fields: recordFields(record),
      onSubmit: (data) => {
        const event = String(data.get("event") || "").trim();
        const date = String(data.get("date") || "");
        const amount = Number(data.get("amount"));
        if (!event || !date || !Number.isFinite(amount) || amount <= 0) {
          dialogError.textContent = "请完整填写事件、日期和大于 0 的金额。";
          return false;
        }
        if (record) Object.assign(record, { event, date, amount, updatedAt: new Date().toISOString() });
        else {
          const created = { id: uid(), event, date, amount, updatedAt: new Date().toISOString() };
          records.push(created);
          selectedId = created.id;
        }
        persist();
        render();
        return true;
      }
    });
  };

  const showFilterDialog = () => {
    openDialog({
      title: "筛选记录",
      message: "选择开始和结束日期，累计金额会只计算范围内的记录。",
      fields: `
        <div class="money-ledger-date-fields">
          <label class="money-ledger-field">开始日期<input name="start" type="date" value="${filter.start}"></label>
          <label class="money-ledger-field">结束日期<input name="end" type="date" value="${filter.end}"></label>
        </div>
      `,
      confirm: "应用筛选",
      onSubmit: (data) => {
        const start = String(data.get("start") || "");
        const end = String(data.get("end") || "");
        if (start && end && start > end) {
          dialogError.textContent = "开始日期不能晚于结束日期。";
          return false;
        }
        filter = { start, end };
        render();
        return true;
      }
    });
  };

  const showDeleteDialog = (record) => {
    openDialog({
      title: "删除这条记录",
      message: `确定删除“${record.event}”吗？删除后累计金额会自动更新。`,
      fields: "",
      confirm: "确认删除",
      danger: true,
      onSubmit: () => {
        records = records.filter((item) => item.id !== record.id);
        selectedId = "";
        persist();
        render();
        return true;
      }
    });
  };

  const show = () => {
    if (!authUser) return;
    widget.hidden = false;
    persistVisible(true);
    render();
  };

  const hide = () => {
    widget.hidden = true;
    interactionMode = "";
    closeMenu();
    closeDialog();
    persistVisible(false);
  };

  const loadForUser = () => {
    records = authUser ? readJson(userKey(DATA_KEY), []) : [];
    if (!Array.isArray(records)) records = [];
    selectedId = "";
    filter = { start: "", end: "" };
    interactionMode = "";
    widget.hidden = !readVisible();
    render();
  };

  layer.querySelector(".money-ledger-add").addEventListener("click", () => showRecordDialog(null));
  layer.querySelector(".money-ledger-filter").addEventListener("click", showFilterDialog);
  layer.querySelector(".money-ledger-close").addEventListener("click", hide);
  layer.querySelector(".money-ledger-more").addEventListener("click", (event) => {
    event.stopPropagation();
    if (!records.length) return;
    menu.classList.toggle("open");
  });

  list.addEventListener("click", (event) => {
    const row = event.target.closest("[data-record-id]");
    if (!row) return;
    selectedId = row.dataset.recordId;
    list.querySelectorAll(".money-ledger-row").forEach((item) => {
      item.classList.toggle("selected", item.closest("[data-record-id]") === row);
    });
    if (event.target.closest(".money-ledger-row-delete")) {
      const record = records.find((item) => item.id === selectedId);
      if (record) showDeleteDialog(record);
    }
  });

  list.addEventListener("dblclick", (event) => {
    if (interactionMode !== "edit" || event.target.closest(".money-ledger-row-delete")) return;
    const row = event.target.closest("[data-record-id]");
    if (!row) return;
    const record = records.find((item) => item.id === row.dataset.recordId);
    if (record) showRecordDialog(record);
  });

  menu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-money-action]")?.dataset.moneyAction;
    if (!action) return;
    closeMenu();
    interactionMode = interactionMode === action ? "" : action;
    render();
  });

  dialogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!dialogSubmit) return;
    if (dialogSubmit(new FormData(dialogForm)) !== false) closeDialog();
  });
  layer.querySelector(".money-ledger-dialog-cancel").addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".money-ledger-menu, .money-ledger-more")) closeMenu();
  });

  const head = layer.querySelector(".money-ledger-head");
  head.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    const rect = widget.getBoundingClientRect();
    dragging = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    head.setPointerCapture(event.pointerId);
  });
  head.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    const left = Math.max(14, Math.min(window.innerWidth - widget.offsetWidth - 14, event.clientX - dragging.dx));
    const top = Math.max(14, Math.min(window.innerHeight - widget.offsetHeight - 14, event.clientY - dragging.dy));
    widget.style.left = `${left}px`;
    widget.style.top = `${top}px`;
  });
  head.addEventListener("pointerup", () => { dragging = null; });
  head.addEventListener("pointercancel", () => { dragging = null; });

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    if (!authUser && event.data?.user?.id) {
      authUser = { ...event.data.user };
      loadForUser();
    }
    if (event.data?.type === "portal:show-home-money-ledger") show();
  });

  window.addEventListener("portal:session-changed", (event) => {
    authUser = event.detail || null;
    if (!authUser) hide();
    loadForUser();
  });

  loadForUser();
})();
