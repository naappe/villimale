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

// ============================================
// INIT SUPABASE
// ============================================
if (typeof supabase === 'undefined') {
    document.getElementById('voterList').innerHTML =
        '<div class="error-box">❌ Supabase library failed to load.</div>';
    throw new Error('Supabase library failed to load');
}

const supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);

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

// ============================================
// DOM ELEMENTS
// ============================================
const voterList = document.getElementById('voterList');
const searchInput = document.getElementById('searchInput');
const sexFilter = document.getElementById('sexFilter');
const partyFilter = document.getElementById('partyFilter');
const houseFilter = document.getElementById('houseFilter');
const ageMin = document.getElementById('ageMin');
const ageMax = document.getElementById('ageMax');
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

// Gallery Elements
const gallerySection = document.getElementById('gallerySection');
const photoGrid = document.getElementById('photoGrid');
const galleryCount = document.getElementById('galleryCount');
const galleryPrev = document.getElementById('galleryPrev');
const galleryNext = document.getElementById('galleryNext');
const galleryPageInfo = document.getElementById('galleryPageInfo');
const listViewBtn = document.getElementById('listViewBtn');
const galleryViewBtn = document.getElementById('galleryViewBtn');

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
// POPUP CONTROLS
// ============================================
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

// ============================================
// FETCH ALL VOTERS WITH PAGINATION
// ============================================
async function fetchVoters() {
    if (isLoading) return;
    isLoading = true;

    voterList.innerHTML = '<div class="loading-state">Loading voters...</div>';

    try {
        // First, get total count
        const { count, error: countError } = await supabaseClient
            .from('full_import')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;
        console.log('📊 Total records in table:', count);

        // Fetch all data using pagination
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;
        let totalFetched = 0;

        while (hasMore) {
            const from = page * pageSize;
            const to = from + pageSize - 1;

            console.log(`📥 Fetching batch ${page + 1}: rows ${from} to ${to}`);

            const { data, error } = await supabaseClient
                .from('full_import')
                .select('*')
                .range(from, to)
                .order('image_number', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                allData = allData.concat(data);
                totalFetched += data.length;
                page++;
            }

            if (!data || data.length < pageSize) {
                hasMore = false;
            }
        }

        console.log('✅ Loaded all voters:', allData.length);

        allVoters = allData || [];
        filteredVoters = [...allVoters];

        // Check if we got all records
        if (count && allVoters.length < count) {
            console.warn(`⚠️ Only loaded ${allVoters.length} out of ${count} records!`);
        }

        populateFilters(allVoters);
        renderTopHouses(allVoters);
        updateStats(allVoters);
        renderList(filteredVoters);

        // Update gallery if visible
        if (gallerySection.style.display !== 'none') {
            galleryPage = 1;
            renderGallery(filteredVoters);
        }

    } catch (error) {
        console.error('❌ Error fetching voters:', error);
        voterList.innerHTML =
            `<div class="error-box">❌ Failed to load voters.<br /><small>${error.message}</small></div>`;
    } finally {
        isLoading = false;
    }
}

// ============================================
// POPULATE FILTERS
// ============================================
function populateFilters(voters) {
    const parties = [...new Set(voters.map(v => v.party).filter(Boolean))].sort();
    partyFilter.innerHTML = '<option value="">All Parties</option>';
    parties.forEach(p => {
        const option = document.createElement('option');
        option.value = p;
        option.textContent = p;
        partyFilter.appendChild(option);
    });

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
    const topParties = Object.entries(partyCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    topParties.forEach(([party, count]) => {
        if (party !== 'No Party') {
            chips.push({ label: `${party} (${count})`, value: `party:${party}`, type: 'party' });
        }
    });

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
            <span class="label">Age</span><span class="value">${voter.age || 'N/A'}</span>
            <span class="label">Sex</span><span class="value">${sexDisplay}</span>
            <span class="label">Address</span><span class="value">${address}</span>
            <span class="label">Mobile</span><span class="value">${voter.phone || 'N/A'}</span>
        </div>
        ${voter.party ? `<div class="popup-party ${partyClass}">${voter.party}</div>` : ''}
    `;

    voterPopup.style.display = 'flex';
}

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
                    <span class="detail"><i class="fas fa-home"></i> ${v.house || 'N/A'}</span>
                    ${sexIcon ? `<span class="detail">${sexIcon}</span>` : ''}
                </div>
                ${v.party ? `<span class="party-badge ${partyClass}">${v.party}</span>` : ''}
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
        if (sex) matchSex = normalizeSex(v.sex) === sex;

        let matchParty = true;
        if (party) matchParty = (v.party || '') === party;

        let matchHouse = true;
        if (house) matchHouse = (v.house || '') === house;

        let matchAge = true;
        const voterAge = parseInt(v.age);
        if (!isNaN(minAge) && !isNaN(voterAge)) matchAge = matchAge && voterAge >= minAge;
        if (!isNaN(maxAge) && !isNaN(voterAge)) matchAge = matchAge && voterAge <= maxAge;

        return matchSearch && matchSex && matchParty && matchHouse && matchAge;
    });

    currentPage = 1;
    renderList(filteredVoters);
    updateStats(filteredVoters);
    renderTopHouses(filteredVoters);

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
    partyFilter.value = '';
    houseFilter.value = '';
    ageMin.value = '';
    ageMax.value = '';

    document.querySelectorAll('.filter-chip').forEach(el => el.classList.remove('active'));

    filteredVoters = [...allVoters];
    currentPage = 1;
    renderList(filteredVoters);
    updateStats(filteredVoters);
    renderTopHouses(filteredVoters);

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
ageMin.addEventListener('change', filterVoters);
ageMax.addEventListener('change', filterVoters);

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
// DIAGNOSTIC BUTTON (Add to filters if needed)
// ============================================
console.log('🔄 Voter Management System loaded');
console.log('📌 Use the "Gallery View" button to see photos in a grid');

// ============================================
// INIT
// ============================================
fetchVoters();
