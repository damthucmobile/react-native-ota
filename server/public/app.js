// Multi-App State
let currentAppId = localStorage.getItem("ota_selected_app_id") || "com.otademoapp";
let allApps = [];
let currentTab = "ios";
let releasesData = [];
let allBackups = [];

// DOM Elements - Header & Selector
const selectActiveApp = document.getElementById("select-active-app");
const currentAppIdBadge = document.getElementById("current-app-id-badge");
const btnOpenCreateApp = document.getElementById("btn-open-create-app");
const btnDeleteCurrentApp = document.getElementById("btn-delete-current-app");
const bannerAppName = document.getElementById("banner-app-name");

// DOM Elements - Stats
const statIosLatest = document.getElementById("stat-ios-latest");
const statIosCount = document.getElementById("stat-ios-count");
const statAndroidLatest = document.getElementById("stat-android-latest");
const statAndroidCount = document.getElementById("stat-android-count");
const statStorage = document.getElementById("stat-storage");
const statStorageGlobal = document.getElementById("stat-storage-global");
const statAppsCount = document.getElementById("stat-apps-count");
const statBackups = document.getElementById("stat-backups");

// DOM Elements - Tabs
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPlatformContent = document.getElementById("tab-platform-content");
const tabAppsContent = document.getElementById("tab-apps-content");
const tabBackupsContent = document.getElementById("tab-backups-content");

// DOM Elements - Platform Releases
const currentPlatformName = document.getElementById("current-platform-name");
const currentActiveVersion = document.getElementById("current-active-version");
const rollbackSelect = document.getElementById("rollback-select");
const btnTriggerRollback = document.getElementById("btn-trigger-rollback");
const releasesTableBody = document.getElementById("releases-table-body");
const filterSearch = document.getElementById("filter-search");

// DOM Elements - Apps Management Tab
const appsTableBody = document.getElementById("apps-table-body");
const btnAppsTabAdd = document.getElementById("btn-apps-tab-add");

// DOM Elements - Backups
const backupsTableBody = document.getElementById("backups-table-body");
const backupTagInput = document.getElementById("backup-tag-input");
const btnCreateBackup = document.getElementById("btn-create-backup");
const btnRefresh = document.getElementById("btn-refresh");

// Modal Create App
const modalCreateApp = document.getElementById("modal-create-app");
const modalCreateAppClose = document.getElementById("modal-create-app-close");
const modalCreateAppBtnCancel = document.getElementById("modal-create-app-btn-cancel");
const btnSubmitCreateApp = document.getElementById("btn-submit-create-app");
const inputAppId = document.getElementById("input-app-id");
const inputAppName = document.getElementById("input-app-name");
const inputAppDesc = document.getElementById("input-app-desc");

// Modal Manifest
const modalManifest = document.getElementById("modal-manifest");
const modalManifestTitle = document.getElementById("modal-manifest-title");
const modalManifestCode = document.getElementById("modal-manifest-code");
const modalManifestClose = document.getElementById("modal-manifest-close");
const modalManifestBtnClose = document.getElementById("modal-manifest-btn-close");

// Toast helper
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(30px)";
    toast.style.transition = "all 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Copy to clipboard
function copyToClipboard(text, label = "Mã SHA-256") {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Đã sao chép ${label} vào clipboard!`);
  }).catch(() => {
    showToast("Không thể sao chép", "error");
  });
}

// ==========================================
// 1. APPS MANAGEMENT LOGIC
// ==========================================

async function loadApps() {
  try {
    const res = await fetch("/api/apps");
    const data = await res.json();
    allApps = data.apps || [];

    // Ensure valid currentAppId
    if (!allApps.some(a => a.id === currentAppId)) {
      currentAppId = allApps[0]?.id || "com.otademoapp";
      localStorage.setItem("ota_selected_app_id", currentAppId);
    }

    renderAppSelector();
    renderAppsTable();
  } catch (error) {
    console.error("Lỗi tải danh sách apps:", error);
    showToast("Không thể tải danh sách ứng dụng", "error");
  }
}

function renderAppSelector() {
  selectActiveApp.innerHTML = "";
  allApps.forEach(app => {
    const opt = document.createElement("option");
    opt.value = app.id;
    opt.textContent = `${app.name} (${app.id})`;
    if (app.id === currentAppId) opt.selected = true;
    selectActiveApp.appendChild(opt);
  });

  const cur = allApps.find(a => a.id === currentAppId);
  currentAppIdBadge.textContent = `ID: ${currentAppId}`;
  bannerAppName.textContent = cur ? cur.name : currentAppId;
}

function renderAppsTable() {
  if (!appsTableBody) return;
  if (allApps.length === 0) {
    appsTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Chưa có ứng dụng nào</td></tr>`;
    return;
  }

  appsTableBody.innerHTML = allApps.map(app => {
    const isSelected = app.id === currentAppId;
    return `
      <tr style="${isSelected ? 'background: rgba(56, 189, 248, 0.08);' : ''}">
        <td>
          <div class="code-font" style="font-weight: 600; color: #38bdf8;">${app.id}</div>
          ${isSelected ? '<span class="badge badge-success" style="font-size: 0.7rem; margin-top: 4px;">Đang chọn</span>' : ''}
        </td>
        <td>
          <div style="font-weight: 600;">${app.name}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${app.description || "Không có mô tả"}</div>
        </td>
        <td>
          <span class="badge badge-cyan">${app.activeVersions?.ios?.latest ? `v${app.activeVersions.ios.latest}` : "Chưa có"}</span>
          <span style="font-size: 0.75rem; color: #94a3b8; margin-left: 4px;">(${app.iosCount || 0} bản)</span>
        </td>
        <td>
          <span class="badge badge-emerald">${app.activeVersions?.android?.latest ? `v${app.activeVersions.android.latest}` : "Chưa có"}</span>
          <span style="font-size: 0.75rem; color: #94a3b8; margin-left: 4px;">(${app.androidCount || 0} bản)</span>
        </td>
        <td><strong>${app.totalReleases || 0}</strong> bản</td>
        <td><span class="badge badge-amber">${app.storageUsed || "0 B"}</span></td>
        <td style="font-size: 0.8rem; color: #94a3b8;">${new Date(app.createdAt).toLocaleDateString("vi-VN")}</td>
        <td>
          <div class="action-cell">
            ${!isSelected ? `<button class="btn btn-secondary btn-sm" onclick="switchApp('${app.id}')">👉 Chọn App</button>` : ''}
            ${allApps.length > 1 ? `<button class="btn btn-danger btn-sm" onclick="deleteApp('${app.id}', '${app.name}')">🗑️ Xóa</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function switchApp(appId) {
  currentAppId = appId;
  localStorage.setItem("ota_selected_app_id", appId);
  renderAppSelector();
  renderAppsTable();
  loadOverview();
  if (currentTab === "ios" || currentTab === "android") {
    loadPlatformReleases(currentTab);
  }
  showToast(`Đã chuyển sang ứng dụng: ${appId}`);
}

async function deleteApp(appId, appName) {
  if (allApps.length <= 1) {
    alert("Không thể xóa ứng dụng duy nhất còn lại trong hệ thống!");
    return;
  }

  const confirmed = confirm(`Bạn có chắc chắn muốn XÓA ứng dụng '${appName}' (${appId})?\nTất cả các bản release của ứng dụng này sẽ bị xóa khỏi server!`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/apps/${appId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi xóa app");

    showToast(`Đã xóa ứng dụng ${appName} thành công!`);
    await loadApps();
    loadOverview();
    if (currentTab === "ios" || currentTab === "android") {
      loadPlatformReleases(currentTab);
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

// ==========================================
// 2. OVERVIEW & PLATFORM RELEASES
// ==========================================

async function loadOverview() {
  try {
    const res = await fetch(`/api/overview?appId=${encodeURIComponent(currentAppId)}`);
    const data = await res.json();

    statIosLatest.textContent = data.activeVersions.ios?.latest ? `v${data.activeVersions.ios.latest}` : "Chưa có";
    statIosCount.textContent = `${data.totalIosReleases} bản lưu trữ`;

    statAndroidLatest.textContent = data.activeVersions.android?.latest ? `v${data.activeVersions.android.latest}` : "Chưa có";
    statAndroidCount.textContent = `${data.totalAndroidReleases} bản lưu trữ`;

    statStorage.textContent = data.totalStorageUsed || "0 B";
    statStorageGlobal.textContent = `Toàn server: ${data.globalStorageUsed || "0 B"}`;

    statAppsCount.textContent = `${data.appsCount || 1}`;
    statBackups.textContent = `${data.backupsCount || 0} bản sao lưu`;
  } catch (error) {
    console.error("Lỗi khi tải overview:", error);
  }
}

async function loadPlatformReleases(platform) {
  try {
    releasesTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Đang tải danh sách ${platform.toUpperCase()} của ${currentAppId}...</td></tr>`;

    const res = await fetch(`/api/releases/${platform}?appId=${encodeURIComponent(currentAppId)}`);
    const data = await res.json();

    releasesData = data.releases || [];
    const latest = data.latestVersion;

    currentPlatformName.textContent = platform.toUpperCase();
    currentPlatformName.style.background = platform === "ios" ? "#3b82f6" : "#10b981";

    currentActiveVersion.textContent = latest ? `v${latest}` : "Chưa có release nào";

    populateRollbackSelect(releasesData, latest);
    renderReleasesTable(releasesData);
  } catch (error) {
    console.error("Lỗi tải releases:", error);
    releasesTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Lỗi khi tải danh sách release!</td></tr>`;
  }
}

function populateRollbackSelect(releases, currentLatest) {
  rollbackSelect.innerHTML = "";

  if (!releases || releases.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Không có bản nào để chọn";
    rollbackSelect.appendChild(opt);
    btnTriggerRollback.disabled = true;
    return;
  }

  btnTriggerRollback.disabled = false;
  releases.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.version;
    const isCurrent = r.version === currentLatest;
    opt.textContent = `v${r.version} ${isCurrent ? "(Đang Active)" : ""} - ${r.sizeFormatted} - ${r.manifest?.releaseNotes || "Không ghi chú"}`;
    if (isCurrent) opt.selected = true;
    rollbackSelect.appendChild(opt);
  });
}

function renderReleasesTable(releases) {
  const query = (filterSearch?.value || "").toLowerCase().trim();
  const filtered = releases.filter(r => {
    if (!query) return true;
    return (
      r.version.toLowerCase().includes(query) ||
      (r.manifest?.releaseNotes || "").toLowerCase().includes(query) ||
      (r.manifest?.sha256 || "").toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    releasesTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Không tìm thấy bản phát hành nào phù hợp.</td></tr>`;
    return;
  }

  releasesTableBody.innerHTML = filtered.map(r => {
    const isLatest = r.isLatest;
    const notes = r.manifest?.releaseNotes || "Không có ghi chú";
    const sha = r.manifest?.sha256 || "";
    const shortSha = sha ? `${sha.slice(0, 10)}...` : "--";
    const minNative = r.manifest?.minNativeVersion || "--";
    const dateFormatted = r.createdAt ? new Date(r.createdAt).toLocaleString("vi-VN") : "--";

    return `
      <tr class="${isLatest ? 'row-active' : ''}">
        <td>
          <div class="version-tag">
            <span class="version-num">v${r.version}</span>
            ${r.manifest?.mandatory ? '<span class="badge badge-rose">Bắt buộc</span>' : ''}
          </div>
        </td>
        <td>
          ${isLatest
            ? '<span class="badge badge-success"><span class="status-dot"></span> Đang Phục Vụ</span>'
            : '<span class="badge badge-secondary">Lưu trữ</span>'
          }
        </td>
        <td><span class="code-font">${minNative}</span></td>
        <td>
          <span class="code-font clickable-sha" title="${sha}" onclick="copyToClipboard('${sha}')">
            ${shortSha} 📋
          </span>
        </td>
        <td>${r.sizeFormatted}</td>
        <td><div class="release-note" title="${notes}">${notes}</div></td>
        <td class="text-muted text-sm">${dateFormatted}</td>
        <td>
          <div class="action-cell">
            <a href="${r.downloadUrl}" class="btn btn-secondary btn-sm" download title="Tải update.zip">
              ⬇️ Tải
            </a>
            <button class="btn btn-secondary btn-sm" onclick="viewManifest('${encodeURIComponent(JSON.stringify(r.manifest))}', 'v${r.version}')">
              📄 Manifest
            </button>
            ${!isLatest
              ? `<button class="btn btn-warning btn-sm" onclick="quickRollback('${r.version}')" title="Kích hoạt bản này">
                   ⏪ Chuyển
                 </button>
                 <button class="btn btn-danger btn-sm" onclick="deleteRelease('${r.version}')" title="Xóa bản này">
                   🗑️
                 </button>`
              : ''
            }
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// Trigger Rollback / Active Version
async function handleSetActive(version) {
  if (!version) return;
  const confirmed = confirm(`Bạn có chắc chắn muốn đổi phiên bản phục vụ của ${currentPlatformName.textContent} (App: ${currentAppId}) sang v${version}?`);
  if (!confirmed) return;

  try {
    const res = await fetch("/api/set-active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: currentAppId,
        platform: currentTab,
        version
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Thao tác thất bại");

    showToast(data.message || `Đã chuyển sang v${version} thành công!`);
    await loadOverview();
    await loadPlatformReleases(currentTab);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function quickRollback(version) {
  handleSetActive(version);
}

// Delete Release
async function deleteRelease(version) {
  const confirmed = confirm(`Bạn có chắc muốn XOÁ hoàn toàn bản ${currentTab.toUpperCase()} v${version} của app ${currentAppId} khỏi server?\nHệ thống sẽ tự động tạo bản Snapshot trước khi xóa.`);
  if (!confirmed) return;

  try {
    const res = await fetch("/api/releases", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: currentAppId,
        platform: currentTab,
        version
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Xóa thất bại");

    showToast(data.message || `Đã xóa v${version} thành công!`);
    await loadOverview();
    await loadPlatformReleases(currentTab);
  } catch (error) {
    showToast(error.message, "error");
  }
}

// ==========================================
// 3. BACKUPS & RESTORE
// ==========================================

async function loadBackups() {
  try {
    backupsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Đang tải danh sách snapshot...</td></tr>`;

    const res = await fetch(`/api/backups?appId=${encodeURIComponent(currentAppId)}`);
    const data = await res.json();
    allBackups = data.backups || [];

    if (allBackups.length === 0) {
      backupsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Chưa có bản sao lưu nào. Hãy tạo điểm sao lưu đầu tiên!</td></tr>`;
      return;
    }

    backupsTableBody.innerHTML = allBackups.map(b => {
      const dateFormatted = new Date(b.createdAt).toLocaleString("vi-VN");
      return `
        <tr>
          <td><span class="code-font text-cyan">${b.filename}</span></td>
          <td><span class="badge badge-purple">${b.tag}</span></td>
          <td><span class="code-font" style="color: #a855f7;">${b.appId || "Toàn bộ"}</span></td>
          <td>${b.sizeFormatted}</td>
          <td class="text-muted text-sm">${dateFormatted}</td>
          <td>
            <div class="action-cell">
              <button class="btn btn-warning btn-sm" onclick="restoreBackup('${b.filename}')">
                🔄 Phục hồi
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  } catch (error) {
    console.error("Lỗi tải backups:", error);
    backupsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Lỗi khi tải danh sách backup!</td></tr>`;
  }
}

async function createBackup() {
  const tag = (backupTagInput.value || "").trim();
  try {
    btnCreateBackup.disabled = true;
    btnCreateBackup.textContent = "⏳ Đang lưu...";

    const res = await fetch("/api/backups/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag, appId: currentAppId })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi tạo backup");

    showToast(`Đã tạo Snapshot '${data.filename}' an toàn!`);
    backupTagInput.value = "";
    await loadBackups();
    await loadOverview();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    btnCreateBackup.disabled = false;
    btnCreateBackup.textContent = "💾 Lưu Snapshot";
  }
}

async function restoreBackup(filename) {
  const confirmed = confirm(`CẢNH BÁO: Phục hồi cấu hình versions từ '${filename}'?\nHệ thống sẽ tự động tạo thêm một snapshot dự phòng trước khi khôi phục.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/backups/restore/${encodeURIComponent(filename)}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Khôi phục thất bại");

    showToast(data.message || "Đã phục hồi thành công!");
    await loadOverview();
    await loadApps();
    if (currentTab === "ios" || currentTab === "android") {
      await loadPlatformReleases(currentTab);
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Manifest Modal
function viewManifest(encodedManifest, versionTitle) {
  try {
    const manifest = JSON.parse(decodeURIComponent(encodedManifest));
    modalManifestTitle.textContent = `Chi tiết manifest.json (${versionTitle})`;
    modalManifestCode.textContent = JSON.stringify(manifest, null, 2);
    modalManifest.classList.remove("hidden");
  } catch (e) {
    showToast("Không thể đọc manifest", "error");
  }
}

// ==========================================
// 4. EVENT LISTENERS
// ==========================================

// App select change
selectActiveApp.addEventListener("change", (e) => {
  switchApp(e.target.value);
});

// Delete current app button
btnDeleteCurrentApp.addEventListener("click", () => {
  const cur = allApps.find(a => a.id === currentAppId);
  deleteApp(currentAppId, cur ? cur.name : currentAppId);
});

// Open Create App Modal
function openCreateAppModal() {
  inputAppId.value = "";
  inputAppName.value = "";
  inputAppDesc.value = "";
  modalCreateApp.classList.remove("hidden");
  inputAppId.focus();
}

btnOpenCreateApp.addEventListener("click", openCreateAppModal);
if (btnAppsTabAdd) btnAppsTabAdd.addEventListener("click", openCreateAppModal);

modalCreateAppClose.addEventListener("click", () => modalCreateApp.classList.add("hidden"));
modalCreateAppBtnCancel.addEventListener("click", () => modalCreateApp.classList.add("hidden"));

// Submit Create App
btnSubmitCreateApp.addEventListener("click", async () => {
  const id = inputAppId.value.trim();
  const name = inputAppName.value.trim();
  const description = inputAppDesc.value.trim();

  if (!id || !name) {
    alert("Vui lòng nhập đầy đủ App ID và Tên ứng dụng!");
    return;
  }

  try {
    btnSubmitCreateApp.disabled = true;
    btnSubmitCreateApp.textContent = "⏳ Đang tạo...";

    const res = await fetch("/api/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, description })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi tạo app");

    modalCreateApp.classList.add("hidden");
    showToast(`Đã tạo ứng dụng '${name}' thành công!`);
    await loadApps();
    switchApp(id);
  } catch (error) {
    alert(error.message);
  } finally {
    btnSubmitCreateApp.disabled = false;
    btnSubmitCreateApp.textContent = "Tạo Ứng Dụng";
  }
});

// Tab Switch
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.getAttribute("data-tab");
    currentTab = tab;

    if (tab === "ios" || tab === "android") {
      tabPlatformContent.classList.add("active");
      tabAppsContent.classList.remove("active");
      tabBackupsContent.classList.remove("active");
      loadPlatformReleases(tab);
    } else if (tab === "apps") {
      tabPlatformContent.classList.remove("active");
      tabAppsContent.classList.add("active");
      tabBackupsContent.classList.remove("active");
      renderAppsTable();
    } else if (tab === "backups") {
      tabPlatformContent.classList.remove("active");
      tabAppsContent.classList.remove("active");
      tabBackupsContent.classList.add("active");
      loadBackups();
    }
  });
});

// Trigger Rollback Button
btnTriggerRollback.addEventListener("click", () => {
  const version = rollbackSelect.value;
  handleSetActive(version);
});

// Search Filter Input
if (filterSearch) {
  filterSearch.addEventListener("input", () => {
    renderReleasesTable(releasesData);
  });
}

// Backup Actions
btnCreateBackup.addEventListener("click", createBackup);

// Refresh Button
btnRefresh.addEventListener("click", () => {
  loadOverview();
  loadApps();
  if (currentTab === "ios" || currentTab === "android") {
    loadPlatformReleases(currentTab);
  } else if (currentTab === "apps") {
    renderAppsTable();
  } else if (currentTab === "backups") {
    loadBackups();
  }
  showToast("Đã làm mới dữ liệu!");
});

// Modal Manifest Close
modalManifestClose.addEventListener("click", () => modalManifest.classList.add("hidden"));
modalManifestBtnClose.addEventListener("click", () => modalManifest.classList.add("hidden"));

// Close modal when clicking backdrop
[modalCreateApp, modalManifest].forEach(m => {
  m.addEventListener("click", (e) => {
    if (e.target === m) m.classList.add("hidden");
  });
});

// ==========================================
// INITIAL LOAD
// ==========================================
(async function init() {
  await loadApps();
  await loadOverview();
  await loadPlatformReleases("ios");
})();
