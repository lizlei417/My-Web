(() => {
  const layer = document.getElementById("stickyNotesLayer");
  if (!layer) return;

  const STORAGE_KEY = "homeStickyNotes:v1";
  const ARCHIVE_KEY = "homeStickyNoteArchive:v1";
  const MIN_WIDTH = 300;
  const MIN_HEIGHT = 260;
  const VIEWPORT_GAP = 14;
  const PROFILE_GAP = 28;
  const TOOL_GAP = 14;
  const addOption = document.getElementById("addStickyNoteOption");
  let notes = [];
  let activeNote = null;
  let interaction = null;
  let saveTimer = null;
  let authUser = window.portalCurrentUser || null;

  const noteStyles = {
    classic: {
      label: "奶油默认",
      icon: '<svg class="sticky-note-brand-icon" viewBox="0 0 32 36" aria-hidden="true"><rect x="5" y="5" width="22" height="27" rx="3"/><path d="M11 6V3.5h10V6"/><path d="M12 3h8"/></svg>',
      doodle: '<svg class="sticky-note-doodle" viewBox="0 0 130 105" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"><path d="M32 34c2-11 10-17 22-15l50 7c7 1 11 6 10 13l-7 45c-2 10-13 14-23 8-9 10-21 11-34 7L20 90c17-7 7-39 12-56Z"/><path d="M84 31 87 9c1-7 11-7 10 1l-4 28c-1 7-11 6-10-1l3-20c1-5 7-4 7 1"/><path d="M58 58h.1M82 61h.1"/><path d="M63 70c4 6 12 7 17 1"/><path d="m14 20 3-6 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z"/><path d="m116 69 2-4 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z"/></g></svg>'
    },
    clover: {
      label: "幸运绿",
      icon: '<svg class="sticky-note-brand-icon" viewBox="0 0 36 36" aria-hidden="true"><path d="M18 18C9 12 10 5 15 5c4 0 5 5 3 13Z"/><path d="M18 18c6-9 13-8 13-3 0 4-5 5-13 3Z"/><path d="M18 18c9 6 8 13 3 13-4 0-5-5-3-13Z"/><path d="M18 18c-6 9-13 8-13 3 0-4 5-5 13-3Z"/><path d="M20 21c3 3 5 6 6 10"/></svg>',
      doodle: '<svg class="sticky-note-doodle" viewBox="0 0 130 105" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"><path d="M42 57h47c8 0 14 6 14 14v2c0 9-7 16-16 16H46c-10 0-17-7-17-16v-2c0-8 5-14 13-14Z"/><path d="M102 64c13-3 20 16 3 21"/><path d="M43 57c10-6 35-6 48 0"/><path d="M54 73h.1M76 73h.1"/><path d="M59 80c5 4 13 4 18 0"/><path d="M49 42c-8-8-1-15 7-7 8-8 15-1 7 7"/><path d="M79 41c-7-7-1-13 6-6 7-7 13-1 6 6"/><path d="M61 26c-3-5 2-9 6-5 4-5 9-1 6 5"/></g></svg>'
    },
    planet: {
      label: "星球紫",
      icon: '<svg class="sticky-note-brand-icon" viewBox="0 0 38 34" aria-hidden="true"><ellipse cx="19" cy="17" rx="11" ry="10"/><path d="M4 25c5 4 15 2 23-4 8-5 11-12 8-15-4-4-15-1-24 5C3 16 0 22 4 25Z"/><path d="M11 8 9 4M29 28l3 3"/></svg>',
      doodle: '<svg class="sticky-note-doodle" viewBox="0 0 130 105" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"><path d="m33 68 9-15 8 13 15 3-12 10 3 16-14-8-14 8 3-16-12-10 14-1Z"/><path d="M65 59c20-15 38-21 54-20"/><path d="M75 67c17-8 31-12 43-12"/><path d="M93 35v5M96 37h-5M110 25v4M112 27h-4M101 75v4M103 77h-4"/></g></svg>'
    },
    whale: {
      label: "海风蓝",
      icon: '<svg class="sticky-note-brand-icon" viewBox="0 0 38 34" aria-hidden="true"><path d="M7 20c6-10 21-12 29-3-5 1-7 6-14 8-7 2-17 0-15-5Z"/><path d="M8 19c-3-1-6-5-5-9 4 1 7 4 8 8"/><path d="M25 14c3-6 8-8 11-5-1 5-5 8-10 8"/><path d="M15 17h.1"/><path d="M18 9c0-4 3-4 3 0"/><path d="M23 9c2-4 5-2 3 1"/></svg>',
      doodle: '<svg class="sticky-note-doodle" viewBox="0 0 130 105" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"><path d="M31 70c0-19 16-33 37-33 19 0 34 12 38 29 5-5 13-8 20-4-4 5-9 8-15 9 6 3 10 8 11 14-8 1-15-2-20-8-5 15-20 23-39 23-19 0-32-11-32-30Z"/><path d="M49 77c9 8 28 8 42 1"/><path d="M54 63h.1"/><path d="M66 73c5 4 13 4 18 0"/><path d="M61 31c0-8 6-8 6 0"/><path d="M75 31c4-8 10-4 5 2"/><path d="M49 36c-6-7 1-12 7-5"/></g></svg>'
    },
    letter: {
      label: "甜心粉",
      icon: '<svg class="sticky-note-brand-icon" viewBox="0 0 34 36" aria-hidden="true"><path d="M15 31V14"/><path d="M16 14c-6-8-14-2-8 6 3 4 7 5 8 5 1-3 1-7 0-11Z"/><path d="M17 14c6-8 14-2 8 6-3 4-7 5-9 5 0-3 0-7 1-11Z"/><path d="M15 12c-2-8 6-10 8-3 1 4-3 6-7 6"/><path d="M15 23c-4 0-7 2-10 5"/><path d="M16 24c4 0 7 2 10 5"/></svg>',
      doodle: '<svg class="sticky-note-doodle" viewBox="0 0 130 105" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"><g transform="rotate(15 66 64)"><rect x="34" y="45" width="64" height="38" rx="8"/><path d="M38 51 66 70 94 51"/><path d="M38 82 59 64"/><path d="M94 82 73 64"/><path d="M63 58c-6-7-14 1-7 8l10 9 10-9c8-7-1-15-8-7-2 2-3 4-3 6-1-3-2-5-2-7Z"/></g><path d="M96 30c-5-6-12 1-6 7l6 5 7-5c6-6-1-13-7-7Z"/><path d="M21 72c-5-6-11 1-6 7l6 5 7-5c6-5 0-12-7-7Z"/><path d="M108 83c-5-6-11 1-6 7l6 5 7-5c6-5 0-12-7-7Z"/></g></svg>'
    },
    cloud: {
      label: "晴云蓝",
      icon: '<svg class="sticky-note-brand-icon" viewBox="0 0 38 34" aria-hidden="true"><path d="M12 25h15c5 0 8-3 8-7s-4-7-8-6C25 6 17 5 14 11 8 10 4 14 4 19c0 4 3 6 8 6Z"/><path d="M13 19h.1M24 19h.1"/><path d="M16 23c3 3 7 3 10 0"/></svg>',
      doodle: '<svg class="sticky-note-doodle" viewBox="0 0 130 105" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"><path d="M39 73h49c11 0 19-7 19-17 0-11-10-18-21-15-5-18-30-19-37-3-12-2-24 6-24 19 0 9 6 16 14 16Z"/><path d="M55 56h.1M78 56h.1"/><path d="M62 66c5 4 13 4 18 0"/><path d="M39 84v5M58 84v6M78 84v5"/><path d="m20 36 2-5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/><path d="m112 30 2-4 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z"/></g></svg>'
    }
  };
  const styleOrder = ["classic", "clover", "planet", "whale", "letter", "cloud"];

  const icons = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4.2L7.5 19 18 8.5 14.5 5 4 16Z"/><path d="m13.8 5.7 3.5 3.5"/><path d="M3 21h7"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 18 5-5 3 3 2.5-2.5L20 19"/></svg>',
    style: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="m8 12 3 3 5-7"/></svg>'
  };

  const uid = () => `sticky-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const dateParts = (date = new Date()) => {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return {
      date: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`,
      weekday: weekdays[date.getDay()]
    };
  };

  const userStorageKey = (key) => authUser ? `user:${authUser.id}:${key}` : "";

  const canUseStickyNotes = () => Boolean(authUser);

  const requestLogin = () => {
    window.dispatchEvent(new CustomEvent("portal:sticky-login-required"));
  };

  const currentStorageKey = () => userStorageKey(STORAGE_KEY);
  const currentArchiveKey = () => userStorageKey(ARCHIVE_KEY);

  const readJson = (key) => {
    if (!key) return [];
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const writeJson = (key, value) => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  const persist = () => {
    clearTimeout(saveTimer);
    writeJson(currentStorageKey(), notes);
  };

  const schedulePersist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 180);
  };

  const getState = (id) => notes.find((note) => note.id === id);
  const normalizeStyle = (value) => noteStyles[value] ? value : "classic";

  const rectsOverlap = (a, b) => (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );

  const expandedRect = (rect, gap) => ({
    left: rect.left - gap,
    top: rect.top - gap,
    right: rect.right + gap,
    bottom: rect.bottom + gap
  });

  const profileExclusion = () => {
    const profile = document.querySelector(".profile");
    if (!profile) return null;
    return expandedRect(profile.getBoundingClientRect(), PROFILE_GAP);
  };

  const toolExclusions = () => {
    const exclusions = [];
    const colorTools = document.querySelector(".top-tools");
    if (colorTools) exclusions.push(expandedRect(colorTools.getBoundingClientRect(), TOOL_GAP));
    if (document.documentElement.classList.contains("portal-embedded")) {
      exclusions.push({
        left: Math.max(0, window.innerWidth - 590),
        top: 12,
        right: window.innerWidth - 92,
        bottom: 126
      });
    }
    return exclusions;
  };

  const withinViewport = (rect) => (
    rect.left >= VIEWPORT_GAP &&
    rect.top >= VIEWPORT_GAP &&
    rect.right <= window.innerWidth - VIEWPORT_GAP &&
    rect.bottom <= window.innerHeight - VIEWPORT_GAP
  );

  const isLegalRect = (rect) => {
    if (!withinViewport(rect)) return false;
    const profile = profileExclusion();
    if (profile && rectsOverlap(rect, profile)) return false;
    return !toolExclusions().some((toolRect) => rectsOverlap(rect, toolRect));
  };

  const stateRect = (state) => ({
    left: state.x,
    top: state.y,
    right: state.x + state.width,
    bottom: state.y + state.height,
    width: state.width,
    height: state.height
  });

  const maxArea = () => window.innerWidth * window.innerHeight * .25;

  const fitSizeToArea = (width, height) => {
    const limit = maxArea();
    if (width * height <= limit) return { width, height };
    const scale = Math.sqrt(limit / (width * height));
    return {
      width: Math.max(Math.min(MIN_WIDTH, window.innerWidth - VIEWPORT_GAP * 2), Math.floor(width * scale)),
      height: Math.max(Math.min(MIN_HEIGHT, window.innerHeight - VIEWPORT_GAP * 2), Math.floor(height * scale))
    };
  };

  const clampSize = (width, height, changedWidth = true) => {
    let nextWidth = Math.max(Math.min(MIN_WIDTH, window.innerWidth - VIEWPORT_GAP * 2), width);
    let nextHeight = Math.max(Math.min(MIN_HEIGHT, window.innerHeight - VIEWPORT_GAP * 2), height);
    const limit = maxArea();
    if (nextWidth * nextHeight > limit) {
      if (changedWidth) nextWidth = limit / nextHeight;
      else nextHeight = limit / nextWidth;
    }
    return { width: Math.floor(nextWidth), height: Math.floor(nextHeight) };
  };

  const candidatePositions = (width, height) => {
    const gap = 24;
    const spots = [
      [110, 145],
      [window.innerWidth - width - 52, window.innerHeight - height - 42],
      [110, window.innerHeight - height - 42],
      [window.innerWidth - width - 52, 145],
      [VIEWPORT_GAP, VIEWPORT_GAP],
      [window.innerWidth - width - VIEWPORT_GAP, window.innerHeight - height - VIEWPORT_GAP]
    ];
    for (let y = VIEWPORT_GAP; y <= window.innerHeight - height - VIEWPORT_GAP; y += gap) {
      for (let x = VIEWPORT_GAP; x <= window.innerWidth - width - VIEWPORT_GAP; x += gap) {
        spots.push([x, y]);
      }
    }
    return spots;
  };

  const findLegalPosition = (width, height, preferredX, preferredY, avoidRects = []) => {
    const candidates = [[preferredX, preferredY], ...candidatePositions(width, height)]
      .map(([x, y]) => ({
        x: Math.max(VIEWPORT_GAP, Math.min(window.innerWidth - width - VIEWPORT_GAP, x)),
        y: Math.max(VIEWPORT_GAP, Math.min(window.innerHeight - height - VIEWPORT_GAP, y))
      }))
      .sort((a, b) => Math.hypot(a.x - preferredX, a.y - preferredY) - Math.hypot(b.x - preferredX, b.y - preferredY));

    const isAvailable = ({ x, y }) => {
      const rect = { left: x, top: y, right: x + width, bottom: y + height };
      return isLegalRect(rect) && !avoidRects.some((avoid) => rectsOverlap(rect, avoid));
    };

    return candidates.find(isAvailable)
      || candidates.find(({ x, y }) => isLegalRect({ left: x, top: y, right: x + width, bottom: y + height }))
      || { x: VIEWPORT_GAP, y: VIEWPORT_GAP };
  };

  const normalizeState = (raw, index = 0) => {
    const fitted = fitSizeToArea(Number(raw.width) || 370, Number(raw.height) || 390);
    const preferredX = Number.isFinite(Number(raw.x)) ? Number(raw.x) : 112 + index * 28;
    const preferredY = Number.isFinite(Number(raw.y)) ? Number(raw.y) : 145 + index * 22;
    const position = findLegalPosition(fitted.width, fitted.height, preferredX, preferredY);
    return {
      id: raw.id || uid(),
      x: position.x,
      y: position.y,
      width: fitted.width,
      height: fitted.height,
      text: String(raw.text || ""),
      image: typeof raw.image === "string" ? raw.image : "",
      style: normalizeStyle(raw.style),
      createdAt: raw.createdAt || new Date().toISOString()
    };
  };

  const setElementGeometry = (element, state) => {
    element.style.left = `${state.x}px`;
    element.style.top = `${state.y}px`;
    element.style.width = `${state.width}px`;
    element.style.height = `${state.height}px`;
  };

  const closeMenus = (except) => {
    layer.querySelectorAll(".sticky-note-menu.open, .sticky-style-popover.open").forEach((menu) => {
      if (menu === except) return;
      menu.classList.remove("open");
      menu.previousElementSibling?.setAttribute("aria-expanded", "false");
    });
  };

  const setActive = (element) => {
    if (activeNote && activeNote !== element) activeNote.classList.remove("is-active");
    activeNote = element;
    activeNote?.classList.add("is-active");
  };

  const archiveDisplayName = (archive, archivedAt) => {
    const base = dateParts(new Date(archivedAt)).date;
    const used = archive.map((item) => item.name);
    if (!used.includes(base)) return base;
    let index = 1;
    while (used.includes(`${base}（${index}）`)) index += 1;
    return `${base}（${index}）`;
  };

  const stylePreview = (key, selected = false) => `
    <button class="sticky-style-option${selected ? " selected" : ""}" data-style="${key}" type="button" aria-label="切换为${noteStyles[key].label}">
      <span class="sticky-style-preview sticky-style-${key}">
        <span class="preview-head">${noteStyles[key].icon}<b>便签</b><em>✦</em></span>
        <span class="preview-line"></span>
        <span class="preview-doodle">${noteStyles[key].doodle}</span>
      </span>
      <span>${noteStyles[key].label}</span>
    </button>
  `;

  const buildNote = (state) => {
    const { date, weekday } = dateParts();
    const styleKey = normalizeStyle(state.style);
    const element = document.createElement("article");
    element.className = `sticky-note sticky-style-${styleKey}${state.image ? " has-image" : ""}`;
    element.dataset.noteId = state.id;
    element.innerHTML = `
      <header class="sticky-note-header">
        <div class="sticky-note-brand">
          ${noteStyles[styleKey].icon}
          <span class="sticky-note-title">便签</span>
          <span class="sticky-note-sparkle" aria-hidden="true">✦</span>
        </div>
        <div class="sticky-note-meta">
          <time>${date}</time>
          <span>${weekday}</span>
          <button class="sticky-note-more" type="button" aria-label="更多操作" aria-expanded="false">···</button>
          <div class="sticky-note-menu">
            <button class="sticky-note-archive" type="button">归档</button>
          </div>
        </div>
      </header>
      <div class="sticky-note-body">
        ${state.image ? `<img class="sticky-note-image" alt="便签图片">` : ""}
        <textarea class="sticky-note-text" placeholder="记录点什么吧..."></textarea>
        ${noteStyles[styleKey].doodle}
      </div>
      <footer class="sticky-note-footer">
        <div class="sticky-note-tools">
          <button class="sticky-note-tool" data-action="edit" type="button" title="编辑">${icons.edit}</button>
          <button class="sticky-note-tool" data-action="image" type="button" title="添加图片">${icons.image}</button>
          <button class="sticky-note-tool" data-action="style" type="button" title="切换便签款式" aria-expanded="false">${icons.style}</button>
          <div class="sticky-style-popover" aria-label="选择便签款式">
            ${styleOrder.map((key) => stylePreview(key, key === styleKey)).join("")}
          </div>
        </div>
        <button class="sticky-note-save" type="button" title="保存便签" aria-label="保存便签">✦</button>
      </footer>
      <input class="sticky-note-file" type="file" accept="image/*" hidden>
      ${["n", "ne", "e", "se", "s", "sw", "w", "nw"].map((edge) => `<span class="sticky-resize-handle" data-edge="${edge}" aria-hidden="true"></span>`).join("")}
    `;

    setElementGeometry(element, state);
    const textarea = element.querySelector(".sticky-note-text");
    textarea.value = state.text;
    const image = element.querySelector(".sticky-note-image");
    if (image) image.src = state.image;
    installNoteEvents(element);
    return element;
  };

  const applyStyle = (element, styleKey) => {
    const state = getState(element.dataset.noteId);
    if (!state) return;
    const next = normalizeStyle(styleKey);
    state.style = next;
    styleOrder.forEach((key) => element.classList.toggle(`sticky-style-${key}`, key === next));
    element.querySelector(".sticky-note-brand-icon")?.remove();
    element.querySelector(".sticky-note-brand").insertAdjacentHTML("afterbegin", noteStyles[next].icon);
    element.querySelector(".sticky-note-doodle")?.remove();
    element.querySelector(".sticky-note-body").insertAdjacentHTML("beforeend", noteStyles[next].doodle);
    element.querySelectorAll(".sticky-style-option").forEach((button) => {
      button.classList.toggle("selected", button.dataset.style === next);
    });
    persist();
  };

  const saveNote = (element, animate = false) => {
    const state = getState(element.dataset.noteId);
    if (!state) return;
    state.text = element.querySelector(".sticky-note-text").value;
    persist();
    if (animate) {
      const button = element.querySelector(".sticky-note-save");
      button.classList.remove("saved");
      void button.offsetWidth;
      button.classList.add("saved");
    }
  };

  const archiveNote = (element) => {
    if (!canUseStickyNotes()) {
      requestLogin();
      return;
    }
    saveNote(element);
    const state = getState(element.dataset.noteId);
    if (!state) return;
    const archive = readJson(currentArchiveKey());
    const archivedAt = new Date().toISOString();
    archive.unshift({
      ...state,
      id: uid(),
      sourceId: state.id,
      name: archiveDisplayName(archive, archivedAt),
      archivedAt
    });
    writeJson(currentArchiveKey(), archive);
    notes = notes.filter((note) => note.id !== state.id);
    if (activeNote === element) activeNote = null;
    element.remove();
    persist();
    window.parent?.postMessage({ type: "portal:sticky-archive-updated" }, "*");
  };

  const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const maxSide = 1000;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", .78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  const beginInteraction = (event, element, mode, edge = "") => {
    const state = getState(element.dataset.noteId);
    if (!state) return;
    event.preventDefault();
    event.stopPropagation();
    setActive(element);
    closeMenus();
    interaction = {
      pointerId: event.pointerId,
      element,
      mode,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      original: { x: state.x, y: state.y, width: state.width, height: state.height },
      lastLegal: { x: state.x, y: state.y, width: state.width, height: state.height }
    };
    element.classList.add("is-moving");
    element.setPointerCapture(event.pointerId);
  };

  const resizeCandidate = (dx, dy) => {
    const { original, edge } = interaction;
    let x = original.x;
    let y = original.y;
    let width = original.width;
    let height = original.height;
    if (edge.includes("e")) width += dx;
    if (edge.includes("s")) height += dy;
    if (edge.includes("w")) {
      width -= dx;
      x += dx;
    }
    if (edge.includes("n")) {
      height -= dy;
      y += dy;
    }
    const beforeWidth = width;
    const beforeHeight = height;
    const size = clampSize(width, height, edge.includes("e") || edge.includes("w"));
    width = size.width;
    height = size.height;
    if (edge.includes("w")) x += beforeWidth - width;
    if (edge.includes("n")) y += beforeHeight - height;
    return { x, y, width, height };
  };

  const moveInteraction = (event) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    const dx = event.clientX - interaction.startX;
    const dy = event.clientY - interaction.startY;
    const candidate = interaction.mode === "drag"
      ? { ...interaction.original, x: interaction.original.x + dx, y: interaction.original.y + dy }
      : resizeCandidate(dx, dy);
    if (isLegalRect(stateRect(candidate))) interaction.lastLegal = candidate;
    setElementGeometry(interaction.element, candidate);
  };

  const endInteraction = (event) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    const { element, lastLegal } = interaction;
    const state = getState(element.dataset.noteId);
    Object.assign(state, lastLegal);
    setElementGeometry(element, state);
    element.classList.remove("is-moving");
    try {
      element.releasePointerCapture(event.pointerId);
    } catch {}
    interaction = null;
    persist();
  };

  const installNoteEvents = (element) => {
    const header = element.querySelector(".sticky-note-header");
    const textarea = element.querySelector(".sticky-note-text");
    const moreButton = element.querySelector(".sticky-note-more");
    const menu = element.querySelector(".sticky-note-menu");
    const fileInput = element.querySelector(".sticky-note-file");
    const styleButton = element.querySelector("[data-action='style']");
    const stylePopover = element.querySelector(".sticky-style-popover");

    element.addEventListener("pointerdown", () => setActive(element));
    header.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      beginInteraction(event, element, "drag");
    });
    element.querySelectorAll(".sticky-resize-handle").forEach((handle) => {
      handle.addEventListener("pointerdown", (event) => beginInteraction(event, element, "resize", handle.dataset.edge));
    });
    element.addEventListener("pointermove", moveInteraction);
    element.addEventListener("pointerup", endInteraction);
    element.addEventListener("pointercancel", endInteraction);

    textarea.addEventListener("input", () => {
      const state = getState(element.dataset.noteId);
      state.text = textarea.value;
      schedulePersist();
    });

    moreButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = !menu.classList.contains("open");
      closeMenus(menu);
      menu.classList.toggle("open", open);
      moreButton.setAttribute("aria-expanded", String(open));
    });

    element.querySelector(".sticky-note-archive").addEventListener("click", () => archiveNote(element));
    element.querySelector("[data-action='edit']").addEventListener("click", () => textarea.focus());
    element.querySelector("[data-action='image']").addEventListener("click", () => fileInput.click());
    styleButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = !stylePopover.classList.contains("open");
      closeMenus(stylePopover);
      stylePopover.classList.toggle("open", open);
      styleButton.setAttribute("aria-expanded", String(open));
    });
    stylePopover.addEventListener("click", (event) => {
      event.stopPropagation();
      const option = event.target.closest("[data-style]");
      if (!option) return;
      applyStyle(element, option.dataset.style);
      stylePopover.classList.remove("open");
      styleButton.setAttribute("aria-expanded", "false");
    });
    element.querySelector(".sticky-note-save").addEventListener("click", () => saveNote(element, true));

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const source = await compressImage(file);
        const state = getState(element.dataset.noteId);
        state.image = source;
        let image = element.querySelector(".sticky-note-image");
        if (!image) {
          image = document.createElement("img");
          image.className = "sticky-note-image";
          image.alt = "便签图片";
          element.querySelector(".sticky-note-body").prepend(image);
        }
        image.src = source;
        element.classList.add("has-image");
        persist();
      } catch {}
      fileInput.value = "";
    });
  };

  const addNote = (raw = {}) => {
    if (!canUseStickyNotes()) {
      requestLogin();
      return;
    }
    const size = fitSizeToArea(Number(raw.width) || 370, Number(raw.height) || 390);
    const position = findLegalPosition(
      size.width,
      size.height,
      Number.isFinite(Number(raw.x)) ? Number(raw.x) : 112 + notes.length * 28,
      Number.isFinite(Number(raw.y)) ? Number(raw.y) : 145 + notes.length * 22,
      notes.map((note) => expandedRect(stateRect(note), 14))
    );
    const state = normalizeState({
      ...raw,
      id: uid(),
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      createdAt: new Date().toISOString()
    }, notes.length);
    notes.push(state);
    const element = buildNote(state);
    layer.appendChild(element);
    setActive(element);
    persist();
    requestAnimationFrame(() => element.querySelector(".sticky-note-text").focus());
  };

  const repairLayout = () => {
    notes.forEach((state) => {
      const size = fitSizeToArea(state.width, state.height);
      state.width = size.width;
      state.height = size.height;
      const position = findLegalPosition(state.width, state.height, state.x, state.y);
      state.x = position.x;
      state.y = position.y;
      const element = layer.querySelector(`[data-note-id="${CSS.escape(state.id)}"]`);
      if (element) setElementGeometry(element, state);
    });
    persist();
  };

  const loadNotesForCurrentUser = () => {
    clearTimeout(saveTimer);
    closeMenus();
    activeNote = null;
    interaction = null;
    layer.innerHTML = "";
    notes = canUseStickyNotes() ? readJson(currentStorageKey()).map(normalizeState) : [];
    notes.forEach((state) => layer.appendChild(buildNote(state)));
    if (canUseStickyNotes()) persist();
  };

  loadNotesForCurrentUser();

  addOption?.addEventListener("click", (event) => {
    event.stopPropagation();
    document.getElementById("widgetMenu")?.classList.remove("open");
    if (!canUseStickyNotes()) {
      requestLogin();
      return;
    }
    addNote();
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    if (!authUser && event.data?.user?.id) {
      authUser = {
        id: event.data.user.id,
        email: event.data.user.email || "",
        isGuest: Boolean(event.data.user.isGuest)
      };
      loadNotesForCurrentUser();
    }
    if (event.data?.type === "portal:add-home-sticky-note") addNote();
    if (event.data?.type === "portal:restore-home-sticky-note") addNote(event.data.note || {});
  });

  window.addEventListener("portal:session-changed", (event) => {
    if (activeNote && canUseStickyNotes()) saveNote(activeNote);
    else if (canUseStickyNotes()) persist();
    authUser = event.detail || null;
    loadNotesForCurrentUser();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".sticky-note")) {
      if (activeNote) saveNote(activeNote);
      activeNote?.classList.remove("is-active");
      activeNote = null;
      closeMenus();
      return;
    }
    if (!event.target.closest(".sticky-note-menu, .sticky-note-more, .sticky-style-popover, [data-action='style']")) closeMenus();
  });

  window.addEventListener("resize", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(repairLayout, 100);
  });
})();
