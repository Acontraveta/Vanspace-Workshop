import { Quote } from '../types/quote.types'
import { CatalogService } from './catalogService'
import toast from 'react-hot-toast'

export interface AutomationResult {
  projectCreated: boolean
  purchaseListGenerated: boolean
  tasksGenerated: boolean
  designInstructionsGenerated: boolean
  calendarScheduled: boolean
  details: {
    projectId?: string
    totalPurchaseItems: number
    totalTasks: number
    totalDesignInstructions: number
    estimatedStartDate?: Date
    estimatedEndDate?: Date
  }
}

export class QuoteAutomation {
  // Ejecutar automatización completa al aprobar presupuesto
  static async executeAutomation(quote: Quote): Promise<AutomationResult> {
    console.log('🚀 Iniciando automatización para presupuesto:', quote.quoteNumber)
    
    const result: AutomationResult = {
      projectCreated: false,
      purchaseListGenerated: false,
      tasksGenerated: false,
      designInstructionsGenerated: false,
      calendarScheduled: false,
      details: {
        totalPurchaseItems: 0,
        totalTasks: 0,
        totalDesignInstructions: 0,
      }
    }
    
    try {
      // 1. Crear Proyecto
      const project = await this.createProject(quote)
      result.projectCreated = true
      result.details.projectId = project.id
      console.log('✅ Proyecto creado:', project)
      
      // 2. Generar Lista de Compra
      const purchaseList = await this.generatePurchaseList(quote, project.id)
      result.purchaseListGenerated = true
      result.details.totalPurchaseItems = purchaseList.length
      console.log('✅ Lista de compra generada:', purchaseList.length, 'items')
      
      // 3. Generar Tareas de Producción
      const tasks = await this.generateProductionTasks(quote, project.id)
      result.tasksGenerated = true
      result.details.totalTasks = tasks.length
      console.log('✅ Tareas generadas:', tasks.length, 'tareas')
      
      // 4. Generar Instrucciones de Diseño
      const designInstructions = await this.generateDesignInstructions(quote, project.id)
      result.designInstructionsGenerated = true
      result.details.totalDesignInstructions = designInstructions.length
      console.log('✅ Instrucciones de diseño:', designInstructions.length)
      
      // 5. Programar en Calendario
      const schedule = await this.scheduleInCalendar(quote, project.id)
      result.calendarScheduled = true
      result.details.estimatedStartDate = schedule.startDate
      result.details.estimatedEndDate = schedule.endDate
      console.log('✅ Calendario programado:', schedule)
      
      toast.success(`Automatización completada: ${tasks.length} tareas, ${purchaseList.length} compras`)
      
      return result
      
    } catch (error: any) {
      console.error('❌ Error en automatización:', error)
      toast.error('Error en automatización: ' + error.message)
      throw error
    }
  }
  
  // 1. Crear Proyecto
  private static async createProject(quote: Quote) {
    const projectId = `PRJ-${Date.now()}`
    const projectNumber = `PRJ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
    
    const project = {
      id: projectId,
      projectNumber,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      clientName: quote.clientName,
      vehicleModel: quote.vehicleModel,
      businessLine: quote.businessLine,
      estimatedHours: quote.totalHours,
      estimatedCost: quote.total,
      status: 'PENDING',
      createdAt: new Date(),
    }
    
    // Guardar en localStorage
    const projects = JSON.parse(localStorage.getItem('projects') || '[]')
    projects.push(project)
    localStorage.setItem('projects', JSON.stringify(projects))
    
    return project
  }
  
  // 2. Generar Lista de Compra
  private static async generatePurchaseList(quote: Quote, projectId: string) {
    const purchaseItems: any[] = []
    
    for (const item of quote.items) {
      const product = CatalogService.getProductBySKU(item.catalogSKU)
      if (!product) continue
      
      // Obtener materiales del producto
      const materials = CatalogService.getProductMaterials(product)
      
      for (const material of materials) {
        purchaseItems.push({
          id: `PUR-${Date.now()}-${Math.random()}`,
          projectId,
          projectNumber: projectId,
          productSKU: product.SKU,
          productName: product.NOMBRE,
          materialName: material.name,
          quantity: material.quantity * item.quantity,
          unit: material.unit,
          provider: product.PROVEEDOR,
          deliveryDays: product.DIAS_ENTREGA_PROVEEDOR,
          priority: this.calculatePriority(product),
          status: 'PENDING',
          createdAt: new Date(),
        })
      }
    }
    
    // Guardar en localStorage
    const allPurchases = JSON.parse(localStorage.getItem('purchase_list') || '[]')
    allPurchases.push(...purchaseItems)
    localStorage.setItem('purchase_list', JSON.stringify(allPurchases))
    
    return purchaseItems
  }
  
  // 3. Generar Tareas de Producción
  private static async generateProductionTasks(quote: Quote, projectId: string) {
    const tasks: any[] = []
    let taskOrder = 1
    
    for (const item of quote.items) {
      const product = CatalogService.getProductBySKU(item.catalogSKU)
      if (!product) continue
      
      // Obtener tareas del producto
      const productTasks = CatalogService.getProductTasks(product)
      
      for (const task of productTasks) {
        for (let i = 0; i < item.quantity; i++) {
          tasks.push({
            id: `TASK-${Date.now()}-${Math.random()}`,
            projectId,
            productSKU: product.SKU,
            productName: product.NOMBRE,
            taskName: task.name,
            duration: task.duration,
            requiresMaterial: task.requiresMaterial,
            requiresDesign: task.requiresDesign,
            order: taskOrder++,
            status: 'PENDING',
            blocked: task.requiresMaterial || task.requiresDesign,
            createdAt: new Date(),
          })
        }
      }
    }
    
    // Guardar en localStorage
    const allTasks = JSON.parse(localStorage.getItem('production_tasks') || '[]')
    allTasks.push(...tasks)
    localStorage.setItem('production_tasks', JSON.stringify(allTasks))
    
    return tasks
  }
  
  // 4. Generar Instrucciones de Diseño
  private static async generateDesignInstructions(quote: Quote, projectId: string) {
    const instructions: any[] = []
    
    for (const item of quote.items) {
      const product = CatalogService.getProductBySKU(item.catalogSKU)
      if (!product || product.REQUIERE_DISEÑO !== 'SÍ') continue
      
      for (let i = 0; i < item.quantity; i++) {
        instructions.push({
          id: `DES-${Date.now()}-${Math.random()}`,
          projectId,
          productSKU: product.SKU,
          productName: product.NOMBRE,
          designType: product.TIPO_DISEÑO,
          instructions: product.INSTRUCCIONES_DISEÑO,
          status: 'PENDING',
          priority: 'NORMAL',
          createdAt: new Date(),
        })
      }
    }
    
    // Guardar en localStorage
    const allInstructions = JSON.parse(localStorage.getItem('design_instructions') || '[]')
    allInstructions.push(...instructions)
    localStorage.setItem('design_instructions', JSON.stringify(allInstructions))
    
    return instructions
  }
  
  // 5. Programar en Calendario
  private static async scheduleInCalendar(quote: Quote, projectId: string) {
    // Calcular fechas (por ahora simple, en producción sería más complejo)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + 7) // Empezar en 7 días
    
    const endDate = new Date(startDate)
    const daysNeeded = Math.ceil(quote.totalHours / 8) // 8h por día
    endDate.setDate(endDate.getDate() + daysNeeded)
    
    const calendarEvent = {
      id: `CAL-${Date.now()}`,
      projectId,
      title: `${quote.clientName} - ${quote.vehicleModel}`,
      startDate,
      endDate,
      totalHours: quote.totalHours,
      status: 'SCHEDULED',
      createdAt: new Date(),
    }
    
    // Guardar en localStorage
    const allEvents = JSON.parse(localStorage.getItem('calendar_events') || '[]')
    allEvents.push(calendarEvent)
    localStorage.setItem('calendar_events', JSON.stringify(allEvents))
    
    return { startDate, endDate }
  }
  
  // Calcular prioridad de compra (1-10)
  private static calculatePriority(product: any): number {
    const deliveryDays = product.DIAS_ENTREGA_PROVEEDOR || 0
    
    // Más días de entrega = mayor prioridad (comprar antes)
    if (deliveryDays > 10) return 10
    if (deliveryDays > 7) return 8
    if (deliveryDays > 5) return 6
    if (deliveryDays > 3) return 4
    return 2
  }
}
