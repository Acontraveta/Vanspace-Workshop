import { supabase } from '@/lib/supabase'
import { Tarifa, ProductionEmployee, Role, ConfigSetting, AlertSetting, CompanyInfo } from '../types/config.types'

export class ConfigService {
  
  // ============================================
  // TARIFAS
  // ============================================
  static async getTarifas(): Promise<Tarifa[]> {
    const { data, error } = await supabase
      .from('business_lines')
      .select('*')
      .order('linea_negocio')
    
    if (error) throw error
    // Mapear campo DB a nombre de tipo
    return (data || []).map((d: any) => ({ ...d, nombre_tarifa: d.linea_negocio }))
  }

  static async updateTarifa(id: string, updates: Partial<Tarifa>): Promise<void> {
    // Mapear nombre_tarifa a linea_negocio para la BD
    const dbUpdates: any = { ...updates, updated_at: new Date().toISOString() }
    if (dbUpdates.nombre_tarifa) {
      dbUpdates.linea_negocio = dbUpdates.nombre_tarifa
      delete dbUpdates.nombre_tarifa
    }
    const { error } = await supabase
      .from('business_lines')
      .update(dbUpdates)
      .eq('id', id)
    
    if (error) throw error
  }

  static async createTarifa(tarifa: Omit<Tarifa, 'created_at' | 'updated_at'>): Promise<void> {
    const dbRow: any = { ...tarifa, linea_negocio: tarifa.nombre_tarifa }
    delete dbRow.nombre_tarifa
    const { error } = await supabase
      .from('business_lines')
      .insert(dbRow)
    
    if (error) throw error
  }

  static async deleteTarifa(id: string): Promise<void> {
    const { error } = await supabase
      .from('business_lines')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // ============================================
  // EMPLEADOS
  // ============================================
  static async getEmployees(): Promise<ProductionEmployee[]> {
    const { data, error } = await supabase
      .from('production_employees')
      .select('*')
      .order('nombre')
    
    if (error) throw error
    return data || []
  }

  static async updateEmployee(id: string, updates: Partial<ProductionEmployee>): Promise<void> {
    const { error } = await supabase
      .from('production_employees')
      .update({
        nombre: updates.nombre,
        especialidad_principal: updates.especialidad_principal,
        especialidad_secundaria: updates.especialidad_secundaria,
        tarifa_hora_eur: updates.tarifa_hora_eur,
        horas_semanales: updates.horas_semanales,
        email: updates.email,
        password_hash: updates.password_hash, // Solo se incluye si se proporcionó
        telefono: updates.telefono,
        activo: updates.activo,
        role: updates.role,
        permissions: updates.permissions,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    if (error) throw error
  }

  static async createEmployee(employee: Omit<ProductionEmployee, 'created_at' | 'updated_at'>): Promise<void> {
    const { error } = await supabase
      .from('production_employees')
      .insert({
        nombre: employee.nombre,
        especialidad_principal: employee.especialidad_principal,
        especialidad_secundaria: employee.especialidad_secundaria,
        tarifa_hora_eur: employee.tarifa_hora_eur,
        horas_semanales: employee.horas_semanales,
        email: employee.email,
        password_hash: employee.password_hash, // TODO: En producción, hashear con bcrypt
        telefono: employee.telefono,
        activo: employee.activo,
        role: employee.role,
        permissions: employee.permissions || {}
      })
    if (error) throw error
  }

  static async deleteEmployee(id: string): Promise<void> {
    const { error } = await supabase
      .from('production_employees')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // ============================================
  // ROLES
  // ============================================
  static async getRoles(): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('nivel')
    
    if (error) throw error
    return data || []
  }

  // ============================================
  // CONFIGURACIÓN
  // ============================================
  static async getConfigByCategory(category: string): Promise<ConfigSetting[]> {
    const { data, error } = await supabase
      .from('config_settings')
      .select('*')
      .eq('category', category)
      .order('key')
    
    if (error) throw error
    return data || []
  }

  static async updateConfig(key: string, value: string): Promise<void> {
    const { error } = await supabase
      .from('config_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)
    
    if (error) throw error
  }

  // ============================================
  // ALERTAS
  // ============================================
  static async getAlerts(): Promise<AlertSetting[]> {
    const { data, error } = await supabase
      .from('alert_settings')
      .select('*')
      .order('tipo_alerta')
    
    if (error) throw error
    return data || []
  }

  static async updateAlert(tipo: string, updates: Partial<AlertSetting>): Promise<void> {
    const { error } = await supabase
      .from('alert_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('tipo_alerta', tipo)
    
    if (error) throw error
  }

  // ============================================
  // DATOS EMPRESA
  // ============================================
  static async getCompanyInfo(): Promise<CompanyInfo[]> {
    const { data, error } = await supabase
      .from('company_info')
      .select('*')
      .order('campo')
    
    if (error) throw error
    return data || []
  }

  static async updateCompanyInfo(campo: string, valor: string): Promise<void> {
    const { error } = await supabase
      .from('company_info')
      .update({ valor, updated_at: new Date().toISOString() })
      .eq('campo', campo)
    
    if (error) throw error
  }
}