// ============================================
// CONFIG VALUES (from config.js)
// ============================================
const SUPABASE_URL = window.SUPABASE_CONFIG ? window.SUPABASE_CONFIG.url : 'https://espezmdpkoixnfchomqb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = window.SUPABASE_CONFIG ? window.SUPABASE_CONFIG.publishableKey : 'sb_publishable_xP8z74zcMuCkj6xlu1bJ3w_Kudqbcu1';
const PARTY_AUTH = window.PARTY_AUTH || {};
const PARTY_VOTER_COUNTS = window.PARTY_VOTER_COUNTS || {};

// ============================================
// INIT SUPABASE
// ============================================
if (typeof supabase === 'undefined') {
    document.getElementById('voterList').innerHTML =
        '<div class="error-box">❌ Supabase library failed to load.</div>';
    throw new Error('Supabase library failed to load');
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// ============================================
// HELPER: Normalize Sex
// ============================================
function normalizeSex(value) {
    if (!value) return '';
    const upper = value.toUpperCase();
    if (upper === 'M' || upper === 'MALE') return 'Male';
    if (upper === 'F' || upper === 'FEMALE') return 'Female';
    if (upper === 'O' || upper === 'OTHER') return 'Other';
    return value;
}

// ============================================
// STATE
// ============================================
let allVoters = [];
let filteredVoters = [];
let currentPage = 1;
const pageSize = 25;
let galleryPage = 1;
const galleryPageSize = 30;
let topHousesCollapsed = false;
let isLoading = false;
let ageChartInstance = null;
let selectedParty = null;
let selectedPartyColor = '#f5a623';
let selectedPartyData = null;

// ============================================
// DOM ELEMENTS
// ============================================
const partySelection = document.getElementById('partySelection');
const partyPasswordOverlay = document.getElementById('partyPasswordOverlay');
const partyPasswordForm = document.getElementById('partyPasswordForm');
const partyPasswordInput = document.getElementById('partyPasswordInput');
const partyPasswordError = document.getElementById('partyPasswordError');
const partyPasswordName = document.getElementById('partyPasswordName');
const partyPasswordTitle = document.getElementById('partyPasswordTitle');
const partyPasswordIcon = document.getElementById('partyPasswordIcon');
const partyRememberMe = document.getElementById('partyRememberMe');
const backToParties = document.getElementById('backToParties');

const mainApp = document.getElementById('mainApp');
const mainNavbar = document.getElementById('mainNavbar');
const partyLogo = document.getElementById('partyLogo');
const activePartyBadge = document.getElementById('activePartyBadge');
const activePartyCount = document.getElementById('activePartyCount');

const voterList = document.getElementById('voterList');
const searchInput = document.getElementById('searchInput');
const sexFilter = document.getElementById('sexFilter');
const partyFilter = document.getElementById('partyFilter');
const houseFilter = document.getElementById('houseFilter');
const ageRangeFilter = document.getElementById('ageRangeFilter');
const resetBtn = document.getElementById('resetBtn');
const filterChips = document.getElementById('filterChips');

const totalVoters = document.getElementById('totalVoters');
const maleCount = document.getElementById('maleCount');
const femaleCount = document.getElementById('femaleCount');
const partyCount = document.getElementById('partyCount');
const avgAge = document.getElementById('avgAge');
const houseCount = document.getElementById('houseCount');
const navCount = document.getElementById('navCount');
const voterCountDisplay = document.getElementById('voterCountDisplay');

const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

const topHouses = document.getElementById('topHouses');
const topHousesCount = document.getElementById('topHousesCount');
const topHousesToggle = document.getElementById('topHousesToggle');

const voterPopup = document.getElementById('voterPopup');
const voterPopupContent = document.getElementById('voterPopupContent');
const voterPopupClose = document.getElementById('voterPopupClose');

const gallerySection = document.getElementById('gallerySection');
const photoGrid = document.getElementById('photoGrid');
const galleryCount = document.getElementById('galleryCount');
const galleryPrev = document.getElementById('galleryPrev');
const galleryNext = document.getElementById('galleryNext');
const galleryPageInfo = document.getElementById('galleryPageInfo');
const listViewBtn = document.getElementById('listViewBtn');
const galleryViewBtn = document.getElementById('galleryViewBtn');

const editPopup = document.getElementById('editPopup');
const editPopupClose = document.getElementById('editPopupClose');
const editForm = document.getElementById('editForm');
const editId = document.getElementById('editId');
const editName = document.getElementById('editName');
const editNationalId = document.getElementById('editNationalId');
const editHouse = document.getElementById('editHouse');
const editLivesIn = document.getElementById('editLivesIn');
const editPhone = document.getElementById('editPhone');
const editSex = document.getElementById('editSex');
const editAge = document.getElementById('editAge');
const editParty = document.getElementById('editParty');
const logoutBtn = document.getElementById('logoutBtn');

// ============================================
// ===== PARTY SESSION MANAGEMENT =====
// ============================================
function savePartySession(party) {
    localStorage.setItem('partySession', JSON.stringify({
        party: party,
        timestamp: Date.now()
    }));
}

function clearPartySession() {
    localStorage.removeItem('partySession');
}

function checkPartySession() {
    const sessionData = localStorage.getItem('partySession');
    if (sessionData) {
        try {
            const session = JSON.parse(sessionData);
            const sessionAge = Date.now() - session.timestamp;
            const maxAge = 24 * 60 * 60 * 1000;
            if (sessionAge < maxAge) {
                return session.party;
            } else {
                clearPartySession();
                return null;
            }
        } catch (e) {
            clearPartySession();
            return null;
        }
    }
    return null;
}

// ============================================
// ===== PARTY AUTHENTICATION =====
// ============================================
function selectParty(party) {
    const auth = PARTY_AUTH[party];
    if (!auth) {
        alert('Party not found');
        return;
    }

    selectedParty = party;
    selectedPartyData = auth;
    selectedPartyColor = auth.color;

    // Update password overlay with party colors
    partyPasswordIcon.style.color = auth.color;
    partyPasswordName.textContent = party;
    partyPasswordTitle.textContent = auth.shortName + ' Access';

    // Show password overlay
    partyPasswordOverlay.classList.add('active');
    partyPasswordInput.value = '';
    partyPasswordError.style.display = 'none';
    partyPasswordInput.focus();

    // Store selected party for password verification
    partyPasswordOverlay.dataset.party = party;
    partyPasswordOverlay.dataset.password = auth.password;
}

// Password form submission
partyPasswordForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const entered = partyPasswordInput.value.trim();
    const expected = partyPasswordOverlay.dataset.password;
    const party = partyPasswordOverlay.dataset.party;

    if (entered === expected) {
        partyPasswordOverlay.classList.remove('active');
        partyPasswordError.style.display = 'none';

        if (partyRememberMe && partyRememberMe.checked) {
            savePartySession(party);
        }

        // Show main app
        mainApp.style.display = 'block';
        partySelection.classList.add('hidden');

        // Update navbar with party info
        updatePartyUI(party);

        // Load voters for this party
        fetchPartyVoters(party);

    } else {
        partyPasswordError.style.display = 'block';
        partyPasswordInput.value = '';
        partyPasswordInput.focus();
    }
});

// Back to parties
backToParties.addEventListener('click', function() {
    partyPasswordOverlay.classList.remove('active');
    partySelection.classList.remove('hidden');
});

// ============================================
// ===== UPDATE PARTY UI =====
// ============================================
function updatePartyUI(party) {
    const auth = PARTY_AUTH[party];
    if (!auth) return;

    const color = auth.color;
    const lightColor = auth.lightColor || '#f5f5f5';

    // Update navbar
    const logo = document.querySelector('.navbar .logo');
    logo.style.color = color;
    logo.querySelector('i').style.color = color;

    // Update party indicator
    activePartyBadge.textContent = auth.shortName;
    activePartyBadge.style.color = color;

    const count = PARTY_VOTER_COUNTS[party] || 0;
    activePartyCount.textContent = count.toLocaleString() + ' voters';

    // Update navbar border with party color
    document.querySelector('.navbar').style.borderBottom = `2px solid ${color}`;

    // Update password icon color
    partyPasswordIcon.style.color = color;

    // Update stat items with party color
    document.querySelectorAll('.stat-item').forEach(el => {
        el.style.borderLeftColor = color;
    });

    // Update view toggle buttons
    document.querySelectorAll('.view-toggle-btn.active').forEach(el => {
        el.style.background = color;
        el.style.color = '#1a1a2e';
    });
}

// ============================================
// ===== CHECK SESSION ON LOAD =====
// ============================================
function checkSession() {
    const savedParty = checkPartySession();
    if (savedParty && PARTY_AUTH[savedParty]) {
        // Auto-login to party
        partySelection.classList.add('hidden');
        mainApp.style.display = 'block';
        updatePartyUI(savedParty);
        fetchPartyVoters(savedParty);
        return true;
    }
    return false;
}

// ============================================
// ===== FETCH PARTY VOTERS =====
// ============================================
async function fetchPartyVoters(party) {
    selectedParty = party;
    const auth = PARTY_AUTH[party];
    selectedPartyColor = auth ? auth.color : '#f5a623';
    selectedPartyData = auth;

    voterList.innerHTML = '<div class="loading-state">Loading voters...</div>';

    try {
        const { data, error } = await supabaseClient
            .from('full_import')
            .select('*')
            .ilike('party', party)
            .order('image_number', { ascending: true });

        if (error) throw error;

        allVoters = data || [];
        filteredVoters = [...allVoters];

        // Update party filter to show only current party
        partyFilter.innerHTML = `<option value="${party}" selected>${party}</option>`;

        populateFilters(allVoters);
        renderTopHouses(allVoters);
        updateStats(allVoters);
        renderAgeAnalytics(allVoters);
        renderList(filteredVoters);

        if (gallerySection.style.display !== 'none') {
            galleryPage = 1;
            renderGallery(filteredVoters);
        }

        // Update voter count in navbar
        const count = allVoters.length;
        activePartyCount.textContent = count.toLocaleString() + ' voters';

    } catch (error) {
        console.error('Error:', error);
        voterList.innerHTML =
            `<div class="error-box">❌ Failed to load voters.<br /><small>${error.message}</small></div>`;
    }
}

// ============================================
// ===== LOGOUT =====
// ============================================
logoutBtn.addEventListener('click', function() {
    clearPartySession();
    mainApp.style.display = 'none';
    partySelection.classList.remove('hidden');
    partyPasswordOverlay.classList.remove('active');
    selectedParty = null;
    selectedPartyData = null;

    // Reset navbar
    const logo = document.querySelector('.navbar .logo');
    logo.style.color = '';
    logo.querySelector('i').style.color = '';
    document.querySelector('.navbar').style.borderBottom = '';

    console.log('🔐 Logged out from party');
});

// ============================================
// ===== REST OF FUNCTIONS =====
// ============================================

// HAMBURGER MENU
document.getElementById('hamburger').addEventListener('click', function() {
    document.getElementById('navLinks').classList.toggle('open');
});

// TOP HOUSES COLLAPSIBLE
topHousesToggle.addEventListener('click', function() {
    topHousesCollapsed = !topHousesCollapsed;
    const grid = document.querySelector('.top-houses-grid');
    const icon = document.querySelector('.toggle-icon');
    if (grid) grid.classList.toggle('collapsed');
    if (icon) icon.classList.toggle('collapsed');
});

// POPUP CONTROLS
function closePopup() {
    voterPopup.style.display = 'none';
    document.body.style.overflow = 'auto';
}

voterPopupClose.addEventListener('click', closePopup);
voterPopup.addEventListener('click', function(e) {
    if (e.target === this) closePopup();
});
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closePopup();
});

// EDIT POPUP CONTROLS
editPopupClose.addEventListener('click', function() {
    editPopup.style.display = 'none';
});
editPopup.addEventListener('click', function(e) {
    if (e.target === this) {
        editPopup.style.display = 'none';
    }
});

// ============================================
// POPULATE FILTERS
// ============================================
function populateFilters(voters) {
    if (selectedParty) {
        partyFilter.innerHTML = `<option value="${selectedParty}" selected>${selectedParty}</option>`;
    }

    const houses = [...new Set(voters.map(v => v.house).filter(Boolean))].sort();
    houseFilter.innerHTML = '<option value="">All Houses</option>';
    houses.forEach(h => {
        const option = document.createElement('option');
        option.value = h;
        option.textContent = h;
        houseFilter.appendChild(option);
    });

    renderFilterChips(voters);
}

// ============================================
// RENDER FILTER CHIPS
// ============================================
function renderFilterChips(voters) {
    const chips = [];

    const males = voters.filter(v => normalizeSex(v.sex) === 'Male').length;
    const females = voters.filter(v => normalizeSex(v.sex) === 'Female').length;
    if (males > 0) chips.push({ label: `👨 Male (${males})`, value: 'sex:Male', type: 'sex' });
    if (females > 0) chips.push({ label: `👩 Female (${females})`, value: 'sex:Female', type: 'sex' });

    if (selectedParty) {
        const count = voters.length;
        chips.push({ label: `🏛️ ${selectedParty} (${count})`, value: `party:${selectedParty}`, type: 'party' });
    }

    filterChips.innerHTML = chips.map(chip => `
        <span class="filter-chip" data-value="${chip.value}" data-type="${chip.type}">
            ${chip.label}
        </span>
    `).join('');

    document.querySelectorAll('.filter-chip').forEach(el => {
        el.addEventListener('click', function() {
            const [type, value] = this.dataset.value.split(':');
            applyFilterChip(type, value);
        });
    });
}

// ============================================
// APPLY FILTER CHIP
// ============================================
function applyFilterChip(type, value) {
    if (type === 'sex') sexFilter.value = value;
    else if (type === 'party') partyFilter.value = value;
    else if (type === 'age') {
        ageRangeFilter.value = value;
    }
    filterVoters();
    document.querySelectorAll('.filter-chip').forEach(el => {
        el.classList.toggle('active', el.dataset.value === `${type}:${value}`);
    });
}

// ============================================
// UPDATE STATS
// ============================================
function updateStats(voters) {
    const total = voters.length;
    const males = voters.filter(v => normalizeSex(v.sex) === 'Male').length;
    const females = voters.filter(v => normalizeSex(v.sex) === 'Female').length;
    const parties = selectedParty ? [selectedParty] : [...new Set(voters.map(v => v.party).filter(Boolean))];
    const houses = [...new Set(voters.map(v => v.house).filter(Boolean))];
    const ages = voters.map(v => parseInt(v.age)).filter(a => a > 0 && a < 120);
    const avg = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;

    totalVoters.textContent = total;
    maleCount.textContent = males;
    femaleCount.textContent = females;
    partyCount.textContent = parties.length;
    avgAge.textContent = avg;
    houseCount.textContent = houses.length;
    navCount.textContent = total;
}

// ============================================
// RENDER AGE ANALYTICS
// ============================================
function renderAgeAnalytics(voters) {
    const ageGroups = {
        '18-24': 0,
        '25-34': 0,
        '35-44': 0,
        '45-54': 0,
        '55-64': 0,
        '65+': 0
    };

    voters.forEach(v => {
        const age = parseInt(v.age);
        if (isNaN(age) || age < 18) return;
        if (age >= 18 && age <= 24) ageGroups['18-24']++;
        else if (age >= 25 && age <= 34) ageGroups['25-34']++;
        else if (age >= 35 && age <= 44) ageGroups['35-44']++;
        else if (age >= 45 && age <= 54) ageGroups['45-54']++;
        else if (age >= 55 && age <= 64) ageGroups['55-64']++;
        else if (age >= 65) ageGroups['65+']++;
    });

    const total = voters.length;
    const withAge = Object.values(ageGroups).reduce((a, b) => a + b, 0);
    const withoutAge = total - withAge;

    const ctx = document.getElementById('ageChart').getContext('2d');
    if (ageChartInstance) ageChartInstance.destroy();

    const labels = Object.keys(ageGroups);
    const data = Object.values(ageGroups);
    const colors = ['#4a90d9', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c'];

    ageChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Voters by Age',
                data: data,
                backgroundColor: colors.map(c => c + '80'),
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.parsed.y / total) * 100).toFixed(1) : 0;
                            return `${context.parsed.y} voters (${percentage}%)`;
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    const ageRangeStats = document.getElementById('ageRangeStats');
    let statsHtml = `
        <div class="age-stats-grid">
            <div class="age-stat-item">
                <span class="age-stat-number">${total}</span>
                <span class="age-stat-label">Total Voters</span>
            </div>
            <div class="age-stat-item">
                <span class="age-stat-number">${withAge}</span>
                <span class="age-stat-label">With Age</span>
            </div>
            <div class="age-stat-item">
                <span class="age-stat-number">${withoutAge}</span>
                <span class="age-stat-label">No Age</span>
            </div>
            <div class="age-stat-item">
                <span class="age-stat-number">${Object.keys(ageGroups).filter(k => ageGroups[k] > 0).length}</span>
                <span class="age-stat-label">Age Groups</span>
            </div>
        </div>
    `;

    let breakdownHtml = '<div class="age-breakdown">';
    Object.entries(ageGroups).forEach(([group, count]) => {
        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        breakdownHtml += `
            <div class="age-breakdown-item">
                <span class="age-group-label">${group}</span>
                <div class="age-bar-wrapper">
                    <div class="age-bar" style="width: ${percentage}%; background: ${colors[Object.keys(ageGroups).indexOf(group)]};"></div>
                </div>
                <span class="age-group-count">${count} (${percentage}%)</span>
            </div>
        `;
    });
    breakdownHtml += '</div>';

    ageRangeStats.innerHTML = statsHtml + breakdownHtml;
}

// ============================================
// RENDER TOP HOUSES
// ============================================
function renderTopHouses(voters) {
    const houseCounts = {};
    voters.forEach(v => {
        if (v.house) {
            houseCounts[v.house] = (houseCounts[v.house] || 0) + 1;
        }
    });

    const top = Object.entries(houseCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    topHousesCount.textContent = `(${top.length})`;

    if (top.length === 0) {
        topHouses.innerHTML = '<div class="no-results">No houses found</div>';
        return;
    }

    let html = '';
    top.forEach(([house, count], index) => {
        const medals = ['🥇', '🥈', '🥉'];
        const medal = index < 3 ? medals[index] : `#${index + 1}`;
        html += `
            <div class="top-house" data-house="${house}">
                <span class="house-name">${medal} ${house}</span>
                <span class="house-count">${count}</span>
            </div>
        `;
    });

    topHouses.innerHTML = html;

    document.querySelectorAll('.top-house').forEach(el => {
        el.addEventListener('click', function() {
            houseFilter.value = this.dataset.house;
            filterVoters();
        });
    });
}

// ============================================
// SHOW VOTER POPUP
// ============================================
function showVoterPopup(voter) {
    if (!voter) return;
    document.body.style.overflow = 'hidden';

    const photoUrl = voter.photo_url || '';
    const sexDisplay = normalizeSex(voter.sex);
    const partyClass = (voter.party || '').toLowerCase();
    const address = [voter.house, voter.lives_in].filter(Boolean).join(', ') || 'N/A';

    window.currentVoterId = voter.id;
    window.currentHouse = voter.house;

    voterPopupContent.innerHTML = `
        <div class="popup-photo">
            ${photoUrl ? 
                `<img src="${photoUrl}" alt="${voter.name}" 
                      onerror="this.style.display='none'; this.parentElement.querySelector('.placeholder').style.display='flex';" />` :
                ''
            }
            <div class="placeholder" style="${photoUrl ? 'display:none;' : 'display:flex;'} align-items:center; justify-content:center; width:100%; height:100%;">
                📷
            </div>
        </div>

        <div class="popup-name">${voter.name || 'Unknown'}</div>
        <div class="popup-id">🆔 ${voter.national_id || 'N/A'}</div>

        <div class="popup-address">
            <div class="address-label">📍 Address</div>
            <div class="address-value">${address}</div>
        </div>

        <div class="popup-details">
            <span class="label">Age</span>
            <span class="value">${voter.age || 'N/A'}</span>
            <span class="label">Sex</span>
            <span class="value">${sexDisplay}</span>
            <span class="label">Phone</span>
            <span class="value">${voter.phone || 'N/A'}</span>
            <span class="label">Party</span>
            <span class="value">${voter.party || 'N/A'}</span>
        </div>

        <form id="popupEditForm">
            <div class="form-group">
                <label><i class="fas fa-phone"></i> Phone</label>
                <input type="text" id="popupPhone" placeholder="Enter phone number..." value="${voter.phone || ''}" />
            </div>

            <div class="form-group">
                <label><i class="fas fa-check-circle"></i> Reach Status</label>
                <select id="popupReachStatus">
                    <option value="not-reached" ${voter.reach_status === 'reached' ? '' : 'selected'}>❌ Not Reached</option>
                    <option value="reached" ${voter.reach_status === 'reached' ? 'selected' : ''}>✅ Reached</option>
                </select>
            </div>

            <div class="form-group">
                <label><i class="fas fa-vote-yea"></i> Vote Status</label>
                <select id="popupVoteStatus">
                    <option value="pending" ${voter.vote_status === 'pending' || !voter.vote_status ? 'selected' : ''}>⏳ Pending</option>
                    <option value="will-vote" ${voter.vote_status === 'will-vote' ? 'selected' : ''}>🗳️ Will Vote</option>
                    <option value="not-vote" ${voter.vote_status === 'not-vote' ? 'selected' : ''}>❌ Not Vote</option>
                </select>
            </div>

            <div class="form-group">
                <label><i class="fas fa-comment"></i> Remarks</label>
                <textarea id="popupRemarks" placeholder="Add notes...">${voter.remarks || ''}</textarea>
            </div>

            <div class="popup-actions">
                <button type="submit" class="btn-save"><i class="fas fa-save"></i> Save & Go to House</button>
                <button type="button" class="btn-close" id="popupCloseBtn"><i class="fas fa-times"></i> Close</button>
            </div>
        </form>
    `;

    voterPopup.style.display = 'flex';

    document.getElementById('popupEditForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        const phone = document.getElementById('popupPhone').value.trim();
        const reach_status = document.getElementById('popupReachStatus').value;
        const vote_status = document.getElementById('popupVoteStatus').value;
        const remarks = document.getElementById('popupRemarks').value.trim();

        const updateData = {};
        if (phone) updateData.phone = phone;
        updateData.reach_status = reach_status;
        updateData.vote_status = vote_status;
        if (remarks) updateData.remarks = remarks;

        try {
            const { error } = await supabaseClient
                .from('full_import')
                .update(updateData)
                .eq('id', voter.id);

            if (error) throw error;

            const index = allVoters.findIndex(v => v.id === voter.id);
            if (index !== -1) {
                allVoters[index] = { ...allVoters[index], ...updateData };
            }

            filteredVoters = [...allVoters];
            renderList(filteredVoters);
            renderAgeAnalytics(filteredVoters);
            updateStats(filteredVoters);
            renderTopHouses(filteredVoters);

            if (gallerySection.style.display !== 'none') {
                renderGallery(filteredVoters);
            }

            voterPopup.style.display = 'none';
            document.body.style.overflow = 'auto';

            const msg = document.createElement('div');
            msg.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#2ecc71;color:white;padding:10px 24px;border-radius:10px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(46,204,113,0.3);';
            msg.innerHTML = '✅ Voter updated!';
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 2000);

            setTimeout(() => {
                if (window.currentHouse) {
                    houseFilter.value = window.currentHouse;
                    filterVoters();
                    document.querySelector('.voter-list-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 500);

        } catch (error) {
            console.error('Error updating voter:', error);
            alert('❌ Failed to update voter: ' + error.message);
        }
    });

    document.getElementById('popupCloseBtn').addEventListener('click', function() {
        voterPopup.style.display = 'none';
        document.body.style.overflow = 'auto';
    });
}

// ============================================
// OPEN EDIT POPUP
// ============================================
window.openEditPopup = function(id) {
    const voter = allVoters.find(v => v.id === id);
    if (!voter) return;

    editId.value = voter.id;
    editName.value = voter.name || '';
    editNationalId.value = voter.national_id || '';
    editHouse.value = voter.house || '';
    editLivesIn.value = voter.lives_in || '';
    editPhone.value = voter.phone || '';
    editSex.value = voter.sex || '';
    editAge.value = voter.age || '';
    editParty.value = voter.party || '';

    editPopup.style.display = 'flex';
    voterPopup.style.display = 'none';
};

// ============================================
// SAVE EDIT
// ============================================
editForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const id = parseInt(editId.value);
    const updatedData = {
        name: editName.value,
        national_id: editNationalId.value,
        house: editHouse.value,
        lives_in: editLivesIn.value,
        phone: editPhone.value,
        sex: editSex.value,
        age: parseInt(editAge.value) || null,
        party: editParty.value
    };

    try {
        const { error } = await supabaseClient
            .from('full_import')
            .update(updatedData)
            .eq('id', id);

        if (error) throw error;

        const index = allVoters.findIndex(v => v.id === id);
        if (index !== -1) {
            allVoters[index] = { ...allVoters[index], ...updatedData };
        }

        filteredVoters = [...allVoters];
        renderList(filteredVoters);
        renderAgeAnalytics(filteredVoters);
        updateStats(filteredVoters);
        renderTopHouses(filteredVoters);

        if (gallerySection.style.display !== 'none') {
            renderGallery(filteredVoters);
        }

        editPopup.style.display = 'none';
        alert('✅ Voter updated successfully!');

    } catch (error) {
        console.error('Error updating voter:', error);
        alert('❌ Failed to update voter: ' + error.message);
    }
});

// ============================================
// RENDER LIST
// ============================================
function renderList(voters) {
    const totalPages = Math.max(1, Math.ceil(voters.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, voters.length);
    const pageVoters = voters.slice(start, end);

    voterCountDisplay.textContent = `(${voters.length} total)`;

    if (pageVoters.length === 0) {
        voterList.innerHTML = '<div class="no-results">🔍 No voters found</div>';
        updatePagination(0, totalPages);
        return;
    }

    let html = '';
    pageVoters.forEach(v => {
        const photoUrl = v.photo_url || '';
        const partyClass = (v.party || '').toLowerCase();
        const sexIcon = normalizeSex(v.sex) === 'Male' ? '♂️' : normalizeSex(v.sex) === 'Female' ? '♀️' : '';
        const address = [v.house, v.lives_in].filter(Boolean).join(', ') || 'N/A';

        html += `
            <div class="voter-item" data-id="${v.id}">
                <div class="photo">
                    ${photoUrl ? 
                        `<img src="${photoUrl}" alt="${v.name}" loading="lazy" 
                              onerror="this.style.display='none'; this.parentElement.innerHTML='📷';" />` :
                        '<span class="no-photo">📷</span>'
                    }
                </div>
                <div class="info">
                    <span class="name">${v.name || 'Unknown'}</span>
                    <span class="detail"><i class="fas fa-calendar-alt"></i> ${v.age || 'N/A'}</span>
                    <span class="detail"><i class="fas fa-home"></i> ${address}</span>
                    ${sexIcon ? `<span class="detail">${sexIcon}</span>` : ''}
                </div>
                ${v.party ? `<span class="party-badge ${partyClass}">${v.party}</span>` : ''}
                <button class="edit-btn-small" onclick="event.stopPropagation(); openEditPopup(${v.id});">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        `;
    });

    voterList.innerHTML = html;
    updatePagination(voters.length, totalPages);

    document.querySelectorAll('.voter-item').forEach(el => {
        el.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            const voter = allVoters.find(v => v.id === id);
            if (voter) showVoterPopup(voter);
        });
    });
}

// ============================================
// UPDATE PAGINATION
// ============================================
function updatePagination(total, totalPages) {
    prevPage.disabled = currentPage <= 1;
    nextPage.disabled = currentPage >= totalPages;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

// ============================================
// RENDER PHOTO GALLERY
// ============================================
function renderGallery(voters) {
    const totalPages = Math.max(1, Math.ceil(voters.length / galleryPageSize));
    if (galleryPage > totalPages) galleryPage = totalPages;

    const start = (galleryPage - 1) * galleryPageSize;
    const end = Math.min(start + galleryPageSize, voters.length);
    const pageVoters = voters.slice(start, end);

    galleryCount.textContent = `(${voters.length} photos)`;

    if (pageVoters.length === 0) {
        photoGrid.innerHTML = '<div class="no-results">No photos found</div>';
        updateGalleryPagination(0, totalPages);
        return;
    }

    let html = '';
    pageVoters.forEach(v => {
        const photoUrl = v.photo_url || '';
        const name = v.name || 'Unknown';

        html += `
            <div class="photo-grid-item" data-id="${v.id}">
                <div class="photo-wrapper">
                    ${photoUrl ? 
                        `<img src="${photoUrl}" alt="${name}" loading="lazy" 
                              onerror="this.style.display='none'; this.parentElement.querySelector('.photo-placeholder').style.display='flex';" />` :
                        ''
                    }
                    <div class="photo-placeholder" style="${photoUrl ? 'display:none;' : 'display:flex;'} align-items:center; justify-content:center; width:100%; height:100%;">
                        📷
                    </div>
                </div>
                <div class="photo-name">${name}</div>
            </div>
        `;
    });

    photoGrid.innerHTML = html;
    updateGalleryPagination(voters.length, totalPages);

    document.querySelectorAll('.photo-grid-item').forEach(el => {
        el.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            const voter = allVoters.find(v => v.id === id);
            if (voter) showVoterPopup(voter);
        });
    });
}

// ============================================
// UPDATE GALLERY PAGINATION
// ============================================
function updateGalleryPagination(total, totalPages) {
    galleryPrev.disabled = galleryPage <= 1;
    galleryNext.disabled = galleryPage >= totalPages;
    galleryPageInfo.textContent = `Page ${galleryPage} of ${totalPages}`;
}

// ============================================
// SWITCH VIEWS
// ============================================
function showListView() {
    document.getElementById('listSection').style.display = 'block';
    gallerySection.style.display = 'none';
    listViewBtn.classList.add('active');
    galleryViewBtn.classList.remove('active');
}

function showGalleryView() {
    document.getElementById('listSection').style.display = 'none';
    gallerySection.style.display = 'block';
    galleryViewBtn.classList.add('active');
    listViewBtn.classList.remove('active');
    galleryPage = 1;
    renderGallery(filteredVoters);
}

// ============================================
// FILTER VOTERS
// ============================================
function filterVoters() {
    const search = searchInput.value.toLowerCase().trim();
    const sex = sexFilter.value;
    const party = partyFilter.value;
    const house = houseFilter.value;
    const ageRange = ageRangeFilter.value;

    filteredVoters = allVoters.filter(v => {
        let matchSearch = true;
        if (search) {
            matchSearch =
                (v.name && v.name.toLowerCase().includes(search)) ||
                (v.national_id && v.national_id.toLowerCase().includes(search)) ||
                (v.house && v.house.toLowerCase().includes(search)) ||
                (v.lives_in && v.lives_in.toLowerCase().includes(search));
        }

        let matchSex = true;
        if (sex) matchSex = normalizeSex(v.sex) === sex;

        let matchParty = true;
        if (party) matchParty = (v.party || '') === party;

        let matchHouse = true;
        if (house) matchHouse = (v.house || '') === house;

        let matchAge = true;
        if (ageRange) {
            const voterAge = parseInt(v.age);
            if (!isNaN(voterAge) && voterAge > 0) {
                const [min, max] = ageRange.split('-').map(Number);
                if (max) {
                    matchAge = voterAge >= min && voterAge <= max;
                } else {
                    matchAge = voterAge >= min;
                }
            } else {
                matchAge = false;
            }
        }

        return matchSearch && matchSex && matchParty && matchHouse && matchAge;
    });

    currentPage = 1;
    renderList(filteredVoters);
    updateStats(filteredVoters);
    renderTopHouses(filteredVoters);
    renderAgeAnalytics(filteredVoters);

    if (gallerySection.style.display !== 'none') {
        galleryPage = 1;
        renderGallery(filteredVoters);
    }

    document.querySelectorAll('.filter-chip').forEach(el => el.classList.remove('active'));
}

// ============================================
// RESET FILTERS
// ============================================
function resetFilters() {
    searchInput.value = '';
    sexFilter.value = '';
    partyFilter.value = selectedParty || '';
    houseFilter.value = '';
    ageRangeFilter.value = '';

    document.querySelectorAll('.filter-chip').forEach(el => el.classList.remove('active'));

    filteredVoters = [...allVoters];
    currentPage = 1;
    renderList(filteredVoters);
    updateStats(filteredVoters);
    renderTopHouses(filteredVoters);
    renderAgeAnalytics(filteredVoters);

    if (gallerySection.style.display !== 'none') {
        galleryPage = 1;
        renderGallery(filteredVoters);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
searchInput.addEventListener('input', filterVoters);
sexFilter.addEventListener('change', filterVoters);
partyFilter.addEventListener('change', filterVoters);
houseFilter.addEventListener('change', filterVoters);
ageRangeFilter.addEventListener('change', filterVoters);

resetBtn.addEventListener('click', resetFilters);

prevPage.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderList(filteredVoters); }
});

nextPage.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredVoters.length / pageSize);
    if (currentPage < totalPages) { currentPage++; renderList(filteredVoters); }
});

// Gallery Events
listViewBtn.addEventListener('click', showListView);
galleryViewBtn.addEventListener('click', showGalleryView);

galleryPrev.addEventListener('click', () => {
    if (galleryPage > 1) { galleryPage--; renderGallery(filteredVoters); }
});

galleryNext.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredVoters.length / galleryPageSize);
    if (galleryPage < totalPages) { galleryPage++; renderGallery(filteredVoters); }
});

// ============================================
// INIT
// ============================================
console.log('🔐 Voter Management System loaded');
console.log('🏛️ MDP (Yellow) & PNC (Turquoise)');

// Check for saved session
if (!checkSession()) {
    partySelection.classList.remove('hidden');
    mainApp.style.display = 'none';
}