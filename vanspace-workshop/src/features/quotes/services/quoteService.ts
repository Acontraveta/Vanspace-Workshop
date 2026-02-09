import { Quote } from '../types/quote.types'
import toast from 'react-hot-toast'

export class QuoteService {
  private static STORAGE_KEY = 'saved_quotes'

  // Guardar presupuesto
  static saveQuote(quote: Quote): void {
    const quotes = this.getAllQuotes()
    
    // Verificar si ya existe (actualizar) o es nuevo
    const existingIndex = quotes.findIndex(q => q.id === quote.id)
    
    if (existingIndex >= 0) {
      quotes[existingIndex] = quote
    } else {
      quotes.push(quote)
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(quotes))
    toast.success('Presupuesto guardado')
  }

  // Obtener todos los presupuestos
  static getAllQuotes(): Quote[] {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
      try {
        const quotes = JSON.parse(stored)
        // Convertir strings a Date
        return quotes.map((q: any) => ({
          ...q,
          createdAt: new Date(q.createdAt),
          validUntil: new Date(q.validUntil),
          approvedAt: q.approvedAt ? new Date(q.approvedAt) : undefined,
        }))
      } catch (e) {
        return []
      }
    }
    return []
  }

  // Obtener presupuesto por ID
  static getQuoteById(id: string): Quote | undefined {
    return this.getAllQuotes().find(q => q.id === id)
  }

  // Aprobar presupuesto
  static approveQuote(quoteId: string): Quote {
    const quotes = this.getAllQuotes()
    const quote = quotes.find(q => q.id === quoteId)
    
    if (!quote) {
      throw new Error('Presupuesto no encontrado')
    }
    
    if (quote.status === 'APPROVED') {
      throw new Error('El presupuesto ya está aprobado')
    }
    
    // Actualizar estado
    quote.status = 'APPROVED'
    quote.approvedAt = new Date()
    
    // Guardar
    this.saveQuote(quote)
    
    toast.success('¡Presupuesto aprobado! Iniciando automatización...')
    
    return quote
  }

  // Rechazar presupuesto
  static rejectQuote(quoteId: string): Quote {
    const quotes = this.getAllQuotes()
    const quote = quotes.find(q => q.id === quoteId)
    
    if (!quote) {
      throw new Error('Presupuesto no encontrado')
    }
    
    quote.status = 'REJECTED'
    this.saveQuote(quote)
    
    toast.success('Presupuesto rechazado')
    return quote
  }

  // Eliminar presupuesto
  static deleteQuote(quoteId: string): void {
    const quotes = this.getAllQuotes().filter(q => q.id !== quoteId)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(quotes))
    toast.success('Presupuesto eliminado')
  }

  // Obtener presupuestos por estado
  static getQuotesByStatus(status: Quote['status']): Quote[] {
    return this.getAllQuotes().filter(q => q.status === status)
  }
}
