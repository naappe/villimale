// ============================================
// MAIN APPLICATION LOGIC
// ============================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import { SUPABASE_CONFIG, TABLE_NAME, COLUMNS, SORT_CONFIG } from './config.js'

// Initialize Supabase client
const supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)

// State
let allData = []
let filteredData = []

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
  loading: document.getElementById('loading'),
  table: document.getElementById('data-table'),
  tbody: document.getElementById('table-body'),
  search: document.getElementById('search-input'),
  totalCount: document.getElementById('total-count'),
  refreshBtn: document.getElementById('refresh-btn')
}

// ============================================
// MAIN FUNCTIONS
// ============================================

// Load data from Supabase
async function loadData() {
  try {
    showLoading(true)
    
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select('*')
      .order(SORT_CONFIG.column, { ascending: SORT_CONFIG.ascending })

    if (error) throw error

    allData = data
    filteredData = data
    
    renderTable(data)
    updateStats(data)
    
    console.log(`✅ Loaded ${data.length} records`)
  } catch (error) {
    console.error('Error loading data:', error)
    showError(error.message)
  } finally {
    showLoading(false)
  }
}

// Render table
function renderTable(data) {
  const tbody = elements.tbody
  tbody.innerHTML = ''

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 20px;">No data found</td></tr>'
    elements.table.style.display = 'table'
    return
  }

  data.forEach((row, index) => {
    const tr = document.createElement('tr')
    
    let rowHTML = `<td>${index + 1}</td>`
    
    COLUMNS.forEach(col => {
      if (col.key === 'Row #') return
      const value = row[col.key] || ''
      rowHTML += `<td>${value}</td>`
    })
    
    tr.innerHTML = rowHTML
    tbody.appendChild(tr)
  })

  elements.table.style.display = 'table'
}

// Update statistics
function updateStats(data) {
  if (elements.totalCount) {
    elements.totalCount.textContent = data ? data.length : 0
  }
}

// Search/filter functionality
function filterData(searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') {
    filteredData = allData
  } else {
    const term = searchTerm.toLowerCase().trim()
    filteredData = allData.filter(row => {
      return COLUMNS.some(col => {
        const value = row[col.key]
        return value && String(value).toLowerCase().includes(term)
      })
    })
  }
  
  renderTable(filteredData)
  updateStats(filteredData)
}

// ============================================
// UI HELPERS
// ============================================

function showLoading(show) {
  if (elements.loading) {
    elements.loading.style.display = show ? 'block' : 'none'
  }
  if (elements.table) {
    elements.table.style.display = show ? 'none' : 'table'
  }
}

function showError(message) {
  if (elements.loading) {
    elements.loading.innerHTML = `
      ❌ Error loading data: ${message}
      <br><br>
      <small>Check console for more details</small>
    `
    elements.loading.style.display = 'block'
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

if (elements.search) {
  elements.search.addEventListener('input', (e) => {
    filterData(e.target.value)
  })
}

if (elements.refreshBtn) {
  elements.refreshBtn.addEventListener('click', loadData)
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

export { loadData, filterData, allData, filteredData }

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', loadData)