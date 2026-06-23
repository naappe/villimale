// ============================================
// SUPABASE CONFIGURATION
// ============================================

export const SUPABASE_CONFIG = {
  url: 'https://espezmdpkoixnfchomqb.supabase.co',
  anonKey: 'sb_publishable_WGCfJEodLRBVaAHp2jR7VA_hpERDM4H'
}

// Table name
export const TABLE_NAME = 'mdp'

// Column configuration for display
export const COLUMNS = [
  { key: 'Row #', label: '#' },
  { key: 'Name', label: 'Name' },
  { key: 'National ID', label: 'National ID' },
  { key: 'House', label: 'House' },
  { key: 'Island', label: 'Island' },
  { key: 'Phone', label: 'Phone' },
  { key: 'Support Level', label: 'Support Level' },
  { key: 'Priority', label: 'Priority' },
  { key: 'Assigned To', label: 'Assigned To' }
]

// Sorting configuration
export const SORT_CONFIG = {
  column: 'House',
  ascending: true
}