(() => {
  const ORDER_KEY = "portalNavOrder";
  const FORCE_LOGOUT_KEY = "portalForceLoggedOut";
  const GUEST_SESSION_KEY = "portalGuestSession";
  const DEFAULT_ORDER = ["home", "habitat", "journal", "bookmarks", "notes"];

  const sidebar = document.querySelector(".sidebar, .portal-sidebar");
  if (!sidebar) return;

  const settingsButton = sidebar.querySelector(".settings, .portal-settings");
  const navSelector = ".nav-item[data-nav-key], .portal-nav-item[data-nav-key]";

  const pageRoot = (() => {
    const path = window.location.pathname.replace(/\\/g, "/");
    if (path.includes("/home/")) return "..";
    if (path.includes("/Habitat/")) return "..";
    if (path.includes("/plan-journal/")) return "..";
    if (path.includes("/Note/")) return "..";
    return ".";
  })();
  const isEmbedded = window.top !== window.self;
  if (isEmbedded) document.documentElement.classList.add("portal-embedded");

  if (window.top === window.self) {
    const shellUrl = new URL(`${pageRoot}/index.html`, window.location.href);
    const shellDir = new URL("./", shellUrl).pathname;
    const route = `${window.location.pathname.slice(shellDir.length)}${window.location.search}${window.location.hash}`;
    shellUrl.searchParams.set("page", route || "home/index.html");
    window.location.replace(shellUrl.href);
    return;
  }

  const injectStyles = () => {
    if (document.getElementById("globalNavStyles")) return;
    const style = document.createElement("style");
    style.id = "globalNavStyles";
    style.textContent = `
      .settings-menu {
        position: fixed;
        left: 76px;
        bottom: 34px;
        z-index: 60;
        display: grid;
        gap: 6px;
        min-width: 138px;
        padding: 8px;
        border: 1px solid rgba(255,255,255,.82);
        border-radius: 14px;
        background: rgba(255,255,255,.82);
        box-shadow: 0 22px 54px rgba(var(--theme-rgb, 127,169,235), .16), inset 0 1px 0 rgba(255,255,255,.86);
        backdrop-filter: blur(18px);
        opacity: 0;
        transform: translate(-4px, 8px);
        pointer-events: none;
        transition: opacity .2s ease, transform .2s ease;
      }
      .settings-menu.open {
        opacity: 1;
        transform: translate(0, 0);
        pointer-events: auto;
      }
      .settings-action,
      .settings-save-action {
        min-height: 36px;
        padding: 0 12px;
        border: 0;
        border-radius: 10px;
        color: var(--theme-deep, var(--nav-theme-deep, #6f92cf));
        background: transparent;
        font: inherit;
        font-size: 14px;
        text-align: left;
        cursor: pointer;
        transition: background .18s ease, transform .18s ease;
      }
      .settings-action:hover,
      .settings-save-action:hover {
        background: rgba(var(--theme-rgb, var(--nav-theme-rgb, 127,169,235)), .12);
        transform: translateY(-1px);
      }
      .settings-save-action {
        color: #fff;
        background: var(--theme, var(--nav-theme, #7fa9eb));
        text-align: center;
        box-shadow: 0 10px 20px rgba(var(--theme-rgb, var(--nav-theme-rgb, 127,169,235)), .18);
      }
      .settings-save-action:hover {
        background: var(--theme, var(--nav-theme, #7fa9eb));
      }
      .settings-menu .danger-action {
        min-height: 36px;
        padding: 0 12px;
        border-radius: 10px;
        border: 0;
        color: #d93b3b;
        background: transparent;
        font: inherit;
        font-size: 14px;
        text-align: left;
        cursor: pointer;
        transition: background .18s ease, transform .18s ease;
      }
      .settings-menu .danger-action:hover {
        background: rgba(217, 59, 59, .1);
        transform: translateY(-1px);
      }
      .nav-reorder-mode [data-nav-key] {
        cursor: grab;
        touch-action: none;
      }
      .nav-reorder-mode [data-nav-key="home"] {
        cursor: default;
      }
      .nav-reorder-mode [data-nav-key]:active {
        cursor: grabbing;
      }
      [data-nav-key].dragging {
        opacity: .45;
        transform: scale(.96);
      }
      .nav-reorder-mode [data-nav-key]::before {
        content: "";
        position: absolute;
        inset: -5px;
        border-radius: 14px;
        border: 1px dashed rgba(var(--theme-rgb, var(--nav-theme-rgb, 127,169,235)), .35);
        pointer-events: none;
      }
      .nav-reorder-mode [data-nav-key="home"]::before {
        display: none;
      }
      .global-top-tools {
        position: fixed;
        top: 46px;
        right: 56px;
        z-index: 18;
        display: flex;
        align-items: flex-start;
        gap: 20px;
      }
      .global-player {
        display: grid;
        grid-template-columns: 48px 1fr 32px 52px 32px;
        align-items: center;
        gap: 14px;
        min-width: 420px;
        padding: 14px 18px;
        border-radius: 24px;
        background: rgba(255,255,255,.72);
        box-shadow: 0 18px 46px rgba(var(--theme-rgb, var(--nav-theme-rgb, 127,169,235)), .14), inset 0 0 22px rgba(255,255,255,.7);
        backdrop-filter: blur(18px);
      }
      .global-player .cover {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background:
          linear-gradient(150deg, rgba(var(--theme-rgb, var(--nav-theme-rgb, 127,169,235)), .3), rgba(255,255,255,.25)),
          url("${pageRoot}/home/images/avatar.png") center / cover;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.72), 0 8px 20px rgba(var(--theme-rgb, var(--nav-theme-rgb, 127,169,235)), .18);
      }
      .global-player p {
        margin: 0;
      }
      .global-player .song-title {
        color: #202636;
        font-weight: 800;
        font-size: 18px;
      }
      .global-player .artist {
        margin-top: 4px;
        color: #9aa4b8;
        font-size: 14px;
      }
      .global-player .player-btn {
        display: grid;
        place-items: center;
        border: 0;
        color: rgba(var(--theme-rgb, var(--nav-theme-rgb, 127,169,235)), .72);
        background: transparent;
        cursor: pointer;
      }
      .global-player .player-btn.play {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        color: #fff;
        background: var(--theme, var(--nav-theme, #7fa9eb));
        box-shadow: 0 12px 24px rgba(var(--theme-rgb, var(--nav-theme-rgb, 127,169,235)), .28);
      }
      .global-player .player-btn svg {
        width: 20px;
        height: 20px;
      }
      .global-theme-wrap {
        position: relative;
      }
      .global-theme-toggle {
        display: grid;
        place-items: center;
        width: 74px;
        height: 74px;
        border: 1px solid rgba(255,255,255,.78);
        border-radius: 28px;
        background: rgba(255,255,255,.72);
        box-shadow: 0 18px 46px rgba(var(--theme-rgb, 127,169,235), .14), inset 0 1px 0 rgba(255,255,255,.86);
        backdrop-filter: blur(20px);
        cursor: pointer;
      }
      .global-theme-current {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--theme-soft, var(--nav-theme-soft, #a9caff));
        box-shadow: 0 0 0 3px rgba(var(--theme-rgb, 127,169,235), .2), inset 0 0 0 1px rgba(var(--theme-rgb, 127,169,235), .42);
      }
      .global-theme-palette {
        position: absolute;
        top: 92px;
        right: 0;
        display: grid;
        grid-template-columns: repeat(4, 30px);
        gap: 10px;
        padding: 14px;
        border: 1px solid rgba(255,255,255,.82);
        border-radius: 16px;
        background: rgba(255,255,255,.88);
        box-shadow: 0 22px 54px rgba(var(--theme-rgb, 127,169,235), .16);
        backdrop-filter: blur(18px);
        opacity: 0;
        transform: translateY(-6px);
        pointer-events: none;
        transition: opacity .18s ease, transform .18s ease;
      }
      .global-theme-palette.open {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      .global-theme-swatch {
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 50%;
        background: var(--swatch);
        box-shadow: inset 0 0 0 2px rgba(255,255,255,.62);
        cursor: pointer;
      }
      .global-account-dock {
        position: fixed;
        right: 54px;
        bottom: 36px;
        z-index: 30;
      }
      .global-account-toggle {
        position: relative;
        display: grid;
        place-items: center;
        width: 50px;
        height: 50px;
        border: 1px solid rgba(255,255,255,.78);
        border-radius: 50%;
        background: rgba(255,255,255,.72);
        box-shadow: 0 12px 28px rgba(var(--theme-rgb, var(--nav-theme-rgb, 127,169,235)), .14), inset 0 1px 0 rgba(255,255,255,.86);
        backdrop-filter: blur(20px);
        cursor: pointer;
      }
      .global-account-avatar {
        position: relative;
        display: block;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background:
          radial-gradient(circle at 34% 28%, rgba(255,255,255,.96), rgba(255,255,255,.38) 44%, rgba(var(--theme-rgb, var(--nav-theme-rgb, 127,169,235)), .28)),
          linear-gradient(145deg, var(--theme-soft, var(--nav-theme-soft, #a9caff)), var(--theme, var(--nav-theme, #7fa9eb)));
        box-shadow: 0 0 0 3px rgba(var(--theme-rgb, var(--nav-theme-rgb, 127,169,235)), .16), inset 0 0 0 1px rgba(255,255,255,.76);
      }
      .global-account-avatar::after {
        content: "";
        position: absolute;
        right: -2px;
        bottom: -1px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid #fff;
        background: #54c982;
        box-shadow: none;
      }
      .global-account-panel {
        position: absolute;
        right: 0;
        bottom: 64px;
        display: grid;
        gap: 10px;
        width: min(330px, calc(100vw - 42px));
        padding: 16px;
        border: 1px solid rgba(255,255,255,.82);
        border-radius: 18px;
        background: rgba(255,255,255,.84);
        box-shadow: 0 28px 72px rgba(var(--theme-rgb, var(--nav-theme-rgb, 127,169,235)), .18);
        backdrop-filter: blur(22px);
        opacity: 0;
        transform: translateY(8px);
        pointer-events: none;
        transition: opacity .2s ease, transform .2s ease;
      }
      .global-account-panel.open {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      .global-account-panel strong {
        color: #202636;
        font-size: 15px;
      }
      .global-account-panel span {
        color: #8c98b0;
        font-size: 12px;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }
      @media (max-width: 820px) {
        .global-top-tools {
          top: 22px;
          right: 18px;
        }
        .global-player {
          min-width: 230px;
          grid-template-columns: 44px 1fr 48px;
        }
        .global-player .player-btn.skip {
          display: none;
        }
        .global-player .song-title {
          font-size: 15px;
        }
        .global-theme-toggle {
          width: 64px;
          height: 64px;
          border-radius: 23px;
        }
        .global-account-dock {
          right: 20px;
          bottom: 20px;
        }
      }
      html.portal-embedded .global-top-tools {
        top: 36px;
        right: 42px;
        gap: 22px;
      }
      @media (max-width: 820px) {
        html.portal-embedded .global-top-tools {
          top: 18px;
          right: 18px;
          gap: 10px;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const normalizeOrder = (order) => {
    const known = new Set(DEFAULT_ORDER);
    const cleaned = Array.isArray(order) ? order.filter((key) => known.has(key)) : [];
    const rest = [...cleaned, ...DEFAULT_ORDER.filter((key) => !cleaned.includes(key))]
      .filter((key) => key !== "home");
    return ["home", ...rest];
  };

  const getNavItems = () => Array.from(sidebar.querySelectorAll(navSelector));

  const applySavedOrder = () => {
    let order = DEFAULT_ORDER;
    try {
      order = normalizeOrder(JSON.parse(localStorage.getItem(ORDER_KEY) || "[]"));
    } catch {
      order = DEFAULT_ORDER;
    }

    const itemsByKey = new Map(getNavItems().map((item) => [item.dataset.navKey, item]));
    const beforeNode = sidebar.querySelector(".add-widget, .portal-add-widget, .settings, .portal-settings");
    order.forEach((key) => {
      const item = itemsByKey.get(key);
      if (item) sidebar.insertBefore(item, beforeNode);
    });
  };

  const ensureSettingsMenu = () => {
    if (!settingsButton) return null;

    let menu = sidebar.querySelector(".settings-menu");
    if (!menu) {
      menu = document.createElement("div");
      menu.className = "settings-menu";
      menu.setAttribute("aria-label", "设置菜单");
      settingsButton.insertAdjacentElement("afterend", menu);
    }

    if (!menu.querySelector("[data-global-action='reorder']")) {
      const reorder = document.createElement("button");
      reorder.className = "settings-action";
      reorder.type = "button";
      reorder.dataset.globalAction = "reorder";
      reorder.textContent = "调整组件位置";
      menu.prepend(reorder);
    }

    if (!menu.querySelector("[data-global-action='save-order']")) {
      const save = document.createElement("button");
      save.className = "settings-save-action";
      save.type = "button";
      save.dataset.globalAction = "save-order";
      save.hidden = true;
      save.textContent = "保存顺序";
      const reorder = menu.querySelector("[data-global-action='reorder']");
      reorder.insertAdjacentElement("afterend", save);
    }

    let signOut = menu.querySelector("[data-global-action='sign-out'], #signOutMenuBtn");
    if (!signOut) {
      signOut = document.createElement("button");
      signOut.className = "danger-action";
      signOut.type = "button";
      signOut.textContent = "退出登录";
      menu.appendChild(signOut);
    }
    signOut.dataset.globalAction = "sign-out";

    return menu;
  };

  const setMenuOpen = (menu, open) => {
    if (!menu || !settingsButton) return;
    menu.classList.toggle("open", open);
    settingsButton.setAttribute("aria-expanded", String(open));
  };

  const saveOrder = () => {
    const order = ["home", ...getNavItems()
      .map((item) => item.dataset.navKey)
      .filter((key) => key && key !== "home")];
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {}
  };

  let reorderMode = false;
  let draggingItem = null;

  const getAfterElement = (y) => {
    const draggableItems = getNavItems().filter((item) => item !== draggingItem && item.dataset.navKey !== "home");
    return draggableItems.reduce((closest, item) => {
      const box = item.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, item };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, item: null }).item;
  };

  const setReorderMode = (enabled, menu) => {
    reorderMode = enabled;
    sidebar.classList.toggle("nav-reorder-mode", enabled);
    getNavItems().forEach((item) => {
      item.draggable = enabled && item.dataset.navKey !== "home";
      if (enabled && item.disabled) {
        item.dataset.wasDisabled = "true";
        item.disabled = false;
        item.setAttribute("aria-disabled", "true");
      }
      if (!enabled && item.dataset.wasDisabled) {
        item.disabled = true;
        item.removeAttribute("aria-disabled");
        delete item.dataset.wasDisabled;
      }
    });

    const save = menu?.querySelector("[data-global-action='save-order']");
    const reorder = menu?.querySelector("[data-global-action='reorder']");
    if (save) save.hidden = !enabled;
    if (reorder) reorder.textContent = enabled ? "正在调整组件位置" : "调整组件位置";
  };

  const menu = ensureSettingsMenu();
  const hasLocalSettingsController = settingsButton?.id === "settingsButton" && menu?.id === "settingsMenu";
  injectStyles();
  applySavedOrder();

  if (settingsButton && menu) {
    if (!hasLocalSettingsController) {
      settingsButton.addEventListener("click", (event) => {
        event.stopPropagation();
        setMenuOpen(menu, !menu.classList.contains("open"));
      });
    }

    menu.addEventListener("click", (event) => {
      event.stopPropagation();
      const action = event.target.closest("[data-global-action]")?.dataset.globalAction;
      if (action === "reorder") {
        setReorderMode(true, menu);
      }
      if (action === "save-order") {
        saveOrder();
        setReorderMode(false, menu);
        setMenuOpen(menu, false);
      }
      if (action === "sign-out") {
        try {
          localStorage.removeItem("portalGuestSession");
          localStorage.removeItem("portalCurrentUserEmail");
          localStorage.setItem(FORCE_LOGOUT_KEY, "1");
        } catch {}
        window.location.href = `${pageRoot}/home/index.html?loggedOut=1`;
      }
    });

    if (!hasLocalSettingsController) {
      document.addEventListener("click", (event) => {
        if (!event.target.closest(".settings-menu") && !event.target.closest(".settings, .portal-settings")) {
          setMenuOpen(menu, false);
        }
      });
    }
  }

  sidebar.addEventListener("dragstart", (event) => {
    if (!reorderMode) return;
    const item = event.target.closest(navSelector);
    if (!item || item.dataset.navKey === "home") return;
    draggingItem = item;
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.dataset.navKey);
  });

  sidebar.addEventListener("dragover", (event) => {
    if (!reorderMode || !draggingItem) return;
    event.preventDefault();
    const afterElement = getAfterElement(event.clientY);
    const beforeNode = afterElement || sidebar.querySelector(".add-widget, .portal-add-widget, .settings, .portal-settings");
    sidebar.insertBefore(draggingItem, beforeNode);
  });

  sidebar.addEventListener("dragend", () => {
    if (!draggingItem) return;
    draggingItem.classList.remove("dragging");
    draggingItem = null;
  });

  const iconPlay = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7Z"/></svg>';
  const iconPause = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

  const ensureGlobalPlayer = () => {
    if (isEmbedded) return;
    if (document.querySelector(".top-tools .player, .global-player")) return;
    const tools = document.createElement("section");
    tools.className = "global-top-tools";
    tools.setAttribute("aria-label", "播放器");
    tools.innerHTML = `
      <div class="global-player">
        <div class="cover" aria-hidden="true"></div>
        <div>
          <p class="song-title">Dream It Possible</p>
          <p class="artist">Delacey</p>
        </div>
        <button class="player-btn skip" type="button" title="上一首">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m11 17-7-5 7-5v10Z"/><path d="M20 18V6"/></svg>
        </button>
        <button class="player-btn play" data-global-play type="button" title="播放">${iconPlay}</button>
        <button class="player-btn skip" type="button" title="下一首">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m13 7 7 5-7 5V7Z"/><path d="M4 6v12"/></svg>
        </button>
      </div>
    `;
    document.body.appendChild(tools);
  };

  const ensureGlobalThemeToggle = () => {
    if (document.body.dataset.globalThemeToggle !== "true") return;
    let tools = document.querySelector(".global-top-tools");
    if (!tools) {
      tools = document.createElement("section");
      tools.className = "global-top-tools";
      tools.setAttribute("aria-label", "主题颜色");
      document.body.appendChild(tools);
    }
    if (tools.querySelector(".global-theme-wrap")) return;
    const themes = [
      ["#e9a7ad", "#c9838a", "#f3c4c8", "233,167,173"],
      ["#e8b184", "#c58b62", "#f2ceb3", "232,177,132"],
      ["#dcc86e", "#b39d4d", "#efe1a9", "220,200,110"],
      ["#9fcfac", "#73a883", "#c7e8cf", "159,207,172"],
      ["#7fa9eb", "#6f92cf", "#a9caff", "127,169,235"],
      ["#a995dc", "#8a76bd", "#c8b8eb", "169,149,220"],
      ["#c99add", "#aa79bf", "#e4cdef", "201,154,221"]
    ];
    const wrap = document.createElement("div");
    wrap.className = "global-theme-wrap";
    wrap.innerHTML = `
      <button class="global-theme-toggle" type="button" aria-expanded="false" title="主题颜色">
        <span class="global-theme-current"></span>
      </button>
      <div class="global-theme-palette">
        ${themes.map(([theme, deep, soft, rgb]) => `
          <button class="global-theme-swatch" style="--swatch:${theme}" type="button"
            data-theme="${theme}" data-deep="${deep}" data-soft="${soft}" data-rgb="${rgb}" title="切换主题"></button>
        `).join("")}
      </div>
    `;
    tools.appendChild(wrap);
    const toggle = wrap.querySelector(".global-theme-toggle");
    const palette = wrap.querySelector(".global-theme-palette");
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = !palette.classList.contains("open");
      palette.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    palette.addEventListener("click", (event) => {
      event.stopPropagation();
      const swatch = event.target.closest(".global-theme-swatch");
      if (!swatch) return;
      const theme = {
        theme: swatch.dataset.theme,
        deep: swatch.dataset.deep,
        soft: swatch.dataset.soft,
        rgb: swatch.dataset.rgb,
        swatch: swatch.dataset.theme
      };
      const root = document.documentElement;
      root.style.setProperty("--theme", theme.theme);
      root.style.setProperty("--theme-deep", theme.deep);
      root.style.setProperty("--theme-soft", theme.soft);
      root.style.setProperty("--theme-rgb", theme.rgb);
      root.style.setProperty("--nav-theme", theme.theme);
      root.style.setProperty("--nav-theme-deep", theme.deep);
      root.style.setProperty("--nav-theme-soft", theme.soft);
      root.style.setProperty("--nav-theme-rgb", theme.rgb);
      try {
        localStorage.setItem("theme", JSON.stringify(theme));
      } catch {}
      palette.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("click", () => {
      palette.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  };

  const ensureGlobalAccountDock = () => {
    if (document.querySelector(".account-dock, .global-account-dock")) return;
    const isGuest = (() => {
      try {
        return localStorage.getItem(GUEST_SESSION_KEY) === "1";
      } catch {
        return false;
      }
    })();
    const savedEmail = (() => {
      try {
        return localStorage.getItem("portalCurrentUserEmail") || "";
      } catch {
        return "";
      }
    })();
    const title = isGuest ? "游客登录" : (savedEmail ? "已登录" : "未登录");
    const detail = isGuest
      ? "游客登录状态下，在此网站内所有保存的内容仅保存于本地浏览器。"
      : (savedEmail || "登录后，网站中的数据内容可同步到你的 Supabase 账号。");
    const dock = document.createElement("section");
    dock.className = "global-account-dock";
    dock.setAttribute("aria-label", "账号");
    dock.innerHTML = `
      <button class="global-account-toggle" type="button" aria-expanded="false" title="账号">
        <span class="global-account-avatar" aria-hidden="true"></span>
      </button>
      <div class="global-account-panel">
        <strong>${title}</strong>
        <span>${detail}</span>
      </div>
    `;
    document.body.appendChild(dock);

    const toggle = dock.querySelector(".global-account-toggle");
    const panel = dock.querySelector(".global-account-panel");
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = !panel.classList.contains("open");
      panel.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    document.addEventListener("click", () => {
      panel.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  };

  ensureGlobalPlayer();
  ensureGlobalThemeToggle();
  ensureGlobalAccountDock();

  if (!isEmbedded && !document.querySelector('link[data-portal-music]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${pageRoot}/music/player.css`;
    link.dataset.portalMusic = "true";
    document.head.appendChild(link);
  }
  if (!isEmbedded && !document.querySelector('script[data-portal-music]')) {
    const script = document.createElement("script");
    script.src = `${pageRoot}/music/player.js`;
    script.dataset.portalMusic = "true";
    document.body.appendChild(script);
  }

  document.querySelectorAll("[data-global-play]").forEach((button) => {
    button.addEventListener("click", () => {
      const playing = button.classList.toggle("is-playing");
      button.title = playing ? "暂停" : "播放";
      button.innerHTML = playing ? iconPause : iconPlay;
    });
  });
})();
