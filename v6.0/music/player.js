(() => {
  "use strict";

  if (window.__portalMusicPlayerLoaded) return;
  window.__portalMusicPlayerLoaded = true;

  const STATE_KEY = "portalMusicPlayerState";
  const GUEST_SESSION_KEY = "portalGuestSession";
  const DB_NAME = "portal-music";
  const DB_STORE = "tracks";
  const CLOUD_BUCKET = "portal-music";
  const CLOUD_TABLE = "user_music";
  const musicRoot = new URL("./", document.currentScript.src);
  const portalRoot = new URL("../", musicRoot);
  const coverUrl = new URL("image.png", musicRoot).href;

  if (window.top !== window.self) {
    document.documentElement.classList.add("portal-embedded");
    return;
  }

  // 修改默认歌曲时，只需要编辑这个数组。
  const defaultPlaylist = [
    { id: "default-onthou", title: "Onthou", artist: "未知艺术家", src: "songs/Onthou.m4a", cover: "image.png" },
    { id: "default-paris-rain", title: "Paris in the Rain (Instrumental)", artist: "Lauv", src: "songs/Paris in the Rain (Instrumental).m4a", cover: "image.png" },
    { id: "default-stardew", title: "Stardew Valley Overture", artist: "ConcernedApe", src: "songs/Stardew Valley Overture.mp3", cover: "image.png" },
    { id: "default-nature-summer", title: "Summer (Nature's Crescendo)", artist: "未知艺术家", src: "songs/Summer (Nature's Crescendo).mp3", cover: "image.png" },
    { id: "default-summer", title: "Summer", artist: "未知艺术家", src: "songs/Summer.m4a", cover: "image.png" },
    { id: "default-talk", title: "We Don't Talk Anymore (Instrumental)", artist: "Instrumental", src: "songs/We don't talk anymore-Instrumental.m4a", cover: "image.png" },
    { id: "default-soseki", title: "夏日漱石 (Summer Cozy Rock)", artist: "纯音乐", src: "songs/夏日漱石(Summer Cozy Rock).m4a", cover: "image.png" },
    { id: "default-kissing-you", title: "Kissing You (纯音乐)", artist: "少女时代", src: "songs/少女时代 - Kissing You (纯音乐).ogg", cover: "image.png" },
    { id: "default-i-love-you-so", title: "I Love You So (纯音乐伴奏)", artist: "The Walters", src: "songs/《I Love You So - The Walters》（纯音乐伴奏）「I Love You So - 1.studio_video_1745167240882.mp4(Av114371271333543,P1).mp3", cover: "image.png" }
  ].map((track) => ({
    ...track,
    src: new URL(track.src, musicRoot).href,
    cover: new URL(track.cover, musicRoot).href,
    source: "default"
  }));

  window.defaultPlaylist = defaultPlaylist.map(({ title, src, cover, artist }) => ({ title, src, cover, artist }));

  const playerCard = document.querySelector(".top-tools .player, .global-player");
  if (!playerCard) return;

  const tools = playerCard.closest(".top-tools, .global-top-tools");
  if (tools) tools.classList.add("portal-music-shell");
  const playerWrap = document.createElement("div");
  playerWrap.className = "music-player-wrap";
  playerCard.parentElement.insertBefore(playerWrap, playerCard);
  playerWrap.appendChild(playerCard);
  playerCard.classList.add("portal-music-card");
  playerCard.dataset.musicPlayer = "true";

  const iconPlay = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M8 5v14l11-7Z"/></svg>';
  const iconPause = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  const iconPrev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m11 17-7-5 7-5v10Z"/><path d="M20 18V6"/></svg>';
  const iconNext = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m13 7 7 5-7 5V7Z"/><path d="M4 6v12"/></svg>';
  const playModes = [
    { id: "sequence", icon: "↪", label: "顺序播放" },
    { id: "repeat-one", icon: "↻¹", label: "单曲循环" },
    { id: "shuffle", icon: "⇄", label: "随机播放" }
  ];

  playerCard.innerHTML = `
    <div class="cover" data-player-cover aria-hidden="true"></div>
    <div class="portal-music-copy">
      <p class="song-title" data-player-title>音乐播放器</p>
      <p class="artist" data-player-artist>正在载入歌单...</p>
    </div>
    <button class="player-btn skip" data-player-prev type="button" title="上一首" aria-label="上一首">${iconPrev}</button>
    <button class="player-btn play" data-player-play type="button" title="播放" aria-label="播放">${iconPlay}</button>
    <button class="player-btn skip" data-player-next type="button" title="下一首" aria-label="下一首">${iconNext}</button>
  `;

  const panel = document.createElement("section");
  panel.className = "music-panel";
  panel.setAttribute("aria-label", "播放列表");
  panel.innerHTML = `
    <div class="music-panel-head">
      <h2 class="music-panel-title">播放列表</h2>
      <div class="music-panel-actions">
        <button class="music-mode-toggle" type="button" aria-label="顺序播放" title="顺序播放">↪</button>
        <button class="music-panel-close" type="button" aria-label="关闭播放列表" title="关闭">×</button>
      </div>
    </div>
    <div class="music-progress-wrap">
      <input class="music-progress" type="range" min="0" max="1000" value="0" step="1" aria-label="播放进度">
      <span class="music-time">00:00 / 00:00</span>
    </div>
    <div class="music-list" role="list"></div>
    <button class="music-import" type="button">+ 导入本地音乐</button>
    <input class="music-file-input" type="file" accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a" multiple hidden>
    <p class="music-storage-note">游客音乐保存在当前浏览器；登录账号后会尝试同步到云端。</p>
  `;
  playerWrap.appendChild(panel);

  const message = document.createElement("div");
  message.className = "music-message";
  message.setAttribute("role", "status");
  document.body.appendChild(message);

  const audio = new Audio();
  audio.preload = "metadata";
  const titleNode = playerCard.querySelector("[data-player-title]");
  const artistNode = playerCard.querySelector("[data-player-artist]");
  const coverNode = playerCard.querySelector("[data-player-cover]");
  const playButton = playerCard.querySelector("[data-player-play]");
  const prevButton = playerCard.querySelector("[data-player-prev]");
  const nextButton = playerCard.querySelector("[data-player-next]");
  const closeButton = panel.querySelector(".music-panel-close");
  const modeButton = panel.querySelector(".music-mode-toggle");
  const listNode = panel.querySelector(".music-list");
  const progress = panel.querySelector(".music-progress");
  const timeNode = panel.querySelector(".music-time");
  const importButton = panel.querySelector(".music-import");
  const fileInput = panel.querySelector(".music-file-input");
  const storageNote = panel.querySelector(".music-storage-note");

  let playlist = [...defaultPlaylist];
  let currentIndex = 0;
  let currentUser = null;
  let stateSaveTimer = null;
  let messageTimer = null;
  let pendingResumeTime = 0;
  let shouldResumePlayback = false;
  let dbPromise = null;
  let cloudClient = null;
  let playMode = "sequence";

  const escapeHtml = (value) => String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const getSavedState = () => {
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
    } catch {
      return {};
    }
  };

  const isGuest = () => {
    try {
      return localStorage.getItem(GUEST_SESSION_KEY) === "1";
    } catch {
      return false;
    }
  };

  const scopeKey = () => currentUser ? `user:${currentUser.id}` : (isGuest() ? "guest" : "anonymous");

  const showMessage = (text) => {
    message.textContent = text;
    message.classList.add("show");
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => message.classList.remove("show"), 3200);
  };

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    const whole = Math.floor(seconds);
    return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
  };

  const saveState = (immediate = false) => {
    clearTimeout(stateSaveTimer);
    const write = () => {
      const track = playlist[currentIndex];
      if (!track) return;
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify({
          trackId: track.id,
          currentTime: audio.currentTime || 0,
          playing: !audio.paused && !audio.ended,
          playMode,
          volume: audio.volume,
          updatedAt: Date.now()
        }));
      } catch {}
    };
    if (immediate) write();
    else stateSaveTimer = setTimeout(write, 250);
  };

  const openDatabase = () => {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          const store = db.createObjectStore(DB_STORE, { keyPath: "key" });
          store.createIndex("scope", "scope", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    return dbPromise;
  };

  const putLocalTrack = async (record) => {
    const db = await openDatabase();
    if (!db) return false;
    return new Promise((resolve) => {
      const transaction = db.transaction(DB_STORE, "readwrite");
      transaction.objectStore(DB_STORE).put(record);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
    });
  };

  const getLocalTracks = async () => {
    const db = await openDatabase();
    if (!db) return [];
    return new Promise((resolve) => {
      const transaction = db.transaction(DB_STORE, "readonly");
      const request = transaction.objectStore(DB_STORE).index("scope").getAll(scopeKey());
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  };

  const getCloudClient = () => {
    if (cloudClient) return cloudClient;
    const config = window.SUPABASE_CONFIG || {};
    if (!window.supabase || !config.url || !config.anonKey) return null;
    cloudClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        storageKey: "portal-music-auth",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    return cloudClient;
  };

  const loadScript = (src) => new Promise((resolve) => {
    const existing = [...document.scripts].find((script) => script.src === src);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", resolve, { once: true });
    document.head.appendChild(script);
  });

  const ensureCloudDependencies = async () => {
    if (!window.SUPABASE_CONFIG) {
      await loadScript(new URL("supabase-config.js", portalRoot).href);
    }
    if (!window.supabase) {
      await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    }
  };

  const restoreUser = async () => {
    const client = getCloudClient();
    if (!client) return null;
    let session = null;
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || "";
        if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
        const value = JSON.parse(localStorage.getItem(key) || "null");
        if (value?.access_token && value?.refresh_token) {
          session = value;
          break;
        }
      }
    } catch {}
    if (session) {
      const { data, error } = await client.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });
      if (!error) currentUser = data?.user || data?.session?.user || null;
    }
    return client;
  };

  const makeLocalTrack = (record) => ({
    id: record.id,
    title: record.title,
    artist: record.artist || "本地音乐",
    src: URL.createObjectURL(record.file),
    cover: coverUrl,
    source: "local"
  });

  const loadLocalTracks = async () => {
    const records = await getLocalTracks();
    playlist.push(...records.map(makeLocalTrack));
  };

  const loadCloudTracks = async (client) => {
    if (!client || !currentUser) return;
    const { data, error } = await client
      .from(CLOUD_TABLE)
      .select("id,title,artist,storage_path,created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: true });
    if (error) {
      storageNote.textContent = "账号音乐当前保存在本浏览器；运行 music/supabase-setup.sql 后可启用云同步。";
      return;
    }
    for (const record of data || []) {
      if (playlist.some((track) => track.id === record.id)) continue;
      const { data: signed, error: signError } = await client.storage
        .from(CLOUD_BUCKET)
        .createSignedUrl(record.storage_path, 3600);
      if (!signError && signed?.signedUrl) {
        playlist.push({
          id: record.id,
          title: record.title,
          artist: record.artist || "本地音乐",
          src: signed.signedUrl,
          cover: coverUrl,
          source: "cloud"
        });
      }
    }
    storageNote.textContent = "已登录：导入音乐会保存到云端，并在本浏览器保留副本。";
  };

  const renderPlaylist = () => {
    listNode.innerHTML = playlist.map((track, index) => `
      <button class="music-list-item${index === currentIndex ? " active" : ""}" type="button"
        role="listitem" data-track-index="${index}" title="播放 ${escapeHtml(track.title)}">
        <img class="music-list-cover" src="${track.cover}" alt="">
        <span class="music-list-copy">
          <strong>${escapeHtml(track.title)}</strong>
          <span>${escapeHtml(track.artist || "未知艺术家")}</span>
        </span>
        <span class="music-list-state">${index === currentIndex ? (audio.paused ? "当前" : "播放中") : ""}</span>
      </button>
    `).join("");
  };

  const updateNowPlaying = () => {
    const track = playlist[currentIndex];
    if (!track) return;
    titleNode.textContent = track.title;
    artistNode.textContent = track.artist || "未知艺术家";
    coverNode.style.setProperty("--music-cover", `url("${track.cover.replaceAll('"', "%22")}")`);
    playButton.innerHTML = audio.paused ? iconPlay : iconPause;
    playButton.title = audio.paused ? "播放" : "暂停";
    playButton.setAttribute("aria-label", playButton.title);
    playerCard.classList.toggle("is-playing", !audio.paused && !audio.ended);
    const mode = playModes.find((item) => item.id === playMode) || playModes[0];
    modeButton.textContent = mode.icon;
    modeButton.title = mode.label;
    modeButton.setAttribute("aria-label", mode.label);
    renderPlaylist();
  };

  const updateProgress = () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    progress.value = String(duration ? Math.round((audio.currentTime / duration) * 1000) : 0);
    timeNode.textContent = `${formatTime(audio.currentTime)} / ${formatTime(duration)}`;
  };

  const playAudio = async () => {
    try {
      await audio.play();
    } catch {
      showMessage("浏览器暂未允许播放，请再次点击播放按钮继续。");
    }
    updateNowPlaying();
    saveState(true);
  };

  const loadTrack = async (index, options = {}) => {
    if (!playlist.length) return;
    currentIndex = (index + playlist.length) % playlist.length;
    audio.src = playlist[currentIndex].src;
    pendingResumeTime = Number(options.time) || 0;
    shouldResumePlayback = Boolean(options.play);
    audio.load();
    updateNowPlaying();
    updateProgress();
    saveState(true);
    if (options.play && pendingResumeTime === 0) {
      shouldResumePlayback = false;
      await playAudio();
    }
  };

  const getRandomIndex = () => {
    if (playlist.length < 2) return currentIndex;
    let next = currentIndex;
    while (next === currentIndex) next = Math.floor(Math.random() * playlist.length);
    return next;
  };

  const changeTrack = (direction) => {
    const nextIndex = playMode === "shuffle" ? getRandomIndex() : currentIndex + direction;
    return loadTrack(nextIndex, { play: true });
  };

  const setPanelOpen = (open) => {
    panel.classList.toggle("open", open);
    playerCard.setAttribute("aria-expanded", String(open));
  };

  const uploadCloudTrack = async (client, file, trackId, title) => {
    if (!client || !currentUser) return false;
    const safeName = file.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_");
    const storagePath = `${currentUser.id}/${trackId}/${safeName}`;
    const { error: uploadError } = await client.storage.from(CLOUD_BUCKET).upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || "application/octet-stream",
      upsert: false
    });
    if (uploadError) return false;
    const { error: rowError } = await client.from(CLOUD_TABLE).insert({
      id: trackId,
      user_id: currentUser.id,
      title,
      artist: "本地音乐",
      storage_path: storagePath
    });
    if (rowError) {
      await client.storage.from(CLOUD_BUCKET).remove([storagePath]);
      return false;
    }
    return true;
  };

  const importFiles = async (files) => {
    const supported = [...files].filter((file) => /\.(mp3|m4a)$/i.test(file.name));
    if (!supported.length) {
      showMessage("请选择 mp3 或 m4a 音乐文件。");
      return;
    }
    const client = currentUser ? getCloudClient() : null;
    let cloudFailures = 0;
    for (const file of supported) {
      const id = `import-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const title = file.name.replace(/\.(mp3|m4a)$/i, "");
      const record = {
        key: `${scopeKey()}:${id}`,
        scope: scopeKey(),
        id,
        title,
        artist: "本地音乐",
        file,
        createdAt: Date.now()
      };
      const saved = await putLocalTrack(record);
      if (!saved) showMessage(`无法持久保存 ${file.name}，但本次打开期间仍可播放。`);
      playlist.push(makeLocalTrack(record));
      if (currentUser && !(await uploadCloudTrack(client, file, id, title))) cloudFailures += 1;
    }
    renderPlaylist();
    showMessage(cloudFailures
      ? `已导入 ${supported.length} 首；云同步未配置，已保存在本浏览器。`
      : `已导入 ${supported.length} 首音乐。`);
    fileInput.value = "";
  };

  playerCard.addEventListener("click", (event) => {
    if (event.target.closest(".player-btn, .music-panel")) return;
    event.stopPropagation();
    setPanelOpen(!panel.classList.contains("open"));
  });

  [playButton, prevButton, nextButton].forEach((button) => {
    button.addEventListener("click", (event) => event.stopPropagation());
  });

  playButton.addEventListener("click", async () => {
    if (audio.paused) await playAudio();
    else audio.pause();
    updateNowPlaying();
    saveState(true);
  });
  prevButton.addEventListener("click", () => changeTrack(-1));
  nextButton.addEventListener("click", () => changeTrack(1));
  closeButton.addEventListener("click", () => setPanelOpen(false));
  modeButton.addEventListener("click", () => {
    const currentModeIndex = playModes.findIndex((item) => item.id === playMode);
    playMode = playModes[(currentModeIndex + 1) % playModes.length].id;
    updateNowPlaying();
    saveState(true);
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => setPanelOpen(false));

  listNode.addEventListener("click", (event) => {
    const item = event.target.closest("[data-track-index]");
    if (item) loadTrack(Number(item.dataset.trackIndex), { play: true });
  });

  importButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => importFiles(fileInput.files || []));

  progress.addEventListener("input", () => {
    if (!Number.isFinite(audio.duration)) return;
    audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
    updateProgress();
  });

  audio.addEventListener("loadedmetadata", async () => {
    if (pendingResumeTime > 0) {
      audio.currentTime = Math.min(pendingResumeTime, Math.max(0, audio.duration - .15));
      pendingResumeTime = 0;
    }
    updateProgress();
    if (shouldResumePlayback) {
      shouldResumePlayback = false;
      await playAudio();
    }
  });
  audio.addEventListener("timeupdate", () => {
    updateProgress();
    saveState();
  });
  audio.addEventListener("play", updateNowPlaying);
  audio.addEventListener("pause", () => {
    updateNowPlaying();
    saveState(true);
  });
  audio.addEventListener("ended", () => {
    if (playMode === "repeat-one") {
      audio.currentTime = 0;
      playAudio();
      return;
    }
    changeTrack(1);
  });
  audio.addEventListener("error", () => {
    showMessage("这首音乐无法播放，已尝试切换到下一首。");
    setTimeout(() => changeTrack(1), 700);
  });

  window.addEventListener("pagehide", () => saveState(true));
  window.addEventListener("beforeunload", () => saveState(true));

  const initialize = async () => {
    await ensureCloudDependencies();
    const client = await restoreUser();
    await loadLocalTracks();
    await loadCloudTracks(client);
    const saved = getSavedState();
    playMode = playModes.some((item) => item.id === saved.playMode) ? saved.playMode : "sequence";
    const index = playlist.findIndex((track) => track.id === saved.trackId);
    const elapsed = saved.playing && saved.updatedAt
      ? Math.min(5, Math.max(0, (Date.now() - saved.updatedAt) / 1000))
      : 0;
    audio.volume = Number.isFinite(saved.volume) ? saved.volume : 1;
    await loadTrack(index >= 0 ? index : 0, {
      time: Math.max(0, Number(saved.currentTime) || 0) + elapsed,
      play: Boolean(saved.playing)
    });
    renderPlaylist();
  };

  initialize();
})();
