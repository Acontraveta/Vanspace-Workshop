import { Quote, QuoteItem } from '../types/quote.types'
import { PurchaseItem } from '@/features/purchases/types/purchase.types'
import { StockService } from '@/features/purchases/services/stockService'
import { PurchaseService } from '@/features/purchases/services/purchaseService'
import { supabase } from '@/lib/supabase'

interface AutomationResult {
  success: boolean
  details: {
    totalPurchaseItems: number
    totalTasks: number
    totalDesignInstructions: number
  }
  errors: string[]
}

export class QuoteAutomation {
  
  static async executeAutomation(quote: Quote): Promise<AutomationResult> {
    console.log('🤖 Ejecutando automatización para:', quote.quoteNumber)
    
    const errors: string[] = []
    let totalPurchaseItems = 0
    let totalTasks = 0
    let totalDesignInstructions = 0
    
    try {
      // 1. Generar pedidos de materiales (considerando stock desde Supabase)
      const purchaseItems = await this.generatePurchaseList(quote)
      totalPurchaseItems = purchaseItems.length
      
      // Guardar pedidos en Supabase (error no-bloquea la automatización)
      if (purchaseItems.length > 0) {
        try {
          await PurchaseService.savePurchases(purchaseItems)
        } catch (saveErr: any) {
          console.error('⚠️ Error guardando pedidos en Supabase:', saveErr)
          errors.push('Pedidos no guardados en Supabase: ' + saveErr.message)
        }
      }
      
      console.log(`📦 ${totalPurchaseItems} pedidos de compra generados`)
      
      // 2. Generar tareas de producción
      const tasks = this.generateProductionTasks(quote)
      totalTasks = tasks.length
      
      // Guardar tareas
      const existingTasks = JSON.parse(localStorage.getItem('production_tasks') || '[]')
      const allTasks = [...existingTasks, ...tasks]
      localStorage.setItem('production_tasks', JSON.stringify(allTasks))
      
      console.log(`⚙️ ${totalTasks} tareas de producción generadas`)
      
      // 3. Generar instrucciones de diseño
      const designInstructions = this.generateDesignInstructions(quote)
      totalDesignInstructions = designInstructions.length
      
      // Guardar instrucciones
      const existingDesigns = JSON.parse(localStorage.getItem('design_instructions') || '[]')
      const allDesigns = [...existingDesigns, ...designInstructions]
      localStorage.setItem('design_instructions', JSON.stringify(allDesigns))
      
      console.log(`📐 ${totalDesignInstructions} instrucciones de diseño generadas`)
      
      // 4. Añadir pedidos para stock bajo
      const lowStockPurchases = this.generateLowStockPurchases()
      if (lowStockPurchases.length > 0) {
        try {
          await PurchaseService.savePurchases(lowStockPurchases)
          totalPurchaseItems += lowStockPurchases.length
          console.log(`⚠️ ${lowStockPurchases.length} pedidos adicionales por stock bajo`)
        } catch (lsErr: any) {
          console.warn('⚠️ Error guardando pedidos de stock bajo:', lsErr.message)
        }
      }
      
      // 5. NUEVO: Crear proyecto de producción en el calendario
      try {
        console.log('📅 Creando proyecto en calendario...')
        const { ProductionService } = await import('@/features/calendar/services/productionService')
        
        const project = await ProductionService.createProject({
          quote_id: undefined, // NO pasar el quote.id porque no es UUID
          quote_number: quote.quoteNumber,
          client_name: quote.clientName,
          vehicle_model: quote.vehicleModel,
          total_hours: quote.totalHours,
          status: 'WAITING',
          priority: 5,
          requires_materials: purchaseItems.length > 0,
          materials_ready: false,
          requires_design: designInstructions.length > 0,
          design_ready: false,
          notes: `Presupuesto ID: ${quote.id}\n` +
                 (quote.lead_id ? `CRM Lead ID: ${quote.lead_id}\n` : '') +
                 `Aprobado: ${quote.total.toFixed(2)}€\n` +
                 `📦 Materiales: ${totalPurchaseItems} pedidos\n` +
                 `⚙️ Tareas: ${totalTasks}\n` +
                 `📐 Diseños: ${totalDesignInstructions}`
        })
        
        console.log('✅ Proyecto creado en calendario:', project.id)
        
        // Vincular los pedidos de compra recién creados a este proyecto en Supabase
        if (purchaseItems.length > 0) {
          try {
            await supabase
              .from('purchase_items')
              .update({ project_id: project.id })
              .in('id', purchaseItems.map(p => p.id))
            console.log(`🔗 ${purchaseItems.length} pedidos vinculados al proyecto ${project.id}`)
          } catch (e) {
            console.warn('No se pudieron vincular los pedidos al proyecto:', e)
          }
        }
        // Agrupar tasks por productSKU para saber cuál es la primera de cada bloque
        const tasksByBlock: Record<string, typeof tasks> = {};
        const blockMaterialsCollected: Record<string, boolean> = {};
        tasks.forEach(task => {
          const blockId = task.productSKU || task.productName;
          if (!tasksByBlock[blockId]) tasksByBlock[blockId] = [];
          tasksByBlock[blockId].push(task);
        });
        // Determinar si algún task del bloque ha recogido materiales
        Object.keys(tasksByBlock).forEach(blockId => {
          const blockTasks = tasksByBlock[blockId];
          // Si algún task tiene materials_collected true, el bloque está recogido
          blockMaterialsCollected[blockId] = blockTasks.some(t => t.materials_collected === true);
        });

        // Crear tareas de producción en Supabase
        for (const task of tasks) {
          const blockId = task.productSKU || task.productName;
          const blockTasks = tasksByBlock[blockId];
          const isFirst = blockTasks.indexOf(task) === 0;
          const blockOrder = blockTasks.indexOf(task);
          // Nuevo: materiales_collected a nivel de bloque
          const materialsCollected = blockMaterialsCollected[blockId] || false;

          // ► Determinar si esta tarea debe bloquearse:
          //   Solo si ALGUNO de sus materiales no tenía stock suficiente
          //   (= fue añadido a purchaseItems).
          //   Matching por nombre de material, no por productName (que no se guarda en purchases).
          const pendingMaterials = purchaseItems.filter(p =>
            task.materialsList?.some((m: any) =>
              m.name?.toLowerCase().trim() === p.materialName?.toLowerCase().trim()
            )
          );
          const isBlocked = task.requiresMaterial && pendingMaterials.length > 0;

          // Construir blocked_reason solo si realmente está bloqueada
          let blockedReason: string | undefined = undefined;
          if (isBlocked) {
            const lines = pendingMaterials.map(p => {
              const deliveryDays = p.deliveryDays ||
                quote.items.find(i => i.productName === task.productName || i.catalogSKU === task.productSKU)
                  ?.catalogData?.DIAS_ENTREGA_PROVEEDOR || 7;
              const arrivalDate = new Date();
              arrivalDate.setDate(arrivalDate.getDate() + Number(deliveryDays));
              const arrivalStr = arrivalDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
              return `• ${p.materialName} (${p.quantity} ${p.unit}) · Llega ~${arrivalStr}`;
            });
            blockedReason = `Esperando materiales:\n${lines.join('\n')}`;
          }

          await ProductionService.createTask({
            project_id: project.id,
            task_name: task.taskName,
            product_name: task.productName,
            estimated_hours: task.duration,
            status: isBlocked ? 'BLOCKED' : 'PENDING',
            requires_material: task.requiresMaterial ? 'Materiales del producto' : undefined,
            material_ready: !isBlocked,
            requires_design: task.requiresDesign,
            design_ready: true,
            blocked_reason: blockedReason,
            order_index: tasks.indexOf(task),
            materials: task.materialsList || [],
            consumables: task.consumablesList || [],
            instructions_design: task.instructions || '',
            catalog_sku: task.productSKU || '',
            requiere_diseno: task.requiresDesign || false,
            task_block_id: blockId,
            block_order: blockOrder,
            is_block_first: isFirst,
            materials_collected: materialsCollected,
          });
        }

        console.log(`✅ ${tasks.length} tareas añadidas al proyecto del calendario`)
        
      } catch (calendarError) {
        console.error('⚠️ Error creando proyecto en calendario (no crítico):', calendarError)
        // No fallar toda la automatización si solo falla el calendario
      }
      
      return {
        success: true,
        details: {
          totalPurchaseItems,
          totalTasks,
          totalDesignInstructions
        },
        errors
      }
      
    } catch (error: any) {
      console.error('❌ Error crítico en automatización:', error.message, error)
      return {
        success: false,
        details: { totalPurchaseItems, totalTasks, totalDesignInstructions },
        errors: [error.message]
      }
    }
  }
  
  private static async generatePurchaseList(quote: Quote): Promise<PurchaseItem[]> {
    const purchases: PurchaseItem[] = []
    const projectId = quote.id.slice(-5)
    
    console.log('🔍 GENERANDO PEDIDOS PARA:', quote.quoteNumber)
    console.log('📋 Total items en presupuesto:', quote.items.length)
    
    for (let idx = 0; idx < quote.items.length; idx++) {
      const item = quote.items[idx] as QuoteItem
      console.log(`\n--- ITEM ${idx + 1}: ${item.productName} ---`)
      console.log('Catalog data:', item.catalogData)
      
      // Obtener materiales del producto
      const materials = this.extractMaterials(item)
      console.log(`\ud83d\udce6 Materiales extra\u00eddos:`, materials.length)
      
      for (let matIdx = 0; matIdx < materials.length; matIdx++) {
        const material = materials[matIdx]
        console.log(`\n  Material ${matIdx + 1}:`, material.name, '-', material.quantity)
          
          // VERIFICAR STOCK DISPONIBLE (desde Supabase)
          const { data: stockRow } = await supabase
            .from('stock_items')
            .select('cantidad, articulo, unidad')
            .or(`articulo.ilike.%${material.name}%,referencia.ilike.%${material.name}%`)
            .maybeSingle()
          console.log(`  Stock encontrado:`, stockRow ? `${stockRow.articulo} (${stockRow.cantidad} ${stockRow.unidad})` : '❌ NO ENCONTRADO')
          
          const stockDisponible = (stockRow?.cantidad as number) || 0
          const cantidadNecesaria = material.quantity
          
          console.log(`  Necesario: ${cantidadNecesaria} | Disponible: ${stockDisponible}`)
          
          // Solo crear pedido si NO hay suficiente stock
          if (stockDisponible < cantidadNecesaria) {
            const cantidadAPedir = cantidadNecesaria - stockDisponible
            console.log(`  ✅ CREAR PEDIDO: ${cantidadAPedir} ${material.unit}`)
            
            // Calcular prioridad basada en días de entrega
            const deliveryDays = material.deliveryDays || 7
            let priority = 5
            
            if (deliveryDays >= 14) {
              priority = 3
            }
            purchases.push({
              id: crypto.randomUUID(),
              referencia: '',
              materialName: material.name,
              quantity: cantidadAPedir,
              unit: material.unit,
              priority,
              status: 'PENDING',
              createdAt: new Date(),
              notes: ''
            })
          } else {
            console.log(`  ⏭️ OMITIR: Hay suficiente stock`)
          }
        }
      }
    
    console.log(`\n✅ TOTAL PEDIDOS GENERADOS: ${purchases.length}`)
    
    // ORDENAR POR PRIORIDAD (mayor primero)
    return purchases.sort((a, b) => b.priority - a.priority)
  }

  private static generateLowStockPurchases(): PurchaseItem[] {
    const lowStockItems = StockService.getLowStockItems()
    const purchases: PurchaseItem[] = []
    
    lowStockItems.forEach(item => {
      const cantidadAPedir = (item.STOCK_MINIMO || 0) - item.CANTIDAD + (item.STOCK_MINIMO || 0)
      
      if (cantidadAPedir > 0) {
        const purchase: PurchaseItem = {
          id: crypto.randomUUID(),
          referencia: item.REFERENCIA,
          materialName: item.ARTICULO,
          quantity: cantidadAPedir,
          unit: item.UNIDAD,
          priority: 8,
          status: 'PENDING',
          createdAt: new Date(),
          notes: `⚠️ REPOSICIÓN AUTOMÁTICA - Stock bajo (${item.CANTIDAD} < ${item.STOCK_MINIMO})`
        }
        
        purchases.push(purchase)
      }
    })
    
    return purchases
  }
  
  private static extractMaterials(item: QuoteItem): Array<{
    name: string
    quantity: number
    unit: string
    provider?: string
    deliveryDays?: number
  }> {
    const materials: Array<{
      name: string
      quantity: number
      unit: string
      provider?: string
      deliveryDays?: number
    }> = []

    if (!item.catalogData) {
      console.log('  ⚠️ Sin catalogData en item:', item.productName)
      return materials
    }
    
    console.log('  🔍 Extrayendo materiales de catalogData...')

    // Extraer de MATERIAL_X
    for (let i = 1; i <= 5; i++) {
      const matKey = `MATERIAL_${i}` as keyof typeof item.catalogData
      const cantKey = `MATERIAL_${i}_CANT` as keyof typeof item.catalogData
      const unidadKey = `MATERIAL_${i}_UNIDAD` as keyof typeof item.catalogData
      
      const materialName = item.catalogData[matKey]
      const cantidad = parseFloat(String(item.catalogData[cantKey] || 0))
      const unidad = item.catalogData[unidadKey] as string || 'ud'
      
      if (materialName && cantidad > 0) {
        console.log(`    MATERIAL_${i}:`, materialName, cantidad, unidad)
        materials.push({
          name: String(materialName),
          quantity: cantidad * item.quantity,
          unit: unidad,
          provider: item.catalogData.PROVEEDOR as string,
          deliveryDays: parseInt(String(item.catalogData.DIAS_ENTREGA_PROVEEDOR || 7))
        })
      }
    }
    
    // Extraer de CONSUMIBLE_X
    for (let i = 1; i <= 10; i++) {
      const consKey = `CONSUMIBLE_${i}` as keyof typeof item.catalogData
      const cantKey = `CONSUMIBLE_${i}_CANT` as keyof typeof item.catalogData
      const unidadKey = `CONSUMIBLE_${i}_UNIDAD` as keyof typeof item.catalogData
      
      const consumibleName = item.catalogData[consKey]
      const cantidad = parseFloat(String(item.catalogData[cantKey] || 0))
      const unidad = item.catalogData[unidadKey] as string || 'ud'
      
      if (consumibleName && cantidad > 0) {
        console.log(`    CONSUMIBLE_${i}:`, consumibleName, cantidad, unidad)
        materials.push({
          name: String(consumibleName),
          quantity: cantidad * item.quantity,
          unit: unidad,
          provider: item.catalogData.PROVEEDOR as string,
          deliveryDays: parseInt(String(item.catalogData.DIAS_ENTREGA_PROVEEDOR || 7))
        })
      }
    }
    
    console.log(`  Total materiales encontrados: ${materials.length}`)
    
    return materials
  }
  
  private static generateProductionTasks(quote: Quote): any[] {
    const tasks: any[] = []
    const projectId = quote.id.slice(-5)
    
    quote.items.forEach((item: QuoteItem) => {
      // Extraer materiales y consumibles del producto
      const materialsList = [];
      const consumablesList = [];
      for (let m = 1; m <= 10; m++) {
        const matKey = `MATERIAL_${m}`;
        const cantKey = `MATERIAL_${m}_CANT`;
        const unidadKey = `MATERIAL_${m}_UNIDAD`;
        if (item.catalogData && item.catalogData[matKey]) {
          materialsList.push({
            name: item.catalogData[matKey],
            quantity: item.catalogData[cantKey] || 1,
            unit: item.catalogData[unidadKey] || 'ud',
          });
        }
        const consKey = `CONSUMIBLE_${m}`;
        const consCantKey = `CONSUMIBLE_${m}_CANT`;
        const consUnidadKey = `CONSUMIBLE_${m}_UNIDAD`;
        if (item.catalogData && item.catalogData[consKey]) {
          consumablesList.push({
            name: item.catalogData[consKey],
            quantity: item.catalogData[consCantKey] || 1,
            unit: item.catalogData[consUnidadKey] || 'ud',
          });
        }
      }
      // Si no hay catalogData ni tareas definidas, generar una tarea genérica por defecto
      if (!item.catalogData) {
        const genericTask = {
          id: crypto.randomUUID(),
          projectId,
          projectNumber: quote.quoteNumber,
          productSKU: item.catalogSKU,
          productName: item.productName,
          taskName: item.productName,
          duration: item.laborHours,
          requiresMaterial: false,
          requiresDesign: false,
          blocked: false,
          status: 'READY',
          assignedTo: null,
          createdAt: new Date(),
          materialsList: [],
          consumablesList: [],
          instructions: '',
        };
        tasks.push(genericTask);
        return;
      }

      // Extraer tareas del producto
      let hasExplicitTasks = false;
      for (let i = 1; i <= 12; i++) {
        const tareaKey = `TAREA_${i}_NOMBRE` as keyof typeof item.catalogData;
        const duracionKey = `TAREA_${i}_DURACION` as keyof typeof item.catalogData;
        const requiereMaterialKey = `TAREA_${i}_REQUIERE_MATERIAL` as keyof typeof item.catalogData;
        const requiereDiseñoKey = `TAREA_${i}_REQUIERE_DISEÑO` as keyof typeof item.catalogData;
        const tareaNombre = item.catalogData[tareaKey];
        const duracion = parseFloat(String(item.catalogData[duracionKey] || 0));
        const requiereMaterial = String(item.catalogData[requiereMaterialKey]) === 'SÍ';
        const requiereDiseño = String(item.catalogData[requiereDiseñoKey]) === 'SÍ';
        if (tareaNombre && duracion > 0) {
          hasExplicitTasks = true;
          const task = {
            id: crypto.randomUUID(),
            projectId,
            projectNumber: quote.quoteNumber,
            productSKU: item.catalogSKU,
            productName: item.productName,
            taskName: String(tareaNombre),
            duration: duracion,
            requiresMaterial: requiereMaterial,
            requiresDesign: requiereDiseño,
            blocked: requiereMaterial, // Solo se bloquea si falta material
            status: requiereMaterial ? 'BLOCKED' : 'READY',
            assignedTo: null,
            createdAt: new Date(),
            materialsList,
            consumablesList,
            instructions: item.catalogData && item.catalogData.INSTRUCCIONES_DISEÑO ? item.catalogData.INSTRUCCIONES_DISEÑO : '',
          };
          tasks.push(task);
        }
      }

      // Si no se encontraron tareas explícitas, crear una tarea genérica
      if (!hasExplicitTasks) {
        const hasMaterials = materialsList.length + consumablesList.length > 0;
        const genericTask = {
          id: crypto.randomUUID(),
          projectId,
          projectNumber: quote.quoteNumber,
          productSKU: item.catalogSKU,
          productName: item.productName,
          taskName: item.productName,
          duration: item.laborHours,
          requiresMaterial: hasMaterials,
          requiresDesign: item.catalogData.REQUIERE_DISEÑO === 'SÍ',
          blocked: hasMaterials,
          status: hasMaterials ? 'BLOCKED' : 'READY',
          assignedTo: null,
          createdAt: new Date(),
          materialsList,
          consumablesList,
          instructions: item.catalogData.INSTRUCCIONES_DISEÑO || '',
        };
        tasks.push(genericTask);
      }
    });
    
    return tasks
  }
  
  private static generateDesignInstructions(quote: Quote): any[] {
    const designs: any[] = []
    const projectId = quote.id.slice(-5)
    
    quote.items.forEach((item: QuoteItem) => {
      if (!item.catalogData) return
      const requiereDiseno = item.catalogData.REQUIERE_DISEÑO === 'SÍ'
      
      if (requiereDiseno) {
        const design = {
          id: crypto.randomUUID(),
          projectId,
          projectNumber: quote.quoteNumber,
          productSKU: item.catalogSKU,
          productName: item.productName,
          designType: item.catalogData.TIPO_DISEÑO || 'GENERAL',
          instructions: item.catalogData.INSTRUCCIONES_DISEÑO || 'Sin instrucciones específicas',
          status: 'PENDING',
          createdAt: new Date()
        }
        
        designs.push(design)
      }
    })
    
    return designs
  }
}