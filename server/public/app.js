// Multi-App State
let currentAppId = localStorage.getItem("ota_selected_app_id") || "";
let allApps = [];
let currentTab = "ios";
let releasesData = [];
let allBackups = [];
let allApiKeys = [];

// Auth & Server Config State
let serverConfig = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  isSupabaseConfigured: false,
  isR2Configured: false
};
let supabaseClient = null;
let currentUser = null;
let currentSessionToken = localStorage.getItem("ota_auth_token") || "";
let authMode = "login"; // 'login' | 'signup'
let gateAuthMode = "login"; // 'login' | 'signup'

// DOM Elements - Auth Gate & Layout Containers
const authGateScreen = document.getElementById("auth-gate-screen");
const dashboardContentWrapper = document.getElementById("dashboard-content-wrapper");
const emptyAppsState = document.getElementById("empty-apps-state");
const appWorkspace = document.getElementById("app-workspace");
const btnEmptyCreateApp = document.getElementById("btn-empty-create-app");

// DOM Elements - Auth Gate Form
const gateAuthTitle = document.getElementById("gate-auth-title");
const gateAuthDesc = document.getElementById("gate-auth-desc");
const gateAuthForm = document.getElementById("gate-auth-form");
const gateInputEmail = document.getElementById("gate-input-email");
const gateInputPassword = document.getElementById("gate-input-password");
const gateBtnSubmit = document.getElementById("gate-btn-submit");
const gateSubmitText = document.getElementById("gate-submit-text");
const gateSwitchText = document.getElementById("gate-switch-text");
const btnGateSwitchMode = document.getElementById("btn-gate-switch-mode");
const gateAuthAlert = document.getElementById("gate-auth-alert");
const btnToggleGatePwd = document.getElementById("btn-toggle-gate-pwd");

// DOM Elements - Header & Status
const systemStatusBadge = document.getElementById("system-status-badge");
const badgeSupabase = document.getElementById("badge-supabase");
const badgeR2 = document.getElementById("badge-r2");
const userDisplayEmail = document.getElementById("user-display-email");
const btnAuthAction = document.getElementById("btn-auth-action");
const btnRefresh = document.getElementById("btn-refresh");

// DOM Elements - App Selector
const selectActiveApp = document.getElementById("select-active-app");
const currentAppIdBadge = document.getElementById("current-app-id-badge");
const btnOpenCreateApp = document.getElementById("btn-open-create-app");
const btnDeleteCurrentApp = document.getElementById("btn-delete-current-app");

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
const tabKeysContent = document.getElementById("tab-keys-content");
const tabAppsContent = document.getElementById("tab-apps-content");
const tabBackupsContent = document.getElementById("tab-backups-content");

// DOM Elements - Platform Releases
const currentPlatformName = document.getElementById("current-platform-name");
const currentActiveVersion = document.getElementById("current-active-version");
const currentActiveDesc = document.getElementById("current-active-desc");
const selectRollbackVersion = document.getElementById("select-rollback-version");
const btnExecuteRollback = document.getElementById("btn-execute-rollback");
const releasesTableBody = document.getElementById("releases-table-body");

// DOM Elements - API Keys Tab
const keysTableBody = document.getElementById("keys-table-body");
const btnOpenCreateKey = document.getElementById("btn-open-create-key");

// DOM Elements - Apps Management Tab
const appsTableBody = document.getElementById("apps-table-body");
const btnTabCreateApp = document.getElementById("btn-tab-create-app");

// DOM Elements - Backups Tab
const backupsTableBody = document.getElementById("backups-table-body");
const inputBackupTag = document.getElementById("input-backup-tag");
const btnCreateSnapshot = document.getElementById("btn-create-snapshot");

// Modals
const modalAuth = document.getElementById("modal-auth");
const modalAuthClose = document.getElementById("modal-auth-close");
const modalAuthBtnCancel = document.getElementById("modal-auth-btn-cancel");
const btnSubmitAuth = document.getElementById("btn-submit-auth");
const inputAuthEmail = document.getElementById("input-auth-email");
const inputAuthPassword = document.getElementById("input-auth-password");
const btnToggleAuthMode = document.getElementById("btn-toggle-auth-mode");
const authToggleText = document.getElementById("auth-toggle-text");
const modalAuthTitle = document.getElementById("modal-auth-title");

const modalCreateKey = document.getElementById("modal-create-key");
const modalCreateKeyClose = document.getElementById("modal-create-key-close");
const modalCreateKeyBtnCancel = document.getElementById("modal-create-key-btn-cancel");
const btnSubmitCreateKey = document.getElementById("btn-submit-create-key");
const inputKeyName = document.getElementById("input-key-name");
const selectKeyType = document.getElementById("select-key-type");
const selectKeyExpiry = document.getElementById("select-key-expiry");

const modalShowKey = document.getElementById("modal-show-key");
const modalShowKeyClose = document.getElementById("modal-show-key-close");
const modalShowKeyBtnDone = document.getElementById("modal-show-key-btn-done");
const inputCreatedFullKey = document.getElementById("input-created-full-key");
const btnCopyFullKey = document.getElementById("btn-copy-full-key");

const modalCreateApp = document.getElementById("modal-create-app");
const modalCreateAppClose = document.getElementById("modal-create-app-close");
const modalCreateAppBtnCancel = document.getElementById("modal-create-app-btn-cancel");
const btnSubmitCreateApp = document.getElementById("btn-submit-create-app");
const inputAppId = document.getElementById("input-app-id");
const inputAppName = document.getElementById("input-app-name");
const inputAppDesc = document.getElementById("input-app-desc");

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

// Copy helper
function copyToClipboard(text, label = "Mã") {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Đã sao chép ${label} vào clipboard!`);
  }).catch(() => {
    showToast("Không thể sao chép", "error");
  });
}

function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (currentSessionToken) {
    headers["Authorization"] = `Bearer ${currentSessionToken}`;
  }
  return headers;
}

// ==========================================
// 1. SERVER CONFIG & SUPABASE AUTH
// ==========================================

async function loadServerConfig() {
  try {
    const res = await fetch("/api/config");
    serverConfig = await res.json();

    if (serverConfig.isSupabaseConfigured) {
      initSupabaseClient();
    }
  } catch (err) {
    console.warn("Không thể tải cấu hình server:", err);
  }
}

function initSupabaseClient() {
  if (!window.supabase || !serverConfig.supabaseUrl || !serverConfig.supabaseAnonKey) return;
  supabaseClient = window.supabase.createClient(serverConfig.supabaseUrl, serverConfig.supabaseAnonKey);

  // Lắng nghe thay đổi đăng nhập/đăng xuất từ Supabase
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      currentSessionToken = session.access_token;
      localStorage.setItem("ota_auth_token", currentSessionToken);
      setAuthState(true, currentUser.email);
      await loadApps();
    } else {
      currentUser = null;
      currentSessionToken = "";
      localStorage.removeItem("ota_auth_token");
      setAuthState(false);
    }
  });
}

async function checkInitialSession() {
  if (!supabaseClient) {
    setAuthState(false);
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      currentSessionToken = session.access_token;
      localStorage.setItem("ota_auth_token", currentSessionToken);
      setAuthState(true, currentUser.email);
      await loadApps();
    } else {
      currentUser = null;
      currentSessionToken = "";
      localStorage.removeItem("ota_auth_token");
      setAuthState(false);
    }
  } catch (err) {
    console.warn("Lỗi kiểm tra session ban đầu:", err);
    setAuthState(false);
  }
}

function setAuthState(isLoggedIn, email = "") {
  if (isLoggedIn) {
    if (authGateScreen) authGateScreen.classList.add("hidden");
    if (dashboardContentWrapper) dashboardContentWrapper.classList.remove("hidden");

    userDisplayEmail.textContent = `👤 ${email}`;
    userDisplayEmail.classList.remove("hidden");
    btnAuthAction.textContent = "🚪 Đăng xuất";
    btnAuthAction.className = "btn btn-danger-outline btn-sm";
    btnRefresh.disabled = false;
  } else {
    if (authGateScreen) authGateScreen.classList.remove("hidden");
    if (dashboardContentWrapper) dashboardContentWrapper.classList.add("hidden");

    userDisplayEmail.classList.add("hidden");
    btnAuthAction.textContent = "🔑 Đăng nhập";
    btnAuthAction.className = "btn btn-secondary btn-sm";
    btnRefresh.disabled = true;

    // Reset sạch dữ liệu trong state và DOM để bảo mật hoàn đối
    allApps = [];
    releasesData = [];
    allBackups = [];
    allApiKeys = [];
    currentAppId = "";

    if (releasesTableBody) releasesTableBody.innerHTML = "";
    if (selectRollbackVersion) selectRollbackVersion.innerHTML = "";
    if (selectActiveApp) selectActiveApp.innerHTML = "";
    if (appsTableBody) appsTableBody.innerHTML = "";
    if (keysTableBody) keysTableBody.innerHTML = "";
    if (backupsTableBody) backupsTableBody.innerHTML = "";
    if (currentAppIdBadge) currentAppIdBadge.textContent = "ID: --";
  }
}

// Xử lý nút Auth trên Header
btnAuthAction.addEventListener("click", async () => {
  if (currentUser) {
    if (confirm(`Bạn có chắc muốn đăng xuất khỏi tài khoản ${currentUser.email}?`)) {
      if (supabaseClient) await supabaseClient.auth.signOut();
      currentUser = null;
      currentSessionToken = "";
      localStorage.removeItem("ota_auth_token");
      setAuthState(false);
      showToast("Đã đăng xuất tài khoản!");
    }
  } else {
    // Focus vào form Auth Gate
    if (gateInputEmail) {
      gateInputEmail.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
});

// Xử lý Auth Gate Form (Tabs và Submit)
// Xử lý Auth Gate Form (Tabs và Submit)
function showGateAlert(message, type = "error") {
  if (!gateAuthAlert) return;
  gateAuthAlert.className = `gate-auth-alert alert-${type}`;
  gateAuthAlert.textContent = (type === "error" ? "⚠️ " : "✅ ") + message;
  gateAuthAlert.classList.remove("hidden");
}

function clearGateAlert() {
  if (gateAuthAlert) {
    gateAuthAlert.textContent = "";
    gateAuthAlert.classList.add("hidden");
  }
}

// Bật/tắt xem mật khẩu
if (btnToggleGatePwd && gateInputPassword) {
  btnToggleGatePwd.addEventListener("click", () => {
    const isPassword = gateInputPassword.getAttribute("type") === "password";
    gateInputPassword.setAttribute("type", isPassword ? "text" : "password");
    btnToggleGatePwd.textContent = isPassword ? "🙈" : "👁️";
  });
}

if (btnGateSwitchMode) {
  btnGateSwitchMode.addEventListener("click", () => {
    clearGateAlert();
    if (gateAuthMode === "login") {
      gateAuthMode = "signup";
      if (gateAuthTitle) gateAuthTitle.textContent = "Đăng Ký Tài Khoản";
      if (gateAuthDesc) gateAuthDesc.textContent = "Tạo tài khoản mới để bắt đầu quản lý ứng dụng của bạn";
      if (gateSubmitText) gateSubmitText.textContent = "Tạo Tài Khoản Mới";
      if (gateSwitchText) gateSwitchText.textContent = "Đã có tài khoản?";
      btnGateSwitchMode.textContent = "Đăng nhập ngay";
    } else {
      gateAuthMode = "login";
      if (gateAuthTitle) gateAuthTitle.textContent = "Đăng Nhập";
      if (gateAuthDesc) gateAuthDesc.textContent = "Nhập email và mật khẩu để quản lý ứng dụng của bạn";
      if (gateSubmitText) gateSubmitText.textContent = "Đăng Nhập";
      if (gateSwitchText) gateSwitchText.textContent = "Chưa có tài khoản?";
      btnGateSwitchMode.textContent = "Đăng ký ngay";
    }
  });
}

if (gateBtnSubmit) {
  gateBtnSubmit.addEventListener("click", async (e) => {
    e.preventDefault();
    clearGateAlert();
    const email = gateInputEmail.value.trim();
    const password = gateInputPassword.value;
    if (!email || !password) {
      showGateAlert("Vui lòng điền đầy đủ Email và Mật khẩu!");
      return;
    }

    gateBtnSubmit.disabled = true;
    if (gateSubmitText) gateSubmitText.textContent = "⏳ Đang xử lý...";
    else gateBtnSubmit.textContent = "⏳ Đang xử lý...";

    try {
      if (!supabaseClient) throw new Error("Chưa kết nối được hệ thống xác thực");

      if (gateAuthMode === "login") {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("Email hoặc mật khẩu không chính xác!");
          }
          throw error;
        }
        currentUser = data.user;
        currentSessionToken = data.session.access_token;
        localStorage.setItem("ota_auth_token", currentSessionToken);
        setAuthState(true, currentUser.email);
        showToast(`Đăng nhập thành công! Chào mừng ${currentUser.email}`);
        await loadApps();
      } else {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          currentUser = data.user;
          currentSessionToken = data.session.access_token;
          localStorage.setItem("ota_auth_token", currentSessionToken);
          setAuthState(true, currentUser.email);
          showToast("Đăng ký thành công! Đã tự động đăng nhập.");
          await loadApps();
        } else {
          showGateAlert("Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản nếu có yêu cầu.", "success");
        }
      }
    } catch (err) {
      showGateAlert(err.message || "Lỗi xác thực!");
    } finally {
      gateBtnSubmit.disabled = false;
      const targetText = gateAuthMode === "login" ? "Đăng Nhập" : "Tạo Tài Khoản Mới";
      if (gateSubmitText) gateSubmitText.textContent = targetText;
      else gateBtnSubmit.textContent = targetText;
    }
  });
}

// Modal Auth phụ trợ
btnToggleAuthMode.addEventListener("click", () => {
  if (authMode === "login") {
    authMode = "signup";
    modalAuthTitle.textContent = "Đăng Ký Tài Khoản Mới";
    btnSubmitAuth.textContent = "Đăng Ký";
    authToggleText.textContent = "Đã có tài khoản?";
    btnToggleAuthMode.textContent = "Đăng nhập";
  } else {
    authMode = "login";
    modalAuthTitle.textContent = "Đăng Nhập Tài Khoản";
    btnSubmitAuth.textContent = "Đăng Nhập";
    authToggleText.textContent = "Chưa có tài khoản?";
    btnToggleAuthMode.textContent = "Đăng ký ngay";
  }
});

btnSubmitAuth.addEventListener("click", async () => {
  const email = inputAuthEmail.value.trim();
  const password = inputAuthPassword.value;
  if (!email || !password) {
    alert("Vui lòng nhập đầy đủ Email và Mật khẩu!");
    return;
  }

  btnSubmitAuth.disabled = true;
  btnSubmitAuth.textContent = "⏳ Đang xử lý...";

  try {
    if (!supabaseClient) throw new Error("Chưa kết nối được Supabase Client");

    if (authMode === "login") {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      modalAuth.classList.add("hidden");
      currentUser = data.user;
      currentSessionToken = data.session.access_token;
      localStorage.setItem("ota_auth_token", currentSessionToken);
      setAuthState(true, currentUser.email);
      showToast(`Đăng nhập thành công! Chào mừng ${currentUser.email}`);
    } else {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      modalAuth.classList.add("hidden");
      if (data.session) {
        currentUser = data.user;
        currentSessionToken = data.session.access_token;
        localStorage.setItem("ota_auth_token", currentSessionToken);
        setAuthState(true, currentUser.email);
        showToast("Đăng ký thành công!");
      } else {
        showToast("Đăng ký thành công! Vui lòng kiểm tra email xác nhận.");
      }
    }
    await loadApps();
  } catch (err) {
    alert("Lỗi: " + err.message);
  } finally {
    btnSubmitAuth.disabled = false;
    btnSubmitAuth.textContent = authMode === "login" ? "Đăng Nhập" : "Đăng Ký";
  }
});

modalAuthClose.addEventListener("click", () => modalAuth.classList.add("hidden"));
modalAuthBtnCancel.addEventListener("click", () => modalAuth.classList.add("hidden"));

// ==========================================
// 2. APPS MANAGEMENT (CHỈ DÀNH CHO USER ĐANG ĐĂNG NHẬP)
// ==========================================

async function loadApps() {
  if (!currentUser && serverConfig.isSupabaseConfigured) {
    setAuthState(false);
    return;
  }

  try {
    const res = await fetch("/api/apps", { headers: getAuthHeaders() });
    if (res.status === 401) {
      setAuthState(false);
      return;
    }

    const data = await res.json();
    allApps = data.apps || [];

    // Nếu user chưa có app nào: Hiển thị Empty State
    if (allApps.length === 0) {
      if (emptyAppsState) emptyAppsState.classList.remove("hidden");
      if (appWorkspace) appWorkspace.classList.add("hidden");
      currentAppId = "";
      localStorage.removeItem("ota_selected_app_id");
      renderAppsTable();
      return;
    }

    // Nếu user có app: Hiển thị Workspace
    if (emptyAppsState) emptyAppsState.classList.add("hidden");
    if (appWorkspace) appWorkspace.classList.remove("hidden");

    if (!allApps.some(a => a.id === currentAppId)) {
      currentAppId = allApps[0].id;
      localStorage.setItem("ota_selected_app_id", currentAppId);
    }

    renderAppSelector();
    renderAppsTable();
    await loadOverview();

    if (currentTab === "ios" || currentTab === "android") {
      await loadPlatformReleases(currentTab);
    } else if (currentTab === "keys") {
      await loadApiKeys();
    } else if (currentTab === "backups") {
      await loadBackups();
    }
  } catch (error) {
    console.error("Lỗi tải danh sách apps:", error);
  }
}

// Bấm nút tạo app từ Empty State
if (btnEmptyCreateApp) {
  btnEmptyCreateApp.addEventListener("click", () => {
    modalCreateApp.classList.remove("hidden");
  });
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

  currentAppIdBadge.textContent = `ID: ${currentAppId}`;
}

selectActiveApp.addEventListener("change", (e) => {
  switchApp(e.target.value);
});

function switchApp(appId) {
  currentAppId = appId;
  localStorage.setItem("ota_selected_app_id", appId);
  renderAppSelector();
  renderAppsTable();
  loadOverview();

  if (currentTab === "ios" || currentTab === "android") {
    loadPlatformReleases(currentTab);
  } else if (currentTab === "keys") {
    loadApiKeys();
  }
  showToast(`Đã chọn app: ${appId}`);
}

function renderAppsTable() {
  if (!appsTableBody) return;
  if (allApps.length === 0) {
    appsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Chưa có ứng dụng nào</td></tr>`;
    return;
  }

  appsTableBody.innerHTML = allApps.map(app => {
    const isSelected = app.id === currentAppId;
    return `
      <tr style="${isSelected ? 'background: rgba(56, 189, 248, 0.08);' : ''}">
        <td>
          <div style="font-weight: 600;">${app.name}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${app.description || "Không có mô tả"}</div>
        </td>
        <td>
          <span class="code-font text-cyan">${app.id}</span>
          ${isSelected ? '<br><span class="badge badge-success" style="font-size: 0.65rem; margin-top: 3px;">Đang chọn</span>' : ''}
        </td>
        <td><span class="badge badge-cyan">${app.activeVersions?.ios?.latest ? `v${app.activeVersions.ios.latest}` : "Chưa có"}</span></td>
        <td><span class="badge badge-emerald">${app.activeVersions?.android?.latest ? `v${app.activeVersions.android.latest}` : "Chưa có"}</span></td>
        <td><strong>${app.totalReleases || 0}</strong> bản</td>
        <td><span class="badge badge-amber">${app.storageUsed || "0 B"}</span></td>
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

btnOpenCreateApp.addEventListener("click", () => modalCreateApp.classList.remove("hidden"));
btnTabCreateApp.addEventListener("click", () => modalCreateApp.classList.remove("hidden"));
modalCreateAppClose.addEventListener("click", () => modalCreateApp.classList.add("hidden"));
modalCreateAppBtnCancel.addEventListener("click", () => modalCreateApp.classList.add("hidden"));

btnSubmitCreateApp.addEventListener("click", async () => {
  const id = inputAppId.value.trim();
  const name = inputAppName.value.trim();
  const description = inputAppDesc.value.trim();

  if (!id || !name) {
    alert("Vui lòng điền App ID và Tên ứng dụng!");
    return;
  }

  try {
    btnSubmitCreateApp.disabled = true;
    btnSubmitCreateApp.textContent = "⏳ Đang tạo...";

    const res = await fetch("/api/apps", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, name, description })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi tạo app");

    modalCreateApp.classList.add("hidden");
    inputAppId.value = "";
    inputAppName.value = "";
    inputAppDesc.value = "";

    showToast(`Đã tạo ứng dụng '${name}' thành công!`);
    await loadApps();
    switchApp(id);
  } catch (err) {
    alert(err.message);
  } finally {
    btnSubmitCreateApp.disabled = false;
    btnSubmitCreateApp.textContent = "Tạo Ứng Dụng";
  }
});

btnDeleteCurrentApp.addEventListener("click", () => {
  const cur = allApps.find(a => a.id === currentAppId);
  deleteApp(currentAppId, cur?.name || currentAppId);
});

async function deleteApp(appId, appName) {
  if (allApps.length <= 1) {
    alert("Không thể xóa ứng dụng cuối cùng trên hệ thống!");
    return;
  }

  if (!confirm(`Bạn có chắc chắn muốn XÓA ứng dụng '${appName}' (${appId})?\nTất cả dữ liệu release liên quan sẽ bị xóa vĩnh viễn!`)) {
    return;
  }

  try {
    const res = await fetch(`/api/apps/${appId}`, { method: "DELETE", headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi xóa app");

    showToast(`Đã xóa app ${appName} thành công!`);
    await loadApps();
    loadOverview();
    if (currentTab === "ios" || currentTab === "android") {
      loadPlatformReleases(currentTab);
    }
  } catch (err) {
    alert(err.message);
  }
}

// ==========================================
// 3. API KEYS MANAGEMENT
// ==========================================

async function loadApiKeys() {
  if (!currentAppId) {
    if (keysTableBody) keysTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Chưa chọn ứng dụng</td></tr>`;
    return;
  }

  try {
    keysTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Đang tải API Keys của ${currentAppId}...</td></tr>`;
    const res = await fetch(`/api/apps/${encodeURIComponent(currentAppId)}/api-keys`, { headers: getAuthHeaders() });
    if (res.status === 401) {
      setAuthState(false);
      return;
    }
    const data = await res.json();
    if (data.error) {
      keysTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">${data.error}</td></tr>`;
      return;
    }
    allApiKeys = data.keys || [];

    if (allApiKeys.length === 0) {
      keysTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Chưa có API Key nào cho ứng dụng này. Hãy bấm "Tạo API Key Mới" để bắt đầu!</td></tr>`;
      return;
    }

    keysTableBody.innerHTML = allApiKeys.map(k => {
      const typeClass = k.key_type === "pull" ? "key-type-pull" : (k.key_type === "push" ? "key-type-push" : "key-type-full");
      const typeLabel = k.key_type === "pull" ? "📱 Pull (Mobile App)" : (k.key_type === "push" ? "🚀 Push (CI/CD)" : "⚡ Full Access");
      const dateStr = k.created_at ? new Date(k.created_at).toLocaleDateString("vi-VN") : "--";

      return `
        <tr>
          <td><strong>${k.name}</strong></td>
          <td><span class="key-type-pill ${typeClass}">${typeLabel}</span></td>
          <td><span class="code-font text-cyan">${k.key_prefix}••••••••</span></td>
          <td>${k.is_active ? '<span class="badge badge-success">Hoạt động</span>' : '<span class="badge badge-danger">Đã khóa</span>'}</td>
          <td class="text-muted text-sm">${dateStr}</td>
          <td>
            <button class="btn btn-danger-outline btn-sm" onclick="deleteApiKey('${k.id}', '${k.name}')">
              🗑️ Thu hồi
            </button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error("Lỗi tải API keys:", err);
    keysTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Không thể tải API Keys: ${err.message}</td></tr>`;
  }
}

btnOpenCreateKey.addEventListener("click", () => {
  inputKeyName.value = "";
  modalCreateKey.classList.remove("hidden");
});
modalCreateKeyClose.addEventListener("click", () => modalCreateKey.classList.add("hidden"));
modalCreateKeyBtnCancel.addEventListener("click", () => modalCreateKey.classList.add("hidden"));

btnSubmitCreateKey.addEventListener("click", async () => {
  const name = inputKeyName.value.trim();
  const keyType = selectKeyType.value;
  const expiresInDays = Number(selectKeyExpiry.value);

  if (!name) {
    alert("Vui lòng nhập tên định danh cho API Key!");
    return;
  }

  btnSubmitCreateKey.disabled = true;
  btnSubmitCreateKey.textContent = "⏳ Đang tạo...";

  try {
    const res = await fetch(`/api/apps/${encodeURIComponent(currentAppId)}/api-keys`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, keyType, expiresInDays })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi tạo API Key");

    modalCreateKey.classList.add("hidden");

    // Hiển thị Full Key cho người dùng copy
    inputCreatedFullKey.value = data.apiKey.fullKey;
    modalShowKey.classList.remove("hidden");

    loadApiKeys();
  } catch (err) {
    alert(err.message);
  } finally {
    btnSubmitCreateKey.disabled = false;
    btnSubmitCreateKey.textContent = "Tạo Key";
  }
});

btnCopyFullKey.addEventListener("click", () => {
  copyToClipboard(inputCreatedFullKey.value, "API Key");
});

modalShowKeyClose.addEventListener("click", () => modalShowKey.classList.add("hidden"));
modalShowKeyBtnDone.addEventListener("click", () => modalShowKey.classList.add("hidden"));

async function deleteApiKey(keyId, keyName) {
  if (!confirm(`Bạn có chắc muốn THU HỒI API Key '${keyName}'?\nCác thiết bị hoặc CI/CD đang sử dụng Key này sẽ không thể truy cập được nữa!`)) {
    return;
  }

  try {
    const res = await fetch(`/api/apps/${encodeURIComponent(currentAppId)}/api-keys/${keyId}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi xóa API Key");

    showToast("Đã thu hồi API Key thành công!");
    loadApiKeys();
  } catch (err) {
    alert(err.message);
  }
}

// ==========================================
// 4. OVERVIEW & PLATFORM RELEASES
// ==========================================

async function loadOverview() {
  if (!currentAppId) return;
  try {
    const res = await fetch(`/api/overview?appId=${encodeURIComponent(currentAppId)}`, { headers: getAuthHeaders() });
    if (res.status === 401) {
      setAuthState(false);
      return;
    }
    const data = await res.json();
    if (data.error || !data.activeVersions) return;

    statIosLatest.textContent = data.activeVersions.ios?.latest ? `v${data.activeVersions.ios.latest}` : "Chưa có";
    statIosCount.textContent = `${data.totalIosReleases || 0} bản lưu trữ`;

    statAndroidLatest.textContent = data.activeVersions.android?.latest ? `v${data.activeVersions.android.latest}` : "Chưa có";
    statAndroidCount.textContent = `${data.totalAndroidReleases || 0} bản lưu trữ`;

    statStorage.textContent = data.totalStorageUsed || "0 B";
    if (statStorageGlobal) statStorageGlobal.textContent = `Tài nguyên ứng dụng này`;

    statAppsCount.textContent = `${data.appsCount || 0}`;
    if (statBackups) statBackups.textContent = `Quyền sở hữu tài khoản`;
  } catch (error) {
    console.error("Lỗi khi tải overview:", error);
  }
}

async function loadPlatformReleases(platform) {
  if (!currentAppId) {
    if (releasesTableBody) releasesTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Chưa chọn ứng dụng</td></tr>`;
    return;
  }

  try {
    if (releasesTableBody) releasesTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Đang tải danh sách ${platform.toUpperCase()} của ${currentAppId}...</td></tr>`;

    const res = await fetch(`/api/releases/${platform}?appId=${encodeURIComponent(currentAppId)}`, { headers: getAuthHeaders() });
    if (res.status === 401) {
      setAuthState(false);
      return;
    }
    const data = await res.json();
    if (data.error) {
      if (releasesTableBody) releasesTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">${data.error}</td></tr>`;
      return;
    }

    releasesData = data.releases || [];
    const latest = data.latestVersion;

    currentPlatformName.textContent = platform.toUpperCase();
    currentPlatformName.style.background = platform === "ios" ? "#3b82f6" : "#10b981";

    currentActiveVersion.textContent = latest ? `v${latest}` : "Chưa có bản phát hành";
    currentActiveDesc.textContent = latest
      ? `Ứng dụng ${currentAppId} đang phục vụ phiên bản v${latest} cho người dùng ${platform.toUpperCase()}.`
      : `Chưa có bản cập nhật nào cho ${platform.toUpperCase()}.`;

    populateRollbackSelect(releasesData, latest);
    renderReleasesTable(releasesData);
  } catch (error) {
    console.error("Lỗi tải releases:", error);
    if (releasesTableBody) releasesTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Lỗi khi tải danh sách release!</td></tr>`;
  }
}

function populateRollbackSelect(releases, currentLatest) {
  selectRollbackVersion.innerHTML = "";

  if (!releases || releases.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Không có bản nào để chọn";
    selectRollbackVersion.appendChild(opt);
    btnExecuteRollback.disabled = true;
    return;
  }

  btnExecuteRollback.disabled = false;
  releases.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.version;
    const isCurrent = r.version === currentLatest;
    opt.textContent = `v${r.version} ${isCurrent ? "(Đang phục vụ)" : ""} - ${r.sizeFormatted} - ${r.manifest?.releaseNotes || "Không ghi chú"}`;
    if (isCurrent) opt.selected = true;
    selectRollbackVersion.appendChild(opt);
  });
}

function renderReleasesTable(releases) {
  if (releases.length === 0) {
    releasesTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Chưa có bản phát hành nào.</td></tr>`;
    return;
  }

  releasesTableBody.innerHTML = releases.map(r => {
    const isLatest = r.isLatest;
    const minNative = r.manifest?.minNativeVersion || "--";
    const dateFormatted = r.createdAt ? new Date(r.createdAt).toLocaleString("vi-VN") : "--";

    return `
      <tr class="${isLatest ? 'row-active' : ''}">
        <td>
          <div class="version-tag">
            <span class="version-num">v${r.version}</span>
            ${r.manifest?.mandatory ? '<span class="badge badge-rose">Bắt buộc</span>' : ''}
          </div>
          <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">
            ${r.manifest?.releaseNotes || "Không có ghi chú"}
          </div>
        </td>
        <td>
          ${isLatest
            ? '<span class="badge badge-success"><span class="status-dot"></span> Đang Phục Vụ</span>'
            : '<span class="badge badge-neutral">Lưu trữ</span>'
          }
        </td>
        <td>${r.sizeFormatted}</td>
        <td><span class="code-font">${minNative}</span></td>
        <td class="text-muted text-sm">${dateFormatted}</td>
        <td>
          <div class="action-cell">
            <a href="${r.downloadUrl}" class="btn btn-secondary btn-sm" download title="Tải update.zip">
              ⬇️ Tải zip
            </a>
            <button class="btn btn-secondary btn-sm" onclick="viewManifest('${encodeURIComponent(JSON.stringify(r.manifest))}', 'v${r.version}')" title="Xem thông tin chi tiết">
              ℹ️ Chi tiết
            </button>
            ${!isLatest
              ? `<button class="btn btn-warning btn-sm" onclick="handleSetActive('${r.version}')" title="Kích hoạt bản này">
                   ⚡ Kích hoạt
                 </button>
                 <button class="btn btn-danger-outline btn-sm" onclick="deleteRelease('${r.version}')" title="Xóa bản này">
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

btnExecuteRollback.addEventListener("click", () => {
  const version = selectRollbackVersion.value;
  if (version) handleSetActive(version);
});

async function handleSetActive(version) {
  if (!confirm(`Bạn có chắc muốn kích hoạt phiên bản v${version} cho ${currentAppId} (${currentTab.toUpperCase()})?`)) {
    return;
  }

  try {
    const res = await fetch("/api/set-active", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ appId: currentAppId, platform: currentTab, version })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi chuyển đổi phiên bản");

    showToast(`Đã chuyển phiên bản hoạt động sang v${version}!`);
    await loadPlatformReleases(currentTab);
    loadOverview();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteRelease(version) {
  if (!confirm(`Bạn có chắc muốn xóa bản phát hành v${version} của ${currentAppId}?`)) return;

  try {
    const res = await fetch("/api/releases", {
      method: "DELETE",
      headers: getAuthHeaders(),
      body: JSON.stringify({ appId: currentAppId, platform: currentTab, version })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi xóa release");

    showToast(`Đã xóa release v${version}!`);
    await loadPlatformReleases(currentTab);
    loadOverview();
  } catch (error) {
    alert(error.message);
  }
}

function viewManifest(manifestEncoded, title) {
  try {
    const parsed = JSON.parse(decodeURIComponent(manifestEncoded));
    modalManifestTitle.textContent = `Manifest - ${title}`;
    modalManifestCode.textContent = JSON.stringify(parsed, null, 2);
    modalManifest.classList.remove("hidden");
  } catch (e) {
    alert("Không thể đọc manifest!");
  }
}

modalManifestClose.addEventListener("click", () => modalManifest.classList.add("hidden"));
modalManifestBtnClose.addEventListener("click", () => modalManifest.classList.add("hidden"));

// ==========================================
// 5. BACKUPS & TABS
// ==========================================

async function loadBackups() {
  try {
    backupsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Đang tải danh sách sao lưu...</td></tr>`;
    const res = await fetch(`/api/backups?appId=${encodeURIComponent(currentAppId || "")}`, { headers: getAuthHeaders() });
    if (res.status === 401) {
      setAuthState(false);
      return;
    }
    const data = await res.json();
    if (data.error) {
      backupsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">${data.error}</td></tr>`;
      return;
    }

    allBackups = data.backups || [];

    if (allBackups.length === 0) {
      backupsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Chưa có bản sao lưu nào.</td></tr>`;
      return;
    }

    backupsTableBody.innerHTML = allBackups.map(b => `
      <tr>
        <td><span class="code-font text-cyan">${b.filename}</span></td>
        <td><strong>${b.tag}</strong></td>
        <td><span class="badge badge-purple">${b.appId}</span></td>
        <td>${b.sizeFormatted}</td>
        <td class="text-muted text-sm">${new Date(b.createdAt).toLocaleString("vi-VN")}</td>
        <td>
          <button class="btn btn-warning btn-sm" onclick="restoreBackup('${b.filename}')">
            🔄 Phục hồi
          </button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Lỗi tải backups:", err);
    backupsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Lỗi khi tải backups: ${err.message}</td></tr>`;
  }
}

btnCreateSnapshot.addEventListener("click", async () => {
  const tag = inputBackupTag.value.trim() || "manual-snapshot";
  try {
    const res = await fetch("/api/backups/create", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ tag, appId: currentAppId })
    });
    if (res.status === 401) {
      setAuthState(false);
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi tạo snapshot");

    showToast("Đã lưu bản sao lưu thành công!");
    inputBackupTag.value = "";
    loadBackups();
    loadOverview();
  } catch (err) {
    alert(err.message);
  }
});

async function restoreBackup(filename) {
  if (!confirm(`Bạn có chắc muốn phục hồi cấu hình từ ${filename}?\nCấu hình phiên bản hiện tại sẽ được cập nhật lại theo bản sao lưu này!`)) {
    return;
  }

  try {
    const res = await fetch(`/api/backups/restore/${filename}`, {
      method: "POST",
      headers: getAuthHeaders()
    });
    if (res.status === 401) {
      setAuthState(false);
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi phục hồi");

    showToast(data.message || "Đã phục hồi thành công!");
    loadApps();
  } catch (err) {
    alert(err.message);
  }
}

// Tab Switching
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.getAttribute("data-tab");
    currentTab = tab;

    tabPlatformContent.classList.remove("active");
    tabKeysContent.classList.remove("active");
    tabAppsContent.classList.remove("active");
    tabBackupsContent.classList.remove("active");

    if (tab === "ios" || tab === "android") {
      tabPlatformContent.classList.add("active");
      loadPlatformReleases(tab);
    } else if (tab === "keys") {
      tabKeysContent.classList.add("active");
      loadApiKeys();
    } else if (tab === "apps") {
      tabAppsContent.classList.add("active");
      renderAppsTable();
    } else if (tab === "backups") {
      tabBackupsContent.classList.add("active");
      loadBackups();
    }
  });
});

btnRefresh.addEventListener("click", async () => {
  if (!currentUser && serverConfig.isSupabaseConfigured) {
    showToast("Vui lòng đăng nhập trước!", "warning");
    return;
  }
  await loadServerConfig();
  await loadApps();
  showToast("Đã làm mới dữ liệu!");
});

// Close modals when clicking backdrop
[modalAuth, modalCreateKey, modalShowKey, modalCreateApp, modalManifest].forEach(m => {
  if (m) {
    m.addEventListener("click", (e) => {
      if (e.target === m) m.classList.add("hidden");
    });
  }
});

// ==========================================
// INITIALIZATION
// ==========================================
(async function init() {
  await loadServerConfig();

  if (serverConfig.isSupabaseConfigured) {
    await checkInitialSession();
  } else {
    // Chế độ demo local
    setAuthState(true, "Local Admin (Chế độ demo)");
    await loadApps();
  }
})();
