const userName = "lizlei";
const GUEST_SESSION_KEY = "portalGuestSession";
const config = window.SUPABASE_CONFIG || {};
const hasSupabaseConfig = Boolean(config.url && config.anonKey && window.supabase);
const db = hasSupabaseConfig ? window.supabase.createClient(config.url, config.anonKey) : null;
const cloudTable = "note_workspaces";
const cloudBucket = "note-files";
let currentUser = null;
let cloudSaveTimer = null;

const quotes = [
  "记录灵感，整理思绪，让知识有所生长。",
  "把散落的想法收好，明天会更清楚。",
  "知识有了秩序，行动就会变轻。",
  "让每一份资料，都能在需要时被看见。",
  "整理不是结束，是新的开始。"
];

const defaultState = {
  subjects: [
    { id: "english", name: "英语学习", note: "视频技巧与创作库", icon: "palette", createdAt: "2026-01-01" },
    { id: "course", name: "专业课程", note: "Tailwind 代码片段", icon: "code", createdAt: "2026-01-01" },
    { id: "backup", name: "资料备份", note: "参考视频与案例", icon: "calendar", createdAt: "2026-01-01" },
    { id: "homework", name: "作业提交", note: "共享资源与素材", icon: "cloud", createdAt: "2026-01-01" },
    { id: "application", name: "申请材料", note: "构思与草稿记录", icon: "compass", createdAt: "2026-01-01" }
  ],
  folders: [
    { id: "folder-english", subjectId: "english", name: "英语学习" },
    { id: "folder-course", subjectId: "course", name: "专业课程" },
    { id: "folder-backup", subjectId: "backup", name: "资料备份" },
    { id: "folder-homework", subjectId: "homework", name: "作业提交" },
    { id: "folder-application", subjectId: "application", name: "申请材料" }
  ],
  pinnedFolders: [
    { id: "folder-english" },
    { id: "folder-course" }
  ],
  files: [],
  links: []
};

const storageKey = "note-organizer-state";
let state = loadState();
const runtimeFileUrls = new Map();

const icons = {
  palette: '<path d="M12 4a8 8 0 0 0 0 16h1.2a1.8 1.8 0 0 0 1.2-3.1 1.9 1.9 0 0 1 1.3-3.3H17a3 3 0 0 0 3-3C20 7 16.4 4 12 4Z"></path><circle cx="8.5" cy="10" r=".8"></circle><circle cx="11.3" cy="7.8" r=".8"></circle><circle cx="15" cy="9.2" r=".8"></circle>',
  code: '<path d="m8 8-4 4 4 4"></path><path d="m16 8 4 4-4 4"></path>',
  calendar: '<path d="M7 3v4"></path><path d="M17 3v4"></path><rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M4 10h16"></path>',
  cloud: '<path d="M17.5 18H8a4 4 0 0 1-.7-7.9A5.5 5.5 0 0 1 18 12h.2a3 3 0 0 1-.7 6Z"></path><path d="M12 10v6"></path><path d="m9.5 13.5 2.5 2.5 2.5-2.5"></path>',
  compass: '<circle cx="12" cy="6" r="1.8"></circle><path d="M12 8v13"></path><path d="M7 21 12 8l5 13"></path>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3Z"></path>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h5"></path>',
  pen: '<path d="m12 20 9-9-4-4-9 9-2 6 6-2Z"></path><path d="m15 9 4 4"></path>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"></path>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"></rect><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path>',
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"></path>',
  lightbulb: '<path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M8.5 14.5A6 6 0 1 1 15.5 14c-.8.7-1.5 1.7-1.5 3h-4c0-1.2-.6-1.9-1.5-2.5Z"></path>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z"></path>'
};

const emojiIcons = ["📘", "📝", "💡", "📎", "📂", "🎧", "🎬", "🧠", "⭐", "✅", "🗂️", "🔖"];

const userNameNode = document.querySelector("#userName");
const quoteNode = document.querySelector("#quoteLine");
const subjectGrid = document.querySelector("#subjectGrid");
const pinnedList = document.querySelector("#pinnedList");
const searchInput = document.querySelector("#searchInput");
const searchResults = document.querySelector("#searchResults");
const homePage = document.querySelector("#homePage");
const subjectDetailPage = document.querySelector("#subjectDetailPage");
const quickEditButton = document.querySelector("#quickEditButton");
const addPinButton = document.querySelector("#addPinButton");
const editPinButton = document.querySelector("#editPinButton");
const browseButton = document.querySelector("#browseButton");
const fileInput = document.querySelector("#fileInput");
const uploadDropZone = document.querySelector("#uploadDropZone");
const uploadStorageHint = document.querySelector("#uploadStorageHint");
const modalBackdrop = document.querySelector("#modalBackdrop");
const modalTitle = document.querySelector("#modalTitle");
const modalBody = document.querySelector("#modalBody");
const modalClose = document.querySelector("#modalClose");

userNameNode.textContent = userName;
quoteNode.textContent = quotes[Math.floor(Math.random() * quotes.length)];

let quickEditMode = false;
let pinnedEditMode = false;
let subjectDrafts = [];
let draggedSubjectId = "";
let sortDrag = {
  active: false,
  ghost: null,
  offsetX: 0,
  offsetY: 0,
  startX: 0,
  startY: 0,
  timer: null,
  subjectId: ""
};
let subjectDetailSort = {
  type: "time",
  direction: "desc"
};
let subjectDetailFolderId = "";

render();
updateStorageHint();
bootWorkspace();

quickEditButton.addEventListener("click", toggleQuickEdit);
searchInput.addEventListener("input", handleSearch);
addPinButton.addEventListener("click", openPinnedModal);
editPinButton.addEventListener("click", togglePinnedEdit);
browseButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) openUploadModal([...fileInput.files]);
});
modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeModal();
});

["dragenter", "dragover"].forEach((eventName) => {
  uploadDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadDropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  uploadDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadDropZone.classList.remove("dragging");
  });
});

uploadDropZone.addEventListener("drop", (event) => {
  const droppedFiles = [...event.dataTransfer.files];
  if (droppedFiles.length) openUploadModal(droppedFiles);
});

window.addEventListener("hashchange", renderRoute);
renderRoute();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(getLocalStorageKey()) || "null");
    if (!saved) return normalizeState(structuredClone(defaultState));
    return normalizeState({
      subjects: saved.subjects || defaultState.subjects,
      folders: saved.folders || defaultState.folders,
      pinnedFolders: saved.pinnedFolders || defaultState.pinnedFolders,
      files: saved.files || [],
      links: saved.links || []
    });
  } catch {
    return normalizeState(structuredClone(defaultState));
  }
}

function saveState() {
  if (currentUser) {
    localStorage.setItem(`user:${currentUser.id}:${storageKey}`, JSON.stringify(getCloudSafeState()));
    scheduleCloudSave();
    return;
  }
  localStorage.setItem(getLocalStorageKey(), JSON.stringify(state));
}

function trySaveState() {
  try {
    saveState();
    return true;
  } catch {
    return false;
  }
}

function isGuestSession() {
  try {
    return localStorage.getItem(GUEST_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function getLocalStorageKey() {
  if (isGuestSession()) return `guest:${storageKey}`;
  if (currentUser) return `user:${currentUser.id}:${storageKey}`;
  return `anonymous:${storageKey}`;
}

function getCloudSafeState() {
  return {
    ...state,
    files: state.files.map(({ dataUrl, ...file }) => file)
  };
}

function replaceState(nextState) {
  state = normalizeState(nextState || structuredClone(defaultState));
  render();
  renderRoute();
}

async function bootWorkspace() {
  try {
    if (isGuestSession() || !db) return;

    const { data, error } = await db.auth.getSession();
    if (error || !data?.session?.user) return;

    currentUser = data.session.user;
    state = loadState();
    render();
    renderRoute();
    updateStorageHint();

    try {
      localStorage.setItem("portalCurrentUserEmail", currentUser.email || "");
    } catch {}

    await loadCloudWorkspace();
    db.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      updateStorageHint();
      if (currentUser) await loadCloudWorkspace();
    });
  } finally {
    finishWorkspaceBoot();
  }
}

function finishWorkspaceBoot() {
  requestAnimationFrame(() => {
    document.body.classList.remove("note-booting");
  });
}

function updateStorageHint() {
  if (!uploadStorageHint) return;
  uploadStorageHint.innerHTML = currentUser
    ? "将文件拖到卡片框此处，<br>即可快速上传到账号云端。"
    : "将文件拖到卡片框此处，<br>游客数据仅保存在本地浏览器。";
}

async function loadCloudWorkspace() {
  if (!currentUser || !db) return;
  const { data, error } = await db
    .from(cloudTable)
    .select("state")
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (error) {
    console.error("读取文件整理云端数据失败", error);
    return;
  }
  if (data?.state) {
    replaceState(data.state);
    return;
  }
  await persistCloudState();
}

function scheduleCloudSave() {
  if (!currentUser || !db) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(persistCloudState, 250);
}

async function persistCloudState() {
  if (!currentUser || !db) return;
  const { error } = await db.from(cloudTable).upsert({
    user_id: currentUser.id,
    state: getCloudSafeState(),
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  if (error) console.error("保存文件整理云端数据失败", error);
}

function normalizeState(source) {
  const defaultCreatedAtById = new Map(defaultState.subjects.map((subject) => [subject.id, subject.createdAt]));
  source.subjects = (source.subjects || []).map((subject) => ({
    ...subject,
    createdAt: subject.createdAt || defaultCreatedAtById.get(subject.id) || getTodayDate()
  }));
  source.folders = (source.folders || []).map((folder) => ({ ...folder, parentId: folder.parentId || "" }));
  source.files = source.files || [];
  source.links = source.links || [];
  cleanupState(source);
  return source;
}

function cleanupState(source = state) {
  const subjectIds = new Set((source.subjects || []).map((subject) => subject.id));
  source.folders = (source.folders || []).filter((folder) => subjectIds.has(folder.subjectId));
  let validFolderIds = new Set(source.folders.map((folder) => folder.id));
  source.folders = source.folders.filter((folder) => !folder.parentId || validFolderIds.has(folder.parentId));
  validFolderIds = new Set(source.folders.map((folder) => folder.id));
  source.pinnedFolders = (source.pinnedFolders || [])
    .map((pin) => ({ type: pin.type || "folder", id: pin.id }))
    .filter((pin) => pin.type === "subject" ? subjectIds.has(pin.id) : validFolderIds.has(pin.id));
  const subjectRootFolderIds = new Set(source.folders.filter((folder) => !folder.isContentFolder).map((folder) => folder.id));
  source.files = (source.files || [])
    .filter((file) => subjectIds.has(file.subjectId) && (!file.folderId || validFolderIds.has(file.folderId)))
    .map((file) => ({
      ...file,
      folderId: subjectRootFolderIds.has(file.folderId) ? "" : (file.folderId || "")
    }));
  source.links = (source.links || []).filter((link) => subjectIds.has(link.subjectId));
}

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function render() {
  renderSubjects();
  renderPinnedFolders();
  saveState();
}

function renderSubjects() {
  subjectGrid.innerHTML = "";
  subjectGrid.classList.toggle("is-sorting", quickEditMode);

  if (quickEditMode) {
    quickEditButton.classList.add("is-saving");
    quickEditButton.textContent = "保存";
    document.body.classList.add("quick-editing");
    subjectDrafts.forEach((subject) => renderEditableSubject(subject));
    return;
  }

  document.body.classList.remove("quick-editing");
  quickEditButton.classList.remove("is-saving");
  quickEditButton.innerHTML = "<span></span><span></span><span></span>";

  state.subjects.forEach((subject) => {
    const card = document.createElement("button");
    card.className = "subject-card";
    card.type = "button";
    card.innerHTML = `
      ${renderSubjectIcon(subject.icon)}
      <h3>${escapeHtml(subject.name)}</h3>
      <p>${escapeHtml(subject.note)}</p>
    `;
    card.addEventListener("click", () => openSubject(subject.id));
    subjectGrid.append(card);
  });

  const addCard = document.createElement("button");
  addCard.className = "subject-card subject-add";
  addCard.type = "button";
  addCard.textContent = "+";
  addCard.addEventListener("click", openSubjectModal);
  subjectGrid.append(addCard);
}

function renderEditableSubject(subject) {
  const card = document.createElement("div");
  card.className = "subject-card editing";
  if (subject.id === draggedSubjectId) card.classList.add("is-dragging");
  card.dataset.subjectId = subject.id;
  card.innerHTML = `
    <button class="subject-icon-button" type="button" data-open-icon="${subject.id}" aria-label="选择科目图标">
      ${renderSubjectIcon(subject.icon)}
    </button>
    <h3 contenteditable="true" data-edit-name="${subject.id}" spellcheck="false">${escapeHtml(subject.name)}</h3>
    <p contenteditable="true" data-edit-note="${subject.id}" spellcheck="false">${escapeHtml(subject.note)}</p>
  `;
  subjectGrid.append(card);
}

function renderSubjectIcon(iconName) {
  if (String(iconName || "").startsWith("emoji:")) {
    return `<span class="emoji-icon" aria-hidden="true">${escapeHtml(iconName.replace("emoji:", ""))}</span>`;
  }
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[iconName] || icons.palette}</svg>`;
}

function getIconChoices(selectedIcon) {
  const lineIcons = Object.keys(icons)
    .filter((name) => name !== "folder")
    .map((name) => `
      <button class="icon-option ${name === selectedIcon ? "is-selected" : ""}" type="button" data-edit-icon="${name}" aria-label="选择 ${name}">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>
      </button>
    `)
    .join("");
  const emojis = emojiIcons
    .map((emoji) => {
      const value = `emoji:${emoji}`;
      return `
        <button class="icon-option emoji-option ${value === selectedIcon ? "is-selected" : ""}" type="button" data-edit-icon="${value}" aria-label="选择 ${emoji}">
          ${emoji}
        </button>
      `;
    })
    .join("");
  return `<div class="icon-picker">${lineIcons}</div><div class="emoji-picker">${emojis}</div>`;
}

function toggleQuickEdit() {
  if (!quickEditMode) {
    quickEditMode = true;
    subjectDrafts = state.subjects.map((subject) => ({ ...subject }));
    renderSubjects();
    return;
  }

  subjectGrid.querySelectorAll("[data-edit-name]").forEach((input) => {
    const subject = subjectDrafts.find((item) => item.id === input.dataset.editName);
    if (subject) subject.name = input.textContent.trim() || subject.name;
  });
  subjectGrid.querySelectorAll("[data-edit-note]").forEach((input) => {
    const subject = subjectDrafts.find((item) => item.id === input.dataset.editNote);
    if (subject) subject.note = input.textContent.trim() || subject.note;
  });

  state.subjects = subjectDrafts.map((subject) => ({ ...subject }));
  quickEditMode = false;
  subjectDrafts = [];
  draggedSubjectId = "";
  document.body.classList.remove("quick-editing");
  render();
}

subjectGrid.addEventListener("click", (event) => {
  if (!quickEditMode) return;

  const iconTrigger = event.target.closest("[data-open-icon]");
  if (iconTrigger) {
    openIconPicker(iconTrigger.dataset.openIcon);
    return;
  }

});

subjectGrid.addEventListener("pointerdown", (event) => {
  if (!quickEditMode) return;
  const card = event.target.closest(".subject-card.editing");
  if (!card || event.target.closest("[contenteditable='true'], button")) return;

  event.preventDefault();
  startSubjectDrag(card, event);
});

document.addEventListener("pointermove", (event) => {
  if (!sortDrag.active || !sortDrag.ghost) return;
  event.preventDefault();
  moveSubjectGhost(event.clientX, event.clientY);

  const targetCard = document.elementFromPoint(event.clientX, event.clientY)?.closest(".subject-card.editing");
  if (!targetCard || targetCard.dataset.subjectId === draggedSubjectId) return;
  const targetRect = targetCard.getBoundingClientRect();
  const insertAfter = event.clientY > targetRect.top + targetRect.height / 2;
  reorderSubjectDraft(draggedSubjectId, targetCard.dataset.subjectId, insertAfter);
  renderSubjects();
});

document.addEventListener("pointerup", finishSubjectDrag);
document.addEventListener("pointercancel", finishSubjectDrag);

function startSubjectDrag(card, event) {
  syncSubjectDraftText();
  draggedSubjectId = card.dataset.subjectId;
  sortDrag.active = true;
  sortDrag.timer = null;

  const rect = card.getBoundingClientRect();
  sortDrag.offsetX = event.clientX - rect.left;
  sortDrag.offsetY = event.clientY - rect.top;

  const ghost = card.cloneNode(true);
  ghost.classList.remove("is-dragging");
  ghost.classList.add("drag-float");
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.left = "0px";
  ghost.style.top = "0px";
  document.body.append(ghost);
  sortDrag.ghost = ghost;

  card.classList.add("is-dragging");
  subjectGrid.classList.add("is-custom-dragging");
  document.body.classList.add("subject-dragging");
  moveSubjectGhost(event.clientX, event.clientY);
}

function moveSubjectGhost(clientX, clientY) {
  if (!sortDrag.ghost) return;
  const x = clientX - sortDrag.offsetX;
  const y = clientY - sortDrag.offsetY;
  sortDrag.ghost.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.045) rotate(0.7deg)`;
}

function finishSubjectDrag() {
  if (!sortDrag.active && !sortDrag.timer) return;
  window.clearTimeout(sortDrag.timer);
  sortDrag.timer = null;
  if (sortDrag.ghost) sortDrag.ghost.remove();
  sortDrag.ghost = null;
  sortDrag.active = false;
  sortDrag.subjectId = "";
  draggedSubjectId = "";
  subjectGrid.classList.remove("is-custom-dragging");
  document.body.classList.remove("subject-dragging");
  if (quickEditMode) renderSubjects();
}

function openIconPicker(subjectId) {
  syncSubjectDraftText();
  const subject = subjectDrafts.find((item) => item.id === subjectId);
  if (!subject) return;

  openModal("选择科目图标", `
    <div class="form-grid icon-library">
      ${getIconChoices(subject.icon)}
      <div class="modal-actions">
        <button class="primary-button" type="button" data-close>完成</button>
      </div>
    </div>
  `);

  modalBody.querySelectorAll("[data-edit-icon]").forEach((button) => {
    button.addEventListener("click", () => {
      subject.icon = button.dataset.editIcon;
      closeModal();
      renderSubjects();
    });
  });
}

function reorderSubjectDraft(subjectId, targetId, insertAfter) {
  const currentIndex = subjectDrafts.findIndex((subject) => subject.id === subjectId);
  const targetIndex = subjectDrafts.findIndex((subject) => subject.id === targetId);
  if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) return;
  const [subject] = subjectDrafts.splice(currentIndex, 1);
  const adjustedTargetIndex = subjectDrafts.findIndex((item) => item.id === targetId);
  subjectDrafts.splice(adjustedTargetIndex + (insertAfter ? 1 : 0), 0, subject);
}

function syncSubjectDraftText() {
  subjectGrid.querySelectorAll("[data-edit-name]").forEach((input) => {
    const subject = subjectDrafts.find((item) => item.id === input.dataset.editName);
    if (subject) subject.name = input.textContent.trim() || subject.name;
  });
  subjectGrid.querySelectorAll("[data-edit-note]").forEach((input) => {
    const subject = subjectDrafts.find((item) => item.id === input.dataset.editNote);
    if (subject) subject.note = input.textContent.trim() || subject.note;
  });
}

function renderPinnedFolders() {
  pinnedList.innerHTML = "";
  editPinButton.classList.toggle("is-active", pinnedEditMode);
  state.pinnedFolders.forEach((pin) => {
    const pinned = getPinnedItem(pin);
    if (!pinned) return;
    const row = document.createElement("button");
    row.className = "pinned-item";
    row.type = "button";
    row.innerHTML = `
      <svg class="icon folder-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[pinned.icon]}</svg>
      <span>${escapeHtml(pinned.label)}</span>
      ${pinnedEditMode ? `<button class="pin-remove-inline" type="button" data-remove-pin="${pinned.id}" data-remove-pin-type="${pinned.type}" aria-label="从置顶移除 ${escapeHtml(pinned.label)}">-</button>` : ""}
    `;
    row.addEventListener("click", (event) => {
      if (pinnedEditMode || event.target.closest("[data-remove-pin]")) return;
      if (pinned.type === "subject") openSubject(pinned.id);
      if (pinned.type === "folder") openSubjectFolder(pinned.subjectId, pinned.id);
    });
    pinnedList.append(row);
  });
}

pinnedList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-pin]");
  if (!removeButton) return;
  event.stopPropagation();
  confirmRemovePinned(removeButton.dataset.removePin, removeButton.dataset.removePinType);
});

function handleSearch() {
  cleanupState();
  saveState();
  const keyword = searchInput.value.trim().toLowerCase();
  if (!keyword) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }

  // TODO: 后续接入后端后，可在这里追加文件正文内容搜索。
  const subjectMatches = state.subjects
    .filter((item) => matchKeyword([item.name, item.note], keyword))
    .map((item) => ({ type: "科目", title: item.name, desc: item.note, action: () => openSubject(item.id) }));
  const folderMatches = state.folders
    .filter((item) => item.isContentFolder && matchKeyword([item.name], keyword))
    .map((item) => ({ type: "文件夹", title: item.name, desc: `${getSubjectName(item.subjectId)} / ${getParentFolderLabel(item.parentId)}`, action: () => openSubjectFolder(item.subjectId, item.id) }));
  const fileMatches = state.files
    .filter((item) => matchKeyword([item.name], keyword))
    .map((item) => ({ type: "文件", title: item.name, desc: `${getSubjectName(item.subjectId)} / ${getParentFolderLabel(item.folderId)}`, action: () => openStoredFile(item.id) }));

  const results = [...subjectMatches, ...folderMatches, ...fileMatches].slice(0, 8);
  searchResults.innerHTML = "";
  if (!results.length) {
    searchResults.innerHTML = '<div class="search-result"><strong>没有找到匹配内容</strong><span>换个关键词试试</span></div>';
  } else {
    results.forEach((item) => {
      const row = document.createElement("button");
      row.className = "search-result";
      row.type = "button";
      row.innerHTML = `<div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.desc || item.type)}</span></div><span>${item.type}</span>`;
      row.addEventListener("click", () => {
        searchResults.hidden = true;
        item.action();
      });
      searchResults.append(row);
    });
  }
  searchResults.hidden = false;
}

function openSubjectModal() {
  openModal("新增科目", `
    <form class="form-grid" id="subjectForm">
      <div class="field">
        <label for="subjectNameInput">科目名称</label>
        <input id="subjectNameInput" name="name" required placeholder="例如：阅读摘录">
      </div>
      <div class="field">
        <label for="subjectNoteInput">备注</label>
        <textarea id="subjectNoteInput" name="note" required placeholder="例如：文章、书单与灵感记录"></textarea>
      </div>
      <div class="modal-actions">
        <button class="secondary-button" type="button" data-close>取消</button>
        <button class="primary-button" type="submit">确认新增</button>
      </div>
    </form>
  `);

  document.querySelector("#subjectForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = `subject-${Date.now()}`;
    state.subjects.unshift({
      id,
      name: String(form.get("name")).trim(),
      note: String(form.get("note")).trim(),
      icon: "palette",
      createdAt: getTodayDate()
    });
    state.folders.push({ id: `folder-${Date.now()}`, subjectId: id, name: String(form.get("name")).trim() });
    closeModal();
    render();
  });
}

function openPinnedModal() {
  const subjectOptions = state.subjects.map((subject) => `<option value="${subject.id}">${escapeHtml(subject.name)}</option>`).join("");

  openModal("添加置顶文件夹", `
    <form class="form-grid" id="pinForm">
      <div class="field">
        <label for="pinTypeSelect">置顶类型</label>
        <select id="pinTypeSelect" name="pinType">
          <option value="subject">科目</option>
          <option value="folder">科目里的文件夹</option>
        </select>
      </div>
      <div class="field">
        <label for="pinSubjectSelect">选择科目</label>
        <select id="pinSubjectSelect" name="subjectId" required>${subjectOptions}</select>
      </div>
      <div class="field" data-pin-folder-field hidden>
        <label for="pinFolderSelect">选择文件夹</label>
        <select id="pinFolderSelect" name="folderId">
        </select>
      </div>
      <div class="modal-actions">
        <button class="secondary-button" type="button" data-close>取消</button>
        <button class="primary-button" type="submit">添加</button>
      </div>
    </form>
  `);

  const typeSelect = document.querySelector("#pinTypeSelect");
  const subjectSelect = document.querySelector("#pinSubjectSelect");
  const folderSelect = document.querySelector("#pinFolderSelect");
  const folderField = document.querySelector("[data-pin-folder-field]");
  const syncPinFolders = () => {
    folderField.hidden = typeSelect.value !== "folder";
    const folders = getPinnableFolders(subjectSelect.value);
    folderSelect.innerHTML = folders.length
      ? folders.map((folder) => `<option value="${folder.id}">${escapeHtml(getFolderOptionLabel(folder))}</option>`).join("")
      : '<option value="">暂无可添加文件夹</option>';
  };
  typeSelect.addEventListener("change", syncPinFolders);
  subjectSelect.addEventListener("change", syncPinFolders);
  syncPinFolders();

  document.querySelector("#pinForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pinType = form.get("pinType");
    if (pinType === "subject") {
      const subjectId = String(form.get("subjectId"));
      if (subjectId && !state.pinnedFolders.some((pin) => (pin.type || "folder") === "subject" && pin.id === subjectId)) {
        state.pinnedFolders.push({ type: "subject", id: subjectId });
      }
    } else {
      const folderId = String(form.get("folderId") || "");
      if (folderId) state.pinnedFolders.push({ type: "folder", id: folderId });
    }
    closeModal();
    render();
  });
}

function togglePinnedEdit() {
  pinnedEditMode = !pinnedEditMode;
  renderPinnedFolders();
}

function confirmRemovePinned(itemId, pinType = "folder") {
  const pinned = getPinnedItem({ type: pinType, id: itemId });
  if (!pinned) return;
  openModal("移除置顶文件夹", `
    <div class="confirm-copy">
      <p>确认将“${escapeHtml(pinned.label)}”从置顶文件夹中移除吗？</p>
      <span>原科目、文件夹和已上传文件不会被删除。</span>
    </div>
    <div class="modal-actions">
      <button class="secondary-button" type="button" data-close>取消</button>
      <button class="danger-button" id="confirmRemovePin" type="button">确认移除</button>
    </div>
  `);

  document.querySelector("#confirmRemovePin").addEventListener("click", () => {
    state.pinnedFolders = state.pinnedFolders.filter((pin) => !((pin.type || "folder") === pinType && pin.id === itemId));
    closeModal();
    render();
  });
}

function openUploadModal(selectedFiles) {
  const subjectOptions = state.subjects.map((subject) => `<option value="${subject.id}">${escapeHtml(subject.name)}</option>`).join("");
  openModal("上传文件", `
    <form class="form-grid" id="uploadForm">
      <div class="field">
        <label>已选择文件</label>
        <input value="${escapeHtml(selectedFiles.map((file) => file.name).join("、"))}" readonly>
        <small class="field-hint">支持图片、PDF、文本、音视频预览；Word、Excel、PPT 等 Office 文件需下载后打开。</small>
      </div>
      <div class="field">
        <label for="uploadSubjectSelect">选择科目</label>
        <select id="uploadSubjectSelect" name="subjectId" required>${subjectOptions}</select>
      </div>
      <div class="field">
        <label for="uploadFolderSelect">选择文件夹</label>
        <select id="uploadFolderSelect" name="folderId"></select>
      </div>
      <div class="modal-actions">
        <button class="secondary-button" type="button" data-close>取消</button>
        <button class="primary-button" type="submit">确认上传</button>
      </div>
    </form>
  `);

  const subjectSelect = document.querySelector("#uploadSubjectSelect");
  const folderSelect = document.querySelector("#uploadFolderSelect");
  const syncFolders = () => {
    folderSelect.innerHTML = getFolderOptions(subjectSelect.value);
  };
  subjectSelect.addEventListener("change", syncFolders);
  syncFolders();

  document.querySelector("#uploadForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await addUploadedFiles(selectedFiles, String(form.get("subjectId")), String(form.get("folderId") || ""));
    if (!result.saved) {
      alert("浏览器本地存储空间不足，文件没有保存成功。请删除一些文件后再试。");
      return;
    }
    if (!result.contentPersisted) {
      alert("文件记录已保存，但浏览器本地空间不足，文件内容只能在本次页面会话中打开；刷新后需要重新上传才能打开内容。");
    }
    closeModal();
    render();
  });
}

function openModal(title, content) {
  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  modalBackdrop.hidden = false;
  modalBody.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModal));
}

function closeModal() {
  modalBackdrop.hidden = true;
  modalTitle.textContent = "";
  modalBody.innerHTML = "";
  fileInput.value = "";
}

function openSubject(subjectId) {
  console.log("open subject", subjectId);
  window.location.hash = `subject=${subjectId}`;
}

function openFolder(folderId) {
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder) return;
  openSubjectFolder(folder.subjectId, folder.id);
}

function openSubjectFolder(subjectId, folderId) {
  subjectDetailFolderId = folderId || "";
  window.location.hash = `subject=${subjectId}`;
  if (window.location.hash === `#subject=${subjectId}`) rerenderSubject(subjectId);
}

function renderRoute() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (hash === "subject-preview") {
    renderSubjectPageEmpty();
    return;
  }

  showHomePage();
  if (!hash) {
    document.title = "文件整理";
    return;
  }
  const [type, id] = hash.split("=");
  if (type === "subject") {
    const subject = state.subjects.find((item) => item.id === id);
    if (subject) {
      if (subjectDetailPage.hidden) subjectDetailFolderId = "";
      renderSubjectPageEmpty({
        subjectId: subject.id,
        subjectName: subject.name,
        subjectIcon: "folder",
        createdAt: subject.createdAt,
        fileCount: getSubjectItemCount(subject.id)
      });
    }
    return;
  }
  if (type === "folder") {
    const folder = state.folders.find((item) => item.id === id);
    if (folder) document.title = `${folder.name} - 文件整理`;
  }
}

function showHomePage() {
  homePage.hidden = false;
  subjectDetailPage.hidden = true;
  subjectDetailPage.innerHTML = "";
  subjectDetailFolderId = "";
}

function renderIcon(name, className = "icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
}

function renderStaticIcon(paths, className = "icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}

// 科目详情页空白模板，后续接入 #subject=<subjectId> 时使用。
function renderSubjectPageEmpty(subjectData = {}) {
  const subjectId = subjectData.subjectId || "english";
  const fileCount = Number.isFinite(subjectData.fileCount) ? subjectData.fileCount : 0;
  const subjectTemplate = {
    subjectId,
    subjectName: subjectData.subjectName || "英语学习",
    subjectIcon: subjectData.subjectIcon || "folder",
    subjectMeta: subjectData.subjectMeta || `文件数 ${fileCount} · 创建时间 ${subjectData.createdAt || "2026-01-01"}`,
    links: subjectData.links || getSubjectLinks(subjectId),
    files: subjectData.files || getSubjectFiles(subjectId, subjectDetailFolderId),
    folders: subjectData.folders || getSubjectContentFolders(subjectId, subjectDetailFolderId),
    folderPath: getFolderPath(subjectDetailFolderId)
  };

  const chevronDown = '<path d="m6 9 6 6 6-6"></path>';
  const moreIcon = '<path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path><path d="M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path><path d="M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>';

  homePage.hidden = true;
  subjectDetailPage.hidden = false;
  document.title = `${subjectTemplate.subjectName} - 文件整理`;
  subjectDetailPage.innerHTML = `
    <section class="search-shell subject-detail-search" aria-label="搜索">
      <div class="search-bar">
        ${renderStaticIcon('<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.6-3.6"></path>', "icon search-icon")}
        <input type="search" placeholder="搜索文件、链接或内容..." autocomplete="off" data-subject-search>
      </div>
      <div class="search-results subject-detail-results" data-subject-search-results hidden></div>
    </section>

    <section class="subject-detail-shell" data-subject-id="${escapeHtml(subjectTemplate.subjectId)}">
      <nav class="subject-breadcrumb" aria-label="路径">
        <button class="subject-breadcrumb-home" type="button" data-back-home>全部文件</button>
        <strong>&gt;</strong>
        <em>${escapeHtml(subjectTemplate.subjectName)}</em>
        ${subjectTemplate.folderPath.map((folder) => `<strong>&gt;</strong><button class="subject-breadcrumb-folder" type="button" data-open-folder="${folder.id}">${escapeHtml(folder.name)}</button>`).join("")}
      </nav>

      <header class="subject-hero">
        <div class="subject-folder-mark" aria-hidden="true">
          ${renderIcon(subjectTemplate.subjectIcon, "icon")}
        </div>
        <div class="subject-heading">
          <div class="subject-title-row">
            <h1>${escapeHtml(subjectTemplate.subjectName)}</h1>
            <button class="subject-title-edit" type="button" aria-label="编辑科目名称">
              ${renderIcon("pen", "icon")}
            </button>
          </div>
          <p>${escapeHtml(subjectTemplate.subjectMeta)}</p>
        </div>
      </header>

      <div class="subject-toolbar" aria-label="视图和排序">
        <button class="subject-sort-button is-active" type="button" data-sort-type="time" data-direction="desc">
          <span>按上传时间</span>
          ${renderStaticIcon(chevronDown, "icon subject-sort-arrow")}
        </button>
        <button class="subject-sort-button" type="button" data-sort-type="type" data-direction="desc">
          <span>按文件类型</span>
          ${renderStaticIcon(chevronDown, "icon subject-sort-arrow")}
        </button>
        <div class="subject-more-wrap">
          <button class="subject-more-button" type="button" aria-label="更多操作" data-subject-more>
            ${renderStaticIcon(moreIcon, "icon")}
          </button>
          <div class="subject-more-menu" data-subject-menu hidden>
            <button type="button" data-delete-subject>删除整个科目文件夹</button>
          </div>
        </div>
      </div>

      <section class="subject-content-grid">
        ${renderSubjectLinksCard(subjectTemplate)}
        ${renderSubjectFilesCard(subjectTemplate)}
      </section>
    </section>
  `;

  subjectDetailPage.querySelector("[data-back-home]").addEventListener("click", () => {
    history.pushState("", document.title, window.location.pathname);
    showHomePage();
    document.title = "文件整理";
  });
  subjectDetailPage.querySelector("[data-new-link]").addEventListener("click", () => openLinkModal(subjectTemplate.subjectId));
  subjectDetailPage.querySelector("[data-new-file]").addEventListener("click", () => openFileCreateModal(subjectTemplate.subjectId));
  const folderBackButton = subjectDetailPage.querySelector("[data-folder-back]");
  if (folderBackButton) {
    folderBackButton.addEventListener("click", () => {
      const currentFolder = state.folders.find((folder) => folder.id === subjectDetailFolderId);
      subjectDetailFolderId = currentFolder?.parentId || "";
      rerenderSubject(subjectTemplate.subjectId);
    });
  }
  subjectDetailPage.querySelectorAll("[data-open-folder]").forEach((button) => {
    button.addEventListener("click", () => {
      subjectDetailFolderId = button.dataset.openFolder;
      rerenderSubject(subjectTemplate.subjectId);
    });
  });
  subjectDetailPage.querySelector("[data-subject-search]").addEventListener("input", (event) => {
    renderSubjectSearchResults(subjectTemplate.subjectId, event.currentTarget.value);
  });
  subjectDetailPage.querySelector(".subject-content-grid").addEventListener("click", (event) => {
    const folderButton = event.target.closest("[data-folder-id]");
    if (folderButton) {
      subjectDetailFolderId = folderButton.dataset.folderId;
      rerenderSubject(subjectTemplate.subjectId);
      return;
    }

    const fileButton = event.target.closest("[data-file-id]");
    if (fileButton) {
      openStoredFile(fileButton.dataset.fileId);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-item]");
    if (deleteButton) {
      openDeleteItemConfirm(deleteButton.dataset.deleteType, deleteButton.dataset.deleteItem, subjectTemplate.subjectId);
    }
  });
  subjectDetailPage.querySelector("[data-subject-more]").addEventListener("click", () => {
    const menu = subjectDetailPage.querySelector("[data-subject-menu]");
    menu.hidden = !menu.hidden;
  });
  subjectDetailPage.querySelector("[data-delete-subject]").addEventListener("click", () => openDeleteSubjectConfirm(subjectTemplate.subjectId));
  bindSubjectSortButtons(subjectTemplate.subjectId);
}

function renderSubjectLinksCard(subjectTemplate) {
  const sortedLinks = sortSubjectItems(subjectTemplate.links, "link");
  return renderSubjectCard({
          type: "links",
          icon: "link",
    title: `链接文件（${subjectTemplate.links.length}）`,
          subtitle: "保存的网页链接、笔记链接等",
          emptyTitle: "暂无链接文件",
    emptyHint: "点击右上角「新建」添加网页链接或笔记链接",
    newAttr: "data-new-link",
    content: sortedLinks.map(renderLinkItem).join("")
  });
}

function renderSubjectFilesCard(subjectTemplate) {
  const fileItems = [
    ...subjectTemplate.folders.map((folder) => ({ ...folder, itemKind: "folder" })),
    ...subjectTemplate.files.map((file) => ({ ...file, itemKind: "file" }))
  ];
  const sortedFiles = sortSubjectItems(fileItems, "file");
  return renderSubjectCard({
          type: "files",
          icon: "file",
    title: `文件（${fileItems.length}）`,
          subtitle: "各类文档、图片、音视频等文件",
          emptyTitle: "暂无文件",
    emptyHint: "点击右上角「新建」上传文件或新建文件夹",
    extraActions: subjectDetailFolderId ? '<button class="subject-back-button" type="button" data-folder-back>返回</button>' : "",
    newAttr: "data-new-file",
    content: sortedFiles.map(renderFileItem).join("")
  });
}

function renderSubjectCard(card) {
  return `
    <article class="subject-panel subject-panel-${card.type}">
      <header class="subject-panel-head">
        <div class="subject-panel-title">
          ${renderIcon(card.icon, "icon")}
          <div>
            <h2>${card.title}</h2>
            <p>${card.subtitle}</p>
          </div>
        </div>
        <div class="subject-panel-actions">
          ${card.extraActions || ""}
          <button class="subject-new-button" type="button" ${card.newAttr}>+ 新建</button>
        </div>
      </header>
      ${card.content ? `<div class="subject-item-list">${card.content}</div>` : `<div class="subject-empty-state">
        <div class="subject-empty-icon">
          ${renderIcon(card.icon, "icon")}
        </div>
        <h3>${card.emptyTitle}</h3>
        <p>${card.emptyHint}</p>
      </div>`}
    </article>
  `;
}

function renderLinkItem(link) {
  return `
    <div class="subject-list-item">
      ${renderSiteBadge(link.siteName)}
      <div class="subject-list-copy">
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.siteName)} | ${escapeHtml(link.fileName)}</a>
        <p>${escapeHtml(link.note || "暂无备注")}</p>
      </div>
      <span>${escapeHtml(formatDate(link.createdAt))}</span>
      <button class="subject-item-more" type="button" aria-label="删除链接" data-delete-type="link" data-delete-item="${link.id}">...</button>
    </div>
  `;
}

function renderFileItem(item) {
  const isFolder = item.itemKind === "folder";
  const title = isFolder ? item.name : item.name;
  const meta = isFolder
    ? `${getParentFolderLabel(item.parentId)} · 文件夹`
    : `${getParentFolderLabel(item.folderId)} · ${item.fileType || getFileType(item.name)}`;
  const titleMarkup = isFolder
    ? `<button class="subject-item-title" type="button" data-folder-id="${item.id}">${escapeHtml(title)}</button>`
    : `<button class="subject-item-title" type="button" data-file-id="${item.id}">${escapeHtml(title)}</button>`;
  return `
    <div class="subject-list-item">
      ${isFolder ? renderIcon("folder", "icon subject-list-icon folder-icon") : renderFileTypeBadge(item.name)}
      <div class="subject-list-copy">
        ${titleMarkup}
        <p>${escapeHtml(meta)}</p>
      </div>
      <span>${escapeHtml(formatDate(item.createdAt))}</span>
      <button class="subject-item-more" type="button" aria-label="删除${isFolder ? "文件夹" : "文件"}" data-delete-type="${isFolder ? "folder" : "file"}" data-delete-item="${item.id}">...</button>
    </div>
  `;
}

function renderSiteBadge(siteName) {
  const name = String(siteName || "").trim();
  const lower = name.toLowerCase();
  const known = [
    { key: "b站", label: "B", className: "bilibili" },
    { key: "bilibili", label: "B", className: "bilibili" },
    { key: "飞书", label: "飞", className: "feishu" },
    { key: "lark", label: "飞", className: "feishu" },
    { key: "bbc", label: "BBC", className: "bbc" },
    { key: "notion", label: "N", className: "notion" },
    { key: "youtube", label: "YT", className: "youtube" }
  ].find((item) => lower.includes(item.key) || name.includes(item.key));
  const label = known?.label || name.slice(0, 2).toUpperCase() || "链";
  return `<span class="subject-site-badge ${known?.className || ""}" aria-hidden="true">${escapeHtml(label)}</span>`;
}

function renderFileTypeBadge(fileName) {
  const type = getFileKind(fileName);
  const labels = {
    image: "IMG",
    word: "W",
    excel: "X",
    ppt: "P",
    pdf: "PDF",
    audio: "AUD",
    video: "VID",
    archive: "ZIP",
    default: "FILE"
  };
  return `<span class="subject-file-badge ${type}" aria-hidden="true">${labels[type] || labels.default}</span>`;
}

function sortSubjectItems(items, panelType) {
  const direction = subjectDetailSort.direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (subjectDetailSort.type === "type") {
      const aType = panelType === "link" ? a.siteName : (a.itemKind === "folder" ? "文件夹" : getFileType(a.name));
      const bType = panelType === "link" ? b.siteName : (b.itemKind === "folder" ? "文件夹" : getFileType(b.name));
      return String(aType || "").localeCompare(String(bType || ""), "zh-CN") * direction;
    }
    return (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()) * direction;
  });
}

function bindSubjectSortButtons(subjectId) {
  subjectDetailPage.querySelectorAll(".subject-sort-button").forEach((button) => {
    const type = button.dataset.sortType;
    button.classList.toggle("is-active", subjectDetailSort.type === type);
    button.dataset.direction = subjectDetailSort.type === type ? subjectDetailSort.direction : "desc";
    button.addEventListener("click", () => {
      if (subjectDetailSort.type === type) {
        subjectDetailSort.direction = subjectDetailSort.direction === "desc" ? "asc" : "desc";
      } else {
        subjectDetailSort.type = type;
        subjectDetailSort.direction = "desc";
      }
      const subject = state.subjects.find((item) => item.id === subjectId);
      if (subject) {
        renderSubjectPageEmpty({
          subjectId: subject.id,
          subjectName: subject.name,
          subjectIcon: "folder",
          createdAt: subject.createdAt,
          fileCount: getSubjectItemCount(subject.id)
        });
      }
    });
  });
}

function getSubjectLinks(subjectId) {
  return state.links.filter((link) => link.subjectId === subjectId);
}

function getSubjectFiles(subjectId, folderId = subjectDetailFolderId) {
  return state.files.filter((file) => file.subjectId === subjectId && (file.folderId || "") === (folderId || ""));
}

function getSubjectContentFolders(subjectId, parentId = subjectDetailFolderId) {
  return state.folders.filter((folder) => folder.subjectId === subjectId && folder.isContentFolder && (folder.parentId || "") === (parentId || ""));
}

function getSubjectItemCount(subjectId) {
  return getSubjectLinks(subjectId).length
    + state.files.filter((file) => file.subjectId === subjectId).length
    + state.folders.filter((folder) => folder.subjectId === subjectId && folder.isContentFolder).length;
}

function formatDate(value) {
  if (!value) return getTodayDate();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getFileType(fileName) {
  const extension = String(fileName || "").split(".").pop();
  if (!extension || extension === fileName) return "未知类型";
  return extension.toUpperCase();
}

function getFileKind(fileName) {
  const extension = String(fileName || "").split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(extension)) return "image";
  if (["doc", "docx"].includes(extension)) return "word";
  if (["xls", "xlsx", "csv"].includes(extension)) return "excel";
  if (["ppt", "pptx", "key"].includes(extension)) return "ppt";
  if (extension === "pdf") return "pdf";
  if (["txt", "md", "json", "csv", "html", "css", "js"].includes(extension)) return "text";
  if (["mp3", "wav", "aac", "flac"].includes(extension)) return "audio";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(extension)) return "video";
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "archive";
  return "default";
}

function getParentFolderLabel(folderId) {
  if (!folderId) return "根目录";
  return state.folders.find((folder) => folder.id === folderId)?.name || "根目录";
}

function getFolderOptions(subjectId, selectedId = "") {
  const folders = state.folders.filter((folder) => folder.subjectId === subjectId && folder.isContentFolder);
  return [
    `<option value="" ${selectedId === "" ? "selected" : ""}>根目录</option>`,
    ...folders.map((folder) => `<option value="${folder.id}" ${selectedId === folder.id ? "selected" : ""}>${escapeHtml(getFolderOptionLabel(folder))}</option>`)
  ].join("");
}

function getFolderOptionLabel(folder) {
  return [...getFolderPath(folder.parentId), folder].map((item) => item.name).join(" / ");
}

function getPinnableFolders(subjectId) {
  return state.folders.filter((folder) =>
    folder.subjectId === subjectId
    && folder.isContentFolder
    && !state.pinnedFolders.some((pin) => (pin.type || "folder") === "folder" && pin.id === folder.id)
  );
}

function getPinnedItem(pin) {
  const type = pin.type || "folder";
  if (type === "subject") {
    const subject = state.subjects.find((item) => item.id === pin.id);
    if (!subject) return null;
    return {
      type,
      id: subject.id,
      icon: subject.icon && icons[subject.icon] ? subject.icon : "folder",
      label: subject.name
    };
  }

  const folder = state.folders.find((item) => item.id === pin.id);
  if (!folder) return null;
  const subjectName = getSubjectName(folder.subjectId);
  return {
    type,
    id: folder.id,
    subjectId: folder.subjectId,
    icon: "folder",
    label: `${subjectName} | ${folder.name}`
  };
}

function openLinkModal(subjectId) {
  openModal("新建链接文件", `
    <form class="form-grid" id="linkForm">
      <div class="field">
        <label for="linkSiteInput">网站名字</label>
        <input id="linkSiteInput" name="siteName" required placeholder="例如：飞书、B站、BBC">
      </div>
      <div class="field">
        <label for="linkNameInput">文件名</label>
        <input id="linkNameInput" name="fileName" required placeholder="例如：雅思必备3000英语单词">
      </div>
      <div class="field">
        <label for="linkNoteInput">备注</label>
        <textarea id="linkNoteInput" name="note" placeholder="可填写这条链接的用途或说明"></textarea>
      </div>
      <div class="field">
        <label for="linkUrlInput">链接</label>
        <input id="linkUrlInput" name="url" type="url" required placeholder="https://...">
      </div>
      <div class="modal-actions">
        <button class="secondary-button" type="button" data-close>取消</button>
        <button class="primary-button" type="submit">确认新建</button>
      </div>
    </form>
  `);

  document.querySelector("#linkForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.links.push({
      id: `link-${Date.now()}`,
      subjectId,
      siteName: String(form.get("siteName")).trim(),
      fileName: String(form.get("fileName")).trim(),
      note: String(form.get("note")).trim(),
      url: String(form.get("url")).trim(),
      createdAt: new Date().toISOString()
    });
    saveState();
    closeModal();
    rerenderSubject(subjectId);
  });
}

function openFileCreateModal(subjectId) {
  openModal("新建文件", `
    <form class="form-grid" id="subjectFileForm">
      <div class="field">
        <label for="createTypeSelect">新建类型</label>
        <select id="createTypeSelect" name="createType">
          <option value="folder">新建文件夹</option>
          <option value="file">上传本地文件</option>
        </select>
      </div>
      <div class="field" data-folder-field>
        <label for="folderNameInput">新文件夹名</label>
        <input id="folderNameInput" name="folderName" placeholder="例如：听力材料">
      </div>
      <div class="field" data-file-field hidden>
        <label for="subjectUploadInput">选择本地文件</label>
        <input id="subjectUploadInput" name="uploadFile" type="file" multiple>
        <small class="field-hint">支持图片、PDF、文本、音视频预览；Word、Excel、PPT 等 Office 文件需下载后打开。</small>
      </div>
      <div class="field">
        <label for="targetFolderSelect">保存位置</label>
        <select id="targetFolderSelect" name="targetFolder">${getFolderOptions(subjectId)}</select>
      </div>
      <div class="modal-actions">
        <button class="secondary-button" type="button" data-close>取消</button>
        <button class="primary-button" type="submit">确认</button>
      </div>
    </form>
  `);

  const formNode = document.querySelector("#subjectFileForm");
  const typeSelect = formNode.querySelector("#createTypeSelect");
  const folderField = formNode.querySelector("[data-folder-field]");
  const fileField = formNode.querySelector("[data-file-field]");
  const syncCreateType = () => {
    const isFolder = typeSelect.value === "folder";
    folderField.hidden = !isFolder;
    fileField.hidden = isFolder;
  };
  typeSelect.addEventListener("change", syncCreateType);
  syncCreateType();

  formNode.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parentId = String(form.get("targetFolder") || "");

    if (form.get("createType") === "folder") {
      const folderName = String(form.get("folderName")).trim();
      if (!folderName) return;
      state.folders.push({
        id: `folder-${Date.now()}`,
        subjectId,
        name: folderName,
        parentId,
        isContentFolder: true,
        createdAt: new Date().toISOString()
      });
    } else {
      const selectedFiles = [...formNode.querySelector("#subjectUploadInput").files];
      if (!selectedFiles.length) return;
      const result = await addUploadedFiles(selectedFiles, subjectId, parentId);
      if (!result.saved) {
        alert("浏览器本地存储空间不足，文件没有保存成功。请删除一些文件后再试。");
        return;
      }
      if (!result.contentPersisted) {
        alert("文件记录已保存，但浏览器本地空间不足，文件内容只能在本次页面会话中打开；刷新后需要重新上传才能打开内容。");
      }
    }

    saveState();
    closeModal();
    rerenderSubject(subjectId);
  });
}

function openDeleteSubjectConfirm(subjectId) {
  const subject = state.subjects.find((item) => item.id === subjectId);
  if (!subject) return;
  openModal("删除整个科目文件夹", `
    <div class="confirm-copy">
      <p>确认删除“${escapeHtml(subject.name)}”吗？</p>
      <span>这个操作会删除主页面对应的科目卡片，并删除所有上传在此处的文件、链接和子文件夹。删除后不可恢复。</span>
    </div>
    <div class="modal-actions">
      <button class="secondary-button" type="button" data-close>取消</button>
      <button class="danger-button" id="confirmDeleteSubject" type="button">确认删除</button>
    </div>
  `);

  document.querySelector("#confirmDeleteSubject").addEventListener("click", () => {
    const folderIds = state.folders.filter((folder) => folder.subjectId === subjectId).map((folder) => folder.id);
    state.subjects = state.subjects.filter((item) => item.id !== subjectId);
    state.folders = state.folders.filter((folder) => folder.subjectId !== subjectId);
    state.pinnedFolders = state.pinnedFolders.filter((pin) => {
      const type = pin.type || "folder";
      if (type === "subject") return pin.id !== subjectId;
      return !folderIds.includes(pin.id);
    });
    state.files = state.files.filter((file) => file.subjectId !== subjectId);
    state.links = state.links.filter((link) => link.subjectId !== subjectId);
    saveState();
    closeModal();
    history.pushState("", document.title, window.location.pathname);
    showHomePage();
    render();
    document.title = "文件整理";
  });
}

function rerenderSubject(subjectId) {
  const subject = state.subjects.find((item) => item.id === subjectId);
  if (!subject) return;
  renderSubjectPageEmpty({
    subjectId: subject.id,
    subjectName: subject.name,
    subjectIcon: "folder",
    createdAt: subject.createdAt,
    fileCount: getSubjectItemCount(subject.id)
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function addUploadedFiles(selectedFiles, subjectId, folderId) {
  const newRecords = [];
  for (const file of selectedFiles) {
    const id = `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let dataUrl = "";
    let cloudPath = "";
    if (currentUser && db) {
      const safeName = file.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_");
      cloudPath = `${currentUser.id}/${id}/${safeName}`;
      const { error } = await db.storage.from(cloudBucket).upload(cloudPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream"
      });
      if (error) {
        console.error("上传云端文件失败", error);
        for (const record of newRecords) {
          if (record.cloudPath) await db.storage.from(cloudBucket).remove([record.cloudPath]);
        }
        return { saved: false, contentPersisted: false };
      }
    } else {
      dataUrl = await readFileAsDataUrl(file);
    }
    const record = {
      id,
      name: file.name,
      size: file.size,
      subjectId,
      folderId: folderId || "",
      fileType: getFileType(file.name),
      mimeType: file.type,
      dataUrl,
      cloudPath,
      createdAt: new Date().toISOString()
    };
    runtimeFileUrls.set(id, URL.createObjectURL(file));
    state.files.push(record);
    newRecords.push(record);
  }

  if (currentUser) {
    await persistCloudState();
    return { saved: true, contentPersisted: true };
  }

  if (trySaveState()) return { saved: true, contentPersisted: true };

  newRecords.forEach((record) => {
    record.dataUrl = "";
  });
  if (trySaveState()) return { saved: true, contentPersisted: false };

  const newIds = new Set(newRecords.map((record) => record.id));
  state.files = state.files.filter((file) => !newIds.has(file.id));
  return { saved: false, contentPersisted: false };
}

async function openStoredFile(fileId) {
  const file = state.files.find((item) => item.id === fileId);
  if (!file) return;
  let fileUrl = file.dataUrl || runtimeFileUrls.get(file.id);
  if (!fileUrl && file.cloudPath && currentUser && db) {
    const { data, error } = await db.storage.from(cloudBucket).createSignedUrl(file.cloudPath, 300);
    if (error) console.error("读取云端文件失败", error);
    fileUrl = data?.signedUrl || "";
  }
  if (!fileUrl) {
    alert("这个文件暂时无法打开，请检查登录状态或重新上传。");
    return;
  }
  const preview = window.open("", "_blank");
  if (!preview) return;
  const safeName = escapeHtml(file.name);
  const kind = getFileKind(file.name);
  const source = fileUrl;
  const canPreview = ["image", "pdf", "text", "audio", "video"].includes(kind);
  const content = getFilePreviewMarkup(kind, source, safeName, canPreview);
  preview.document.write(`
    <!doctype html>
    <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <title>${safeName}</title>
      <style>
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #172033; font-family: system-ui, sans-serif; }
        img { max-width: 96vw; max-height: 92vh; object-fit: contain; box-shadow: 0 18px 46px rgba(15, 23, 42, .12); }
        iframe { width: 100vw; height: 100vh; border: 0; background: #fff; }
        video, audio { max-width: 92vw; }
        .unsupported { width: min(520px, calc(100vw - 40px)); padding: 34px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; box-shadow: 0 18px 46px rgba(15, 23, 42, .12); text-align: center; }
        .unsupported h1 { margin: 0 0 12px; font-size: 22px; }
        .unsupported p { margin: 0 0 22px; color: #667996; line-height: 1.6; }
        .unsupported a { display: inline-flex; height: 40px; align-items: center; padding: 0 18px; border-radius: 8px; background: #0f5fff; color: #fff; text-decoration: none; font-weight: 700; }
      </style>
    </head>
    <body>${content}</body>
    </html>
  `);
  preview.document.close();
}

function getFilePreviewMarkup(kind, source, safeName, canPreview) {
  if (kind === "image") return `<img src="${source}" alt="${safeName}">`;
  if (kind === "pdf" || kind === "text") return `<iframe src="${source}" title="${safeName}"></iframe>`;
  if (kind === "video") return `<video src="${source}" controls autoplay></video>`;
  if (kind === "audio") return `<audio src="${source}" controls autoplay></audio>`;
  if (!canPreview) {
    return `
      <section class="unsupported">
        <h1>${safeName}</h1>
        <p>浏览器无法直接预览这个文件类型。Word、Excel、PPT 等 Office 文件需要下载后用本地应用打开。</p>
        <a href="${source}" download="${safeName}">下载文件</a>
      </section>
    `;
  }
  return `<iframe src="${source}" title="${safeName}"></iframe>`;
}

function openDeleteItemConfirm(type, itemId, subjectId) {
  const labelMap = { link: "链接", file: "文件", folder: "文件夹" };
  openModal(`删除${labelMap[type] || "项目"}`, `
    <div class="confirm-copy">
      <p>确认删除这个${labelMap[type] || "项目"}吗？</p>
      <span>${type === "folder" ? "删除文件夹会同时删除它里面的子文件夹和文件。" : "删除后不可恢复。"}</span>
    </div>
    <div class="modal-actions">
      <button class="secondary-button" type="button" data-close>取消</button>
      <button class="danger-button" id="confirmDeleteItem" type="button">确认删除</button>
    </div>
  `);

  document.querySelector("#confirmDeleteItem").addEventListener("click", async () => {
    if (type === "link") {
      state.links = state.links.filter((link) => link.id !== itemId);
    }
    if (type === "file") {
      await removeCloudFiles(state.files.filter((file) => file.id === itemId));
      state.files = state.files.filter((file) => file.id !== itemId);
    }
    if (type === "folder") {
      const ids = getDescendantFolderIds(itemId);
      await removeCloudFiles(state.files.filter((file) => ids.includes(file.folderId)));
      state.folders = state.folders.filter((folder) => !ids.includes(folder.id));
      state.files = state.files.filter((file) => !ids.includes(file.folderId));
      if (ids.includes(subjectDetailFolderId)) subjectDetailFolderId = "";
    }
    saveState();
    closeModal();
    rerenderSubject(subjectId);
  });
}

async function removeCloudFiles(files) {
  if (!currentUser || !db) return;
  const paths = files.map((file) => file.cloudPath).filter(Boolean);
  if (!paths.length) return;
  const { error } = await db.storage.from(cloudBucket).remove(paths);
  if (error) console.error("删除云端文件失败", error);
}

function getDescendantFolderIds(folderId) {
  const ids = [folderId];
  state.folders
    .filter((folder) => folder.parentId === folderId)
    .forEach((folder) => ids.push(...getDescendantFolderIds(folder.id)));
  return ids;
}

function getFolderPath(folderId) {
  const path = [];
  let current = state.folders.find((folder) => folder.id === folderId);
  while (current) {
    path.unshift(current);
    current = state.folders.find((folder) => folder.id === current.parentId);
  }
  return path;
}

function renderSubjectSearchResults(subjectId, keyword) {
  const resultsNode = subjectDetailPage.querySelector("[data-subject-search-results]");
  const query = keyword.trim().toLowerCase();
  if (!query) {
    resultsNode.hidden = true;
    resultsNode.innerHTML = "";
    return;
  }

  const results = [
    ...getSubjectLinks(subjectId)
      .filter((link) => matchKeyword([link.siteName, link.fileName, link.note, link.url], query))
      .map((link) => ({ type: "链接", title: `${link.siteName} | ${link.fileName}`, desc: link.note || link.url, action: `link:${link.id}` })),
    ...state.folders
      .filter((folder) => folder.subjectId === subjectId && folder.isContentFolder && matchKeyword([folder.name], query))
      .map((folder) => ({ type: "文件夹", title: folder.name, desc: getParentFolderLabel(folder.parentId), action: `folder:${folder.id}` })),
    ...state.files
      .filter((file) => file.subjectId === subjectId && matchKeyword([file.name, file.fileType], query))
      .map((file) => ({ type: "文件", title: file.name, desc: getParentFolderLabel(file.folderId), action: `file:${file.id}` }))
  ].slice(0, 8);

  resultsNode.innerHTML = results.length
    ? results.map((item) => `
      <button class="search-result" type="button" data-search-action="${item.action}">
        <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.desc || item.type)}</span></div>
        <span>${escapeHtml(item.type)}</span>
      </button>
    `).join("")
    : '<div class="search-result"><strong>没有找到匹配内容</strong><span>换个关键词试试</span></div>';
  resultsNode.hidden = false;
  resultsNode.querySelectorAll("[data-search-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const [type, id] = button.dataset.searchAction.split(":");
      if (type === "link") {
        const link = state.links.find((item) => item.id === id);
        if (link) window.open(link.url, "_blank", "noopener,noreferrer");
      }
      if (type === "file") openStoredFile(id);
      if (type === "folder") {
        subjectDetailFolderId = id;
        rerenderSubject(subjectId);
      }
    });
  });
}

function matchKeyword(values, keyword) {
  return values.some((value) => String(value || "").toLowerCase().includes(keyword));
}

function getSubjectName(subjectId) {
  return state.subjects.find((item) => item.id === subjectId)?.name || "未分类";
}

function getFolderName(folderId) {
  return state.folders.find((item) => item.id === folderId)?.name || "默认文件夹";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

