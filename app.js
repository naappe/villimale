// ============================================
// IMPORT CONFIG
// ============================================
import { SUPABASE_CONFIG } from './config.js';

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

function getSexDisplay(value) {
    if (!value) return 'N/A';
    return normalizeSex(value);
}

// ============================================
// INIT SUPABASE
// ============================================
if (typeof supabase === 'undefined') {
    document.getElementById('voterTableBody').innerHTML =
        '<tr><td colspan="7" class="error-box">❌ Supabase library failed to load.</td></tr>';
    throw new Error('Supabase library failed to load');
}

const supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);

// ============================================
// STATE
// ============================================
let allVoters = [];
let filteredVoters = [];
let currentPage = 1;
const pageSize = 20;
let genderChartInstance = null;
let partyChartInstance = null;
let topHousesCollapsed = false;

// ============================================
// DOM ELEMENTS
// ============================================
const tableBody = document.getElementById('voterTableBody');
const searchInput = document.getElementById('searchInput');
const sexFilter = document.getElementById('sexFilter');
const partyFilter = document.getElementById('partyFilter');
const houseFilter = document.getElementById('houseFilter');
const ageMin = document.getElementById('ageMin');
const ageMax = document.getElementById('ageMax');
const searchBtn = document.getElementById('searchBtn');
const resetBtn = document.getElementById('resetBtn');
const diagnosticBtn = document.getElementById('diagnosticBtn');
const filterChips = document.getElementById('filterChips');

const totalVoters = document.getElementById('totalVoters');
const maleCount = document.getElementById('maleCount');
const femaleCount = document.getElementById('femaleCount');
const partyCount = document.getElementById('partyCount');
const avgAge = document.getElementById('avgAge');
const houseCount = document.getElementById('houseCount');
const navCount = document.getElementById('navCount');
const lastUpdated = document.getElementById('lastUpdated');
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

// ============================================
// HAMBURGER MENU
// ============================================
document.getElementById('hamburger').addEventListener('click', function() {
    document.getElementById('navLinks').classList.toggle('open');
});

// ============================================
// TOP HOUSES COLLAPSIBLE
// ============================================
topHousesToggle.addEventListener('click', function() {
    topHousesCollapsed = !topHousesCollapsed;
    const grid = document.querySelector('.top-houses-grid');
    const icon = document.querySelector('.toggle-icon');
    if (grid) grid.classList.toggle('collapsed');
    if (icon) icon.classList.toggle('collapsed');
});

// ============================================
// CLOSE POPUP
// ============================================
voterPopupClose.addEventListener('click', function() {
    voterPopup.style.display = 'none';
});

voterPopup.addEventListener('click', function(e) {
    if (e.target === this) {
        this.style.display = 'none';
    }
});

// ESC key to close popup
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        voterPopup.style.display = 'none';
    }
});

// ============================================
// CHECK SUPABASE LIMITS (Diagnostic)
// ============================================
async function checkSupabaseLimits() {
    try {
        const { count, error: countError } = await supabaseClient
            .from('full_import')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        const { data: firstBatch, error: batchError } = await supabaseClient
            .from('full_import')
            .select('*')
            .limit(1000)
            .order('image_number', { ascending: true });

        if (batchError) throw batchError;

        const { data: allData, error: allError } = await supabaseClient
            .from('full_import')
            .select('*')
            .order('image_number', { ascending: true });

        if (allError) throw allError;

        return {
            totalCount: count || 0,
            firstBatchSize: firstBatch ? firstBatch.length : 0,
            allDataSize: allData ? allData.length : 0,
            isLimited: (allData ? allData.length : 0) < (count || 0)
        };

    } catch (error) {
        console.error('❌ Error checking limits:', error);
        return null;
    }
}

// ============================================
// FETCH ALL VOTERS WITH PAGINATION
// ============================================
async function fetchAllVotersWithPagination() {
    tableBody.innerHTML = '<tr><td colspan="7" class="loading-state">Loading voters in batches...</td></tr>';

    try {
        let allData = [];
        let page = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const from = page * batchSize;
            const to = from + batchSize - 1;

            console.log(`📥 Fetching batch ${page + 1}: rows ${from} to ${to}`);

            const { data, error } = await supabaseClient
                .from('full_import')
                .select('*')
                .range(from, to)
                .order('image_number', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                allData = allData.concat(data);
                page++;
            }

            if (!data || data.length < batchSize) {
                hasMore = false;
            }
        }

        console.log('✅ Loaded all voters with pagination:', allData.length);

        allVoters = allData || [];
        filteredVoters = [...allVoters];

        populateFilters(allVoters);
        renderTopHouses(allVoters);
        updateStats(allVoters);
        updateCharts(allVoters);
        renderTable(filteredVoters);
        updateLastUpdated();

    } catch (error) {
        console.error('❌ Error with pagination:', error);
        tableBody.innerHTML =
            `<tr><td colspan="7" class="error-box">❌ Failed to load voters with pagination.<br /><small>${error.message}</small></td></tr>`;
    }
}

// ============================================
// FETCH VOTERS - NO LIMIT
// ============================================
async function fetchVoters() {
    tableBody.innerHTML = '<tr><td colspan="7" class="loading-state">Loading voters...</td></tr>';

    try {
        const { data, error } = await supabaseClient
            .from('full_import')
            .select('*')
            .order('image_number', { ascending: true });

        if (error) throw error;

        console.log('✅ Loaded', data ? data.length : 0, 'voters');

        const { count, error: countError } = await supabaseClient
            .from('full_import')
            .select('*', { count: 'exact', head: true });

        if (!countError && data && data.length < count) {
            console.warn(`⚠️ Only loaded ${data.length} out of ${count} records. Using pagination...`);
            await fetchAllVotersWithPagination();
            return;
        }

        allVoters = data || [];
        filteredVoters = [...allVoters];

        populateFilters(allVoters);
        renderTopHouses(allVoters);
        updateStats(allVoters);
        updateCharts(allVoters);
        renderTable(filteredVoters);
        updateLastUpdated();

    } catch (error) {
        console.error('❌ Error:', error);
        tableBody.innerHTML =
            `<tr><td colspan="7" class="error-box">❌ Failed to load voters.<br /><small>${error.message}</small></td></tr>`;
    }
}

// ============================================
// POPULATE FILTERS
// ============================================
function populateFilters(voters) {
    // Party filter
    const parties = [...new Set(voters.map(v => v.party).filter(Boolean))].sort();
    partyFilter.innerHTML = '<option value="">All Parties</option>';
    parties.forEach(p => {
        const option = document.createElement('option');
        option.value = p;
        option.textContent = p;
        partyFilter.appendChild(option);
    });

    // House filter
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

    const partyCounts = {};
    voters.forEach(v => {
        const p = v.party || 'No Party';
        partyCounts[p] = (partyCounts[p] || 0) + 1;
    });
    const topParties = Object.entries(partyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    topParties.forEach(([party, count]) => {
        if (party !== 'No Party') {
            chips.push({ label: `${party} (${count})`, value: `party:${party}`, type: 'party' });
        }
    });

    const ages = voters.map(v => parseInt(v.age)).filter(a => a > 0 && a < 120);
    if (ages.length > 0) {
        const under25 = ages.filter(a => a < 25).length;
        const under40 = ages.filter(a => a < 40).length;
        const over60 = ages.filter(a => a >= 60).length;

        if (under25 > 0) chips.push({ label: `🟢 Under 25 (${under25})`, value: 'age:0-24', type: 'age' });
        if (under40 - under25 > 0) chips.push({ label: `🟡 25-40 (${under40 - under25})`, value: 'age:25-39', type: 'age' });
        if (over60 > 0) chips.push({ label: `🔴 60+ (${over60})`, value: 'age:60-150', type: 'age' });
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
    if (type === 'sex') {
        sexFilter.value = value;
    } else if (type === 'party') {
        partyFilter.value = value;
    } else if (type === 'age') {
        const [min, max] = value.split('-');
        ageMin.value = min;
        ageMax.value = max;
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
    const parties = [...new Set(voters.map(v => v.party).filter(Boolean))];
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
// UPDATE CHARTS
// ============================================
function updateCharts(voters) {
    const males = voters.filter(v => normalizeSex(v.sex) === 'Male').length;
    const females = voters.filter(v => normalizeSex(v.sex) === 'Female').length;
    const others = voters.filter(v => {
        const normalized = normalizeSex(v.sex);
        return normalized !== 'Male' && normalized !== 'Female' && v.sex;
    }).length;

    const genderCtx = document.getElementById('genderChart').getContext('2d');
    if (genderChartInstance) genderChartInstance.destroy();

    genderChartInstance = new Chart(genderCtx, {
        type: 'doughnut',
        data: {
            labels: ['Male', 'Female', 'Other'],
            datasets: [{
                data: [males, females, others],
                backgroundColor: ['#4a90d9', '#e74c3c', '#9b59b6'],
                borderWidth: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 8, usePointStyle: true, pointStyle: 'circle' } }
            },
            cutout: '65%'
        }
    });

    const partyMap = {};
    voters.forEach(v => {
        const p = v.party || 'No Party';
        partyMap[p] = (partyMap[p] || 0) + 1;
    });

    const sorted = Object.entries(partyMap).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(s => s[0]);
    const values = sorted.map(s => s[1]);
    const colors = ['#4a90d9', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#3498db'];

    const partyCtx = document.getElementById('partyChart').getContext('2d');
    if (partyChartInstance) partyChartInstance.destroy();

    partyChartInstance = new Chart(partyCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Voters',
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
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

    const top = Object.entries(houseCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    topHousesCount.textContent = `(${top.length} houses)`;

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
                <span class="house-count">${count} voters</span>
            </div>
        `;
    });

    topHouses.innerHTML = html;

    // Add click listeners to top houses
    document.querySelectorAll('.top-house').forEach(el => {
        el.addEventListener('click', function() {
            const house = this.dataset.house;
            filterByHouse(house);
        });
    });
}

// ============================================
// FILTER BY HOUSE
// ============================================
function filterByHouse(house) {
    houseFilter.value = house;
    filterVoters();
    document.querySelector('.voter-table-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// SHOW VOTER POPUP
// ============================================
function showVoterPopup(id) {
    const voter = allVoters.find(v => v.id === id);
    if (!voter) {
        console.error('Voter not found:', id);
        return;
    }

    const photoUrl = voter.photo_url || '';
    const sexDisplay = getSexDisplay(voter.sex);
    const partyClass = (voter.party || '').toLowerCase();
    const address = [voter.house, voter.lives_in].filter(Boolean).join(', ') || 'N/A';

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
        <div class="popup-details">
            <span class="label">Age</span>
            <span class="value">${voter.age || 'N/A'}</span>
            <span class="label">Sex</span>
            <span class="value">${sexDisplay}</span>
            <span class="label">Address</span>
            <span class="value">${address}</span>
            <span class="label">Mobile</span>
            <span class="value">${voter.phone || 'N/A'}</span>
            <span class="label">National ID</span>
            <span class="value">${voter.national_id || 'N/A'}</span>
        </div>
        ${voter.party ? `<div class="popup-party ${partyClass}">${voter.party}</div>` : ''}
    `;

    voterPopup.style.display = 'flex';
}

// ============================================
// RENDER TABLE - COMPACT WITH EVENT LISTENERS
// ============================================
function renderTable(voters) {
    const totalPages = Math.max(1, Math.ceil(voters.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, voters.length);
    const pageVoters = voters.slice(start, end);

    voterCountDisplay.textContent = `(${voters.length} total)`;

    if (pageVoters.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="no-results">🔍 No voters found.</td></tr>';
        updatePagination(0, totalPages);
        return;
    }

    let html = '';
    pageVoters.forEach((v, index) => {
        const photoUrl = v.photo_url || '';
        const partyClass = (v.party || '').toLowerCase();
        const rowNum = start + index + 1;

        html += `
            <tr>
                <td>${rowNum}</td>
                <td class="photo-cell">
                    ${photoUrl ? 
                        `<img src="${photoUrl}" alt="${v.name}" loading="lazy" 
                              onerror="this.style.display='none';" />` :
                        '📷'
                    }
                </td>
                <td><strong>${v.name || 'Unknown'}</strong></td>
                <td>${v.age || 'N/A'}</td>
                <td>${v.house || 'N/A'}</td>
                <td>${v.party ? `<span class="party-badge ${partyClass}">${v.party}</span>` : '—'}</td>
                <td>
                    <button class="view-btn" data-id="${v.id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
    updatePagination(voters.length, totalPages);

    // Add click listeners to view buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            showVoterPopup(id);
        });
    });
}

// ============================================
// UPDATE PAGINATION
// ============================================
function updatePagination(total, totalPages) {
    prevPage.disabled = currentPage <= 1;
    nextPage.disabled = currentPage >= totalPages;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${total} voters)`;
}

// ============================================
// FILTER
// ============================================
function filterVoters() {
    const search = searchInput.value.toLowerCase().trim();
    const sex = sexFilter.value;
    const party = partyFilter.value;
    const house = houseFilter.value;
    const minAge = parseInt(ageMin.value);
    const maxAge = parseInt(ageMax.value);

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
        if (sex) {
            matchSex = normalizeSex(v.sex) === sex;
        }

        let matchParty = true;
        if (party) {
            matchParty = (v.party || '') === party;
        }

        let matchHouse = true;
        if (house) {
            matchHouse = (v.house || '') === house;
        }

        let matchAge = true;
        const voterAge = parseInt(v.age);
        if (!isNaN(minAge) && !isNaN(voterAge)) {
            matchAge = matchAge && voterAge >= minAge;
        }
        if (!isNaN(maxAge) && !isNaN(voterAge)) {
            matchAge = matchAge && voterAge <= maxAge;
        }

        return matchSearch && matchSex && matchParty && matchHouse && matchAge;
    });

    currentPage = 1;
    renderTable(filteredVoters);
    updateStats(filteredVoters);
    updateCharts(filteredVoters);
    renderTopHouses(filteredVoters);

    document.querySelectorAll('.filter-chip').forEach(el => {
        el.classList.remove('active');
    });
}

// ============================================
// RESET
// ============================================
function resetFilters() {
    searchInput.value = '';
    sexFilter.value = '';
    partyFilter.value = '';
    houseFilter.value = '';
    ageMin.value = '';
    ageMax.value = '';

    document.querySelectorAll('.filter-chip').forEach(el => {
        el.classList.remove('active');
    });

    filteredVoters = [...allVoters];
    currentPage = 1;
    renderTable(filteredVoters);
    updateStats(filteredVoters);
    updateCharts(filteredVoters);
    renderTopHouses(filteredVoters);
}

// ============================================
// DIAGNOSTIC
// ============================================
async function runDiagnostic() {
    const result = await checkSupabaseLimits();
    if (result) {
        alert(`
📊 TABLE DIAGNOSTIC:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Total Records: ${result.totalCount}
📌 Loaded (no limit): ${result.allDataSize}
📌 First batch (1000): ${result.firstBatchSize}
📌 Is limited: ${result.isLimited ? '⚠️ YES' : '✅ NO'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${result.isLimited ? '💡 Try: Fetch all with pagination' : '✅ All data loaded successfully!'}
        `);
    } else {
        alert('❌ Failed to run diagnostic. Check console for errors.');
    }
}

// ============================================
// UPDATE LAST UPDATED
// ============================================
function updateLastUpdated() {
    const now = new Date();
    lastUpdated.textContent = now.toLocaleString();
}

// ============================================
// PAGINATION EVENTS
// ============================================
prevPage.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable(filteredVoters);
    }
});

nextPage.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredVoters.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable(filteredVoters);
    }
});

// ============================================
// LIVE SEARCH
// ============================================
searchInput.addEventListener('input', filterVoters);
sexFilter.addEventListener('change', filterVoters);
partyFilter.addEventListener('change', filterVoters);
houseFilter.addEventListener('change', filterVoters);
ageMin.addEventListener('change', filterVoters);
ageMax.addEventListener('change', filterVoters);

searchBtn.addEventListener('click', filterVoters);
resetBtn.addEventListener('click', resetFilters);
diagnosticBtn.addEventListener('click', runDiagnostic);

// ============================================
// INIT
// ============================================
fetchVoters();
