(() => {
  "use strict";

  const CONFIG = window.APP_CONFIG || {
    APP_NAME: "EAbsensi SATPAM BANK KALTIMTARA",
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "GANTI_PASSWORD_INI",
    GITHUB: {
      owner: "USERNAME_GITHUB_ANDA",
      repo: "eabsensi-satpam-backend",
      branch: "main",
      dataPath: "data/anggota.json"
    }
  };

  const STORAGE_KEY = "eabsensi_satpam_cache_v1";
  const TOKEN_KEY = "eabsensi_satpam_github_token";
  const DAY = 24 * 60 * 60 * 1000;

  const DEFAULT_DATA = {
    meta: {
      appName: "EAbsensi SATPAM BANK KALTIMTARA",
      version: "1.0.0",
      updatedAt: new Date().toISOString()
    },
    settings: {
      bankName: "Bank Kaltimtara",
      location: "Pos Security",
      morningStart: "07:00",
      morningEnd: "19:00",
      nightStart: "19:00",
      nightEnd: "07:00",
      morningDays: 4,
      nightDays: 4,
      offDays: 4
    },
    members: [
      {
        id: makeId("m"),
        nrp: "SP-001",
        name: "Andi Setiawan",
        role: "Danru",
        unit: "Regu A",
        phone: "08xxxxxxxxxx",
        cycleStartDate: "2026-05-01",
        active: true,
        notes: "Contoh anggota. Silakan edit dari Admin Panel."
      },
      {
        id: makeId("m"),
        nrp: "SP-002",
        name: "Budi Pratama",
        role: "Anggota",
        unit: "Regu A",
        phone: "08xxxxxxxxxx",
        cycleStartDate: "2026-05-01",
        active: true,
        notes: ""
      },
      {
        id: makeId("m"),
        nrp: "SP-003",
        name: "Candra Wijaya",
        role: "Anggota",
        unit: "Regu B",
        phone: "08xxxxxxxxxx",
        cycleStartDate: "2026-04-27",
        active: true,
        notes: ""
      },
      {
        id: makeId("m"),
        nrp: "SP-004",
        name: "Dedi Saputra",
        role: "Anggota",
        unit: "Regu C",
        phone: "08xxxxxxxxxx",
        cycleStartDate: "2026-04-23",
        active: true,
        notes: ""
      }
    ],
    logs: [
      {
        id: makeId("log"),
        date: toISODate(new Date()),
        shift: "Pagi",
        memberId: "all",
        category: "Serah Terima",
        title: "Aplikasi siap digunakan",
        note: "Data demo. Hapus atau edit catatan ini dari Admin Panel.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    specialDays: [
      {
        id: makeId("sp"),
        type: "holiday",
        memberId: "all",
        startDate: "2026-01-01",
        endDate: "2026-01-01",
        shift: "all",
        hours: 0,
        note: "Tahun Baru Masehi"
      }
    ]
  };

  let state = structuredCloneSafe(DEFAULT_DATA);
  let githubToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";
  let currentSha = "";
  let isAdmin = false;

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    $("appTitle").textContent = CONFIG.APP_NAME || state.meta.appName;
    const today = toISODate(new Date());
    $("publicDate").value = today;
    $("scheduleStart").value = today;
    $("logDate").value = today;
    $("specialStart").value = today;
    $("specialEnd").value = today;
    $("githubToken").value = githubToken;

    bindEvents();
    tickClock();
    setInterval(tickClock, 30_000);
    loadData();
  }

  function bindEvents() {
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => setTab(btn.dataset.tab));
    });

    $("btnOpenAdmin").addEventListener("click", () => setTab("adminPanel"));
    $("btnRefresh").addEventListener("click", loadData);
    $("publicDate").addEventListener("change", renderAll);
    $("btnBuildSchedule").addEventListener("click", renderSchedule);

    $("btnLogin").addEventListener("click", adminLogin);
    $("btnLogout").addEventListener("click", adminLogout);
    $("btnSaveGithub").addEventListener("click", saveToGitHub);
    $("btnExportJson").addEventListener("click", exportJson);

    $("memberForm").addEventListener("submit", saveMember);
    $("btnResetMember").addEventListener("click", resetMemberForm);

    $("logForm").addEventListener("submit", saveLog);
    $("btnResetLog").addEventListener("click", resetLogForm);

    $("specialForm").addEventListener("submit", saveSpecial);
    $("btnResetSpecial").addEventListener("click", resetSpecialForm);

    $("specialType").addEventListener("change", () => {
      if ($("specialType").value === "holiday") {
        $("specialMember").value = "all";
        $("specialShift").value = "all";
      }
    });
  }

  async function loadData() {
    const rawUrl = githubRawUrl();
    setSync("Mengambil data dari GitHub...");

    try {
      if (isConfigReady()) {
        const res = await fetch(rawUrl + `?v=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`GitHub raw gagal: ${res.status}`);
        const remoteData = await res.json();
        state = normalizeData(remoteData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setSync("Data berhasil dimuat dari GitHub.");
        toast("Data GitHub berhasil dimuat.");
      } else {
        throw new Error("Config GitHub belum diisi.");
      }
    } catch (err) {
      console.warn(err);
      const cached = localStorage.getItem(STORAGE_KEY);
      state = cached ? normalizeData(JSON.parse(cached)) : structuredCloneSafe(DEFAULT_DATA);
      setSync("Memakai data lokal/demo. Isi config GitHub agar data tersimpan permanen.");
      toast("Memakai data lokal/demo. Cek config GitHub.");
    }

    await refreshShaIfPossible();
    renderAll();
  }

  function normalizeData(input) {
    const base = structuredCloneSafe(DEFAULT_DATA);
    const data = { ...base, ...(input || {}) };
    data.meta = { ...base.meta, ...(input?.meta || {}) };
    data.settings = { ...base.settings, ...(input?.settings || {}) };
    data.members = Array.isArray(data.members) ? data.members.map((m) => ({
      id: m.id || makeId("m"),
      nrp: m.nrp || "",
      name: m.name || "Tanpa Nama",
      role: m.role || "Anggota",
      unit: m.unit || "-",
      phone: m.phone || "-",
      cycleStartDate: validISODate(m.cycleStartDate) ? m.cycleStartDate : toISODate(new Date()),
      active: m.active !== false,
      notes: m.notes || ""
    })) : [];
    data.logs = Array.isArray(data.logs) ? data.logs.map((l) => ({
      id: l.id || makeId("log"),
      date: validISODate(l.date) ? l.date : toISODate(new Date()),
      shift: l.shift || "Pagi",
      memberId: l.memberId || "all",
      category: l.category || "Lainnya",
      title: l.title || "Catatan",
      note: l.note || "",
      createdAt: l.createdAt || new Date().toISOString(),
      updatedAt: l.updatedAt || new Date().toISOString()
    })) : [];
    data.specialDays = Array.isArray(data.specialDays) ? data.specialDays.map((s) => ({
      id: s.id || makeId("sp"),
      type: s.type || "leave",
      memberId: s.memberId || "all",
      startDate: validISODate(s.startDate) ? s.startDate : toISODate(new Date()),
      endDate: validISODate(s.endDate) ? s.endDate : (validISODate(s.startDate) ? s.startDate : toISODate(new Date())),
      shift: s.shift || "all",
      hours: Number(s.hours || 0),
      note: s.note || ""
    })) : [];
    return data;
  }

  function renderAll() {
    renderHeader();
    renderDashboard();
    renderSchedule();
    renderLogs();
    renderAdmin();
    $("lastUpdated").textContent = state.meta?.updatedAt
      ? `Update terakhir: ${formatDateTime(state.meta.updatedAt)}`
      : "Belum tersinkron";
  }

  function renderHeader() {
    const now = new Date();
    $("todayInfo").textContent = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(now);

    const shift = getActiveShift(now);
    $("activeShift").textContent = shift.name;
    $("activeShiftTime").textContent = shift.timeText;

    const selectedDate = $("publicDate")?.value || toISODate(now);
    const holiday = getHolidayForDate(selectedDate);
    $("holidayBadge").textContent = holiday ? "Libur Nasional" : "Normal";
    $("holidayNote").textContent = holiday ? holiday.note : "Tidak ada libur nasional pada tanggal ini";
  }

  function renderDashboard() {
    const date = $("publicDate").value || toISODate(new Date());
    const activeMembers = state.members.filter((m) => m.active);
    const groups = {
      Pagi: [],
      Malam: [],
      Off: [],
      Cuti: []
    };

    activeMembers.forEach((member) => {
      const status = getMemberStatus(member, date);
      if (status.primary === "Cuti") groups.Cuti.push({ member, status });
      else if (status.primary === "Off") groups.Off.push({ member, status });
      else if (status.primary === "Malam") groups.Malam.push({ member, status });
      else groups.Pagi.push({ member, status });
    });

    const activeCount = groups.Pagi.length + groups.Malam.length;
    $("activeCount").textContent = activeCount;

    const dutyCards = $("dutyCards");
    dutyCards.innerHTML = "";
    [
      ["Pagi", groups.Pagi],
      ["Malam", groups.Malam],
      ["Off", groups.Off],
      ["Cuti", groups.Cuti]
    ].forEach(([title, list]) => {
      const div = document.createElement("div");
      div.className = "duty-card";
      div.innerHTML = `
        <h3>${escapeHtml(title)} <span class="muted">(${list.length})</span></h3>
        ${list.length ? list.map(({ member, status }) => memberMini(member, status)).join("") : `<p class="muted">Tidak ada data.</p>`}
      `;
      dutyCards.appendChild(div);
    });

    const tbody = $("memberTable");
    tbody.innerHTML = activeMembers.map((member) => {
      const status = getMemberStatus(member, date);
      return `
        <tr>
          <td><strong>${escapeHtml(member.name)}</strong><br><small class="muted">${escapeHtml(member.role || "-")}</small></td>
          <td>${escapeHtml(member.nrp || "-")}</td>
          <td>${escapeHtml(member.unit || "-")}</td>
          <td>${badges(status.badges)}</td>
          <td>${escapeHtml(member.phone || "-")}</td>
        </tr>
      `;
    }).join("");
  }

  function memberMini(member, status) {
    return `
      <div class="mini">
        <strong>${escapeHtml(member.name)}</strong>
        <div class="muted">${escapeHtml(member.role || "-")} • ${escapeHtml(member.unit || "-")}</div>
        ${badges(status.badges)}
      </div>
    `;
  }

  function badges(items) {
    return `<div class="badges">${items.map((b) => `<span class="badge ${escapeHtml(b.className)}">${escapeHtml(b.label)}</span>`).join("")}</div>`;
  }

  function renderSchedule() {
    const start = $("scheduleStart").value || toISODate(new Date());
    const days = Math.max(1, Math.min(31, Number($("scheduleDays").value || 14)));
    const wrap = $("scheduleList");
    wrap.innerHTML = "";

    for (let i = 0; i < days; i += 1) {
      const date = addDays(start, i);
      const activeMembers = state.members.filter((m) => m.active);
      const groups = { Pagi: [], Malam: [], Off: [], Cuti: [] };

      activeMembers.forEach((member) => {
        const status = getMemberStatus(member, date);
        const row = `${member.name} ${status.extraText ? `(${status.extraText})` : ""}`;
        if (status.primary === "Cuti") groups.Cuti.push(row);
        else if (status.primary === "Off") groups.Off.push(row);
        else if (status.primary === "Malam") groups.Malam.push(row);
        else groups.Pagi.push(row);
      });

      const holiday = getHolidayForDate(date);
      const card = document.createElement("div");
      card.className = "schedule-day";
      card.innerHTML = `
        <h3>${formatDate(date)} ${holiday ? `<span class="badge holiday">${escapeHtml(holiday.note)}</span>` : ""}</h3>
        <div class="schedule-columns">
          ${scheduleBox("Pagi 07:00-19:00", groups.Pagi)}
          ${scheduleBox("Malam 19:00-07:00", groups.Malam)}
          ${scheduleBox("Off", groups.Off)}
        </div>
        ${groups.Cuti.length ? `<p>${badges([{label:"Cuti", className:"leave"}])} ${groups.Cuti.map(escapeHtml).join(", ")}</p>` : ""}
      `;
      wrap.appendChild(card);
    }
  }

  function scheduleBox(title, list) {
    return `
      <div class="schedule-box">
        <strong>${escapeHtml(title)}</strong>
        <p class="muted">${list.length ? list.map(escapeHtml).join("<br>") : "Tidak ada"}</p>
      </div>
    `;
  }

  function renderLogs() {
    const sorted = [...state.logs].sort((a, b) => {
      const byDate = String(b.date).localeCompare(String(a.date));
      if (byDate !== 0) return byDate;
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    }).slice(0, 30);

    $("publicLogs").innerHTML = sorted.length ? sorted.map((log) => {
      const member = findMember(log.memberId);
      return `
        <article class="timeline-item">
          <div class="badges">
            <span class="badge">${escapeHtml(log.shift)}</span>
            <span class="badge night">${escapeHtml(log.category)}</span>
          </div>
          <h3>${escapeHtml(log.title)}</h3>
          <p>${escapeHtml(log.note)}</p>
          <small class="muted">${formatDate(log.date)} • ${member ? escapeHtml(member.name) : "Semua Anggota"}</small>
        </article>
      `;
    }).join("") : `<p class="muted">Belum ada catatan kerja.</p>`;
  }

  function renderAdmin() {
    populateSelects();
    renderAdminMembers();
    renderAdminLogs();
    renderAdminSpecials();
  }

  function populateSelects() {
    const memberOptions = [
      `<option value="all">Semua Anggota</option>`,
      ...state.members.filter((m) => m.active).map((m) => `<option value="${escapeAttr(m.id)}">${escapeHtml(m.name)} - ${escapeHtml(m.unit || "-")}</option>`)
    ].join("");
    $("logMember").innerHTML = memberOptions;
    $("specialMember").innerHTML = memberOptions;
  }

  function renderAdminMembers() {
    $("adminMemberList").innerHTML = state.members.map((m) => `
      <div class="admin-row">
        <div>
          <strong>${escapeHtml(m.name)}</strong>
          <div class="muted">${escapeHtml(m.nrp || "-")} • ${escapeHtml(m.role || "-")} • ${escapeHtml(m.unit || "-")}</div>
          <small class="muted">Siklus mulai: ${formatDate(m.cycleStartDate)} • ${m.active ? "Aktif" : "Nonaktif"}</small>
        </div>
        <div class="admin-row-actions">
          <button class="btn" data-edit-member="${escapeAttr(m.id)}">Edit</button>
          <button class="btn danger" data-delete-member="${escapeAttr(m.id)}">Hapus</button>
        </div>
      </div>
    `).join("");

    document.querySelectorAll("[data-edit-member]").forEach((btn) => btn.addEventListener("click", () => editMember(btn.dataset.editMember)));
    document.querySelectorAll("[data-delete-member]").forEach((btn) => btn.addEventListener("click", () => deleteMember(btn.dataset.deleteMember)));
  }

  function renderAdminLogs() {
    const sorted = [...state.logs].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 50);
    $("adminLogList").innerHTML = sorted.map((log) => `
      <div class="admin-row">
        <div>
          <strong>${escapeHtml(log.title)}</strong>
          <div class="muted">${formatDate(log.date)} • ${escapeHtml(log.shift)} • ${escapeHtml(log.category)}</div>
          <small class="muted">${escapeHtml(log.note)}</small>
        </div>
        <div class="admin-row-actions">
          <button class="btn" data-edit-log="${escapeAttr(log.id)}">Edit</button>
          <button class="btn danger" data-delete-log="${escapeAttr(log.id)}">Hapus</button>
        </div>
      </div>
    `).join("");

    document.querySelectorAll("[data-edit-log]").forEach((btn) => btn.addEventListener("click", () => editLog(btn.dataset.editLog)));
    document.querySelectorAll("[data-delete-log]").forEach((btn) => btn.addEventListener("click", () => deleteLog(btn.dataset.deleteLog)));
  }

  function renderAdminSpecials() {
    const labelMap = { overtime: "Lembur", leave: "Cuti", holiday: "Libur Nasional" };
    $("adminSpecialList").innerHTML = state.specialDays.map((sp) => {
      const member = findMember(sp.memberId);
      return `
        <div class="admin-row">
          <div>
            <strong>${escapeHtml(labelMap[sp.type] || sp.type)}</strong>
            <div class="muted">${formatDate(sp.startDate)} s/d ${formatDate(sp.endDate)} • ${member ? escapeHtml(member.name) : "Semua Anggota"}</div>
            <small class="muted">${escapeHtml(sp.note || "-")} ${sp.hours ? `• ${sp.hours} jam` : ""}</small>
          </div>
          <div class="admin-row-actions">
            <button class="btn" data-edit-special="${escapeAttr(sp.id)}">Edit</button>
            <button class="btn danger" data-delete-special="${escapeAttr(sp.id)}">Hapus</button>
          </div>
        </div>
      `;
    }).join("");

    document.querySelectorAll("[data-edit-special]").forEach((btn) => btn.addEventListener("click", () => editSpecial(btn.dataset.editSpecial)));
    document.querySelectorAll("[data-delete-special]").forEach((btn) => btn.addEventListener("click", () => deleteSpecial(btn.dataset.deleteSpecial)));
  }

  function saveMember(event) {
    event.preventDefault();
    requireAdmin();

    const id = $("memberId").value || makeId("m");
    const payload = {
      id,
      name: $("memberName").value.trim(),
      nrp: $("memberNrp").value.trim(),
      role: $("memberRole").value.trim() || "Anggota",
      unit: $("memberUnit").value.trim() || "-",
      phone: $("memberPhone").value.trim() || "-",
      cycleStartDate: $("memberCycleStart").value,
      active: $("memberActive").value === "true",
      notes: $("memberNotes").value.trim()
    };

    if (!payload.name || !validISODate(payload.cycleStartDate)) {
      toast("Nama dan tanggal mulai siklus wajib diisi.");
      return;
    }

    const index = state.members.findIndex((m) => m.id === id);
    if (index >= 0) state.members[index] = payload;
    else state.members.push(payload);

    markDirty();
    resetMemberForm();
    renderAll();
    toast("Anggota tersimpan. Klik Simpan ke GitHub agar permanen.");
  }

  function editMember(id) {
    const m = state.members.find((item) => item.id === id);
    if (!m) return;
    $("memberId").value = m.id;
    $("memberName").value = m.name || "";
    $("memberNrp").value = m.nrp || "";
    $("memberRole").value = m.role || "";
    $("memberUnit").value = m.unit || "";
    $("memberPhone").value = m.phone || "";
    $("memberCycleStart").value = m.cycleStartDate || toISODate(new Date());
    $("memberActive").value = String(m.active !== false);
    $("memberNotes").value = m.notes || "";
    toast("Data anggota masuk ke form edit.");
  }

  function deleteMember(id) {
    requireAdmin();
    const member = findMember(id);
    if (!member) return;
    if (!confirm(`Hapus anggota ${member.name}? Catatan lama tidak ikut terhapus.`)) return;
    state.members = state.members.filter((m) => m.id !== id);
    markDirty();
    renderAll();
    toast("Anggota dihapus. Klik Simpan ke GitHub agar permanen.");
  }

  function resetMemberForm() {
    $("memberForm").reset();
    $("memberId").value = "";
    $("memberCycleStart").value = toISODate(new Date());
    $("memberActive").value = "true";
  }

  function saveLog(event) {
    event.preventDefault();
    requireAdmin();

    const id = $("logId").value || makeId("log");
    const now = new Date().toISOString();
    const old = state.logs.find((l) => l.id === id);
    const payload = {
      id,
      date: $("logDate").value,
      shift: $("logShift").value,
      memberId: $("logMember").value,
      category: $("logCategory").value,
      title: $("logTitle").value.trim(),
      note: $("logNote").value.trim(),
      createdAt: old?.createdAt || now,
      updatedAt: now
    };

    if (!payload.title || !payload.note || !validISODate(payload.date)) {
      toast("Tanggal, judul, dan isi catatan wajib diisi.");
      return;
    }

    const index = state.logs.findIndex((l) => l.id === id);
    if (index >= 0) state.logs[index] = payload;
    else state.logs.push(payload);

    markDirty();
    resetLogForm();
    renderAll();
    toast("Catatan tersimpan. Klik Simpan ke GitHub agar permanen.");
  }

  function editLog(id) {
    const log = state.logs.find((item) => item.id === id);
    if (!log) return;
    $("logId").value = log.id;
    $("logDate").value = log.date;
    $("logShift").value = log.shift || "Pagi";
    $("logMember").value = log.memberId || "all";
    $("logCategory").value = log.category || "Lainnya";
    $("logTitle").value = log.title || "";
    $("logNote").value = log.note || "";
    toast("Catatan masuk ke form edit.");
  }

  function deleteLog(id) {
    requireAdmin();
    if (!confirm("Hapus catatan ini?")) return;
    state.logs = state.logs.filter((l) => l.id !== id);
    markDirty();
    renderAll();
    toast("Catatan dihapus. Klik Simpan ke GitHub agar permanen.");
  }

  function resetLogForm() {
    $("logForm").reset();
    $("logId").value = "";
    $("logDate").value = toISODate(new Date());
  }

  function saveSpecial(event) {
    event.preventDefault();
    requireAdmin();

    const id = $("specialId").value || makeId("sp");
    const startDate = $("specialStart").value;
    const endDate = $("specialEnd").value;
    if (!validISODate(startDate) || !validISODate(endDate)) {
      toast("Tanggal mulai dan selesai wajib diisi.");
      return;
    }
    if (parseDateOnly(endDate) < parseDateOnly(startDate)) {
      toast("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      return;
    }

    const payload = {
      id,
      type: $("specialType").value,
      memberId: $("specialType").value === "holiday" ? "all" : $("specialMember").value,
      startDate,
      endDate,
      shift: $("specialType").value === "holiday" ? "all" : $("specialShift").value,
      hours: Number($("specialHours").value || 0),
      note: $("specialNote").value.trim()
    };

    const index = state.specialDays.findIndex((s) => s.id === id);
    if (index >= 0) state.specialDays[index] = payload;
    else state.specialDays.push(payload);

    markDirty();
    resetSpecialForm();
    renderAll();
    toast("Status khusus tersimpan. Klik Simpan ke GitHub agar permanen.");
  }

  function editSpecial(id) {
    const sp = state.specialDays.find((item) => item.id === id);
    if (!sp) return;
    $("specialId").value = sp.id;
    $("specialType").value = sp.type || "leave";
    $("specialMember").value = sp.memberId || "all";
    $("specialStart").value = sp.startDate;
    $("specialEnd").value = sp.endDate;
    $("specialShift").value = sp.shift || "all";
    $("specialHours").value = sp.hours || 0;
    $("specialNote").value = sp.note || "";
    toast("Status khusus masuk ke form edit.");
  }

  function deleteSpecial(id) {
    requireAdmin();
    if (!confirm("Hapus status khusus ini?")) return;
    state.specialDays = state.specialDays.filter((s) => s.id !== id);
    markDirty();
    renderAll();
    toast("Status khusus dihapus. Klik Simpan ke GitHub agar permanen.");
  }

  function resetSpecialForm() {
    $("specialForm").reset();
    $("specialId").value = "";
    const today = toISODate(new Date());
    $("specialStart").value = today;
    $("specialEnd").value = today;
    $("specialHours").value = 0;
    $("specialShift").value = "all";
  }

  async function saveToGitHub() {
    requireAdmin();

    if (!isConfigReady()) {
      toast("Config GitHub belum lengkap. Edit assets/config.js dulu.");
      return;
    }

    githubToken = $("githubToken").value.trim() || githubToken;
    if (!githubToken) {
      toast("Token GitHub wajib diisi untuk menyimpan.");
      return;
    }

    const remember = $("rememberToken").checked;
    if (remember) localStorage.setItem(TOKEN_KEY, githubToken);
    else sessionStorage.setItem(TOKEN_KEY, githubToken);

    try {
      setSync("Menyimpan ke GitHub...");
      await refreshShaIfPossible(true);

      const payload = structuredCloneSafe(state);
      payload.meta = {
        ...(payload.meta || {}),
        appName: CONFIG.APP_NAME || payload.meta?.appName || "EAbsensi SATPAM BANK KALTIMTARA",
        updatedAt: new Date().toISOString()
      };

      const url = githubApiUrl();
      const body = {
        message: `Update data EAbsensi ${new Date().toLocaleString("id-ID")}`,
        content: encodeBase64(JSON.stringify(payload, null, 2)),
        branch: CONFIG.GITHUB.branch || "main"
      };
      if (currentSha) body.sha = currentSha;

      const res = await fetch(url, {
        method: "PUT",
        headers: githubHeaders(true),
        body: JSON.stringify(body)
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || `Gagal menyimpan: ${res.status}`);
      }

      currentSha = json.content?.sha || "";
      state = normalizeData(payload);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSync("Data berhasil disimpan ke GitHub.");
      renderAll();
      toast("Data berhasil disimpan permanen ke GitHub.");
    } catch (err) {
      console.error(err);
      setSync(`Gagal simpan: ${err.message}`);
      toast(`Gagal simpan GitHub: ${err.message}`);
    }
  }

  async function refreshShaIfPossible(withToken = false) {
    if (!isConfigReady()) return;
    try {
      const res = await fetch(githubApiUrl(), {
        headers: githubHeaders(withToken && Boolean(githubToken))
      });
      if (!res.ok) return;
      const json = await res.json();
      currentSha = json.sha || "";
    } catch (err) {
      console.warn("Tidak bisa mengambil SHA:", err);
    }
  }

  function adminLogin() {
    const user = $("loginUser").value.trim();
    const pass = $("loginPass").value;
    const goodUser = user === (CONFIG.ADMIN_USERNAME || "admin");
    const goodPass = pass === (CONFIG.ADMIN_PASSWORD || "GANTI_PASSWORD_INI");

    if (!goodUser || !goodPass) {
      toast("Username atau password admin salah.");
      return;
    }

    githubToken = $("githubToken").value.trim() || githubToken;
    if (githubToken) {
      if ($("rememberToken").checked) localStorage.setItem(TOKEN_KEY, githubToken);
      else sessionStorage.setItem(TOKEN_KEY, githubToken);
    }

    isAdmin = true;
    $("adminLocked").classList.add("hidden");
    $("adminUnlocked").classList.remove("hidden");
    setSync("Admin aktif. Perubahan masih lokal sampai klik Simpan ke GitHub.");
    renderAll();
    toast("Admin berhasil login.");
  }

  function adminLogout() {
    isAdmin = false;
    githubToken = "";
    sessionStorage.removeItem(TOKEN_KEY);
    $("githubToken").value = "";
    $("adminLocked").classList.remove("hidden");
    $("adminUnlocked").classList.add("hidden");
    toast("Admin logout.");
  }

  function requireAdmin() {
    if (!isAdmin) {
      throw new Error("Akses admin belum aktif.");
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eabsensi-satpam-${toISODate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getMemberStatus(member, dateStr) {
    const special = getSpecialForMember(member.id, dateStr);
    const scheduled = scheduleStatus(member, dateStr);
    const holiday = getHolidayForDate(dateStr);
    const badges = [];

    let primary = scheduled;
    if (scheduled === "Pagi") badges.push({ label: "Pagi 07-19", className: "" });
    if (scheduled === "Malam") badges.push({ label: "Malam 19-07", className: "night" });
    if (scheduled === "Off") badges.push({ label: "Off", className: "off" });

    if (holiday) badges.push({ label: "Libur Nasional", className: "holiday" });

    let extraText = "";
    special.forEach((s) => {
      if (s.type === "leave") {
        primary = "Cuti";
        extraText = s.note || "Cuti";
        badges.push({ label: `Cuti${s.note ? `: ${s.note}` : ""}`, className: "leave" });
      }
      if (s.type === "overtime") {
        extraText = `${s.hours || 0} jam lembur`;
        badges.push({ label: `Lembur ${s.hours || 0} jam`, className: "overtime" });
      }
    });

    return { primary, badges, extraText };
  }

  function scheduleStatus(member, dateStr) {
    const start = validISODate(member.cycleStartDate) ? member.cycleStartDate : dateStr;
    const diff = diffDays(dateStr, start);
    const cycleLength = Number(state.settings.morningDays || 4) + Number(state.settings.nightDays || 4) + Number(state.settings.offDays || 4);
    const pos = ((diff % cycleLength) + cycleLength) % cycleLength;
    if (pos < Number(state.settings.morningDays || 4)) return "Pagi";
    if (pos < Number(state.settings.morningDays || 4) + Number(state.settings.nightDays || 4)) return "Malam";
    return "Off";
  }

  function getSpecialForMember(memberId, dateStr) {
    return state.specialDays.filter((s) => {
      if (s.type === "holiday") return false;
      const memberMatch = s.memberId === "all" || s.memberId === memberId;
      return memberMatch && inRange(dateStr, s.startDate, s.endDate);
    });
  }

  function getHolidayForDate(dateStr) {
    return state.specialDays.find((s) => s.type === "holiday" && inRange(dateStr, s.startDate, s.endDate));
  }

  function getActiveShift(now) {
    const minutes = now.getHours() * 60 + now.getMinutes();
    const morningStart = timeToMinutes(state.settings?.morningStart || "07:00");
    const morningEnd = timeToMinutes(state.settings?.morningEnd || "19:00");
    if (minutes >= morningStart && minutes < morningEnd) {
      return { name: "Pagi", timeText: `${state.settings.morningStart || "07:00"} - ${state.settings.morningEnd || "19:00"}` };
    }
    return { name: "Malam", timeText: `${state.settings.nightStart || "19:00"} - ${state.settings.nightEnd || "07:00"}` };
  }

  function timeToMinutes(value) {
    const [h, m] = String(value).split(":").map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  }

  function findMember(id) {
    if (!id || id === "all") return null;
    return state.members.find((m) => m.id === id) || null;
  }

  function setTab(tabId) {
    document.querySelectorAll(".tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabId));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
  }

  function tickClock() {
    if (!$("todayInfo")) return;
    renderHeader();
  }

  function markDirty() {
    state.meta = { ...(state.meta || {}), updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSync("Ada perubahan lokal. Klik Simpan ke GitHub agar tidak hilang.");
  }

  function setSync(text) {
    const el = $("syncStatus");
    if (el) el.textContent = text;
    const footer = $("lastUpdated");
    if (footer && text) footer.textContent = text;
  }

  function githubRawUrl() {
    const g = CONFIG.GITHUB || {};
    return `https://raw.githubusercontent.com/${encodeURIComponent(g.owner || "")}/${encodeURIComponent(g.repo || "")}/${encodeURIComponent(g.branch || "main")}/${String(g.dataPath || "data/anggota.json").split("/").map(encodeURIComponent).join("/")}`;
  }

  function githubApiUrl() {
    const g = CONFIG.GITHUB || {};
    const path = String(g.dataPath || "data/anggota.json").split("/").map(encodeURIComponent).join("/");
    return `https://api.github.com/repos/${encodeURIComponent(g.owner || "")}/${encodeURIComponent(g.repo || "")}/contents/${path}`;
  }

  function githubHeaders(auth = false) {
    const headers = {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (auth && githubToken) headers.Authorization = `Bearer ${githubToken}`;
    return headers;
  }

  function isConfigReady() {
    const g = CONFIG.GITHUB || {};
    return Boolean(g.owner && g.repo && g.branch && g.dataPath && !String(g.owner).includes("USERNAME_GITHUB_ANDA"));
  }

  function encodeBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((b) => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  function toISODate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function validISODate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(parseDateOnly(value).getTime());
  }

  function parseDateOnly(value) {
    const [y, m, d] = String(value).split("-").map(Number);
    return new Date(y || 1970, (m || 1) - 1, d || 1);
  }

  function diffDays(dateA, dateB) {
    const a = parseDateOnly(dateA);
    const b = parseDateOnly(dateB);
    return Math.floor((a - b) / DAY);
  }

  function addDays(dateStr, days) {
    const date = parseDateOnly(dateStr);
    date.setDate(date.getDate() + days);
    return toISODate(date);
  }

  function inRange(dateStr, startStr, endStr) {
    const d = parseDateOnly(dateStr).getTime();
    const s = parseDateOnly(startStr).getTime();
    const e = parseDateOnly(endStr || startStr).getTime();
    return d >= s && d <= e;
  }

  function formatDate(dateStr) {
    if (!validISODate(dateStr)) return "-";
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(parseDateOnly(dateStr));
  }

  function formatDateTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function makeId(prefix = "id") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
  }
})();
