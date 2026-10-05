const $= (s, root = document) => root.querySelector(s); const$$ = (s, root = document) => [...root.querySelectorAll(s)];

const API_URL = "https://script.google.com/macros/s/AKfycbxYpvxxkElZVostCLGLV51N_kU1ZsEDf1Th6Ax3FvApkTCvgg7mlvDiFF4IFJDBREyu/exec";

let currentDivision = "pendidikan";
// --- FITUR BARU: Variabel User Default diubah menjadi Guest ---
let currentUser = { role: "guest", nama: "Tamu", divisionKey: "pendidikan" }; 
let globalData = { members: [], tasks: [], dashboard: [] };
let currentPage = "overview";
let isFetching = false;
let selectedMemberId = null;

// === 1. SISTEM AUTENTIKASI (LOGIN & ROLE) ===
async function initApp() {
  // Cek apakah ada sesi user tersimpan di memori browser
  const savedUser = sessionStorage.getItem("genbi_user");
  if(savedUser) currentUser = JSON.parse(savedUser);
  
  updateAuthUI();
  applyRolePermissions();
  await fetchDivisionData();
}

function handleAuth() {
  if (currentUser.role !== "guest") {
    // Proses Logout
    currentUser = { role: "guest", nama: "Tamu", divisionKey: "pendidikan" };
    sessionStorage.removeItem("genbi_user");
    toast("Berhasil logout. Mode: Tamu.");
  } else {
    // Proses Login Sederhana
    const password = prompt("Masukkan password role:\n(Ketik: 'admin', 'koor', 'inti', atau 'anggota')");
    
    switch (password) {
      case "admin": currentUser = { role: "admin", nama: "Admin" }; break;
      case "koor": currentUser = { role: "koordinator", nama: "Koordinator" }; break;
      case "inti": currentUser = { role: "inti", nama: "DPH / Inti" }; break;
      case "anggota": currentUser = { role: "anggota", nama: "Anggota" }; break;
      case null: return;
      default: toast("Password salah!"); return;
    }
    sessionStorage.setItem("genbi_user", JSON.stringify(currentUser));
    toast(`Berhasil login sebagai ${currentUser.nama}`);
  }
  updateAuthUI();
  render(); // Render ulang halaman setelah ganti role
}

function updateAuthUI() {
  const btn = $("#loginBtn");
  if(btn) {
    btn.textContent = currentUser.role === "guest" ? "Login" : `Logout (${currentUser.nama})`;
    btn.className = currentUser.role === "guest" ? "btn btn-primary" : "btn btn-danger";
  }
}

// Cek permission apakah user boleh menambah/mengubah data
const canEdit = () => ["admin", "koordinator", "inti"].includes(currentUser.role);

function applyRolePermissions() {
  const select = $("#divisionSelect");
  if (!select) return;
  select.disabled = false;
}

// === 2. FETCH DATA DIVISI (KODE ASLI DIPERTAHANKAN) ===
async function fetchDivisionData() {
  const cacheKey = `genbi_cache_${currentDivision}`;
  const cachedData = sessionStorage.getItem(cacheKey);

  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      globalData.members = parsed.members;
      globalData.tasks = parsed.tasks;
      render(); 
    } catch (e) {}
  } else {
    if (!isFetching) {
      $("#content").innerHTML = `<div style="text-align:center; padding:50px;"><strong>Memuat Data Google Sheets (${currentDivision.toUpperCase()})...</strong></div>`;
    }
  }

  if (isFetching) return;
  isFetching = true;

  try {
    const [membersRes, kpiRes] = await Promise.all([
      fetch(`${API_URL}?action=getMembers&division=${currentDivision}`).then(r => r.json()),
      fetch(`${API_URL}?action=getKPI&division=${currentDivision}`).then(r => r.json())
    ]);

    const freshMembers = membersRes.data || [];
    const freshTasks = kpiRes.data || [];
    const hasChanged = JSON.stringify(freshTasks) !== JSON.stringify(globalData.tasks);

    if (hasChanged || !cachedData) {
      globalData.members = freshMembers;
      globalData.tasks = freshTasks;
      sessionStorage.setItem(cacheKey, JSON.stringify({ members: freshMembers, tasks: freshTasks }));
      render();
    }
  } catch (e) {
  } finally {
    isFetching = false;
  }
}

// === 3. HELPER TAMPILAN ===
function esc(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

function head(kicker, title, sub, action = "") {
  return `<div class="page-head"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p class="subtitle">${sub}</p></div><div class="head-actions">${action}</div></div>`;
}

function stat(label, value, icon, color, foot = "") {
  return `<article class="stat-card"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon ${color}">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`;
}

function badge(status) {
  let cls = status === "Selesai" ? "green" : status === "Proses" ? "orange" : "gray";
  return `<span class="badge badge-${cls}">${esc(status || "—")}</span>`;
}

// --- FITUR BARU: Buka Viewer Bukti Modal ---
function viewBukti(url) {
  const content = $("#buktiContent");
  const cleanUrl = url.trim();
  
  if (cleanUrl.match(/\.(jpeg|jpg|gif|png)$/i)) {
    content.innerHTML = `<img src="${cleanUrl}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:8px;">`;
  } else if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) {
    let embedUrl = cleanUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/");
    content.innerHTML = `<iframe src="${embedUrl}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;
  } else if (cleanUrl.includes("drive.google.com")) {
    let previewUrl = cleanUrl.replace("/view", "/preview");
    content.innerHTML = `<iframe src="${previewUrl}" width="100%" height="100%" frameborder="0"></iframe><div style="margin-top:15px;"><a href="${cleanUrl}" target="_blank" class="btn btn-primary">Buka Link Asli ↗</a></div>`;
  } else {
    content.innerHTML = `
      <div style="text-align:center;">
        <p style="margin-bottom:15px; color:#53647d;">Viewer tidak mendukung tampilan otomatis format link ini.</p>
        <a href="${cleanUrl}" target="_blank" class="btn btn-primary">Buka Bukti di Tab Baru ↗</a>
      </div>`;
  }
  $("#buktiModal")?.showModal();
}

// --- FITUR BARU: Modifikasi Render Bukti untuk buka modal ---
function renderEvidenceLinks(evidenceStr) {
  if (!evidenceStr) return "—";
  const links = String(evidenceStr).split("\n").filter(l => l.trim().length > 0);
  return links.map((url, idx) => {
    let clean = url.trim();
    // Jika link valid, buka modal viewBukti
    return /^https?:\/\//i.test(clean) ? `<button class="mini-btn" style="color:var(--blue); border-color:var(--blue2)" onclick="viewBukti('${esc(clean)}')">Lihat Bukti ${idx + 1}</button>` : esc(clean);
  }).join("<br>");
}

// === 4. HALAMAN DASHBOARD & MONITORING TUGAS ===
function overview() {
  const tasks = globalData.tasks || [];
  const members = globalData.members || [];
  const done = tasks.filter(t => t.status === "Selesai").length;

  return `
    ${head("OVERVIEW", "Dashboard", `Monitoring Divisi ${currentDivision.toUpperCase()}`)}
    <div class="stats-grid">
      ${stat("Total Anggota", members.length, "♙", "blue", "Anggota terdaftar")}
      ${stat("Total Proker", tasks.length, "▤", "purple", "Program kerja")}
      ${stat("Proker Selesai", done, "▥", "green", "Telah selesai")}
    </div>
  `;
}

function taskRow(t) {
  const prokerId = t.iDProker || t.idProker || t.IDProker || t.id || "";
  const namaTugas = t.namaProgramKerja || t.namaProker || t.namaTugas || t.nama || "—";
  const picTugas = t.pIC || t.penanggungJawab || t.pj || "—";
  const linkBukti = t.linkBuktiUtama || t.bukti || t.linkBukti || "";
  const hasBukti = Boolean(linkBukti);
  
  let rawProgres = Number(t.progres || t.Progres || t['%Progres'] || 0);
  const progresNum = (rawProgres > 0 && rawProgres <= 1) ? Math.round(rawProgres * 100) : rawProgres;
  
  let tenggatTampil = t.tenggat || t.tenggatWaktu || "—";
  if (String(tenggatTampil).includes('T')) {
    tenggatTampil = tenggatTampil.split('T')[0];
  }

  // --- FITUR BARU: Kontrol Akses Tombol Edit ---
  const actionBtn = canEdit() 
    ? `<button class="mini-btn" onclick="openUploadModal('${esc(prokerId)}')">${hasBukti ? "✎ Edit" : "+ Update"}</button>`
    : `<span class="badge badge-gray">Hanya Admin</span>`;

  return `
    <tr>
      <td><strong>${esc(prokerId)}</strong></td>
      <td>${esc(namaTugas)}</td>
      <td>${esc(t.divisi || currentDivision)}</td>
      <td>${esc(picTugas)}</td>
      <td>${badge(t.status || "Belum Mulai")}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="progress-track" style="min-width:60px;"><div class="progress-fill" style="width:${progresNum}%"></div></div>
          ${progresNum}%
        </div>
      </td>
      <td>${esc(tenggatTampil)}</td>
      <td>${renderEvidenceLinks(linkBukti)}</td>
      <td style="white-space:normal; max-width: 200px; font-size:10px;">${esc(t.catatan || "—").replace(/\n/g, '<br>')}</td>
      <td>${actionBtn}</td>
    </tr>
  `;
}

function tasksPage() {
  const tasks = globalData.tasks || [];
  const rows = tasks.map(taskRow).join("");
  // --- FITUR BARU: Sembunyikan tombol tambah proker jika bukan admin ---
  const addBtn = canEdit() ? `<button class="btn btn-primary" onclick="handleAddProkerPrompt()">＋ Tambah Proker Baru</button>` : '';

  return `
    ${head("DATA & MONITORING", "Monitoring Tugas", "Pantau tugas, progres, bukti, dan catatan situasi khusus.", addBtn)}
    <section class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nama Tugas</th>
              <th>Divisi</th>
              <th>Penanggung Jawab</th>
              <th>Status</th>
              <th>Progres</th>
              <th>Tenggat</th>
              <th>Bukti</th>
              <th>Catatan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="10" class="empty-cell">Belum ada proker terdaftar.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

// === 5. HALAMAN ANGGOTA & DETAIL PROFIL MODAL ===
function memberRow(m) {
  const id = m.idAnggota || m.id || "—";
  return `
    <tr>
      <td><strong>${esc(id)}</strong></td>
      <td><strong>${esc(m.namaLengkap || m.nama || "—")}</strong></td>
      <td>${esc(m.divisi || currentDivision)}</td>
      <!-- FITUR BARU: Mengubah dari data-member-detail menjadi onClick fungsi modal -->
      <td><button class="mini-btn" onclick="openMemberDetail('${esc(id)}')">Detail Poin</button></td>
    </tr>
  `;
}

function membersPage() {
  const members = globalData.members || [];
  const rows = members.map(memberRow).join("");

  return `
    ${head("DATA & MONITORING", "Monitoring Anggota", "Cari anggota dan buka profil detail.")}
    <section class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID Anggota</th>
              <th>Nama Lengkap</th>
              <th>Divisi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4" class="empty-cell">Belum ada anggota.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

// --- FITUR BARU: Fungsi Detail Anggota dikonversi ke Modal (Kode Fetch Asli Dipertahankan) ---
function openMemberDetail(id) {
  selectedMemberId = id;
  const m = globalData.members.find(x => String(x.idAnggota || x.id) === String(selectedMemberId));
  if (!m) return toast("Anggota tidak ditemukan!");

  const namaPanggilan = m.panggilan || m.namaPanggilan || m.namaLengkap.split(' ')[0];
  
  // Set Identitas di Modal
  $("#detailNama").textContent = m.namaLengkap || m.nama;
  $("#detailStats").innerHTML = `
    ${stat("ID Anggota", esc(m.idAnggota || m.id), "♙", "blue")}
    ${stat("Jabatan", esc(m.role || m.jabatan || "Anggota"), "✦", "green")}
    ${stat("Tab Panggilan", esc(namaPanggilan), "◷", "orange")}
  `;

  // Tampilkan loading di tabel modal
  const tbody = $("#detailTrackerBody");
  tbody.innerHTML = `<tr><td colspan="2" class="empty-cell" style="text-align:center;"><em>Memuat riwayat tracker...</em></td></tr>`;
  
  $("#memberModal")?.showModal();

  // Ambil data tracker dari tab perorangan di Google Sheets (KODE ASLI)
  fetch(`${API_URL}?action=getTracker&division=${currentDivision}&nickname=${namaPanggilan}`)
    .then(r => r.json())
    .then(res => {
      if (res.status === "success" && res.data.length > 0) {
        tbody.innerHTML = res.data.map(t => `
          <tr>
            <td style="white-space: nowrap;">${esc(t.tanggal instanceof Date ? t.tanggal.toLocaleDateString('id-ID') : t.tanggal)}</td>
            <td>
              <strong>${esc(t.kegiatan)}</strong> 
              <span class="badge ${t.poin > 0 ? 'badge-green' : (t.poin < 0 ? 'badge-red' : 'badge-gray')}" style="margin-left:8px;">${t.poin > 0 ? '+' : ''}${esc(t.poin)} Poin</span>
              <br><small>${esc(t.catatan)}</small>
            </td>
          </tr>
        `).join("");
      } else {
        tbody.innerHTML = `<tr><td colspan="2" class="empty-cell">Belum ada riwayat / Tab '${namaPanggilan}' tidak ditemukan.</td></tr>`;
      }
    });
}

// === 6. MODAL UPLOAD LINK & TAMBAH PROKER ===
function openUploadModal(idProker) {
  if (!canEdit()) return toast("Hanya Admin/Koor yang dapat mengedit proker!");

  const task = globalData.tasks.find(t => String(t.iDProker || t.idProker || t.id) === String(idProker));
  if (!task) {
    toast("ID Proker tidak ditemukan!");
    return;
  }
  
  $("#formProkerId").value = idProker;
  $("#modalProkerTitle").textContent = `Update: ${task.namaProgramKerja || task.namaProker || idProker}`;
  
  let rawProgres = Number(task.progres || task.Progres || task['%Progres'] || 0);
  $("#formProgres").value = (rawProgres > 0 && rawProgres <= 1) ? Math.round(rawProgres * 100) : rawProgres;
  
  $("#formStatus").value = task.status || "Belum Mulai";
  $("#formPic").value = task.pIC || task.penanggungJawab || task.pj || "";
  $("#formCatatan").value = task.catatan || "";
  $("#formLinkBukti").value = task.linkBuktiUtama || task.bukti || task.linkBukti || "";

  let tgl = task.tenggat || task.tenggatWaktu || "";
  if (String(tgl).includes('T')) tgl = String(tgl).split('T')[0];
  $("#formTenggat").value = tgl;
  
  $("#uploadModal")?.showModal();
}

function handleAddProkerPrompt() {
  if (!canEdit()) return toast("Akses ditolak!");
  
  const namaProker = prompt("Masukkan nama Program Kerja baru:");
  if (!namaProker) return;
  
  const payload = {
    action: "addProker",
    division: currentDivision,
    prokerData: { namaProker: namaProker.trim() }
  };
  
  toast("Menyiapkan proker baru...");
  sendPostPayload(payload);
}

async function handleSaveProker(e) {
  e.preventDefault();

  // --- FITUR BARU: Sistem Pencatatan Riwayat History ---
  const prevCatatan = $("#formCatatan").value.trim();
  const dateNow = new Date().toLocaleDateString('id-ID');
  const addLog = `[${dateNow}] Update by ${currentUser.nama}: ${$("#formProgres").value}%`;
  
  // Mencegah duplikasi log di hari yang sama dengan progres yang sama
  const finalCatatan = prevCatatan.includes(addLog) ? prevCatatan : (prevCatatan ? prevCatatan + `\n${addLog}` : addLog);

  const payload = {
   action: "uploadEvidence",
   division: currentDivision,
   idProker: $("#formProkerId").value,
   progres: Number($("#formProgres").value),
   status: $("#formStatus").value,
   pic: $("#formPic").value.trim(),
   catatan: finalCatatan, // Catatan dikirim dengan History baru
   tenggat: $("#formTenggat").value,
   linkBukti: $("#formLinkBukti").value.trim() 
  };

  toast("Menyimpan data ke Google Sheets...");
  await sendPostPayload(payload);
}

async function sendPostPayload(payload) {
  try {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) }).then(r => r.json());
    if (res.status === "success") {
      toast("Berhasil disimpan!");
      $("#uploadModal")?.close();
      
      sessionStorage.removeItem(`genbi_cache_${currentDivision}`);
      fetchDivisionData();
    } else {
      toast("Gagal: " + res.message);
    }
  } catch (err) {
    toast("Terjadi kesalahan koneksi!");
  }
}

// === 7. EVENT LISTENER & NAVIGASI ===
const pageRender = { 
  overview, 
  members: membersPage, 
  // member-detail dihapus karena sekarang menggunakan Modal
  tasks: tasksPage 
};

function render() {
  const fn = pageRender[currentPage] || overview;
  $("#content").innerHTML = fn();      $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === currentPage));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function go(page) {
  currentPage = page;
  render();
  // Autoclose sidebar di HP saat pindah menu
  if(window.innerWidth <= 760) {
    $("#sidebar")?.classList.remove("open");
  }
}

document.addEventListener("click", e => {
  const nav = e.target.closest("[data-page]");
  if (nav) { go(nav.dataset.page); return; }
});

document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "divisionSelect") {
    currentDivision = e.target.value;
    fetchDivisionData();
  }
});

// --- FITUR BARU: Toggle Sidebar yang responsif ---
$("#menuBtn").onclick = () => {
  const sidebar = $("#sidebar");
  const mainContent = $("#mainContent");
  
  if (window.innerWidth > 760) {
    // Mode Desktop: Animasi tutup/buka sidebar
    sidebar?.classList.toggle("collapsed");
    mainContent?.classList.toggle("expanded");
  } else {
    // Mode Mobile (Kode Asli)
    sidebar?.classList.toggle("open");
  }
};

// Jalankan Inisialisasi Utama
initApp();
