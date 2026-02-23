#!/usr/bin/env node
/**
 * Clear all test data from Supabase tables, preserving:
 * - material_catalog (catálogo de materiales)
 * - catalog_products (catálogo de productos)
 * - production_employees, business_lines, roles, config_settings
 * - alert_settings, company_info, users
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rqumbscotqlcffmcwswv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdW1ic2NvdHFsY2ZmbWN3c3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjYwNjIsImV4cCI6MjA4NjIwMjA2Mn0.gGAdFHsZvO1syM6dISwRcOdkVa9KNOfYaSw-FuduXEA'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Tables to clear, in FK-safe order (children first, parents last)
const TABLES_TO_CLEAR = [
  'task_material_usage',
  'crm_alert_instances',
  'lead_documents',
  'design_files',
  'excel_export_queue',
  'quick_docs',
  'work_sessions',
  'time_entries',
  'production_tasks',
  'calendar_events',
  'furniture_designs',
  'furniture_work_orders',
  'purchase_items',
  'stock_items',
  'warehouse_shelves',
  'production_projects',
  'quotes',
  'crm_leads',
  // Legacy tables
  'tasks',
  'phases',
  'projects',
  'leads',
]

async function clearTable(tableName) {
  try {
    // Delete all rows — use a filter that matches everything
    const { error, count } = await supabase
      .from(tableName)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // matches everything
    
    if (error) {
      // Table might not exist or have different ID format
      // Try with gte on id
      const { error: err2 } = await supabase
        .from(tableName)
        .delete()
        .gte('id', '')
      
      if (err2) {
        console.log(`  ⚠️  ${tableName}: ${err2.message}`)
        return false
      }
    }
    console.log(`  ✅ ${tableName}: cleared`)
    return true
  } catch (err) {
    console.log(`  ⚠️  ${tableName}: ${err.message}`)
    return false
  }
}

async function main() {
  console.log('🧹 VanSpace Workshop — Clear Test Data')
  console.log('=' .repeat(50))
  console.log('')
  console.log('Preserving: material_catalog, catalog_products,')
  console.log('  employees, roles, business_lines, config, alerts')
  console.log('')

  let cleared = 0
  let skipped = 0

  for (const table of TABLES_TO_CLEAR) {
    const ok = await clearTable(table)
    if (ok) cleared++
    else skipped++
  }

  console.log('')
  console.log(`Done: ${cleared} tables cleared, ${skipped} skipped/missing`)
  console.log('')
  console.log('📱 Now clear localStorage in the browser console:')
  console.log(`
  ['saved_quotes','production_tasks','design_instructions','stock_items',
   'stock_last_sync','purchase_items','quick_docs_v1',
   'vanspace_furniture_work_orders','vanspace_furniture_designs',
   'vanspace_dismissed_live_alerts'
  ].forEach(k => localStorage.removeItem(k));
  Object.keys(localStorage).filter(k => k.startsWith('quick_doc_seq_')).forEach(k => localStorage.removeItem(k));
  console.log('✅ localStorage cleared');
  location.reload();
`)
}

main().catch(console.error)
