// Producto del catálogo (estructura FINAL con FAMILIA)
export interface CatalogProduct {
  SKU: string
  FAMILIA: string        // NUEVO: Familia (electricidad, fontaneria, muebles, ventanas)
  CATEGORIA: string      // Subcategoría (Claraboyas, Paneles solares, etc.)
  NOMBRE: string
  DESCRIPCION?: string
  PRECIO_COMPRA?: number
  'PRECIO DE VENTA'?: number  // NUEVO campo con espacio
  PROVEEDOR?: string
  DIAS_ENTREGA_PROVEEDOR?: number
  TIEMPO_TOTAL_MIN: number
  REQUIERE_DISEÑO: 'SÍ' | 'NO'
  TIPO_DISEÑO?: string
  INSTRUCCIONES_DISEÑO?: string
  
  // Materiales (hasta 5)
  MATERIAL_1?: string
  MATERIAL_1_CANT?: number
  MATERIAL_1_UNIDAD?: string
  MATERIAL_2?: string
  MATERIAL_2_CANT?: number
  MATERIAL_2_UNIDAD?: string
  MATERIAL_3?: string
  MATERIAL_3_CANT?: number
  MATERIAL_3_UNIDAD?: string
  MATERIAL_4?: string
  MATERIAL_4_CANT?: number
  MATERIAL_4_UNIDAD?: string
  MATERIAL_5?: string
  MATERIAL_5_CANT?: number
  MATERIAL_5_UNIDAD?: string
  
  // Consumibles (hasta 10)
  CONSUMIBLE_1?: string
  CONSUMIBLE_1_CANT?: number
  CONSUMIBLE_1_UNIDAD?: string
  CONSUMIBLE_2?: string
  CONSUMIBLE_2_CANT?: number
  CONSUMIBLE_2_UNIDAD?: string
  CONSUMIBLE_3?: string
  CONSUMIBLE_3_CANT?: number
  CONSUMIBLE_3_UNIDAD?: string
  CONSUMIBLE_4?: string
  CONSUMIBLE_4_CANT?: number
  CONSUMIBLE_4_UNIDAD?: string
  CONSUMIBLE_5?: string
  CONSUMIBLE_5_CANT?: number
  CONSUMIBLE_5_UNIDAD?: string
  CONSUMIBLE_6?: string
  CONSUMIBLE_6_CANT?: number
  CONSUMIBLE_6_UNIDAD?: string
  CONSUMIBLE_7?: string
  CONSUMIBLE_7_CANT?: number
  CONSUMIBLE_7_UNIDAD?: string
  CONSUMIBLE_8?: string
  CONSUMIBLE_8_CANT?: number
  CONSUMIBLE_8_UNIDAD?: string
  CONSUMIBLE_9?: string
  CONSUMIBLE_9_CANT?: number
  CONSUMIBLE_9_UNIDAD?: string
  CONSUMIBLE_10?: string
  CONSUMIBLE_10_CANT?: number
  CONSUMIBLE_10_UNIDAD?: string
  
  // Tareas (hasta 12)
  TAREA_1_NOMBRE?: string
  TAREA_1_DURACION?: number
  TAREA_1_REQUIERE_MATERIAL?: 'SÍ' | 'NO'
  TAREA_1_REQUIERE_DISEÑO?: 'SÍ' | 'NO'
  TAREA_2_NOMBRE?: string
  TAREA_2_DURACION?: number
  TAREA_2_REQUIERE_MATERIAL?: 'SÍ' | 'NO'
  TAREA_2_REQUIERE_DISEÑO?: 'SÍ' | 'NO'
  TAREA_3_NOMBRE?: string
  TAREA_3_DURACION?: number
  TAREA_3_REQUIERE_MATERIAL?: 'SÍ' | 'NO'
  TAREA_3_REQUIERE_DISEÑO?: 'SÍ' | 'NO'
  TAREA_4_NOMBRE?: string
  TAREA_4_DURACION?: number
  TAREA_4_REQUIERE_MATERIAL?: 'SÍ' | 'NO'
  TAREA_4_REQUIERE_DISEÑO?: 'SÍ' | 'NO'
  TAREA_5_NOMBRE?: string
  TAREA_5_DURACION?: number
  TAREA_5_REQUIERE_MATERIAL?: 'SÍ' | 'NO'
  TAREA_5_REQUIERE_DISEÑO?: 'SÍ' | 'NO'
  TAREA_6_NOMBRE?: string
  TAREA_6_DURACION?: number
  TAREA_6_REQUIERE_MATERIAL?: 'SÍ' | 'NO'
  TAREA_6_REQUIERE_DISEÑO?: 'SÍ' | 'NO'
  TAREA_7_NOMBRE?: string
  TAREA_7_DURACION?: number
  TAREA_7_REQUIERE_MATERIAL?: 'SÍ' | 'NO'
  TAREA_7_REQUIERE_DISEÑO?: 'SÍ' | 'NO'
  TAREA_8_NOMBRE?: string
  TAREA_8_DURACION?: number
  TAREA_8_REQUIERE_MATERIAL?: 'SÍ' | 'NO'
  TAREA_8_REQUIERE_DISEÑO?: 'SÍ' | 'NO'
  TAREA_9_NOMBRE?: string
  TAREA_9_DURACION?: number
  TAREA_9_REQUIERE_MATERIAL?: 'SÍ' | 'NO'
  TAREA_9_REQUIERE_DISEÑO?: 'SÍ' | 'NO'
  TAREA_10_NOMBRE?: string
  TAREA_10_DURACION?: number
  TAREA_10_REQUIERE_MATERIAL?: 'SÍ' | 'NO'
  TAREA_10_REQUIERE_DISEÑO?: 'SÍ' | 'NO'
  TAREA_11_NOMBRE?: string
  TAREA_11_DURACION?: number
  TAREA_11_REQUIERE_MATERIAL?: 'SÍ' | 'NO'
  TAREA_11_REQUIERE_DISEÑO?: 'SÍ' | 'NO'
  TAREA_12_NOMBRE?: string
  TAREA_12_DURACION?: number
  TAREA_12_REQUIERE_MATERIAL?: 'SÍ' | 'NO'
  TAREA_12_REQUIERE_DISEÑO?: 'SÍ' | 'NO'
}

export interface Tarifa {
  id: string
  name: string
  hourlyRate: number
  profitMargin: number
}

export interface QuoteItem {
  id: string
  catalogSKU: string
  productName: string
  quantity: number
  materialsTotal: number
  laborHours: number
  laborCost: number
  totalCost: number
  catalogData?: CatalogProduct // Permite que los productos manuales lleven los datos necesarios para automatización
}

export interface Quote {
  id: string
  quoteNumber: string

  // Vínculo CRM (opcional: enlaza el presupuesto a un lead)
  lead_id?: string
  
  // Datos básicos del cliente (necesarios para guardar/enviar)
  clientName: string
  clientEmail?: string
  clientPhone?: string
  vehicleModel?: string
  vehicleSize?: string
  
  // Datos de facturación (necesarios solo para aprobar)
  billingData?: {
    nif: string                    // NIF/CIF
    fiscalName: string             // Razón social (si es empresa)
    address: string                // Dirección completa
    postalCode: string             // Código postal
    city: string                   // Ciudad
    province: string               // Provincia
    country: string                // País
  }
  
  tarifa: Tarifa
  items: QuoteItem[]
  subtotalMaterials: number
  subtotalLabor: number
  subtotal: number
  profitMargin: number
  profitAmount: number
  total: number
  totalHours: number
  createdAt: Date
  validUntil: Date
  approvedAt?: Date
  cancelledAt?: Date
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
  notes?: string

  /**
   * Datos editados del documento (líneas personalizadas, notas al pie, etc.).
   * Se persisten al guardar desde QuotePreview para que la factura conserve los cambios.
   */
  documentData?: {
    customLines?: import('../components/QuotePDF').CustomLine[]
    footerNotes?: string
    showBreakdown?: boolean
    paymentInstallments?: import('../components/QuotePDF').PaymentInstallment[]
    company?: {
      name: string
      nif: string
      address: string
      phone: string
      email: string
      logoUrl?: string
    }
  }
}