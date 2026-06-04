
    const orbit = document.getElementById("orbit");
    const addWidget = document.getElementById("addWidget");
    const widgetMenu = document.getElementById("widgetMenu");
    const addBubbleOption = document.getElementById("addBubbleOption");
    const hint = document.getElementById("bubbleHint");
    const toast = document.getElementById("toast");
    const colorToggle = document.getElementById("colorToggle");
    const currentColor = document.getElementById("currentColor");
    const palette = document.getElementById("palette");
    const playButton = document.getElementById("playButton");
    const avatarButton = document.getElementById("avatarButton");
    const avatarInput = document.getElementById("avatarInput");
    const avatarImage = document.getElementById("avatarImage");
    const username = document.getElementById("username");
    const signature = document.getElementById("signature");
    const cropModal = document.getElementById("cropModal");
    const cropFrame = document.getElementById("cropFrame");
    const cropImage = document.getElementById("cropImage");
    const cropZoom = document.getElementById("cropZoom");
    const cropCancel = document.getElementById("cropCancel");
    const cropSave = document.getElementById("cropSave");
    const accountDock = document.querySelector(".account-dock");
    const accountToggle = document.getElementById("accountToggle");
    const accountPanel = document.getElementById("accountPanel");
    const accountTitle = document.getElementById("accountTitle");
    const accountStatus = document.getElementById("accountStatus");
    const accountEmail = document.getElementById("accountEmail");
    const accountPassword = document.getElementById("accountPassword");
    const accountSignUp = document.getElementById("accountSignUp");
    const accountSignIn = document.getElementById("accountSignIn");
    const accountGuest = document.getElementById("accountGuest");
    const guestNote = document.getElementById("guestNote");
    const settingsButton = document.getElementById("settingsButton");
    const settingsMenu = document.getElementById("settingsMenu");
    const signOutMenuBtn = document.getElementById("signOutMenuBtn");

    const supabaseConfig = window.SUPABASE_CONFIG || {};
    const hasSupabaseConfig = Boolean(supabaseConfig.url && supabaseConfig.anonKey && window.supabase);
    const db = hasSupabaseConfig ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey) : null;
    const GUEST_SESSION_KEY = "portalGuestSession";
    const FORCE_LOGOUT_KEY = "portalForceLoggedOut";
    const guestUser = { id: "guest", email: "游客", isGuest: true };

    let spin = 0;
    let dragging = null;
    let pendingDrag = null;
    let resizingBubble = null;
    let selectedBubble = null;
    let currentUser = null;
    let toastTimer = null;
    const guestSignatures = [
      "生活明朗，万物可爱。✨",
      "今天也要闪闪发光呀 (ง •̀_•́)ง",
      "把普通日子过成高光片段。",
      "风很温柔，计划也要很漂亮。",
      "慢慢来，比较快。☁️",
      "好运正在加载中...",
      "去做会让眼睛发亮的事。",
      "把热爱调成置顶模式。",
      "今日份能量：满格！",
      "心里有光，路上有风。",
      "允许一切发生，也认真向前走。",
      "小小宇宙，持续发电。⚡",
      "认真生活的人自带滤镜。",
      "先开心，再厉害。",
      "把每一天都写成新章节。",
      "保持可爱，偶尔酷一点。",
      "今天适合进步一点点。",
      "别急，好事会在路上拐个弯来找你。",
      "热爱不会过期，灵感正在续杯。",
      "愿望清单正在逐项点亮。",
      "给生活加一点甜和勇气。",
      "去见想见的人，做想做的事。",
      "所有小努力都在悄悄开花。",
      "今天也拥有重新开始的权利。",
      "把心情切到晴天频道。",
      "世界很大，今天先把自己照顾好。",
      "愿你野蛮生长，也温柔发光。",
      "保持期待，保持在线。",
      "带着好奇心出门，带着好心情回来。",
      "快乐不是库存，是生产力。",
      "做自己的日常策展人。",
      "此刻开始，风向正好。",
      "今日关键词：明亮、松弛、向前。",
      "先把心里的小灯打开。",
      "宇宙很忙，但好运记得你。",
      "不赶路的时候，也在成长。",
      "把焦虑换成行动，把日子过亮。",
      "请继续做一个很有盼头的人。",
      "小步快跑，也很迷人。",
      "今日营业：可爱和勇敢。",
      "有趣的人生，正在刷新。",
      "请收下今天的阳光补丁。",
      "你就是自己的限定款。",
      "把生活过成喜欢的色号。",
      "去发光，不用等许可。"
    ];
    let cropState = {
      source: "",
      baseScale: 1,
      baseWidth: 0,
      baseHeight: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      dragging: false,
      startX: 0,
      startY: 0
    };

    const showToast = (message) => {
      clearTimeout(toastTimer);
      toast.textContent = message;
      toast.classList.add("show");
      toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
    };

    const bubbleCenter = () => {
      const rect = orbit.getBoundingClientRect();
      return { x: rect.width / 2, y: rect.height / 2 };
    };

    const selectBubble = (bubble) => {
      if (selectedBubble && selectedBubble !== bubble) {
        selectedBubble.classList.remove("selected");
      }
      selectedBubble = bubble;
      selectedBubble.classList.add("selected");
    };

    const clearBubbleSelection = () => {
      if (!selectedBubble) return;
      selectedBubble.classList.remove("selected");
      selectedBubble = null;
    };

    const isEditingText = () => {
      const active = document.activeElement;
      return active && active.isContentEditable;
    };

    const userStorageKey = (key) => currentUser ? `user:${currentUser.id}:${key}` : key;

    const saveValue = (key, value) => {
      try {
        localStorage.setItem(userStorageKey(key), value);
        if (key === "theme") localStorage.setItem(key, value);
        return true;
      } catch {
        /* Local file pages can be blocked from storage in some browsers. */
        return false;
      }
    };

    const readValue = (key) => {
      try {
        if (currentUser && key !== "theme") return localStorage.getItem(userStorageKey(key));
        return localStorage.getItem(userStorageKey(key)) || localStorage.getItem(key);
      } catch {
        return null;
      }
    };

    const setAccountPanelOpen = (open) => {
      accountPanel.classList.toggle("open", open);
      accountToggle.setAttribute("aria-expanded", String(open));
    };

    const setSettingsMenuOpen = (open) => {
      settingsMenu.classList.toggle("open", open);
      settingsButton.setAttribute("aria-expanded", String(open));
    };

    const setAccountMessage = (title, detail) => {
      accountTitle.textContent = title;
      accountStatus.textContent = detail || "";
    };

    const applyTheme = (theme) => {
      if (!theme) return;
      document.documentElement.style.setProperty("--theme", theme.theme);
      document.documentElement.style.setProperty("--theme-deep", theme.deep);
      document.documentElement.style.setProperty("--theme-soft", theme.soft);
      document.documentElement.style.setProperty("--theme-rgb", theme.rgb);
      currentColor.style.background = theme.swatch;
      document.querySelectorAll(".swatch").forEach((swatch) => {
        const isActive = swatch.dataset.theme === theme.theme
          && swatch.dataset.deep === theme.deep
          && swatch.dataset.soft === theme.soft
          && swatch.dataset.rgb === theme.rgb;
        swatch.classList.toggle("active", isActive);
      });
    };

    const applySavedProfile = () => {
      const savedAvatar = readValue("avatarImage");
      const savedUsername = readValue("username");
      const savedSignature = readValue("signature");
      const savedTheme = currentUser
        ? localStorage.getItem(userStorageKey("theme")) || localStorage.getItem("theme")
        : readValue("theme");

      if (savedAvatar) {
        applyAvatar(savedAvatar);
      } else {
        defaultGuestAvatar();
      }
      if (savedUsername) username.textContent = savedUsername;
      if (savedSignature) signature.textContent = savedSignature;
      if (savedTheme) {
        try {
          applyTheme(JSON.parse(savedTheme));
          localStorage.setItem("theme", savedTheme);
        } catch {
          try {
            localStorage.removeItem("theme");
          } catch {}
        }
      }
    };

    const defaultGuestAvatar = () => {
      avatarImage.removeAttribute("src");
      avatarImage.alt = "默认用户头像";
      document.body.classList.add("no-custom-avatar");
      document.documentElement.style.removeProperty("--avatar-url");
    };

    const applyLoggedOutProfile = () => {
      defaultGuestAvatar();
      username.textContent = "User";
      const index = Math.floor(Math.random() * guestSignatures.length);
      signature.textContent = guestSignatures[index];
      clearBubbleSelection();
    };

    const applyGlobalThemeFromStorage = () => {
      try {
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme) applyTheme(JSON.parse(savedTheme));
      } catch {}
    };

    const hasGuestSession = () => {
      try {
        return localStorage.getItem(GUEST_SESSION_KEY) === "1";
      } catch {
        return false;
      }
    };

    const applySession = (session) => {
      currentUser = session?.user || (hasGuestSession() ? guestUser : null);
      accountDock.classList.toggle("signed-in", Boolean(currentUser));
      signOutMenuBtn.hidden = !currentUser;

      accountGuest.hidden = Boolean(currentUser);
      guestNote.hidden = Boolean(currentUser && !currentUser.isGuest);

      if (currentUser?.isGuest) {
        try {
          localStorage.removeItem("portalCurrentUserEmail");
        } catch {}
        document.body.classList.remove("logged-out");
        setAccountMessage("游客登录", "");
        accountSignUp.hidden = true;
        accountSignIn.hidden = true;
        accountEmail.hidden = true;
        accountPassword.hidden = true;
        applySavedProfile();
        applySavedBubbles();
        setAccountPanelOpen(false);
        document.body.classList.remove("auth-pending");
        return;
      }

      if (!hasSupabaseConfig) {
        setAccountMessage("Supabase 未配置", "请检查项目根目录的 supabase-config.js。");
        accountSignUp.hidden = false;
        accountSignIn.hidden = false;
        accountEmail.hidden = false;
        accountPassword.hidden = false;
        accountSignUp.disabled = true;
        accountSignIn.disabled = true;
        accountGuest.disabled = false;
        document.body.classList.remove("auth-pending");
        return;
      }

      if (!currentUser) {
        try {
          localStorage.removeItem("portalCurrentUserEmail");
        } catch {}
        document.body.classList.add("logged-out");
        applyLoggedOutProfile();
        setAccountMessage("未登录", "登录后，计划日记会同步到你的 Supabase 账号。");
        accountSignUp.hidden = false;
        accountSignIn.hidden = false;
        accountEmail.hidden = false;
        accountPassword.hidden = false;
        accountGuest.hidden = false;
        accountGuest.disabled = false;
        document.body.classList.remove("auth-pending");
        return;
      }

      document.body.classList.remove("logged-out");
      try {
        localStorage.setItem("portalCurrentUserEmail", currentUser.email || "");
      } catch {}
      setAccountMessage("已登录", currentUser.email);
      accountSignUp.hidden = true;
      accountSignIn.hidden = true;
      accountEmail.hidden = true;
      accountPassword.hidden = true;
      accountGuest.hidden = true;
      applySavedProfile();
      applySavedBubbles();
      setAccountPanelOpen(false);
      document.body.classList.remove("auth-pending");
    };

    const bootAuth = async () => {
      let forceLoggedOut = false;
      try {
        forceLoggedOut = localStorage.getItem(FORCE_LOGOUT_KEY) === "1";
        if (forceLoggedOut) {
          localStorage.removeItem(FORCE_LOGOUT_KEY);
          localStorage.removeItem(GUEST_SESSION_KEY);
        }
      } catch {}

      if (!db) {
        applySession(null);
        return;
      }

      if (forceLoggedOut) {
        await db.auth.signOut();
      }

      const { data, error } = await db.auth.getSession();
      if (error) {
        setAccountMessage("读取登录状态失败", error.message);
      } else {
        applySession(data?.session || null);
      }

      db.auth.onAuthStateChange((_event, session) => {
        applySession(session);
      });
    };

    const applyAvatar = (imageUrl) => {
      avatarImage.src = imageUrl;
      avatarImage.alt = "用户头像";
      document.body.classList.remove("no-custom-avatar");
      document.documentElement.style.setProperty("--avatar-url", `url("${imageUrl}")`);
    };

    const updateCropImage = () => {
      cropImage.style.width = `${cropState.baseWidth}px`;
      cropImage.style.height = `${cropState.baseHeight}px`;
      cropImage.style.transform = `translate(-50%, -50%) translate(${cropState.offsetX}px, ${cropState.offsetY}px) scale(${cropState.scale})`;
    };

    const clampCropOffset = () => {
      const frameSize = cropFrame.getBoundingClientRect().width;
      const maxX = Math.max(0, (cropState.baseWidth * cropState.scale - frameSize) / 2);
      const maxY = Math.max(0, (cropState.baseHeight * cropState.scale - frameSize) / 2);
      cropState.offsetX = clamp(cropState.offsetX, -maxX, maxX);
      cropState.offsetY = clamp(cropState.offsetY, -maxY, maxY);
    };

    const openCropper = (source) => {
      cropState.source = source;
      cropState.scale = 1;
      cropState.offsetX = 0;
      cropState.offsetY = 0;
      cropModal.classList.add("open");
      cropModal.setAttribute("aria-hidden", "false");
      cropZoom.value = "1";
      cropImage.addEventListener("load", () => {
        const frameSize = cropFrame.getBoundingClientRect().width;
        cropState.baseScale = Math.max(frameSize / cropImage.naturalWidth, frameSize / cropImage.naturalHeight);
        cropState.baseWidth = cropImage.naturalWidth * cropState.baseScale;
        cropState.baseHeight = cropImage.naturalHeight * cropState.baseScale;
        updateCropImage();
      }, { once: true });
      cropImage.src = source;
    };

    const closeCropper = () => {
      cropModal.classList.remove("open");
      cropModal.setAttribute("aria-hidden", "true");
      cropImage.removeAttribute("src");
      avatarInput.value = "";
      cropState.dragging = false;
    };

    const saveCroppedAvatar = () => {
      if (!cropImage.naturalWidth || !cropImage.naturalHeight) return;
      const frameSize = cropFrame.getBoundingClientRect().width;
      const sourceSize = frameSize / (cropState.scale * cropState.baseScale);
      const sourceX = ((-frameSize / 2 - cropState.offsetX) / cropState.scale + cropState.baseWidth / 2) / cropState.baseScale;
      const sourceY = ((-frameSize / 2 - cropState.offsetY) / cropState.scale + cropState.baseHeight / 2) / cropState.baseScale;
      const canvas = document.createElement("canvas");
      const outputSize = 320;
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");
      context.drawImage(cropImage, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
      const croppedAvatar = canvas.toDataURL("image/jpeg", 0.88);
      applyAvatar(croppedAvatar);
      const saved = saveValue("avatarImage", croppedAvatar);
      closeCropper();
      showToast(saved ? "头像已更新" : "头像已更新，但浏览器存储空间不足");
    };

    const selectElementText = (element) => {
      const selection = window.getSelection();
      const range = document.createRange();
      const textNodes = Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE || node.nodeName === "BR");
      if (textNodes.length) {
        range.setStartBefore(textNodes[0]);
        range.setEndAfter(textNodes[textNodes.length - 1]);
      } else {
        range.selectNodeContents(element);
      }
      selection.removeAllRanges();
      selection.addRange(range);
    };

    const placeWidgetMenu = () => {
      const rect = addWidget.getBoundingClientRect();
      widgetMenu.style.left = `${rect.right + 8}px`;
      widgetMenu.style.top = `${rect.top + rect.height / 2 - 18}px`;
    };

    const closeWidgetMenu = () => {
      widgetMenu.classList.remove("open");
    };

    const getBubbleText = (bubble) => {
      const clone = bubble.cloneNode(true);
      clone.querySelector(".bubble-resize")?.remove();
      return (clone.innerText || clone.textContent || "").trim();
    };

    const getBubbleSizeClass = (bubble) => {
      if (bubble.classList.contains("small")) return "small";
      if (bubble.classList.contains("medium")) return "medium";
      return "large";
    };

    const serializeBubbles = () => [...orbit.querySelectorAll(".bubble")].map((bubble) => ({
      text: getBubbleText(bubble),
      size: getBubbleSizeClass(bubble),
      angle: bubble.dataset.angle || "0",
      radiusX: bubble.dataset.radiusX || ".4",
      radiusY: bubble.dataset.radiusY || ".35",
      emptySize: bubble.dataset.emptySize || "",
      ariaLabel: bubble.getAttribute("aria-label") || "",
      diameter: bubble.style.getPropertyValue("--bubble-diameter") || "",
    }));

    const saveBubbles = () => {
      if (!currentUser) return;
      saveValue("bubbles", JSON.stringify(serializeBubbles()));
    };

    const makeBubbleFromState = (state) => {
      const bubble = document.createElement("button");
      bubble.type = "button";
      bubble.className = `bubble ${state.size || "large"}`;
      bubble.dataset.angle = state.angle || "0";
      bubble.dataset.radiusX = state.radiusX || ".4";
      bubble.dataset.radiusY = state.radiusY || ".35";
      if (state.emptySize) {
        bubble.dataset.emptySize = state.emptySize;
        bubble.style.setProperty("--empty-size", `${Number(state.emptySize) || 64}px`);
      }
      if (state.diameter) bubble.style.setProperty("--bubble-diameter", state.diameter);
      if (state.ariaLabel) bubble.setAttribute("aria-label", state.ariaLabel);
      bubble.innerHTML = state.text || "";
      seedBubbleMotion(bubble);
      orbit.appendChild(bubble);
      installBubbleEvents(bubble);
      resizeBubble(bubble);
      placeBubble(bubble);
    };

    const applySavedBubbles = () => {
      const saved = readValue("bubbles");
      if (!saved) return;
      try {
        const bubbles = JSON.parse(saved);
        if (!Array.isArray(bubbles)) return;
        orbit.querySelectorAll(".bubble").forEach((bubble) => bubble.remove());
        bubbles.forEach(makeBubbleFromState);
      } catch {
        try {
          localStorage.removeItem(userStorageKey("bubbles"));
        } catch {}
      }
    };

    const createBubble = () => {
      const bubble = document.createElement("button");
      bubble.type = "button";
      bubble.className = "bubble large";
      bubble.dataset.angle = String(215 + Math.random() * 90);
      bubble.dataset.radiusX = ".4";
      bubble.dataset.radiusY = ".35";
      seedBubbleMotion(bubble);
      bubble.innerHTML = "新气泡";
      orbit.appendChild(bubble);
      installBubbleEvents(bubble);
      resizeBubble(bubble);
      selectBubble(bubble);
      placeBubble(bubble);
      saveBubbles();
      showToast("已添加气泡，双击即可改文字");
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const seedBubbleMotion = (bubble) => {
      if (bubble.dataset.seeded) return;
      bubble.dataset.seeded = "true";
      bubble.dataset.phase = String(Math.random() * Math.PI * 2);
      bubble.dataset.wave = String(.75 + Math.random() * .75);
      bubble.dataset.speed = String(.72 + Math.random() * .44);
      bubble.dataset.drift = String(10 + Math.random() * 18);
    };

    const ensureBubbleResizeHandle = (bubble) => {
      if (bubble.classList.contains("small") || bubble.querySelector(".bubble-resize")) return;
      const handle = document.createElement("span");
      handle.className = "bubble-resize";
      handle.setAttribute("aria-hidden", "true");
      bubble.appendChild(handle);

      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        resizingBubble = bubble;
        selectBubble(bubble);
        bubble.dataset.resizeStartX = String(event.clientX);
        bubble.dataset.resizeStartY = String(event.clientY);
        bubble.dataset.resizeStartSize = String(Number.parseFloat(getComputedStyle(bubble).getPropertyValue("--bubble-diameter")) || 64);
        handle.setPointerCapture(event.pointerId);
      });

      handle.addEventListener("pointermove", (event) => {
        if (resizingBubble !== bubble) return;
        const dx = event.clientX - Number(bubble.dataset.resizeStartX || event.clientX);
        const dy = event.clientY - Number(bubble.dataset.resizeStartY || event.clientY);
        const delta = Math.max(dx, dy);
        const nextSize = Math.max(64, Math.min(180, Number(bubble.dataset.resizeStartSize || 64) + delta));
        bubble.dataset.emptySize = String(nextSize);
        bubble.style.setProperty("--empty-size", `${nextSize}px`);
        bubble.style.setProperty("--bubble-diameter", `${nextSize}px`);
      });

      handle.addEventListener("pointerup", () => {
        resizingBubble = null;
        saveBubbles();
      });
    };

    const resizeBubble = (bubble) => {
      if (bubble.classList.contains("small")) return;
      ensureBubbleResizeHandle(bubble);
      const base = Number.parseInt(getComputedStyle(bubble).getPropertyValue("--size"), 10) || 92;
      const text = (bubble.innerText || bubble.textContent).trim();
      if (!text) {
        const emptySize = Math.max(64, Math.min(180, Number(bubble.dataset.emptySize || 64)));
        bubble.classList.add("is-empty");
        bubble.style.setProperty("--empty-size", `${emptySize}px`);
        bubble.style.setProperty("--bubble-diameter", `${emptySize}px`);
        return;
      }
      bubble.classList.remove("is-empty");
      const lines = text.split(/\n+/);
      const longestLine = Math.max(...lines.map(line => Array.from(line.trim()).length), 1);
      const visualUnits = Math.max(longestLine, lines.length * 3);
      const diameter = Math.min(240, Math.max(base, 58 + visualUnits * 10, 44 + lines.length * 28));
      bubble.style.setProperty("--bubble-diameter", `${diameter}px`);
    };

    const placeBubble = (bubble) => {
      if (bubble.classList.contains("dragging") || bubble.classList.contains("editing") || resizingBubble === bubble || pendingDrag?.bubble === bubble) return;
      seedBubbleMotion(bubble);
      const rect = orbit.getBoundingClientRect();
      const phase = Number(bubble.dataset.phase || 0);
      const speed = Number(bubble.dataset.speed || 1);
      const wave = Number(bubble.dataset.wave || 1);
      const drift = Number(bubble.dataset.drift || 14);
      const angle = (Number(bubble.dataset.angle) + spin * speed) * Math.PI / 180;
      const pulse = 1 + Math.sin(spin * .028 * wave + phase) * .035;
      const rx = rect.width * Number(bubble.dataset.radiusX || .4) * pulse;
      const ry = rect.height * Number(bubble.dataset.radiusY || .34) * (2 - pulse);
      const x = Math.cos(angle) * rx + Math.sin(spin * .018 + phase) * drift;
      const y = Math.sin(angle) * ry + Math.cos(spin * .015 + phase) * drift * .72;
      bubble.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    };

    const animate = () => {
      spin = (spin + .045) % 360;
      document.querySelectorAll(".bubble").forEach(placeBubble);
      requestAnimationFrame(animate);
    };

    const installBubbleEvents = (bubble) => {
      bubble.addEventListener("pointerdown", (event) => {
        if (bubble.classList.contains("editing")) return;
        if (event.target.closest(".bubble-resize")) return;
        selectBubble(bubble);
        const bubbleRect = bubble.getBoundingClientRect();
        pendingDrag = {
          bubble,
          startX: event.clientX,
          startY: event.clientY,
          offsetX: event.clientX - (bubbleRect.left + bubbleRect.width / 2),
          offsetY: event.clientY - (bubbleRect.top + bubbleRect.height / 2)
        };
        bubble.setPointerCapture(event.pointerId);
        event.stopPropagation();
      });

      bubble.addEventListener("pointermove", (event) => {
        if (pendingDrag?.bubble === bubble && dragging !== bubble) {
          const moved = Math.hypot(event.clientX - pendingDrag.startX, event.clientY - pendingDrag.startY);
          if (moved < 6) return;
          dragging = bubble;
          bubble.classList.add("dragging");
        }
        if (dragging !== bubble || !pendingDrag) return;
        const rect = orbit.getBoundingClientRect();
        const center = bubbleCenter();
        const x = event.clientX - pendingDrag.offsetX - rect.left - center.x;
        const y = event.clientY - pendingDrag.offsetY - rect.top - center.y;
        bubble.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      });

      bubble.addEventListener("pointerup", (event) => {
        if (dragging !== bubble) {
          if (pendingDrag?.bubble === bubble) pendingDrag = null;
          return;
        }
        const rect = orbit.getBoundingClientRect();
        const center = bubbleCenter();
        const x = event.clientX - pendingDrag.offsetX - rect.left - center.x;
        const y = event.clientY - pendingDrag.offsetY - rect.top - center.y;
        const angle = Math.atan2(y, x) * 180 / Math.PI;
        bubble.dataset.angle = String(angle - spin);
        const normalizedX = Math.abs(x) / rect.width;
        const normalizedY = Math.abs(y) / rect.height;
        const orbitStrength = Math.max(normalizedX / .42, normalizedY / .34, .72);
        bubble.dataset.radiusX = String(clamp(.42 * orbitStrength, .26, .54));
        bubble.dataset.radiusY = String(clamp(.34 * orbitStrength, .22, .48));
        bubble.classList.remove("dragging");
        dragging = null;
        pendingDrag = null;
        saveBubbles();
      });

      bubble.addEventListener("dblclick", (event) => {
        if (bubble.classList.contains("small")) return;
        event.preventDefault();
        event.stopPropagation();
        selectBubble(bubble);
        bubble.contentEditable = "true";
        bubble.classList.add("editing");
        bubble.focus();
        selectElementText(bubble);
      });

      bubble.addEventListener("blur", () => {
        if (!bubble.classList.contains("editing")) return;
        bubble.contentEditable = "false";
        bubble.classList.remove("editing");
        bubble.innerText = (bubble.innerText || bubble.textContent).trim();
        resizeBubble(bubble);
        saveBubbles();
      });

      bubble.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          document.execCommand("insertLineBreak");
          resizeBubble(bubble);
        }
      });
    };

    document.querySelectorAll(".bubble").forEach((bubble) => {
      installBubbleEvents(bubble);
      resizeBubble(bubble);
    });

    document.querySelectorAll(".sidebar .nav-item[href], .sidebar .add-widget").forEach((item) => {
      item.addEventListener("click", (event) => {
        if (currentUser) return;
        event.preventDefault();
        event.stopPropagation();
        showToast("登录后可使用");
      });
    });

    const makeEditable = (element) => {
      const startEditing = () => {
        if (!currentUser) {
          setAccountPanelOpen(true);
          return;
        }
        element.contentEditable = "true";
        element.focus();
        selectElementText(element);
      };

      element.addEventListener("click", (event) => {
        event.stopPropagation();
        startEditing();
      });

      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          element.blur();
        }
      });

      element.addEventListener("blur", () => {
        element.contentEditable = "false";
        element.textContent = element.textContent.trim() || element.dataset.fallback;
        saveValue(element.id, element.textContent);
      });
    };

    makeEditable(username);
    makeEditable(signature);

    avatarButton.addEventListener("click", () => {
      if (!currentUser) {
        setAccountPanelOpen(true);
        return;
      }
      avatarInput.click();
    });

    avatarInput.addEventListener("change", () => {
      const file = avatarInput.files && avatarInput.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showToast("请选择图片文件");
        avatarInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        openCropper(reader.result);
      });
      reader.readAsDataURL(file);
    });

    cropFrame.addEventListener("pointerdown", (event) => {
      cropState.dragging = true;
      cropState.startX = event.clientX - cropState.offsetX;
      cropState.startY = event.clientY - cropState.offsetY;
      cropFrame.setPointerCapture(event.pointerId);
    });

    cropFrame.addEventListener("pointermove", (event) => {
      if (!cropState.dragging) return;
      cropState.offsetX = event.clientX - cropState.startX;
      cropState.offsetY = event.clientY - cropState.startY;
      clampCropOffset();
      updateCropImage();
    });

    cropFrame.addEventListener("pointerup", () => {
      cropState.dragging = false;
    });

    cropFrame.addEventListener("pointercancel", () => {
      cropState.dragging = false;
    });

    cropZoom.addEventListener("input", () => {
      cropState.scale = Number(cropZoom.value);
      clampCropOffset();
      updateCropImage();
    });

    cropCancel.addEventListener("click", closeCropper);
    cropSave.addEventListener("click", saveCroppedAvatar);

    cropModal.addEventListener("click", (event) => {
      if (event.target === cropModal) closeCropper();
    });

    addWidget.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!currentUser) {
        showToast("登录后可添加小组件");
        return;
      }
      placeWidgetMenu();
      widgetMenu.classList.toggle("open");
    });

    addBubbleOption.addEventListener("click", (event) => {
      event.stopPropagation();
      closeWidgetMenu();
      createBubble();
    });

    accountToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      setAccountPanelOpen(!accountPanel.classList.contains("open"));
      setSettingsMenuOpen(false);
    });

    accountPanel.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    accountSignUp.addEventListener("click", async () => {
      if (!db) return setAccountMessage("Supabase 未配置", "请检查项目根目录的 supabase-config.js。");
      const email = accountEmail.value.trim();
      const password = accountPassword.value;
      if (!email || !password) return setAccountMessage("请输入邮箱和密码", "注册需要邮箱和密码。");

      accountSignUp.disabled = true;
      const { error } = await db.auth.signUp({ email, password });
      accountSignUp.disabled = false;
      if (error) return setAccountMessage("注册失败", error.message);
      setAccountMessage("注册成功", "如果 Supabase 开启了邮件确认，请先去邮箱确认。");
    });

    accountSignIn.addEventListener("click", async () => {
      if (!db) return setAccountMessage("Supabase 未配置", "请检查项目根目录的 supabase-config.js。");
      const email = accountEmail.value.trim();
      const password = accountPassword.value;
      if (!email || !password) return setAccountMessage("请输入邮箱和密码", "登录需要邮箱和密码。");

      accountSignIn.disabled = true;
      try {
        localStorage.removeItem(GUEST_SESSION_KEY);
      } catch {}
      const { error } = await db.auth.signInWithPassword({ email, password });
      accountSignIn.disabled = false;
      if (error) return setAccountMessage("登录失败", error.message);
      accountPassword.value = "";
    });

    accountGuest.addEventListener("click", () => {
      try {
        localStorage.setItem(GUEST_SESSION_KEY, "1");
      } catch {}
      applySession(null);
      showToast("已进入游客模式");
    });

    settingsButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setSettingsMenuOpen(!settingsMenu.classList.contains("open"));
      setAccountPanelOpen(false);
    });

    settingsMenu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    signOutMenuBtn.addEventListener("click", async () => {
      if (currentUser?.isGuest || !db) {
        try {
          localStorage.removeItem(GUEST_SESSION_KEY);
        } catch {}
        applySession(null);
        setSettingsMenuOpen(false);
        setAccountPanelOpen(true);
        showToast("已退出登录");
        return;
      }
      const { error } = await db.auth.signOut();
      if (error) {
        showToast("退出失败");
        setAccountMessage("退出失败", error.message);
        return;
      }
      setSettingsMenuOpen(false);
      setAccountPanelOpen(true);
      showToast("已退出登录");
    });

    colorToggle.addEventListener("click", () => {
      const isOpen = palette.classList.toggle("open");
      colorToggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.querySelectorAll(".swatch").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        const nextTheme = {
          theme: swatch.dataset.theme,
          deep: swatch.dataset.deep,
          soft: swatch.dataset.soft,
          rgb: swatch.dataset.rgb,
          swatch: getComputedStyle(swatch).getPropertyValue("--swatch").trim()
        };
        applyTheme(nextTheme);
        saveValue("theme", JSON.stringify(nextTheme));
        palette.classList.remove("open");
        colorToggle.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".color-wrap")) {
        palette.classList.remove("open");
        colorToggle.setAttribute("aria-expanded", "false");
      }
      if (!event.target.closest(".widget-menu") && !event.target.closest(".add-widget")) {
        closeWidgetMenu();
      }
      if (!event.target.closest(".settings-menu") && !event.target.closest(".settings")) {
        setSettingsMenuOpen(false);
      }
      if (!event.target.closest(".account-dock")) {
        setAccountPanelOpen(false);
      }
      if (!event.target.closest(".bubble")) {
        clearBubbleSelection();
      }
    });

    window.addEventListener("resize", () => {
      if (widgetMenu.classList.contains("open")) placeWidgetMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (cropModal.classList.contains("open")) {
        if (event.key === "Escape") closeCropper();
        return;
      }
      if ((event.key !== "Delete" && event.key !== "Backspace") || !selectedBubble || isEditingText()) return;
      event.preventDefault();
      selectedBubble.remove();
      selectedBubble = null;
      saveBubbles();
      showToast("气泡已删除");
    });

    playButton.addEventListener("click", () => {
      const playing = playButton.classList.toggle("is-playing");
      playButton.title = playing ? "暂停" : "播放";
      playButton.innerHTML = playing
        ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7Z"/></svg>';
      showToast(playing ? "音乐播放器已开始" : "音乐播放器已暂停");
    });

    window.addEventListener("load", () => {
      applyGlobalThemeFromStorage();
      bootAuth();
      if (new URLSearchParams(window.location.search).get("login") === "1") {
        setAccountPanelOpen(true);
      }
      setTimeout(() => hint.classList.add("show"), 350);
      setTimeout(() => hint.classList.remove("show"), 3600);
    });

    animate();
  
