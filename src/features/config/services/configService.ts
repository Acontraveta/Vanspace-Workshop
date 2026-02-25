import { supabase } from '@/lib/supabase'
import { Tarifa, ProductionEmployee, Role, ConfigSetting, AlertSetting, CompanyInfo } from '../types/config.types'
import { Security } from '@/lib/security'

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

  // Aliases para BusinessLinesConfig
  static getBusinessLines = ConfigService.getTarifas
  static updateBusinessLine = ConfigService.updateTarifa
  static createBusinessLine = ConfigService.createTarifa as (data: any) => Promise<void>

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
    const updateData: any = { ...updates, updated_at: new Date().toISOString() }
    // Solo hashear si se proporcionó nueva contraseña
    if (updates.password_hash && updates.password_hash.trim() !== '') {
      updateData.password_hash = await Security.hashPassword(updates.password_hash)
    } else {
      delete updateData.password_hash // No actualizar si está vacío
    }
    const { error } = await supabase
      .from('production_employees')
      .update(updateData)
      .eq('id', id)
    if (error) throw error
  }

  static async createEmployee(employee: Omit<ProductionEmployee, 'created_at' | 'updated_at'>): Promise<void> {
    // Hashear contraseña antes de guardar
    const hashedPassword = employee.password_hash 
      ? await Security.hashPassword(employee.password_hash)
      : await Security.hashPassword(Security.generateTempPassword())

    const { error } = await supabase
      .from('production_employees')
      .insert({
        id: crypto.randomUUID(),
        nombre: employee.nombre,
        especialidad_principal: employee.especialidad_principal,
        especialidad_secundaria: employee.especialidad_secundaria,
        tarifa_hora_eur: employee.tarifa_hora_eur,
        horas_semanales: employee.horas_semanales,
        email: employee.email?.toLowerCase().trim(),
        password_hash: hashedPassword, // ← Siempre hasheado
        telefono: employee.telefono,
        activo: employee.activo,
        role: employee.role,
        rol: employee.rol || employee.role,
        permissions: employee.permissions || {}
      })
    if (error) throw error
    }

    // Nuevo método para resetear contraseña
    static async resetPassword(employeeId: string): Promise<string> {
    const tempPassword = Security.generateTempPassword()
    const hashedPassword = await Security.hashPassword(tempPassword)

    const { error } = await supabase
      .from('production_employees')
      .update({ password_hash: hashedPassword })
      .eq('id', employeeId)

    if (error) throw error

    return tempPassword // Devolver la contraseña temporal para mostrar al admin
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