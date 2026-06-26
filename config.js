// ============================================
// SUPABASE CONFIGURATION
// ============================================

const SUPABASE_CONFIG = {
    url: 'https://espezmdpkoixnfchomqb.supabase.co',
    publishableKey: 'sb_publishable_xP8z74zcMuCkj6xlu1bJ3w_Kudqbcu1'
};

// ============================================
// PARTY AUTHENTICATION & DETAILS
// ============================================

const PARTY_AUTH = {
    'MDP': {
        password: 'mdp2024',
        shortName: 'MDP',
        fullName: 'Maldivian Democratic Party',
        color: '#f5a623',
        lightColor: '#fef5e7',
        textColor: '#1a1a2e',
        logo: 'fa-flag',
        registered: '26 Jun 2005',
        table: 'full_import',
        partyColumn: 'party',
        partyValue: 'MDP'
    },
    'PNC': {
        password: 'pnc2024',
        shortName: 'PNC',
        fullName: 'Peoples National Congress',
        color: '#1abc9c',
        lightColor: '#e8f8f5',
        textColor: '#ffffff',
        logo: 'fa-users',
        registered: '31 Jan 2019',
        table: 'full_import',
        partyColumn: 'party',
        partyValue: 'PNC'
    }
};

// ============================================
// EXPOSE TO GLOBAL SCOPE
// ============================================
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.PARTY_AUTH = PARTY_AUTH;

console.log('✅ Config loaded');
console.log('🏛️ Parties:', Object.keys(PARTY_AUTH).join(', '));
console.log('📊 Using table: full_import');
console.log('🔐 MDP Password: mdp2024');
console.log('🔐 PNC Password: pnc2024');