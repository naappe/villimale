// ============================================
// MDP TRACKER - SPECIFIC LOGIC
// ============================================

// ============================================
// CONFIG
// ============================================
const PARTY_NAME = 'MDP';
const PARTY_CONFIG = getPartyConfig(PARTY_NAME);
const PARTY_PASSWORD = PARTY_CONFIG ? PARTY_CONFIG.password : 'mdp2024';
const PARTY_COLOR = PARTY_CONFIG ? PARTY_CONFIG.color : '#f5a623';

let allVoters = [];
let filteredVoters = [];
let selectedVoterId = null;
let target = parseInt(localStorage.getItem('mdpReachTarget')) || 100;
let currentPage = 1;
const pageSize = 25;

// ============================================
// DOM ELEMENTS
// ============================================
const voterGrid = document.getElementById('voterGrid');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const houseFilter = document.getElementById('houseFilter');
const applyBtn = document.getElementById('applyBtn');
const resetBtn = document.getElementById('resetBtn');
const filterCount = document.getElementById('filterCount');
const exportBtn = document.getElementById('exportBtn');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

const topHousesGrid = document.getElementById('topHousesGrid');
const topHousesCount = document.getElementById('topHousesCount');

const miniTotal = document.getElementById('miniTotal');
const miniReached = document.getElementById('miniReached');
const miniWillVote = document.getElementById('miniWillVote');
const miniPending = document.getElementById('miniPending');

const dashReached = document.getElementById('dashReached');
const dashReachedPercent = document.getElementById('dashReachedPercent');
const dashNotReached = document.getElementById('dashNotReached');
const dashWillVote = document.getElementById('dashWillVote');
const dashNotVote = document.getElementById('dashNotVote');
const dashPending = document.getElementById('dashPending');

const targetBar = document.getElementById('targetBar');
const targetPercent = document.getElementById('targetPercent');
const targetInput = document.getElementById('targetInput');
const setTargetBtn = document.getElementById('setTargetBtn');
const targetNeed = document.getElementById('targetNeed');

// Password
const passwordOverlay = document.getElementById('passwordOverlay');
const passwordForm = document.getElementById('passwordForm');
const passwordInput = document.getElementById('passwordInput');
const passwordError = document.getElementById('passwordError');
const rememberMe = document.getElementById('rememberMe');
const mainApp = document.getElementById('mainApp');

// Popup
const popupOverlay = document.getElementById('popupOverlay');
const popupClose = document.getElementById('popupClose');
const btnClosePopup = document.getElementById('btnClosePopup');
const popupPhoto = document.getElementById('popupPhoto');
const popupName = document.getElementById('popupName');
const popupId = document.getElementById('popupId');
const popupHouse = document.getElementById('popupHouse');
const popupPhone = document.getElementById('popupPhone');
const popupAge = document.getElementById('popupAge');
const popupSex = document.getElementById('popupSex');
const popupPhoneInput = document.getElementById('popupPhoneInput');
const popupReachStatus = document.getElementById('popupReachStatus');
const popupVoteStatus = document.getElementById('popupVoteStatus');
const popupRemarks = document.getElementById('popupRemarks');
const popupForm = document.getElementById('popupForm');

// ============================================
// PASSWORD CHECK
// ============================================
function checkPasswordSession() {
    return localStorage.getItem('mdpSession') === 'true';
}

function savePasswordSession() {
    localStorage.setItem('mdpSession', 'true');
}

if (checkPasswordSession()) {
    passwordOverlay.classList.add('hidden');
    mainApp.style.display = 'block';
    loadMDPData();
}

passwordForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const entered = passwordInput.value.trim();

    if (entered === PARTY_PASSWORD) {
        if (rememberMe && rememberMe.checked) {
            savePasswordSession();
        }
        passwordOverlay.classList.add('hidden');
        mainApp.style.display = 'block';
        passwordError.style.display = 'none';
        loadMDPData();
    } else {
        passwordError.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
    }
});

// ============================================
// LOAD MDP DATA
// ============================================
async function loadMDPData() {
    voterGrid.innerHTML = '<div class="loading-state">Loading MDP voters...</div>';

    const voters = await fetchPartyVoters(PARTY_NAME);
    if (voters) {
        allVoters = voters;
        filteredVoters = [...allVoters];
        updateUI();
    }
}

// ============================================
// UPDATE UI
// ============================================
function updateUI() {
    populateHouseFilter(allVoters);
    renderTopHouses(allVoters);
    updateStats(allVoters);
    renderGrid(filteredVoters);
    updatePagination();
}

// ============================================
// RENDER TOP HOUSES
// ============================================
function renderTopHouses(voters) {
    const top = getTopHouses(voters);

    if (top.length === 0) {
        topHousesGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#888; padding:8px; font-size:12px;">No houses found</div>';
        topHousesCount.textContent = '';
        return;
    }

    topHousesCount.textContent = `(${top.length})`;

    let html = '';
    top.forEach(([house, count], index) => {
        const medals = ['🥇', '🥈', '🥉'];
        const medal = index < 3 ? medals[index] : `#${index + 1}`;
        html += `
            <div class="top-house-item" onclick="filterByHouse('${house.replace(/'/g, "\\'")}')">
                <span>${medal} ${house}</span>
                <span class="count">${count}</span>
            </div>
        `;
    });

    topHousesGrid.innerHTML = html;
}

// ============================================
// POPULATE HOUSE FILTER
// ============================================
function populateHouseFilter(voters) {
    const houses = getHouseOptions(voters);
    houseFilter.innerHTML = '<option value="">All Houses</option>';
    houses.forEach(h => {
        const option = document.createElement('option');
        option.value = h;
        option.textContent = h;
        houseFilter.appendChild(option);
    });
}

// ============================================
// UPDATE STATS
// ============================================
function updateStats(voters) {
    const stats = calculateStats(voters);

    miniTotal.textContent = stats.total;
    miniReached.textContent = stats.reached;
    miniWillVote.textContent = stats.willVote;
    miniPending.textContent = stats.pending;

    dashReached.textContent = stats.reached;
    const reachedPercent = target > 0 ? Math.round((stats.reached / target) * 100) : 0;
    dashReachedPercent.textContent = reachedPercent + '% of target';
    dashNotReached.textContent = stats.notReached;
    dashWillVote.textContent = stats.willVote;
    dashNotVote.textContent = stats.notVote;
    dashPending.textContent = stats.pending;

    updateTargetProgress(stats);
    createStatusChart(document.getElementById('statusChart').getContext('2d'), voters);
    renderTopHouses(voters);
}

// ============================================
// UPDATE TARGET PROGRESS
// ============================================
function updateTargetProgress(stats) {
    const progress = target > 0 ? Math.min((stats.reached / target) * 100, 100) : 0;

    targetBar.style.width = progress + '%';
    targetPercent.textContent = Math.round(progress) + '%';

    const need = Math.max(target - stats.reached, 0);
    targetNeed.textContent = need;

    if (progress >= 100) {
        targetBar.className = 'bar over';
    } else {
        targetBar.className = 'bar';
    }

    targetInput.value = target;
}

// ============================================
// RENDER GRID
// ============================================
function renderGrid(voters) {
    const totalPages = Math.max(1, Math.ceil(voters.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, voters.length);
    const pageVoters = voters.slice(start, end);

    if (pageVoters.length === 0) {
        voterGrid.innerHTML = `<div class="no-results"><i class="fas fa-search"></i>No voters found</div>`;
        filterCount.innerHTML = 'Showing <strong>0</strong>';
        return;
    }

    let html = '';
    pageVoters.forEach(v => {
        const photoUrl = v.photo_url || '';
        const voteStatus = v.vote_status || 'pending';
        const statusLabel = voteStatus === 'will-vote' ? 'Will Vote' :
            voteStatus === 'not-vote' ? 'Not Vote' : 'Pending';
        const address = [v.house, v.lives_in].filter(Boolean).join(', ') || 'N/A';
        const remarks = v.remarks || '';

        html += `
            <div class="voter-card" onclick="openPopup(${v.id})">
                <div class="photo">
                    ${photoUrl ? 
                        `<img src="${photoUrl}" alt="${v.name}" loading="lazy" 
                              onerror="this.style.display='none'; this.parentElement.innerHTML='<span class=\\'no-photo\\'>📷</span>';" />` :
                        '<span class="no-photo">📷</span>'
                    }
                </div>
                <div class="status-bar ${voteStatus}">${statusLabel}</div>
                <div class="info">
                    <div class="name">${v.name || 'Unknown'}</div>
                    <div class="address">📍 ${address}</div>
                    <div class="id">🆔 ${v.national_id || 'N/A'}</div>
                    <div class="details">
                        <span><i class="fas fa-phone"></i> ${v.phone || 'N/A'}</span>
                        <span><i class="fas fa-calendar-alt"></i> ${v.age || 'N/A'}</span>
                        <span><i class="fas fa-venus-mars"></i> ${v.sex || 'N/A'}</span>
                    </div>
                    ${remarks ? `<div class="remarks"><i class="fas fa-comment"></i> ${remarks}</div>` : ''}
                </div>
            </div>
        `;
    });

    voterGrid.innerHTML = html;
    filterCount.innerHTML = `Showing <strong>${voters.length}</strong>`;
    updatePagination();
}

// ============================================
// UPDATE PAGINATION
// ============================================
function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(filteredVoters.length / pageSize));
    prevPage.disabled = currentPage <= 1;
    nextPage.disabled = currentPage >= totalPages;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

// ============================================
// FILTER VOTERS
// ============================================
function filterVoters() {
    const search = searchInput.value.trim();
    const status = statusFilter.value;
    const house = houseFilter.value;

    filteredVoters = filterVotersList(allVoters, search, status, house);
    currentPage = 1;
    renderGrid(filteredVoters);
    updateStats(filteredVoters);
    updateActiveCard(status);
}

// ============================================
// UPDATE ACTIVE CARD
// ============================================
function updateActiveCard(status) {
    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
    if (status) {
        document.querySelector(`.stat-card[data-filter="${status}"]`)?.classList.add('active');
    }
}

// ============================================
// BACK TO ALL
// ============================================
function backToAll() {
    searchInput.value = '';
    statusFilter.value = '';
    houseFilter.value = '';
    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
    filteredVoters = [...allVoters];
    currentPage = 1;
    renderGrid(filteredVoters);
    updateStats(filteredVoters);
}

// ============================================
// FILTER BY STATUS (Card Click)
// ============================================
window.filterByStatus = function(status) {
    statusFilter.value = status;
    filterVoters();
};

// ============================================
// FILTER BY HOUSE (Top Houses Click)
// ============================================
window.filterByHouse = function(house) {
    houseFilter.value = house;
    filterVoters();
};

// ============================================
// SET TARGET
// ============================================
function setTarget() {
    const val = parseInt(targetInput.value);
    if (val > 0 && val <= allVoters.length) {
        target = val;
        localStorage.setItem('mdpReachTarget', target);
        updateStats(filteredVoters);
    } else {
        alert(`Enter between 1 and ${allVoters.length}`);
    }
}

// ============================================
// OPEN POPUP
// ============================================
function openPopup(id) {
    const voter = allVoters.find(v => v.id === id);
    if (!voter) return;

    selectedVoterId = id;

    const photoUrl = voter.photo_url || '';
    if (photoUrl) {
        popupPhoto.innerHTML = `<img src="${photoUrl}" alt="${voter.name}" 
                                  onerror="this.style.display='none'; this.parentElement.innerHTML='<span class=\\'placeholder\\'>📷</span>';" />`;
    } else {
        popupPhoto.innerHTML = '<span class="placeholder">📷</span>';
    }

    popupName.textContent = voter.name || 'Unknown';
    popupId.textContent = '🆔 ' + (voter.national_id || 'N/A');
    popupHouse.textContent = voter.house || 'N/A';
    popupPhone.textContent = voter.phone || 'N/A';
    popupAge.textContent = voter.age || 'N/A';
    popupSex.textContent = voter.sex || 'N/A';

    popupPhoneInput.value = '';
    popupReachStatus.value = voter.reach_status || 'not-reached';
    popupVoteStatus.value = voter.vote_status || 'pending';
    popupRemarks.value = voter.remarks || '';

    popupOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ============================================
// CLOSE POPUP
// ============================================
function closePopup() {
    popupOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
    selectedVoterId = null;
}

// ============================================
// SAVE POPUP
// ============================================
async function savePopup(e) {
    e.preventDefault();
    if (selectedVoterId === null) return;

    const phone = popupPhoneInput.value.trim();
    const reach_status = popupReachStatus.value;
    const vote_status = popupVoteStatus.value;
    const remarks = popupRemarks.value.trim();

    const updateData = {};
    if (phone) updateData.phone = phone;
    updateData.reach_status = reach_status;
    updateData.vote_status = vote_status;
    if (remarks) updateData.remarks = remarks;

    const result = await updateVoter(PARTY_NAME, selectedVoterId, updateData);

    if (result) {
        const voter = allVoters.find(v => v.id === selectedVoterId);
        if (voter) {
            if (phone) voter.phone = phone;
            voter.reach_status = reach_status;
            voter.vote_status = vote_status;
            if (remarks) voter.remarks = remarks;
        }

        renderGrid(filteredVoters);
        updateStats(filteredVoters);
        closePopup();

        const msg = document.createElement('div');
        msg.style.cssText =
            'position:fixed;bottom:20px;right:20px;background:#2ecc71;color:white;padding:8px 20px;border-radius:10px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(46,204,113,0.3);';
        msg.innerHTML = '✅ Updated!';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 2000);
    } else {
        alert('❌ Failed to save');
    }
}

// ============================================
// EXPORT DATA
// ============================================
function exportData() {
    exportVotersToCSV(filteredVoters, 'MDP');
}

// ============================================
// EVENT LISTENERS
// ============================================
applyBtn.addEventListener('click', filterVoters);
resetBtn.addEventListener('click', backToAll);
exportBtn.addEventListener('click', exportData);

searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') filterVoters();
    if (e.target.value.trim() === '') backToAll();
});

statusFilter.addEventListener('change', filterVoters);
houseFilter.addEventListener('change', filterVoters);

prevPage.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderGrid(filteredVoters); }
});

nextPage.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredVoters.length / pageSize);
    if (currentPage < totalPages) { currentPage++; renderGrid(filteredVoters); }
});

setTargetBtn.addEventListener('click', setTarget);
targetInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') setTarget();
});

popupClose.addEventListener('click', closePopup);
btnClosePopup.addEventListener('click', closePopup);
popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) closePopup();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopup();
});

popupForm.addEventListener('submit', savePopup);

// ============================================
// EXPOSE TO GLOBAL
// ============================================
window.openPopup = openPopup;
window.closePopup = closePopup;
window.filterByStatus = filterByStatus;
window.filterByHouse = filterByHouse;

// ============================================
// INIT
// ============================================
targetInput.value = target;
console.log('✅ MDP Tracker loaded');