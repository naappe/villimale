// ============================================
// SHARED COMPONENTS
// ============================================

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
// HELPER: Get Party Config
// ============================================
function getPartyConfig(partyName) {
    return window.PARTY_AUTH[partyName] || null;
}

// ============================================
// HELPER: Get Table Name
// ============================================
function getTableName(partyName) {
    const config = getPartyConfig(partyName);
    return config ? config.table : 'full_import';
}

// ============================================
// HELPER: Get Party Filter
// ============================================
function getPartyFilter(partyName) {
    const config = getPartyConfig(partyName);
    if (!config) return null;
    return {
        column: config.partyColumn || 'party',
        value: config.partyValue || partyName
    };
}

// ============================================
// HELPER: Get Party Color
// ============================================
function getPartyColor(partyName) {
    const config = getPartyConfig(partyName);
    return config ? config.color : '#4a90d9';
}

// ============================================
// SESSION MANAGEMENT
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
// SUPABASE CLIENT
// ============================================
function createSupabaseClient() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded');
        return null;
    }
    return supabase.createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.publishableKey
    );
}

// ============================================
// FETCH PARTY VOTERS - FIXED
// ============================================
async function fetchPartyVoters(party) {
    const supabaseClient = createSupabaseClient();
    if (!supabaseClient) return [];

    const tableName = getTableName(party);
    const filter = getPartyFilter(party);
    
    if (!filter) {
        console.error('Party filter not found for:', party);
        return [];
    }

    try {
        const { data, error } = await supabaseClient
            .from(tableName)
            .select('*')
            .eq(filter.column, filter.value)
            .order('image_number', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching voters:', error);
        return [];
    }
}

// ============================================
// UPDATE VOTER
// ============================================
async function updateVoter(party, id, updateData) {
    const supabaseClient = createSupabaseClient();
    if (!supabaseClient) return null;

    const tableName = getTableName(party);
    if (!tableName) return null;

    try {
        const { data, error } = await supabaseClient
            .from(tableName)
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error updating voter:', error);
        return null;
    }
}

// ============================================
// EXPORT DATA
// ============================================
function exportVotersToCSV(voters, party) {
    if (!voters || voters.length === 0) {
        alert('No data to export!');
        return;
    }

    const partyName = party || 'voters';
    let csv = 'Name,National ID,Address,Phone,Age,Sex,Reach Status,Vote Status,Remarks\n';

    voters.forEach(v => {
        const name = (v.name || '').replace(/,/g, '');
        const national_id = (v.national_id || '').replace(/,/g, '');
        const address = ([v.house, v.lives_in].filter(Boolean).join(', ') || 'N/A').replace(/,/g, ';');
        const phone = (v.phone || '').replace(/,/g, '');
        const age = v.age || '';
        const sex = v.sex || '';
        const reach = v.reach_status || 'not-reached';
        const vote = v.vote_status || 'pending';
        const remarks = (v.remarks || '').replace(/,/g, '');

        csv += `${name},${national_id},${address},${phone},${age},${sex},${reach},${vote},${remarks}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${partyName}_voters_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// ============================================
// FILTER VOTERS
// ============================================
function filterVotersList(voters, search, status, house) {
    return voters.filter(v => {
        let matchSearch = true;
        if (search) {
            const s = search.toLowerCase();
            matchSearch = (v.name && v.name.toLowerCase().includes(s)) ||
                (v.national_id && v.national_id.toLowerCase().includes(s)) ||
                (v.house && v.house.toLowerCase().includes(s)) ||
                (v.remarks && v.remarks.toLowerCase().includes(s));
        }

        let matchStatus = true;
        if (status) {
            matchStatus = (v.reach_status || 'not-reached') === status ||
                (v.vote_status || 'pending') === status;
        }

        let matchHouse = true;
        if (house) matchHouse = (v.house || '') === house;

        return matchSearch && matchStatus && matchHouse;
    });
}

// ============================================
// CALCULATE STATS
// ============================================
function calculateStats(voters) {
    const total = voters.length;
    const reached = voters.filter(v => v.reach_status === 'reached').length;
    const notReached = voters.filter(v => v.reach_status === 'not-reached').length;
    const willVote = voters.filter(v => v.vote_status === 'will-vote').length;
    const notVote = voters.filter(v => v.vote_status === 'not-vote').length;
    const pending = voters.filter(v => v.vote_status === 'pending' || !v.vote_status).length;

    return { total, reached, notReached, willVote, notVote, pending };
}

// ============================================
// GET TOP HOUSES
// ============================================
function getTopHouses(voters, limit = 10) {
    const houseCounts = {};
    voters.forEach(v => {
        if (v.house) {
            houseCounts[v.house] = (houseCounts[v.house] || 0) + 1;
        }
    });

    return Object.entries(houseCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
}

// ============================================
// GET HOUSE OPTIONS
// ============================================
function getHouseOptions(voters) {
    return [...new Set(voters.map(v => v.house).filter(Boolean))].sort();
}

// ============================================
// GET AGE DISTRIBUTION
// ============================================
function getAgeDistribution(voters) {
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

    return ageGroups;
}

// ============================================
// CREATE STATUS CHART
// ============================================
function createStatusChart(ctx, voters) {
    const stats = calculateStats(voters);
    const total = voters.length;

    if (window.statusChartInstance) {
        window.statusChartInstance.destroy();
    }

    window.statusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['🗳️ Will Vote', '❌ Not Vote', '⏳ Pending'],
            datasets: [{
                data: [stats.willVote, stats.notVote, stats.pending],
                backgroundColor: ['#2ecc71', '#e74c3c', '#f39c12'],
                borderWidth: 2,
                borderColor: 'white',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 10,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.parsed} (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// ============================================
// EXPOSE TO GLOBAL
// ============================================
window.normalizeSex = normalizeSex;
window.getPartyConfig = getPartyConfig;
window.getTableName = getTableName;
window.getPartyFilter = getPartyFilter;
window.getPartyColor = getPartyColor;
window.savePartySession = savePartySession;
window.clearPartySession = clearPartySession;
window.checkPartySession = checkPartySession;
window.createSupabaseClient = createSupabaseClient;
window.fetchPartyVoters = fetchPartyVoters;
window.updateVoter = updateVoter;
window.exportVotersToCSV = exportVotersToCSV;
window.filterVotersList = filterVotersList;
window.calculateStats = calculateStats;
window.getTopHouses = getTopHouses;
window.getHouseOptions = getHouseOptions;
window.getAgeDistribution = getAgeDistribution;
window.createStatusChart = createStatusChart;

console.log('✅ Components loaded (using full_import table)');