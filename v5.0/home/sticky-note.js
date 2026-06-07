(() => {
  const layer = document.getElementById("stickyNotesLayer");
  if (!layer) return;

  const STORAGE_KEY = "homeStickyNotes:v1";
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

  const icons = {
    clipboard: '<svg class="sticky-note-brand-icon" viewBox="0 0 32 36" aria-hidden="true"><rect x="5" y="5" width="22" height="27" rx="3"/><path d="M11 6V3.5h10V6"/><path d="M12 3h8"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4.2L7.5 19 18 8.5 14.5 5 4 16Z"/><path d="m13.8 5.7 3.5 3.5"/><path d="M3 21h7"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 18 5-5 3 3 2.5-2.5L20 19"/></svg>',
    todo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 2.3 2.3L16 8.5"/></svg>',
    doodle: '<svg class="sticky-note-doodle" viewBox="0 0 130 105" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"><path d="M32 34c2-11 10-17 22-15l50 7c7 1 11 6 10 13l-7 45c-2 10-13 14-23 8-9 10-21 11-34 7L20 90c17-7 7-39 12-56Z"/><path d="M84 31 87 9c1-7 11-7 10 1l-4 28c-1 7-11 6-10-1l3-20c1-5 7-4 7 1"/><path d="M58 58h.1M82 61h.1"/><path d="M63 70c4 6 12 7 17 1"/><path d="m14 20 3-6 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z"/><path d="m116 69 2-4 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z"/></g></svg>'
  };

  const uid = () => `sticky-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const dateParts = () => {
    const now = new Date();
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return {
      date: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`,
      weekday: weekdays[now.getDay()]
    };
  };

  const readNotes = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const persist = () => {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {
      // A large uploaded image can exhaust localStorage; text and geometry remain usable.
    }
  };

  const schedulePersist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 180);
  };

  const getState = (id) => notes.find((note) => note.id === id);

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
      .sort((a, b) => {
        const da = Math.hypot(a.x - preferredX, a.y - preferredY);
        const db = Math.hypot(b.x - preferredX, b.y - preferredY);
        return da - db;
      });
    const isAvailable = ({ x, y }) => {
      const rect = {
        left: x,
        top: y,
        right: x + width,
        bottom: y + height
      };
      return isLegalRect(rect) && !avoidRects.some((avoid) => rectsOverlap(rect, avoid));
    };
    return candidates.find(isAvailable)
      || candidates.find(({ x, y }) => isLegalRect({
        left: x,
        top: y,
        right: x + width,
        bottom: y + height
      }))
      || { x: VIEWPORT_GAP, y: VIEWPORT_GAP };
  };

  const normalizeState = (raw, index = 0) => {
    const fitted = fitSizeToArea(
      Number(raw.width) || 370,
      Number(raw.height) || 390
    );
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
      todo: Boolean(raw.todo),
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
    layer.querySelectorAll(".sticky-note-menu.open").forEach((menu) => {
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

  const buildNote = (state) => {
    const { date, weekday } = dateParts();
    const element = document.createElement("article");
    element.className = `sticky-note${state.todo ? " todo-mode" : ""}${state.image ? " has-image" : ""}`;
    element.dataset.noteId = state.id;
    element.innerHTML = `
      <header class="sticky-note-header">
        <div class="sticky-note-brand">
          ${icons.clipboard}
          <span class="sticky-note-title">便签</span>
          <span class="sticky-note-sparkle" aria-hidden="true">✦</span>
        </div>
        <div class="sticky-note-meta">
          <time>${date}</time>
          <span>${weekday}</span>
          <button class="sticky-note-more" type="button" aria-label="更多操作" aria-expanded="false">···</button>
          <div class="sticky-note-menu">
            <button class="sticky-note-delete" type="button">删除便签</button>
          </div>
        </div>
      </header>
      <div class="sticky-note-body">
        ${state.image ? `<img class="sticky-note-image" alt="便签图片">` : ""}
        <textarea class="sticky-note-text" placeholder="${state.todo ? "输入待办事项，每行一项..." : "记录点什么吧..."}"></textarea>
        ${icons.doodle}
      </div>
      <footer class="sticky-note-footer">
        <div class="sticky-note-tools">
          <button class="sticky-note-tool" data-action="edit" type="button" title="编辑">${icons.edit}</button>
          <button class="sticky-note-tool" data-action="image" type="button" title="添加图片">${icons.image}</button>
          <button class="sticky-note-tool${state.todo ? " is-on" : ""}" data-action="todo" type="button" title="待办模式">${icons.todo}</button>
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

  const deleteNote = (element) => {
    notes = notes.filter((note) => note.id !== element.dataset.noteId);
    if (activeNote === element) activeNote = null;
    element.remove();
    persist();
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
      ? {
          ...interaction.original,
          x: interaction.original.x + dx,
          y: interaction.original.y + dy
        }
      : resizeCandidate(dx, dy);
    const rect = stateRect(candidate);
    if (isLegalRect(rect)) interaction.lastLegal = candidate;
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

    element.querySelector(".sticky-note-delete").addEventListener("click", () => deleteNote(element));
    element.querySelector("[data-action='edit']").addEventListener("click", () => textarea.focus());
    element.querySelector("[data-action='image']").addEventListener("click", () => fileInput.click());
    element.querySelector("[data-action='todo']").addEventListener("click", (event) => {
      const state = getState(element.dataset.noteId);
      state.todo = !state.todo;
      element.classList.toggle("todo-mode", state.todo);
      event.currentTarget.classList.toggle("is-on", state.todo);
      textarea.placeholder = state.todo ? "输入待办事项，每行一项..." : "记录点什么吧...";
      textarea.focus();
      persist();
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

  const addNote = () => {
    const size = fitSizeToArea(370, 390);
    const position = findLegalPosition(
      size.width,
      size.height,
      112 + notes.length * 28,
      145 + notes.length * 22,
      notes.map((note) => expandedRect(stateRect(note), 14))
    );
    const state = normalizeState({
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

  notes = readNotes().map(normalizeState);
  notes.forEach((state) => layer.appendChild(buildNote(state)));
  persist();

  addOption?.addEventListener("click", (event) => {
    event.stopPropagation();
    document.getElementById("widgetMenu")?.classList.remove("open");
    addNote();
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.type !== "portal:add-home-sticky-note") return;
    addNote();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".sticky-note")) {
      if (activeNote) saveNote(activeNote);
      activeNote?.classList.remove("is-active");
      activeNote = null;
      closeMenus();
      return;
    }
    if (!event.target.closest(".sticky-note-menu, .sticky-note-more")) closeMenus();
  });

  window.addEventListener("resize", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(repairLayout, 100);
  });
})();
