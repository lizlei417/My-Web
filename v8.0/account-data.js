(() => {
  if (window.PortalAccountData) return;

  const TABLE_NAME = "portal_user_data";
  const currentScriptUrl = document.currentScript?.src || new URL("account-data.js", window.location.href).href;
  const portalRoot = new URL("./", currentScriptUrl);
  const rememberedUserAtBoot = (() => {
    try {
      return localStorage.getItem("portalCurrentUserId") || "";
    } catch {
      return "";
    }
  })();

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const mappingsByLocalKey = new Map();
  const saveTimers = new Map();
  const subscribers = new Set();
  const stickyKeys = new Set(["home.sticky.active", "home.sticky.archive"]);
  const stickyJobs = new Map();
  let client = null;
  let currentUser = null;
  let lastReadyUserId = "";
  let syncVersion = 0;
  let dependencyPromise = null;
  let bootPromise = null;

  const loadScript = (src) => new Promise((resolve) => {
    const absolute = new URL(src, portalRoot).href;
    const existing = [...document.scripts].find((script) => script.src === absolute);
    if (existing) {
      if (existing.dataset.loaded === "true" || (src.includes("supabase-js") && window.supabase)) {
        resolve(true);
        return;
      }
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = absolute;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve(true);
    }, { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    document.head.appendChild(script);
  });

  const ensureDependencies = () => {
    if (dependencyPromise) return dependencyPromise;
    dependencyPromise = (async () => {
      if (!window.SUPABASE_CONFIG) await loadScript("supabase-config.js");
      if (!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
      const config = window.SUPABASE_CONFIG || {};
      if (!window.supabase || !config.url || !config.anonKey) return null;
      client = window.__portalAccountDataClient
        || window.supabase.createClient(config.url, config.anonKey);
      window.__portalAccountDataClient = client;
      return client;
    })();
    return dependencyPromise;
  };

  const mappingsFor = (userId) => [
    { cloudKey: "theme", localKey: "theme", legacy: true },
    { cloudKey: "home.avatar", localKey: `user:${userId}:avatarImage`, scoped: true },
    { cloudKey: "home.username", localKey: `user:${userId}:username`, scoped: true },
    { cloudKey: "home.signature", localKey: `user:${userId}:signature`, scoped: true },
    { cloudKey: "home.bubbles", localKey: `user:${userId}:bubbles`, scoped: true },
    { cloudKey: "home.money.records", localKey: `user:${userId}:homeMoneyLedger:v1`, scoped: true },
    { cloudKey: "home.money.visible", localKey: `user:${userId}:homeMoneyLedgerVisible:v1`, scoped: true },
    { cloudKey: "bookkeeping.state", localKey: `user:${userId}:bookkeepingLedger:v1`, scoped: true },
    { cloudKey: "home.sticky.active", localKey: `user:${userId}:homeStickyNotes:v1`, scoped: true },
    { cloudKey: "home.sticky.archive", localKey: `user:${userId}:homeStickyNoteArchive:v1`, scoped: true },
    { cloudKey: "collect.cards", localKey: `user:${userId}:portalCollectCards`, scoped: true, legacyKey: "portalCollectCards" },
    { cloudKey: "habitat.records", localKey: `user:${userId}:habitat_records_v2`, scoped: true, legacyKey: "habitat_records_v2" },
    { cloudKey: "shell.nav.order", localKey: `portalNavOrder:${userId}`, scoped: true, legacyKey: "portalNavOrder" },
    { cloudKey: "shell.nav.hidden", localKey: `portalHiddenComponents:${userId}`, scoped: true },
    { cloudKey: "music.player.state", localKey: `user:${userId}:portalMusicPlayerState`, scoped: true, legacyKey: "portalMusicPlayerState" }
  ];

  const notify = (detail) => {
    window.dispatchEvent(new CustomEvent("portal:account-data-status", { detail }));
    subscribers.forEach((callback) => {
      try {
        callback(detail);
      } catch {}
    });
  };

  // Keep actual edits across logout, navigation and network failures. Loading or
  // laying out a cached note must never count as a new content edit.
  const pendingKey = (key) => `portal:sticky-pending:${key}`;
  const readPending = (key) => JSON.parse(localStorage.getItem(pendingKey(key)) || "null");
  const parseNotes = (value) => {
    const notes = JSON.parse(value || "[]");
    if (!Array.isArray(notes)) throw new Error("Invalid sticky note data");
    return notes;
  };
  const mergeNotes = (baseValue, editedValue, remoteValue) => {
    const base = new Map(parseNotes(baseValue).map((note) => [note.id, note]));
    const edited = new Map(parseNotes(editedValue).map((note) => [note.id, note]));
    const remote = new Map(parseNotes(remoteValue).map((note) => [note.id, note]));
    for (const [id, old] of base) {
      if (!edited.has(id)) remote.delete(id);
      else {
        const next = edited.get(id);
        const changed = Object.keys(next).filter((field) => JSON.stringify(next[field]) !== JSON.stringify(old[field]));
        if (!changed.length) continue;
        // A remote deletion wins over a stale edit; never resurrect an archive.
        if (!remote.has(id)) continue;
        const merged = { ...remote.get(id) };
        changed.forEach((field) => { merged[field] = next[field]; });
        remote.set(id, merged);
      }
    }
    for (const [id, note] of edited) if (!base.has(id)) remote.set(id, note);
    return JSON.stringify([...remote.values()]);
  };

  const recordStickyEdit = (key, previous, value) => {
    if (previous === value) return;
    const match = /^user:([^:]+):homeSticky(NoteArchive|Notes):v1$/.exec(key);
    if (!match || match[1] === "guest") return;
    const pending = readPending(key);
    originalSetItem.call(localStorage, pendingKey(key), JSON.stringify({
      base: pending ? pending.base : previous,
      value: value ?? "[]",
      token: `${Date.now()}-${Math.random()}`
    }));
    clearTimeout(saveTimers.get(key));
    saveTimers.set(key, setTimeout(() => {
      saveTimers.delete(key);
      refreshSticky();
    }, 320));
    notify({ state: "pending", key });
  };

  const restoreSticky = (user, mapping, value, revision) => {
    if (currentUser?.id !== user.id || readPending(mapping.localKey)) return;
    const revisionKey = `portal:sticky-revision:${mapping.localKey}`;
    const knownRevision = localStorage.getItem(revisionKey);
    if (knownRevision && (!revision || Date.parse(revision) < Date.parse(knownRevision))) return;
    const previous = localStorage.getItem(mapping.localKey);
    const backupKey = `portal:sticky-recovery:${mapping.localKey}`;
    // Pre-upgrade caches have no edit history. Retain them for recovery rather
    // than guessing whether a historical local value or the cloud is newer.
    if (!knownRevision && previous && previous !== value && parseNotes(previous).length && !localStorage.getItem(backupKey)) {
      originalSetItem.call(localStorage, backupKey, JSON.stringify({ value: previous, savedAt: new Date().toISOString() }));
    }
    if (revision) originalSetItem.call(localStorage, revisionKey, revision);
    if (previous === value) return;
    originalSetItem.call(localStorage, mapping.localKey, value);
    window.dispatchEvent(new CustomEvent("portal:account-data-restored", {
      detail: { user, keys: [mapping.localKey] }
    }));
  };

  const syncStickyMapping = async (user, mapping) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (currentUser?.id !== user.id) return;
      const { data, error } = await client.from(TABLE_NAME)
        .select("value_text,updated_at").eq("user_id", user.id).eq("data_key", mapping.cloudKey);
      if (error) throw error;
      if (currentUser?.id !== user.id) return;
      const row = data?.[0];
      let pending = readPending(mapping.localKey);
      // Import existing local notes only when the account has no such row yet.
      if (!row && !pending && parseNotes(localStorage.getItem(mapping.localKey)).length) {
        recordStickyEdit(mapping.localKey, null, localStorage.getItem(mapping.localKey));
        pending = readPending(mapping.localKey);
      }
      if (!pending) {
        restoreSticky(user, mapping, row?.value_text ?? "[]", row?.updated_at);
        return;
      }
      const value = mergeNotes(pending.base, pending.value, row ? row.value_text : pending.base);
      let revision = row?.updated_at;
      if (value !== row?.value_text) {
        const updatedAt = new Date(Math.max(Date.now(), Date.parse(row?.updated_at || 0) + 1)).toISOString();
        const write = row
          ? client.from(TABLE_NAME).update({ value_text: value, updated_at: updatedAt })
            .eq("user_id", user.id).eq("data_key", mapping.cloudKey).eq("updated_at", row.updated_at)
          : client.from(TABLE_NAME).upsert({ user_id: user.id, data_key: mapping.cloudKey,
            value_text: value, updated_at: updatedAt }, { onConflict: "user_id,data_key", ignoreDuplicates: true });
        // Compare-and-swap: retry against the latest row if another device won.
        const result = await write.select("value_text");
        if (result.error) throw result.error;
        if (!result.data?.length) continue;
        revision = updatedAt;
      }
      if (currentUser?.id !== user.id) return;
      if (readPending(mapping.localKey)?.token !== pending.token) continue;
      originalRemoveItem.call(localStorage, pendingKey(mapping.localKey));
      restoreSticky(user, mapping, value, revision);
      return;
    }
    throw new Error("便签正在其他窗口更新，将自动重试");
  };

  const refreshSticky = () => {
    const user = currentUser;
    if (!client || !user?.id || user.isGuest) return Promise.resolve();
    if (stickyJobs.has(user.id)) return stickyJobs.get(user.id);
    const job = (async () => {
      try {
        for (const mapping of mappingsFor(user.id).filter((item) => stickyKeys.has(item.cloudKey))) {
          await syncStickyMapping(user, mapping);
        }
        if (currentUser?.id === user.id) {
          const pending = mappingsFor(user.id).some((item) => stickyKeys.has(item.cloudKey) && readPending(item.localKey));
          notify({ state: pending ? "pending" : "synced", user, scope: "sticky" });
        }
      } catch (error) {
        notify({ state: "error", operation: "sticky-sync", error, user });
      } finally {
        stickyJobs.delete(user.id);
      }
    })();
    stickyJobs.set(user.id, job);
    return job;
  };

  const queueSave = (mapping, value) => {
    if (stickyKeys.has(mapping.cloudKey)) return;
    if (!client || !currentUser || currentUser.isGuest) return;
    clearTimeout(saveTimers.get(mapping.cloudKey));
    const userId = currentUser.id;
    saveTimers.set(mapping.cloudKey, setTimeout(async () => {
      saveTimers.delete(mapping.cloudKey);
      if (!client || currentUser?.id !== userId) return;
      const { error } = await client.from(TABLE_NAME).upsert({
        user_id: userId,
        data_key: mapping.cloudKey,
        value_text: String(value),
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,data_key" });
      if (error) {
        console.error(`账号数据保存失败：${mapping.cloudKey}`, error);
        notify({ state: "error", operation: "save", key: mapping.cloudKey, error });
      }
    }, 320));
  };

  const queueRemove = (mapping) => {
    if (stickyKeys.has(mapping.cloudKey)) return;
    if (!client || !currentUser || currentUser.isGuest) return;
    clearTimeout(saveTimers.get(mapping.cloudKey));
    const userId = currentUser.id;
    saveTimers.set(mapping.cloudKey, setTimeout(async () => {
      saveTimers.delete(mapping.cloudKey);
      if (!client || currentUser?.id !== userId) return;
      const { error } = await client
        .from(TABLE_NAME)
        .delete()
        .eq("user_id", userId)
        .eq("data_key", mapping.cloudKey);
      if (error) {
        console.error(`账号数据删除失败：${mapping.cloudKey}`, error);
        notify({ state: "error", operation: "remove", key: mapping.cloudKey, error });
      }
    }, 320));
  };

  Storage.prototype.setItem = function portalAccountSetItem(key, value) {
    const previous = this === window.localStorage ? this.getItem(key) : null;
    originalSetItem.call(this, key, value);
    if (this !== window.localStorage) return;
    recordStickyEdit(String(key), previous, String(value));
    const mapping = mappingsByLocalKey.get(String(key));
    if (mapping) queueSave(mapping, value);
  };

  Storage.prototype.removeItem = function portalAccountRemoveItem(key) {
    const previous = this === window.localStorage ? this.getItem(key) : null;
    originalRemoveItem.call(this, key);
    if (this !== window.localStorage) return;
    recordStickyEdit(String(key), previous, null);
    const mapping = mappingsByLocalKey.get(String(key));
    if (mapping) queueRemove(mapping);
  };

  const canMigrateLegacy = (userId) => (
    !rememberedUserAtBoot
    || rememberedUserAtBoot === userId
    || rememberedUserAtBoot === "guest"
  );

  const syncForUser = async (user) => {
    const version = ++syncVersion;
    if (!user?.id || user.isGuest) {
      currentUser = user || null;
      lastReadyUserId = "";
      mappingsByLocalKey.clear();
      notify({ state: "local", user: currentUser });
      return;
    }
    if (lastReadyUserId === user.id && currentUser?.id === user.id) return;

    const activeClient = await ensureDependencies();
    if (!activeClient || version !== syncVersion) return;
    currentUser = user;
    const localIdentityChanged = localStorage.getItem("portalCurrentUserId") !== user.id;
    originalSetItem.call(localStorage, "portalCurrentUserId", user.id);
    if (user.email) originalSetItem.call(localStorage, "portalCurrentUserEmail", user.email);
    const mappings = mappingsFor(user.id);
    mappingsByLocalKey.clear();
    mappings.forEach((mapping) => {
      mappingsByLocalKey.set(mapping.localKey, mapping);
      if (mapping.legacyKey) mappingsByLocalKey.set(mapping.legacyKey, mapping);
    });
    notify({ state: "syncing", user });

    const { data, error } = await activeClient
      .from(TABLE_NAME)
      .select("data_key,value_text")
      .eq("user_id", user.id);
    if (version !== syncVersion) return;
    if (error) {
      console.error("账号数据同步不可用，请先运行 account-data-setup.sql。", error);
      notify({ state: "error", operation: "load", error, user });
      return;
    }

    const cloudRows = new Map((data || []).map((row) => [row.data_key, row.value_text]));
    const migrations = [];
    const migratedLegacyKeys = [];
    const changedLocalKeys = localIdentityChanged ? ["portalCurrentUserId"] : [];

    mappings.forEach((mapping) => {
      if (stickyKeys.has(mapping.cloudKey)) return;
      if (cloudRows.has(mapping.cloudKey)) {
        const cloudValue = cloudRows.get(mapping.cloudKey);
        const localValue = localStorage.getItem(mapping.localKey);
        if (localValue !== cloudValue) {
          originalSetItem.call(localStorage, mapping.localKey, cloudValue);
          changedLocalKeys.push(mapping.localKey);
        }
        return;
      }

      let localValue = localStorage.getItem(mapping.localKey);
      if (localValue === null && mapping.legacyKey && canMigrateLegacy(user.id)) {
        localValue = localStorage.getItem(mapping.legacyKey);
        if (localValue !== null) {
          originalSetItem.call(localStorage, mapping.localKey, localValue);
          migratedLegacyKeys.push(mapping.legacyKey);
          changedLocalKeys.push(mapping.localKey);
        }
      }
      const safeToMigrate = mapping.scoped || canMigrateLegacy(user.id);
      if (localValue !== null && safeToMigrate) {
        migrations.push({
          user_id: user.id,
          data_key: mapping.cloudKey,
          value_text: localValue,
          updated_at: new Date().toISOString()
        });
      }
    });

    if (migrations.length) {
      const { error: migrationError } = await activeClient
        .from(TABLE_NAME)
        .upsert(migrations, { onConflict: "user_id,data_key" });
      if (version !== syncVersion) return;
      if (migrationError) {
        console.error("迁移现有浏览器数据失败", migrationError);
        notify({ state: "error", operation: "migrate", error: migrationError, user });
        return;
      }
      migratedLegacyKeys.forEach((key) => originalRemoveItem.call(localStorage, key));
    }

    await refreshSticky();
    if (version !== syncVersion) return;
    lastReadyUserId = user.id;
    notify({
      state: "ready",
      user,
      restoredKeys: changedLocalKeys,
      migratedKeys: migrations.map((row) => row.data_key)
    });
    window.dispatchEvent(new CustomEvent("portal:account-data-restored", {
      detail: { user, keys: changedLocalKeys }
    }));
  };

  const boot = () => {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      const activeClient = await ensureDependencies();
      if (!activeClient) {
        notify({ state: "unconfigured" });
        return null;
      }
      const { data } = await activeClient.auth.getSession();
      await syncForUser(data?.session?.user || null);
      activeClient.auth.onAuthStateChange((_event, session) => {
        syncForUser(session?.user || null);
      });
      return currentUser;
    })();
    return bootPromise;
  };

  window.PortalAccountData = {
    ready: boot,
    useUser: syncForUser,
    getUser: () => currentUser,
    refreshSticky,
    writeStickyNotes(key, value, base) {
      const merged = mergeNotes(base, value, localStorage.getItem(key));
      localStorage.setItem(key, merged);
      return merged;
    },
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    }
  };

  setInterval(() => {
    if (document.visibilityState !== "hidden") refreshSticky();
  }, 8000);
  window.addEventListener("focus", refreshSticky);
  window.addEventListener("online", refreshSticky);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") refreshSticky();
  });

  boot();
})();
