/* EAbsensi SATPAM Bank Kaltimtara
   Frontend statis + GitHub Repository sebagai penyimpanan JSON.
   Public dashboard bisa dibuka semua orang. CRUD hanya lewat Admin Panel + GitHub token. */

const CONFIG = window.APP_CONFIG || {};
const DEFAULT_DB = {
  meta: {
    appName: "CATATAN KERJA SATPAM",
    bankName: "BANK KALTIMTARA",
    subtitle: "Cyber Security Duty System",
    updatedAt: new Date().toISOString()
  },
  settings: {
    cycle: ["PAGI", "MALAM", "OFF", "OFF", "OFF", "OFF"],
    shift: { pagiStart: "07:00", pagiEnd: "19:00", malamStart: "19:00", malamEnd: "07:00" },
    holidays: [{ id: "h-demo", date: todayISO(), name: "Libur Nasional", enabled: true }]
  },
  members: [
    { id: uid("m"), nama: "Andi Pratama", jabatan: "Danru", regu: "A", phone: "", photo: "", startDate: todayISO(), startIndex: 0, overrides: {} },
    { id: uid("m"), nama: "Budi Santoso", jabatan: "Anggota", regu: "B", phone: "", photo: "", startDate: todayISO(), startIndex: 1, overrides: {} },
    { id: uid("m"), nama: "Cahyo Nugroho", jabatan: "Anggota", regu: "A", phone: "", photo: "", startDate: todayISO(), startIndex: 2, overrides: { [todayISO()]: "OFF" } },
    { id: uid("m"), nama: "Dimas Setiawan", jabatan: "Anggota", regu: "C", phone: "", photo: "", startDate: todayISO(), startIndex: 3, overrides: { [todayISO()]: "LEMBUR" } }
  ],
  notes: [
    { id: uid("n"), date: todayISO(), time: "07:45", title: "Pemeriksaan Area Lobby", body: "Pemeriksaan rutin area lobby dan pintu masuk.", memberId: "", regu: "A", type: "check" },
    { id: uid("n"), date: todayISO(), time: "06:30", title: "Serah Terima Shift", body: "Serah terima tugas dari shift malam ke pagi berjalan lancar.", memberId: "", regu: "B", type: "handover" }
  ]
};

let db = structuredCloneSafe(DEFAULT_DB);
let isAdmin = false;
let scheduleDate = todayISO();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

init();

async function init() {
  bindNavigation();
  bindAdminForms();
  bindFilters();
  tickClock();
  setInterval(tickClock, 1000);
  await loadDB();
  renderAll();
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromISO(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateLong(iso = todayISO()) {
  return dateFromISO(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function diffDays(fromISO, toISO) {
  const a = dateFromISO(fromISO);
  const b = dateFromISO(toISO);
  return Math.floor((b - a) / 86400000);
}

function tickClock() {
  const now = new Date();
  $("#todayText").textContent = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  $("#clockText").textContent = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");

  const shift = currentShift();
  $("#activeShiftLabel").textContent = shift.name;
  $("#activeShiftTime").textContent = shift.time;
  $$(".shift-tab").forEach((tab) => tab.classList.remove("active"));
  const activeIndex = shift.name === "PAGI" ? 0 : 1;
  const tab = $$(".shift-tab")[activeIndex];
  if (tab) tab.classList.add("active");
}

function currentShift(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 7 && hour < 19) return { name: "PAGI", time: "07:00 - 19:00" };
  return { name: "MALAM", time: "19:00 - 07:00" };
}

function normalizeDB(raw) {
  const normalized = structuredCloneSafe(DEFAULT_DB);
  const safe = raw && typeof raw === "object" ? raw : {};
  normalized.meta = { ...normalized.meta, ...(safe.meta || {}) };
  normalized.settings = { ...normalized.settings, ...(safe.settings || {}) };
  normalized.settings.shift = { ...DEFAULT_DB.settings.shift, ...(safe.settings?.shift || {}) };
  normalized.settings.cycle = Array.isArray(safe.settings?.cycle) && safe.settings.cycle.length ? safe.settings.cycle : DEFAULT_DB.settings.cycle;
  normalized.settings.holidays = Array.isArray(safe.settings?.holidays) ? safe.settings.holidays : [];
  normalized.members = Array.isArray(safe.members) ? safe.members.map((m) => ({
    id: m.id || uid("m"),
    nama: m.nama || "Tanpa Nama",
    jabatan: m.jabatan || "Anggota",
    regu: m.regu || "A",
    phone: m.phone || "",
    photo: m.photo || "",
    startDate: m.startDate || todayISO(),
    startIndex: Number.isFinite(Number(m.startIndex)) ? Number(m.startIndex) : 0,
    overrides: m.overrides && typeof m.overrides === "object" ? m.overrides : {}
  })) : normalized.members;
  normalized.notes = Array.isArray(safe.notes) ? safe.notes.map((n) => ({
    id: n.id || uid("n"),
    date: n.date || todayISO(),
    time: n.time || "07:00",
    title: n.title || "Catatan",
    body: n.body || "",
    memberId: n.memberId || "",
    regu: n.regu || "A",
    type: n.type || "info"
  })) : normalized.notes;
  return normalized;
}

async function loadDB() {
  const cached = localStorage.getItem(cacheKey()) || localStorage.getItem("satpam-db-cache");

  try {
    const result = await loadFromGithub();
    db = normalizeDB(result.data);
    localStorage.setItem(cacheKey(), JSON.stringify(db));
    localStorage.setItem("satpam-db-cache", JSON.stringify(db));
    if (result.sha) sessionStorage.setItem("satpam-db-sha", result.sha);
    setSaveStatus("Data terbaru berhasil dibaca dari GitHub.");
    return;
  } catch (err) {
    console.warn("Gagal load GitHub, pakai cache/default", err);
  }

  if (cached) {
    try {
      db = normalizeDB(JSON.parse(cached));
      toast("Mode cache lokal: data GitHub belum bisa dibaca. Cek repo public / config.js.");
      setSaveStatus("Mode cache lokal. GitHub belum bisa dibaca.");
      return;
    } catch (_) {}
  }

  db = normalizeDB(DEFAULT_DB);
  toast("Mode demo: config GitHub belum benar atau backend repo tidak bisa dibaca.");
  setSaveStatus("Mode demo. Data belum tersambung ke GitHub.");
}

function cacheKey() {
  const owner = CONFIG.GITHUB_OWNER || "no-owner";
  const repo = CONFIG.BACKEND_REPO || "no-repo";
  const branch = CONFIG.BRANCH || "main";
  const path = CONFIG.DATA_PATH || "data/db.json";
  return `satpam-db-cache:${owner}:${repo}:${branch}:${path}`;
}

function hasGithubConfig() {
  return Boolean(
    CONFIG.GITHUB_OWNER &&
    !String(CONFIG.GITHUB_OWNER).includes("ISI_") &&
    CONFIG.BACKEND_REPO &&
    !String(CONFIG.BACKEND_REPO).includes("ISI_") &&
    CONFIG.DATA_PATH &&
    (CONFIG.BRANCH || "main")
  );
}

function githubApiUrl() {
  const owner = encodeURIComponent(CONFIG.GITHUB_OWNER);
  const repo = encodeURIComponent(CONFIG.BACKEND_REPO);
  const path = String(CONFIG.DATA_PATH || "data/db.json").split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
}

async function loadFromGithub() {
  if (!hasGithubConfig()) throw new Error("Config GitHub belum diisi");

  // Utama: pakai GitHub Contents API supaya tidak kena cache raw.githubusercontent.
  // Kalau repo backend private, pembacaan publik tanpa token akan gagal. Untuk dashboard umum, repo backend harus PUBLIC.
  const token = sessionStorage.getItem("satpam-github-token") || "";
  try {
    const file = await readGithubFile(token);
    return file;
  } catch (apiErr) {
    console.warn("GitHub API read gagal, coba raw URL", apiErr);
  }

  // Cadangan: raw URL untuk repo public.
  const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(CONFIG.GITHUB_OWNER)}/${encodeURIComponent(CONFIG.BACKEND_REPO)}/${encodeURIComponent(CONFIG.BRANCH || "main")}/${CONFIG.DATA_PATH}?cacheBust=${Date.now()}`;
  const res = await fetch(rawUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Tidak bisa membaca db.json dari raw GitHub (${res.status})`);
  return { data: await res.json(), sha: "" };
}

async function readGithubFile(token = "") {
  const res = await fetch(`${githubApiUrl()}?ref=${encodeURIComponent(CONFIG.BRANCH || "main")}&cacheBust=${Date.now()}`, {
    method: "GET",
    cache: "no-store",
    headers: githubHeaders(token)
  });
  if (!res.ok) {
    const detail = await safeResponseText(res);
    throw new Error(`Tidak bisa baca file GitHub (${res.status}) ${detail}`);
  }
  const fileInfo = await res.json();
  if (!fileInfo.content) throw new Error("Isi db.json kosong dari GitHub");
  const jsonText = fromBase64Unicode(String(fileInfo.content).replace(/\n/g, ""));
  return { data: JSON.parse(jsonText), sha: fileInfo.sha || "" };
}

async function saveDB(message = "Update data EAbsensi Satpam") {
  db.meta.updatedAt = new Date().toISOString();
  localStorage.setItem(cacheKey(), JSON.stringify(db));
  localStorage.setItem("satpam-db-cache", JSON.stringify(db));
  renderAll();

  if (!hasGithubConfig()) {
    setSaveStatus("Tersimpan lokal. Isi config.js untuk sinkron GitHub.");
    toast("Data tersimpan lokal, belum ke GitHub karena config.js belum diisi.");
    return;
  }

  const token = sessionStorage.getItem("satpam-github-token");
  if (!token) {
    setSaveStatus("Tersimpan lokal. Login ulang dengan token GitHub untuk sinkron.");
    toast("Belum ada token GitHub. Data belum disimpan ke backend repo.");
    return;
  }

  try {
    setSaveStatus("Menyimpan ke GitHub...");

    let lastError = null;
    let savedResult = null;

    // Retry 2x untuk menangani error 409 SHA conflict kalau file baru berubah di GitHub.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const file = await readGithubFile(token);
        const payload = {
          message,
          content: toBase64Unicode(JSON.stringify(db, null, 2)),
          sha: file.sha,
          branch: CONFIG.BRANCH || "main"
        };

        const putRes = await fetch(githubApiUrl(), {
          method: "PUT",
          headers: githubHeaders(token),
          body: JSON.stringify(payload)
        });

        if (!putRes.ok) {
          const detail = await safeResponseText(putRes);
          throw new Error(`Gagal simpan GitHub (${putRes.status}) ${detail}`);
        }

        savedResult = await putRes.json();
        break;
      } catch (err) {
        lastError = err;
        if (!String(err.message || err).includes("409") || attempt === 2) throw err;
      }
    }

    const newSha = savedResult?.content?.sha || "";
    if (newSha) sessionStorage.setItem("satpam-db-sha", newSha);

    // Verifikasi langsung dari GitHub API, bukan raw URL, supaya saat refresh tidak balik ke data lama.
    try {
      const verified = await readGithubFile(token);
      db = normalizeDB(verified.data);
      localStorage.setItem(cacheKey(), JSON.stringify(db));
      localStorage.setItem("satpam-db-cache", JSON.stringify(db));
      if (verified.sha) sessionStorage.setItem("satpam-db-sha", verified.sha);
      renderAll();
    } catch (verifyErr) {
      console.warn("Verifikasi read-back gagal, data lokal tetap dipakai", verifyErr);
    }

    const shortSha = (savedResult?.commit?.sha || newSha || "").slice(0, 7);
    setSaveStatus(`Berhasil tersimpan ke GitHub${shortSha ? " #" + shortSha : ""}.`);
    toast("Berhasil tersimpan permanen ke backend GitHub.");
  } catch (err) {
    console.error(err);
    setSaveStatus("Gagal sinkron GitHub. Cek token / repo / permission / branch.");
    toast("Gagal sinkron GitHub. Data masih aman di cache lokal admin.");
  }
}

async function safeResponseText(res) {
  try {
    const text = await res.text();
    return text ? text.slice(0, 500) : "";
  } catch (_) {
    return "";
  }
}

function githubHeaders(token = "") {
  const headers = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function toBase64Unicode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64Unicode(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function setSaveStatus(text) {
  const el = $("#saveStatus");
  if (el) el.textContent = text;
}

function renderAll() {
  renderDashboard();
  renderSchedule();
  renderNotes();
  renderAdmin();
}

function memberStatus(member, iso = todayISO()) {
  if (member.overrides && member.overrides[iso]) return member.overrides[iso];
  const cycle = db.settings.cycle || DEFAULT_DB.settings.cycle;
  const distance = diffDays(member.startDate || iso, iso);
  const index = ((distance + Number(member.startIndex || 0)) % cycle.length + cycle.length) % cycle.length;
  return cycle[index] || "OFF";
}

function statusIcon(status) {
  return ({ PAGI: "☼", MALAM: "☾", OFF: "⊖", LEMBUR: "◷", CUTI: "◇", LIBUR_NASIONAL: "▣" })[status] || "•";
}

function publicStatusLabel(status) {
  if (status === "LIBUR_NASIONAL") return "LIBUR";
  return status;
}

function isDutyStatus(status) {
  const active = currentShift().name;
  return status === active || status === "LEMBUR";
}

function renderDashboard() {
  const iso = todayISO();
  const members = db.members || [];
  const statuses = members.map((m) => ({ member: m, status: memberStatus(m, iso) }));
  const duty = statuses.filter((row) => isDutyStatus(row.status));
  const off = statuses.filter((row) => ["OFF", "CUTI", "LIBUR_NASIONAL"].includes(row.status));
  const holidayToday = (db.settings.holidays || []).filter((h) => h.enabled && h.date === iso).length;

  $("#statDuty").textContent = duty.length;
  $("#statOff").textContent = off.length;
  $("#statHoliday").textContent = holidayToday;

  const list = duty.length ? duty : statuses.slice(0, 4);
  $("#todayMembers").innerHTML = list.map(({ member, status }) => memberCard(member, status)).join("") || emptyState("Belum ada anggota.");

  const latest = sortedNotes().slice(0, 2);
  $("#latestNotes").innerHTML = latest.map(noteItem).join("") || emptyState("Belum ada catatan.");
}

function memberCard(member, status) {
  const photo = member.photo
    ? `<img class="avatar-img" src="${escapeAttr(member.photo)}" alt="Foto ${escapeAttr(member.nama)}" onerror="this.replaceWith(avatarFallback())">`
    : `<div class="avatar-placeholder"></div>`;
  return `
    <article class="member-card">
      <div class="member-photo">${photo}</div>
      <h4>${escapeHTML(member.nama)}</h4>
      <p>${escapeHTML(member.jabatan)}</p>
      <small>Regu ${escapeHTML(member.regu)}</small>
      <div class="badge-status ${escapeAttr(status)}"><span>${statusIcon(status)}</span> ${publicStatusLabel(status)}</div>
    </article>`;
}

window.avatarFallback = function avatarFallback() {
  const div = document.createElement("div");
  div.className = "avatar-placeholder";
  return div;
};

function sortedNotes() {
  return [...(db.notes || [])].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}

function noteItem(note) {
  const member = db.members.find((m) => m.id === note.memberId);
  const name = member?.nama || "Admin";
  return `
    <article class="note-item">
      <div class="note-time">${escapeHTML(note.time)}</div>
      <div class="note-box">
        <div class="note-icon">${note.type === "handover" ? "▣" : note.type === "incident" ? "!" : "⬟"}</div>
        <div>
          <h4>${escapeHTML(note.title)}</h4>
          <p>${escapeHTML(note.body)}</p>
          <small>${formatDateLong(note.date)} · Oleh: <b>${escapeHTML(name)}</b> · <b>Regu ${escapeHTML(note.regu || "-")}</b></small>
        </div>
      </div>
      <div class="note-arrow">›</div>
    </article>`;
}

function renderSchedule() {
  const input = $("#scheduleDate");
  if (input && !input.value) input.value = scheduleDate;
  const iso = input?.value || scheduleDate;
  scheduleDate = iso;
  const rows = (db.members || []).map((m) => ({ member: m, status: memberStatus(m, iso) }));
  $("#scheduleList").innerHTML = `
    <div class="muted">Tanggal: <b>${formatDateLong(iso)}</b></div>
    ${rows.map(({ member, status }) => `
      <article class="schedule-item">
        <div>
          <h4>${escapeHTML(member.nama)} <small class="badge-status ${escapeAttr(status)}">${statusIcon(status)} ${publicStatusLabel(status)}</small></h4>
          <p>${escapeHTML(member.jabatan)} · Regu ${escapeHTML(member.regu)} · Siklus: ${escapeHTML((db.settings.cycle || []).join(" → "))}</p>
        </div>
      </article>`).join("") || emptyState("Belum ada anggota.")}
  `;
}

function renderNotes() {
  const keyword = ($("#noteSearch")?.value || "").toLowerCase().trim();
  const notes = sortedNotes().filter((note) => {
    const member = db.members.find((m) => m.id === note.memberId);
    const haystack = `${note.title} ${note.body} ${note.regu} ${member?.nama || ""}`.toLowerCase();
    return !keyword || haystack.includes(keyword);
  });
  $("#allNotes").innerHTML = notes.map(noteItem).join("") || emptyState("Catatan tidak ditemukan.");
}

function renderAdmin() {
  renderAdminMembers();
  renderNoteMemberOptions();
  renderAdminNotes();
  renderAdminHolidays();
  const today = todayISO();
  if ($("#memberStartDate") && !$("#memberStartDate").value) $("#memberStartDate").value = today;
  if ($("#noteDate") && !$("#noteDate").value) $("#noteDate").value = today;
  if ($("#noteTime") && !$("#noteTime").value) $("#noteTime").value = new Date().toTimeString().slice(0, 5);
  if ($("#holidayDate") && !$("#holidayDate").value) $("#holidayDate").value = today;
}

function renderAdminMembers() {
  const el = $("#adminMembers");
  if (!el) return;
  el.innerHTML = (db.members || []).map((m) => {
    const status = memberStatus(m, todayISO());
    return `
    <article class="admin-item">
      <div>
        <h4>${escapeHTML(m.nama)} <small class="badge-status ${escapeAttr(status)}">${statusIcon(status)} ${publicStatusLabel(status)}</small></h4>
        <p>${escapeHTML(m.jabatan)} · Regu ${escapeHTML(m.regu)} · Mulai ${escapeHTML(m.startDate)} · Index ${escapeHTML(String(m.startIndex))}</p>
      </div>
      <div class="row-actions">
        <button class="outline-btn" onclick="editMember('${m.id}')">Edit</button>
        <button class="danger-btn" onclick="deleteMember('${m.id}')">Hapus</button>
      </div>
    </article>`;
  }).join("") || emptyState("Belum ada anggota.");
}

function renderNoteMemberOptions() {
  const select = $("#noteMember");
  if (!select) return;
  const old = select.value;
  select.innerHTML = `<option value="">Admin / Umum</option>` + (db.members || []).map((m) => `<option value="${escapeAttr(m.id)}">${escapeHTML(m.nama)} - Regu ${escapeHTML(m.regu)}</option>`).join("");
  select.value = old;
}

function renderAdminNotes() {
  const el = $("#adminNotes");
  if (!el) return;
  el.innerHTML = sortedNotes().map((n) => `
    <article class="admin-item">
      <div>
        <h4>${escapeHTML(n.title)}</h4>
        <p>${escapeHTML(n.date)} ${escapeHTML(n.time)} · Regu ${escapeHTML(n.regu)} · ${escapeHTML(n.body)}</p>
      </div>
      <div class="row-actions">
        <button class="outline-btn" onclick="editNote('${n.id}')">Edit</button>
        <button class="danger-btn" onclick="deleteNote('${n.id}')">Hapus</button>
      </div>
    </article>`).join("") || emptyState("Belum ada catatan.");
}

function renderAdminHolidays() {
  const el = $("#adminHolidays");
  if (!el) return;
  el.innerHTML = (db.settings.holidays || []).sort((a, b) => b.date.localeCompare(a.date)).map((h) => `
    <article class="admin-item">
      <div>
        <h4>${escapeHTML(h.name)} <small class="badge-status ${h.enabled ? "PAGI" : "OFF"}">${h.enabled ? "Aktif" : "Nonaktif"}</small></h4>
        <p>${escapeHTML(formatDateLong(h.date))}</p>
      </div>
      <div class="row-actions">
        <button class="outline-btn" onclick="editHoliday('${h.id}')">Edit</button>
        <button class="danger-btn" onclick="deleteHoliday('${h.id}')">Hapus</button>
      </div>
    </article>`).join("") || emptyState("Belum ada libur nasional.");
}

function bindNavigation() {
  $$('[data-nav]').forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.nav));
  });
}

function navigate(page) {
  const map = {
    dashboard: "viewDashboard",
    jadwal: "viewJadwal",
    catatan: "viewCatatan",
    admin: "viewAdmin"
  };
  $$(".view").forEach((view) => view.classList.remove("active-view"));
  const target = $(`#${map[page] || "viewDashboard"}`);
  if (target) target.classList.add("active-view");
  $$(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.nav === page));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindFilters() {
  $("#scheduleDate")?.addEventListener("change", renderSchedule);
  $("#prevDay")?.addEventListener("click", () => moveScheduleDay(-1));
  $("#nextDay")?.addEventListener("click", () => moveScheduleDay(1));
  $("#noteSearch")?.addEventListener("input", renderNotes);
}

function moveScheduleDay(amount) {
  const input = $("#scheduleDate");
  const date = dateFromISO(input.value || todayISO());
  date.setDate(date.getDate() + amount);
  input.value = todayISO(date);
  renderSchedule();
}

function bindAdminForms() {
  $("#loginBtn")?.addEventListener("click", () => {
    const pass = $("#adminPassword").value.trim();
    const token = $("#githubToken").value.trim();
    if (pass !== (CONFIG.ADMIN_PASSWORD || "admin123")) {
      toast("Password admin salah.");
      return;
    }
    if (token) sessionStorage.setItem("satpam-github-token", token);
    isAdmin = true;
    $("#loginBox").classList.add("hidden");
    $("#adminBox").classList.remove("hidden");
    toast("Admin berhasil login.");
    renderAdmin();
  });

  $("#logoutBtn")?.addEventListener("click", () => {
    isAdmin = false;
    sessionStorage.removeItem("satpam-github-token");
    $("#adminBox").classList.add("hidden");
    $("#loginBox").classList.remove("hidden");
    toast("Admin keluar.");
  });

  $("#memberForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    requireAdmin();
    const id = $("#memberId").value || uid("m");
    const existing = db.members.find((m) => m.id === id);
    const overrides = existing?.overrides || {};
    const override = $("#memberOverride").value;
    if (override) overrides[todayISO()] = override;
    if (!override && overrides[todayISO()]) delete overrides[todayISO()];

    const data = {
      id,
      nama: $("#memberNama").value.trim(),
      jabatan: $("#memberJabatan").value.trim(),
      regu: $("#memberRegu").value,
      phone: $("#memberPhone").value.trim(),
      photo: $("#memberPhoto").value.trim(),
      startDate: $("#memberStartDate").value,
      startIndex: Number($("#memberStartIndex").value),
      overrides
    };
    if (!data.nama || !data.jabatan || !data.startDate) return toast("Lengkapi data anggota.");
    const index = db.members.findIndex((m) => m.id === id);
    if (index >= 0) db.members[index] = data;
    else db.members.push(data);
    resetMemberForm();
    await saveDB(`CRUD anggota ${data.nama}`);
  });

  $("#resetMemberForm")?.addEventListener("click", resetMemberForm);

  $("#noteForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    requireAdmin();
    const id = $("#noteId").value || uid("n");
    const data = {
      id,
      date: $("#noteDate").value,
      time: $("#noteTime").value,
      title: $("#noteTitle").value.trim(),
      memberId: $("#noteMember").value,
      regu: $("#noteRegu").value,
      type: $("#noteType").value,
      body: $("#noteBody").value.trim()
    };
    if (!data.date || !data.time || !data.title || !data.body) return toast("Lengkapi data catatan.");
    const index = db.notes.findIndex((n) => n.id === id);
    if (index >= 0) db.notes[index] = data;
    else db.notes.push(data);
    resetNoteForm();
    await saveDB(`CRUD catatan ${data.title}`);
  });

  $("#resetNoteForm")?.addEventListener("click", resetNoteForm);

  $("#holidayForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    requireAdmin();
    const id = $("#holidayId").value || uid("h");
    const data = {
      id,
      date: $("#holidayDate").value,
      name: $("#holidayName").value.trim(),
      enabled: $("#holidayEnabled").value === "true"
    };
    if (!data.date || !data.name) return toast("Lengkapi data libur nasional.");
    const index = db.settings.holidays.findIndex((h) => h.id === id);
    if (index >= 0) db.settings.holidays[index] = data;
    else db.settings.holidays.push(data);
    resetHolidayForm();
    await saveDB(`CRUD libur nasional ${data.name}`);
  });

  $("#resetHolidayForm")?.addEventListener("click", resetHolidayForm);
}

function requireAdmin() {
  if (!isAdmin) throw new Error("Admin belum login");
}

window.editMember = function editMember(id) {
  const m = db.members.find((item) => item.id === id);
  if (!m) return;
  $("#memberId").value = m.id;
  $("#memberNama").value = m.nama;
  $("#memberJabatan").value = m.jabatan;
  $("#memberRegu").value = m.regu;
  $("#memberPhone").value = m.phone || "";
  $("#memberPhoto").value = m.photo || "";
  $("#memberStartDate").value = m.startDate || todayISO();
  $("#memberStartIndex").value = String(m.startIndex || 0);
  $("#memberOverride").value = m.overrides?.[todayISO()] || "";
  toast("Data anggota masuk ke form edit.");
};

window.deleteMember = async function deleteMember(id) {
  requireAdmin();
  const m = db.members.find((item) => item.id === id);
  if (!m || !confirm(`Hapus anggota ${m.nama}?`)) return;
  db.members = db.members.filter((item) => item.id !== id);
  db.notes = db.notes.map((n) => n.memberId === id ? { ...n, memberId: "" } : n);
  await saveDB(`Hapus anggota ${m.nama}`);
};

window.editNote = function editNote(id) {
  const n = db.notes.find((item) => item.id === id);
  if (!n) return;
  $("#noteId").value = n.id;
  $("#noteDate").value = n.date;
  $("#noteTime").value = n.time;
  $("#noteTitle").value = n.title;
  $("#noteMember").value = n.memberId || "";
  $("#noteRegu").value = n.regu || "A";
  $("#noteType").value = n.type || "info";
  $("#noteBody").value = n.body;
  toast("Data catatan masuk ke form edit.");
};

window.deleteNote = async function deleteNote(id) {
  requireAdmin();
  const n = db.notes.find((item) => item.id === id);
  if (!n || !confirm(`Hapus catatan ${n.title}?`)) return;
  db.notes = db.notes.filter((item) => item.id !== id);
  await saveDB(`Hapus catatan ${n.title}`);
};

window.editHoliday = function editHoliday(id) {
  const h = db.settings.holidays.find((item) => item.id === id);
  if (!h) return;
  $("#holidayId").value = h.id;
  $("#holidayDate").value = h.date;
  $("#holidayName").value = h.name;
  $("#holidayEnabled").value = String(Boolean(h.enabled));
  toast("Data libur masuk ke form edit.");
};

window.deleteHoliday = async function deleteHoliday(id) {
  requireAdmin();
  const h = db.settings.holidays.find((item) => item.id === id);
  if (!h || !confirm(`Hapus libur ${h.name}?`)) return;
  db.settings.holidays = db.settings.holidays.filter((item) => item.id !== id);
  await saveDB(`Hapus libur ${h.name}`);
};

function resetMemberForm() {
  $("#memberForm")?.reset();
  $("#memberId").value = "";
  $("#memberStartDate").value = todayISO();
  $("#memberStartIndex").value = "0";
}

function resetNoteForm() {
  $("#noteForm")?.reset();
  $("#noteId").value = "";
  $("#noteDate").value = todayISO();
  $("#noteTime").value = new Date().toTimeString().slice(0, 5);
}

function resetHolidayForm() {
  $("#holidayForm")?.reset();
  $("#holidayId").value = "";
  $("#holidayDate").value = todayISO();
  $("#holidayEnabled").value = "true";
}

function emptyState(message) {
  return `<p class="muted">${escapeHTML(message)}</p>`;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function escapeAttr(value = "") {
  return escapeHTML(value).replace(/`/g, "&#96;");
}

function toast(message) {
  const old = document.querySelector(".toast");
  if (old) old.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}
