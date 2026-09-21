/* ==========================================================
   NGSA PAYROLL — SCRIPT
   ========================================================== */

/* ----------------------------------------------------------
   1. CẤU HÌNH LƯƠNG — Chỉ sửa tại đây nếu muốn đổi mức lương
   ---------------------------------------------------------- */
const rankSalaries = {
  0: 5000,
  1: 10000,
  2: 20000,
  3: 30000,
  4: 40000,
  5: 50000,
  6: 60000,
  7: 70000,
  8: 80000,
  9: 90000,
  10: 100000,
  11: 115000,
  12: 130000
};

/* Tên cấp bậc + icon, theo Rank. Đồng bộ với rankSalaries ở trên. */
const rankInfo = {
  0:  { name: "Cadet",         icon: "🎖️" },
  1:  { name: "Thiếu úy",      icon: "⭐" },
  2:  { name: "Trung úy",      icon: "⭐" },
  3:  { name: "Thượng úy",     icon: "⭐" },
  4:  { name: "Đại úy",        icon: "⭐" },
  5:  { name: "Thiếu tá",      icon: "🎖️" },
  6:  { name: "Trung tá",      icon: "🎖️" },
  7:  { name: "Thượng tá",     icon: "🎖️" },
  8:  { name: "Đại tá",        icon: "🎖️" },
  9:  { name: "Thiếu tướng",   icon: "⭐" },
  10: { name: "Trung tướng",   icon: "⭐" },
  11: { name: "Thượng tướng",  icon: "⭐" },
  12: { name: "Đại tướng",     icon: "⭐" }
};

const RANK_IDS = Object.keys(rankSalaries).map(Number).sort((a, b) => a - b);

/* ----------------------------------------------------------
   2. STATE + LOCAL STORAGE
   ---------------------------------------------------------- */
const STORAGE_KEY = "ngsa_payroll_state_v1";

let state = {
  fund: 0,
  members: [] // { id, name, rank }
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state.fund = Number(parsed.fund) || 0;
        state.members = Array.isArray(parsed.members) ? parsed.members : [];
      }
    }
  } catch (e) {
    console.error("Không thể đọc dữ liệu đã lưu:", e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Không thể lưu dữ liệu:", e);
  }
}

/* ----------------------------------------------------------
   3. HELPERS
   ---------------------------------------------------------- */
function formatCredits(amount) {
  const n = Math.round(Number(amount) || 0);
  return n.toLocaleString("en-US") + " Credits";
}

function getRankLabel(rankId) {
  const info = rankInfo[rankId];
  return info ? `${info.icon} ${info.name}` : "—";
}

function getRankSalary(rankId) {
  return rankSalaries[rankId] !== undefined ? rankSalaries[rankId] : 0;
}

function parseFundInput(value) {
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function makeId() {
  return "m_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/* ----------------------------------------------------------
   4. TOAST
   ---------------------------------------------------------- */
function showToast(message, isDanger) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast" + (isDanger ? " toast-danger" : "");
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s ease";
    setTimeout(() => toast.remove(), 260);
  }, 2200);
}

/* ----------------------------------------------------------
   5. DOM REFERENCES
   ---------------------------------------------------------- */
const fundInput = document.getElementById("fundInput");

const addForm = document.getElementById("addForm");
const memberNameInput = document.getElementById("memberName");
const memberRankSelect = document.getElementById("memberRank");
const rankPreview = document.getElementById("rankPreview");

const memberListEl = document.getElementById("memberList");
const emptyState = document.getElementById("emptyState");

const calcBtn = document.getElementById("calcBtn");
const resFund = document.getElementById("resFund");
const resCount = document.getElementById("resCount");
const resTotal = document.getElementById("resTotal");
const resRemaining = document.getElementById("resRemaining");
const resStatusLabel = document.getElementById("resStatusLabel");
const resStatusCard = document.getElementById("resStatusCard");

const reportList = document.getElementById("reportList");
const reportEmpty = document.getElementById("reportEmpty");
const reportTotal = document.getElementById("reportTotal");

const editOverlay = document.getElementById("editOverlay");
const editForm = document.getElementById("editForm");
const editId = document.getElementById("editId");
const editName = document.getElementById("editName");
const editRank = document.getElementById("editRank");
const editRankPreview = document.getElementById("editRankPreview");
const editCancel = document.getElementById("editCancel");

const bonusOverlay = document.getElementById("bonusOverlay");
const bonusForm = document.getElementById("bonusForm");
const bonusId = document.getElementById("bonusId");
const bonusMemberName = document.getElementById("bonusMemberName");
const bonusAmount = document.getElementById("bonusAmount");
const bonusPreview = document.getElementById("bonusPreview");
const bonusCancel = document.getElementById("bonusCancel");

const deleteOverlay = document.getElementById("deleteOverlay");
const deleteConfirm = document.getElementById("deleteConfirm");
const deleteCancel = document.getElementById("deleteCancel");
let pendingDeleteId = null;

/* ----------------------------------------------------------
   6. BUILD RANK DROPDOWNS
   ---------------------------------------------------------- */
function buildRankOptions(selectEl) {
  selectEl.innerHTML = "";
  RANK_IDS.forEach((rankId) => {
    const opt = document.createElement("option");
    opt.value = rankId;
    opt.textContent = `Rank ${rankId} — ${getRankLabel(rankId)}`;
    selectEl.appendChild(opt);
  });
}

/* ----------------------------------------------------------
   7. RENDER: ADD-FORM RANK PREVIEW
   ---------------------------------------------------------- */
function updateRankPreview(selectEl, previewEl) {
  const rankId = Number(selectEl.value);
  const salary = getRankSalary(rankId);
  previewEl.innerHTML = `
    <span>${getRankLabel(rankId)}</span>
    <span class="rank-preview-salary">${formatCredits(salary)}</span>
  `;
}

/* ----------------------------------------------------------
   8. RENDER: MEMBER LIST
   ---------------------------------------------------------- */
function renderMemberList() {
  memberListEl.querySelectorAll(".member-card").forEach((el) => el.remove());

  if (state.members.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  state.members.forEach((member) => {
    const base = getRankSalary(member.rank);
    const bonus = member.bonus || 0;
    const total = base + bonus;
    const bonusNote = bonus > 0
      ? `<p class="member-bonus-note">💎 Gồm ${formatCredits(bonus)} thưởng</p>`
      : "";
    const card = document.createElement("div");
    card.className = "member-card";
    card.innerHTML = `
      <div class="member-info">
        <p class="member-name">${escapeHtml(member.name)}</p>
        <p class="member-rank">${getRankLabel(member.rank)}</p>
        <p class="member-salary">${formatCredits(total)}</p>
        ${bonusNote}
      </div>
      <div class="member-actions">
        <button type="button" class="icon-btn" data-action="edit" data-id="${member.id}" aria-label="Sửa">✏️</button>
        <button type="button" class="icon-btn bonus" data-action="bonus" data-id="${member.id}" aria-label="Lương thưởng">💎</button>
        <button type="button" class="icon-btn danger" data-action="delete" data-id="${member.id}" aria-label="Xóa">🗑️</button>
      </div>
    `;
    memberListEl.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ----------------------------------------------------------
   9. RENDER: BÁO CÁO LƯƠNG (danh sách + tổng, để chụp ảnh)
   ---------------------------------------------------------- */
function renderReport() {
  reportList.innerHTML = "";

  if (state.members.length === 0) {
    reportEmpty.style.display = "block";
  } else {
    reportEmpty.style.display = "none";
    state.members.forEach((member, index) => {
      const total = getMemberTotal(member);
      const row = document.createElement("li");
      row.className = "report-row";
      row.innerHTML = `
        <span class="report-index">${index + 1}.</span>
        <span class="report-name">${escapeHtml(member.name)}</span>
        <span class="report-sep">|</span>
        <span class="report-rank">Rank ${member.rank} — ${getRankLabel(member.rank)}</span>
        <span class="report-salary">${formatCredits(total)}</span>
      `;
      reportList.appendChild(row);
    });
  }

  reportTotal.textContent = "Tổng : " + formatCredits(calcTotalSalary());
}

/* ----------------------------------------------------------
   10. CALCULATION
   ---------------------------------------------------------- */
function getMemberTotal(member) {
  return getRankSalary(member.rank) + (member.bonus || 0);
}

function calcTotalSalary() {
  return state.members.reduce((sum, m) => sum + getMemberTotal(m), 0);
}

function renderResults() {
  const total = calcTotalSalary();
  const remaining = state.fund - total;

  resFund.textContent = formatCredits(state.fund);
  resCount.textContent = state.members.length + " người";
  resTotal.textContent = formatCredits(total);

  resStatusCard.classList.remove("over");

  if (remaining > 0) {
    resStatusLabel.textContent = "🟢 Còn Dư";
    resRemaining.textContent = formatCredits(remaining);
  } else if (remaining === 0) {
    resStatusLabel.textContent = "🟢 Đã Sử Dụng Hết Quỹ";
    resRemaining.textContent = formatCredits(0);
  } else {
    resStatusCard.classList.add("over");
    resStatusLabel.textContent = "🔴 Vượt Quỹ";
    resRemaining.textContent = formatCredits(Math.abs(remaining));
  }
}

function renderAll() {
  renderMemberList();
  renderReport();
  renderResults();
}

/* ----------------------------------------------------------
   11. EVENTS — FUND
   ---------------------------------------------------------- */
fundInput.addEventListener("input", () => {
  state.fund = parseFundInput(fundInput.value);
  saveState();
  renderResults();
});

fundInput.addEventListener("blur", () => {
  fundInput.value = state.fund ? state.fund.toLocaleString("en-US") : "";
});

/* ----------------------------------------------------------
   12. EVENTS — ADD MEMBER
   ---------------------------------------------------------- */
memberRankSelect.addEventListener("change", () => {
  updateRankPreview(memberRankSelect, rankPreview);
});

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = memberNameInput.value.trim();
  const rank = Number(memberRankSelect.value);

  if (!name) {
    showToast("Vui lòng nhập tên thành viên", true);
    return;
  }

  state.members.push({ id: makeId(), name, rank });
  saveState();
  renderAll();

  addForm.reset();
  memberRankSelect.selectedIndex = 0;
  updateRankPreview(memberRankSelect, rankPreview);
  memberNameInput.focus();

  showToast("✅ Đã thêm thành viên");
});

/* ----------------------------------------------------------
   13. EVENTS — EDIT / DELETE (delegated on member list)
   ---------------------------------------------------------- */
memberListEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".icon-btn");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "edit") openEditModal(id);
  if (action === "bonus") openBonusModal(id);
  if (action === "delete") openDeleteModal(id);
});

/* --- BONUS MODAL --- */
function openBonusModal(id) {
  const member = state.members.find((m) => m.id === id);
  if (!member) return;

  bonusId.value = member.id;
  bonusMemberName.textContent = `${member.name} — ${getRankLabel(member.rank)}`;
  bonusAmount.value = member.bonus ? member.bonus.toLocaleString("en-US") : "";
  updateBonusPreview(member);

  bonusOverlay.classList.add("open");
  bonusAmount.focus();
}

function closeBonusModal() {
  bonusOverlay.classList.remove("open");
}

function updateBonusPreview(member) {
  const base = getRankSalary(member.rank);
  const bonusVal = parseFundInput(bonusAmount.value);
  bonusPreview.innerHTML = `
    <span>${formatCredits(base)} + ${formatCredits(bonusVal)} thưởng</span>
    <span class="bonus-preview-total">${formatCredits(base + bonusVal)}</span>
  `;
}

bonusAmount.addEventListener("input", () => {
  const member = state.members.find((m) => m.id === bonusId.value);
  if (member) updateBonusPreview(member);
});

bonusCancel.addEventListener("click", closeBonusModal);
bonusOverlay.addEventListener("click", (e) => {
  if (e.target === bonusOverlay) closeBonusModal();
});

bonusForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const member = state.members.find((m) => m.id === bonusId.value);
  if (!member) return;

  member.bonus = parseFundInput(bonusAmount.value);

  saveState();
  renderAll();
  closeBonusModal();
  showToast("✅ Đã ghi lương thưởng");
});

/* --- EDIT MODAL --- */
function openEditModal(id) {
  const member = state.members.find((m) => m.id === id);
  if (!member) return;

  editId.value = member.id;
  editName.value = member.name;
  editRank.value = member.rank;
  updateRankPreview(editRank, editRankPreview);

  editOverlay.classList.add("open");
}

function closeEditModal() {
  editOverlay.classList.remove("open");
}

editRank.addEventListener("change", () => {
  updateRankPreview(editRank, editRankPreview);
});

editCancel.addEventListener("click", closeEditModal);
editOverlay.addEventListener("click", (e) => {
  if (e.target === editOverlay) closeEditModal();
});

editForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = editId.value;
  const member = state.members.find((m) => m.id === id);
  if (!member) return;

  const newName = editName.value.trim();
  if (!newName) {
    showToast("Vui lòng nhập tên thành viên", true);
    return;
  }

  member.name = newName;
  member.rank = Number(editRank.value);

  saveState();
  renderAll();
  closeEditModal();
  showToast("✅ Đã cập nhật thành viên");
});

/* --- DELETE MODAL --- */
function openDeleteModal(id) {
  pendingDeleteId = id;
  deleteOverlay.classList.add("open");
}

function closeDeleteModal() {
  pendingDeleteId = null;
  deleteOverlay.classList.remove("open");
}

deleteCancel.addEventListener("click", closeDeleteModal);
deleteOverlay.addEventListener("click", (e) => {
  if (e.target === deleteOverlay) closeDeleteModal();
});

deleteConfirm.addEventListener("click", () => {
  if (!pendingDeleteId) return;
  state.members = state.members.filter((m) => m.id !== pendingDeleteId);
  saveState();
  renderAll();
  closeDeleteModal();
  showToast("🗑️ Đã xóa thành viên");
});

/* ----------------------------------------------------------
   14. EVENTS — CALCULATE
   ---------------------------------------------------------- */
calcBtn.addEventListener("click", () => {
  renderAll();
  showToast("✅ Đã tính lương");
  document.getElementById("panel-calc").scrollIntoView({ behavior: "smooth", block: "start" });
});

/* ----------------------------------------------------------
   15. INIT
   ---------------------------------------------------------- */
function init() {
  loadState();
  buildRankOptions(memberRankSelect);
  buildRankOptions(editRank);
  updateRankPreview(memberRankSelect, rankPreview);

  fundInput.value = state.fund ? state.fund.toLocaleString("en-US") : "";

  renderAll();
}

init();
