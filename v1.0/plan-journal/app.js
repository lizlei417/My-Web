const tableName = "diary_entries";

const form = document.querySelector("#entryForm");
const titleInput = document.querySelector("#title");
const subjectInput = document.querySelector("#subject");
const dateInput = document.querySelector("#date");
const colorToggle = document.querySelector("#colorToggle");
const colorPreview = document.querySelector("#colorPreview");
const themePicker = document.querySelector("#themePicker");
const colorButtons = document.querySelectorAll(".theme-dot");
const linkList = document.querySelector("#linkList");
const addLinkBtn = document.querySelector("#addLinkBtn");
const removeLinkBtn = document.querySelector("#removeLinkBtn");
const linkInputTemplate = document.querySelector("#linkInputTemplate");
const noteList = document.querySelector("#noteList");
const addNoteBtn = document.querySelector("#addNoteBtn");
const removeNoteBtn = document.querySelector("#removeNoteBtn");
const noteInputTemplate = document.querySelector("#noteInputTemplate");
const tagInput = document.querySelector("#tagInput");
const addTagBtn = document.querySelector("#addTagBtn");
const selectedTagsWrap = document.querySelector("#selectedTags");
const nextPlanInput = document.querySelector("#nextPlan");
const resetBtn = document.querySelector("#resetBtn");
const submitBtn = document.querySelector("#submitBtn");
const searchInput = document.querySelector("#searchInput");
const filterDateInput = document.querySelector("#filterDate");
const searchBtn = document.querySelector("#searchBtn");
const filterTagsWrap = document.querySelector("#filterTags");
const entriesWrap = document.querySelector("#entries");
const emptyState = document.querySelector("#emptyState");
const entryCount = document.querySelector("#entryCount");
const todayLabel = document.querySelector("#todayLabel");
const template = document.querySelector("#entryTemplate");
const authTitle = document.querySelector("#authTitle");
const authStatus = document.querySelector("#authStatus");
const emailInput = document.querySelector("#emailInput");
const passwordInput = document.querySelector("#passwordInput");
const signUpBtn = document.querySelector("#signUpBtn");
const signInBtn = document.querySelector("#signInBtn");
const signOutBtn = document.querySelector("#signOutBtn");

const config = window.SUPABASE_CONFIG || {};
const hasConfig = Boolean(config.url && config.anonKey && window.supabase);
const db = hasConfig ? window.supabase.createClient(config.url, config.anonKey) : null;

const themeColors = {
  pink: { theme: "#e9a7ad", deep: "#c9838a", soft: "#f3c4c8", swatch: "#e9a7ad", rgb: "233,167,173" },
  orange: { theme: "#e8b184", deep: "#c58b62", soft: "#f2ceb3", swatch: "#e8b184", rgb: "232,177,132" },
  yellow: { theme: "#dcc86e", deep: "#b39d4d", soft: "#efe1a9", swatch: "#dcc86e", rgb: "220,200,110" },
  mint: { theme: "#9fcfac", deep: "#73a883", soft: "#c7e8cf", swatch: "#9fcfac", rgb: "159,207,172" },
  blue: { theme: "#7fa9eb", deep: "#6f92cf", soft: "#a9caff", swatch: "#a9caff", rgb: "127,169,235" },
  lavender: { theme: "#a995dc", deep: "#8a76bd", soft: "#c8b8eb", swatch: "#b8a7e6", rgb: "169,149,220" },
  purple: { theme: "#c99add", deep: "#aa79bf", soft: "#e4cdef", swatch: "#d8b7e6", rgb: "201,154,221" },
};

const legacyColors = {
  sage: "mint",
  butter: "yellow",
  clay: "orange",
  mist: "blue",
};

let entries = [];
let editingId = null;
let selectedTags = [];
let selectedColor = getHomeThemeColor();
let activeTag = "";
let appliedQuery = "";
let appliedDate = "";
let currentUser = null;
let entriesLoadToken = 0;

const today = new Date();
const todayISO = toDateInputValue(today);
dateInput.value = todayISO;
todayLabel.textContent = today.toLocaleDateString("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "short",
});

ensureLinkRows(1);
ensureNoteRows(1);
setSelectedColor(selectedColor);
setAppEnabled(false);

if (!hasConfig) {
  redirectToHome();
} else {
  bootAuth();
}

colorToggle.addEventListener("click", () => {
  themePicker.hidden = !themePicker.hidden;
  colorToggle.setAttribute("aria-expanded", String(!themePicker.hidden));
});

colorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSelectedColor(button.dataset.color);
    themePicker.hidden = true;
    colorToggle.setAttribute("aria-expanded", "false");
  });
});

addLinkBtn.addEventListener("click", () => addLinkRow());
removeLinkBtn.addEventListener("click", removeLinkRow);
addNoteBtn.addEventListener("click", () => addNoteRow());
removeNoteBtn.addEventListener("click", removeNoteRow);
addTagBtn.addEventListener("click", addTagFromInput);
tagInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addTagFromInput();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    redirectToHome();
    return;
  }

  const payload = {
    user_id: currentUser.id,
    title: titleInput.value.trim(),
    subject: subjectInput.value.trim(),
    entry_date: dateInput.value,
    color: selectedColor,
    links: getLinkValues(),
    tags: [...selectedTags],
    notes: getNoteValues(),
    next_plan: nextPlanInput.value.trim(),
    expanded: entries.find((entry) => entry.id === editingId)?.expanded || false,
    updated_at: new Date().toISOString(),
  };

  submitBtn.disabled = true;
  try {
    if (editingId) {
      const { error } = await db.from(tableName).update(payload).eq("id", editingId).eq("user_id", currentUser.id);
      if (error) throw error;
    } else {
      const { error } = await db.from(tableName).insert(payload);
      if (error) throw error;
    }

    clearForm();
    await loadCloudEntries();
  } catch (error) {
    console.error(error);
  } finally {
    submitBtn.disabled = false;
  }
});

resetBtn.addEventListener("click", clearForm);
searchBtn.addEventListener("click", () => {
  appliedQuery = searchInput.value.trim().toLowerCase();
  appliedDate = filterDateInput.value;
  renderEntries();
});
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchBtn.click();
  }
});

if (signUpBtn && signInBtn && signOutBtn) {
  signUpBtn.addEventListener("click", async () => {
    if (!db) return;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return setAuthMessage("请输入邮箱和密码", "注册需要邮箱和密码。");

    const { error } = await db.auth.signUp({ email, password });
    if (error) return setAuthMessage("注册失败", error.message);
    setAuthMessage("注册成功", "如果后台开启了邮箱确认，请先去邮箱点确认链接。");
  });

  signInBtn.addEventListener("click", async () => {
    if (!db) return;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return setAuthMessage("请输入邮箱和密码", "登录需要邮箱和密码。");

    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) return setAuthMessage("登录失败", error.message);
  });

  signOutBtn.addEventListener("click", async () => {
    if (!db) return;
    const { error } = await db.auth.signOut();
    if (error) setAuthMessage("退出失败", error.message);
  });
}

async function bootAuth() {
  const { data, error } = await db.auth.getSession();
  if (error) {
    console.error(error);
    redirectToHome();
    return;
  }
  await applySession(data?.session || null);

  db.auth.onAuthStateChange((_event, session) => {
    applySession(session);
  });
}

async function applySession(session) {
  currentUser = session?.user || null;
  setAppEnabled(Boolean(currentUser));

  if (!currentUser) {
    entries = [];
    redirectToHome();
    return;
  }

  setSelectedColor(getHomeThemeColor(currentUser.id));
  applyPortalTheme(selectedColor);
  await loadCloudEntries();
}

async function loadCloudEntries(retryEmpty = true) {
  if (!currentUser) return;
  const loadToken = ++entriesLoadToken;
  const { data, error } = await db
    .from(tableName)
    .select("*")
    .eq("user_id", currentUser.id)
    .order("entry_date", { ascending: false })
    .order("updated_at", { ascending: false });

  if (loadToken !== entriesLoadToken) return;

  if (error) {
    console.error(error);
    return;
  }

  if (retryEmpty && (!data || data.length === 0)) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (loadToken !== entriesLoadToken || !currentUser) return;
    return loadCloudEntries(false);
  }

  entries = (data || []).map(rowToEntry);
  renderEntries();
}

function renderEntries() {
  sortEntries();
  const filtered = getFilteredEntries();
  entriesWrap.innerHTML = "";
  entryCount.textContent = `${entries.length} 条`;
  renderFilterTags();
  emptyState.classList.toggle("is-visible", filtered.length === 0);

  filtered.forEach((entry) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const details = card.querySelector(".entry-details");

    card.dataset.color = normalizeThemeColor(entry.color) || "blue";
    card.querySelector("time").textContent = formatEntryDate(entry.date);
    card.querySelector("h2").textContent = entry.title;
    card.querySelector(".subject-pill").textContent = entry.subject || "未填写对象";
    details.hidden = !entry.expanded;
    card.classList.toggle("is-expanded", entry.expanded);

    const tagsWrap = card.querySelector(".card-tags");
    if (entry.tags.length) {
      entry.tags.forEach((tag) => tagsWrap.append(createPlainTag(tag)));
    } else {
      tagsWrap.remove();
    }

    const notesWrap = card.querySelector(".note-text");
    if (entry.notes.length) {
      entry.notes.forEach((note) => {
        const item = document.createElement("li");
        item.textContent = note;
        notesWrap.append(item);
      });
    } else {
      notesWrap.remove();
    }

    const nextPlanText = card.querySelector(".next-plan-text");
    if (entry.nextPlan) {
      nextPlanText.textContent = `Next Step：${entry.nextPlan}`;
    } else {
      nextPlanText.remove();
    }

    const linksWrap = card.querySelector(".entry-links");
    if (entry.links.length) {
      const heading = document.createElement("strong");
      heading.className = "links-heading";
      heading.textContent = "⬇️ 相关链接";
      linksWrap.append(heading);

      entry.links.forEach((item) => {
        const row = document.createElement("p");
        row.className = "entry-link-row";
        if (item.remark) {
          const remark = document.createElement("span");
          remark.className = "entry-link-remark";
          remark.textContent = item.remark;
          row.append(remark);
        }

        const link = document.createElement("a");
        link.className = "entry-link";
        link.href = normalizeUrl(item.url);
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = compactUrl(item.url);
        row.append(link);
        linksWrap.append(row);
      });
    } else {
      linksWrap.remove();
    }

    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a")) return;
      toggleEntry(entry.id);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleEntry(entry.id);
      }
    });
    card.querySelector(".edit-btn").addEventListener("click", () => editEntry(entry.id));
    card.querySelector(".delete-btn").addEventListener("click", () => deleteEntry(entry.id));
    entriesWrap.append(card);
  });
}

function getFilteredEntries() {
  return entries.filter((entry) => {
    const linksText = entry.links.map((link) => `${link.remark} ${link.url}`).join(" ");
    const haystack = [entry.title, entry.subject, entry.notes.join(" "), entry.nextPlan, linksText, entry.tags.join(" ")]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !appliedQuery || haystack.includes(appliedQuery);
    const matchesTag = !activeTag || entry.tags.includes(activeTag);
    const matchesDate = !appliedDate || entry.date === appliedDate;

    return matchesQuery && matchesTag && matchesDate;
  });
}

function renderFilterTags() {
  const tags = [...new Set(entries.flatMap((entry) => entry.tags))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  filterTagsWrap.innerHTML = "";

  tags.forEach((tag) => {
    const chip = document.createElement("button");
    chip.className = `filter-chip${activeTag === tag ? " is-active" : ""}`;
    chip.type = "button";
    chip.textContent = tag;
    chip.addEventListener("click", () => {
      activeTag = activeTag === tag ? "" : tag;
      renderEntries();
    });
    filterTagsWrap.append(chip);
  });
}

async function toggleEntry(id) {
  entries = entries.map((entry) => (entry.id === id ? { ...entry, expanded: !entry.expanded } : entry));
  const entry = entries.find((item) => item.id === id);
  renderEntries();
  await db
    .from(tableName)
    .update({ expanded: entry.expanded, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", currentUser.id);
}

function editEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  editingId = id;
  titleInput.value = entry.title;
  subjectInput.value = entry.subject;
  dateInput.value = entry.date;
  setSelectedColor(entry.color || "sage");
  setLinkRows(entry.links.length ? entry.links : [{ remark: "", url: "" }]);
  setNoteRows(entry.notes.length ? entry.notes : [""]);
  selectedTags = [...entry.tags];
  renderSelectedTags();
  nextPlanInput.value = entry.nextPlan || "";
  submitBtn.textContent = "保存修改";
  titleInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  const confirmed = window.confirm(`删除「${entry.title}」这条记录吗？`);
  if (!confirmed) return;

  const { error } = await db.from(tableName).delete().eq("id", id).eq("user_id", currentUser.id);
  if (error) return console.error(error);

  entries = entries.filter((item) => item.id !== id);
  if (editingId === id) clearForm();
  renderEntries();
}

function clearForm() {
  editingId = null;
  form.reset();
  dateInput.value = todayISO;
  setSelectedColor(getHomeThemeColor(currentUser?.id));
  themePicker.hidden = true;
  colorToggle.setAttribute("aria-expanded", "false");
  setLinkRows([{ remark: "", url: "" }]);
  setNoteRows([""]);
  selectedTags = [];
  renderSelectedTags();
  submitBtn.textContent = "添加记录";
}

function setSelectedColor(color) {
  selectedColor = normalizeThemeColor(color) || getHomeThemeColor(currentUser?.id);
  document.body.dataset.previewColor = selectedColor;
  colorPreview.className = `color-preview ${selectedColor}`;
  colorButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.color === selectedColor);
  });
}

function applyPortalTheme(color) {
  const theme = themeColors[normalizeThemeColor(color)];
  if (!theme) return;
  document.documentElement.style.setProperty("--nav-theme", theme.theme);
  document.documentElement.style.setProperty("--nav-theme-deep", theme.deep);
  document.documentElement.style.setProperty("--nav-theme-soft", theme.soft);
  document.documentElement.style.setProperty("--nav-theme-rgb", theme.rgb);
}

function normalizeThemeColor(color) {
  if (!color) return "";
  return themeColors[color] ? color : legacyColors[color] || "";
}

function normalizeRgb(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function normalizeHex(value) {
  return String(value || "").trim().toLowerCase();
}

function getHomeThemeColor(userId = "") {
  let savedTheme = null;
  try {
    const savedThemeText = userId
      ? localStorage.getItem(`user:${userId}:theme`) || localStorage.getItem("theme")
      : localStorage.getItem("theme");
    savedTheme = JSON.parse(savedThemeText || "null");
  } catch {
    savedTheme = null;
  }

  if (!savedTheme) return normalizeThemeColor(window.__journalThemeColor) || "blue";

  const savedValues = [
    normalizeHex(savedTheme.theme),
    normalizeHex(savedTheme.deep),
    normalizeHex(savedTheme.soft),
    normalizeHex(savedTheme.swatch),
  ].filter(Boolean);
  const savedRgb = normalizeRgb(savedTheme.rgb);

  const match = Object.entries(themeColors).find(([, theme]) => {
    const themeValues = [theme.theme, theme.deep, theme.soft, theme.swatch].map(normalizeHex);
    return themeValues.some((value) => savedValues.includes(value)) || normalizeRgb(theme.rgb) === savedRgb;
  });

  return match?.[0] || normalizeThemeColor(window.__journalThemeColor) || "blue";
}

function addLinkRow(value = { remark: "", url: "" }) {
  const row = linkInputTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector(".link-remark-input").value = value.remark || "";
  row.querySelector(".link-url-input").value = value.url || "";
  linkList.append(row);
  updateLinkButtons();
}

function removeLinkRow() {
  const rows = linkList.querySelectorAll(".link-row");
  if (rows.length <= 1) return;
  rows[rows.length - 1].remove();
  updateLinkButtons();
}

function setLinkRows(values) {
  linkList.innerHTML = "";
  values.forEach((value) => addLinkRow(value));
  ensureLinkRows(1);
}

function ensureLinkRows(count) {
  while (linkList.querySelectorAll(".link-row").length < count) addLinkRow();
  updateLinkButtons();
}

function updateLinkButtons() {
  removeLinkBtn.disabled = linkList.querySelectorAll(".link-row").length <= 1;
}

function getLinkValues() {
  return [...linkList.querySelectorAll(".link-row")]
    .map((row) => ({
      remark: row.querySelector(".link-remark-input").value.trim(),
      url: row.querySelector(".link-url-input").value.trim(),
    }))
    .filter((item) => item.url);
}

function addNoteRow(value = "") {
  const row = noteInputTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector(".note-input").value = value;
  noteList.append(row);
  updateNoteRows();
}

function removeNoteRow() {
  const rows = noteList.querySelectorAll(".note-row");
  if (rows.length <= 1) return;
  rows[rows.length - 1].remove();
  updateNoteRows();
}

function setNoteRows(values) {
  noteList.innerHTML = "";
  values.forEach((value) => addNoteRow(value));
  ensureNoteRows(1);
}

function ensureNoteRows(count) {
  while (noteList.querySelectorAll(".note-row").length < count) addNoteRow();
  updateNoteRows();
}

function updateNoteRows() {
  noteList.querySelectorAll(".note-row").forEach((row, index) => {
    row.querySelector(".note-number").textContent = index + 1;
  });
  removeNoteBtn.disabled = noteList.querySelectorAll(".note-row").length <= 1;
}

function getNoteValues() {
  return [...noteList.querySelectorAll(".note-input")].map((input) => input.value.trim()).filter(Boolean);
}

function addTagFromInput() {
  const tag = tagInput.value.trim().replace(/^#/, "");
  if (!tag || selectedTags.includes(tag)) {
    tagInput.value = "";
    return;
  }

  selectedTags = [...selectedTags, tag];
  tagInput.value = "";
  renderSelectedTags();
}

function renderSelectedTags() {
  selectedTagsWrap.innerHTML = "";
  selectedTags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.textContent = tag;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `移除标签 ${tag}`);
    remove.addEventListener("click", () => {
      selectedTags = selectedTags.filter((item) => item !== tag);
      renderSelectedTags();
    });

    chip.append(remove);
    selectedTagsWrap.append(chip);
  });
}

function createPlainTag(tag) {
  const chip = document.createElement("span");
  chip.className = "tag-chip";
  chip.textContent = tag;
  return chip;
}

function rowToEntry(row) {
  return {
    id: row.id,
    title: row.title || "未命名计划",
    subject: row.subject || "",
    date: row.entry_date || todayISO,
    color: normalizeThemeColor(row.color) || "blue",
    links: Array.isArray(row.links) ? row.links : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    notes: Array.isArray(row.notes) ? row.notes : [],
    nextPlan: row.next_plan || "",
    expanded: Boolean(row.expanded),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function sortEntries() {
  entries.sort(compareEntriesByDate);
}

function compareEntriesByDate(a, b) {
  const dateDiff = dateValue(b.date) - dateValue(a.date);
  if (dateDiff !== 0) return dateDiff;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function dateValue(value) {
  return value ? new Date(`${value}T00:00:00`).getTime() : 0;
}

function normalizeUrl(url) {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function compactUrl(url) {
  try {
    const parsed = new URL(normalizeUrl(url));
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return "打开链接";
  }
}

function formatEntryDate(value) {
  if (!value) return "未设置日期";
  return new Date(`${value}T00:00:00`).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setAppEnabled(enabled) {
  form.querySelectorAll("input, textarea, button").forEach((item) => {
    item.disabled = !enabled;
  });
  searchInput.disabled = !enabled;
  filterDateInput.disabled = !enabled;
  searchBtn.disabled = !enabled;
}

function redirectToHome() {
  const target = new URL("../home/index.html", window.location.href);
  target.searchParams.set("login", "1");
  window.location.replace(target.href);
}

function setAuthMessage(title, detail) {
  if (!authTitle || !authStatus) return;
  authTitle.textContent = title;
  authStatus.textContent = detail || "";
}

renderSelectedTags();
