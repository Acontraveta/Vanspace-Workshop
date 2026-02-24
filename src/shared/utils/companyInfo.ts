/**
 * companyInfo.ts
 * Shared utility to load company info (name, NIF, address, phone, email, logo)
 * from the Supabase `company_info` table via ConfigService.
 *
 * All document generators and UI components should use this instead of
 * hardcoding company defaults.
 */

import { ConfigService } from '@/features/config/services/configService'

export interface CompanyData {
  name: string
  nif: string
  address: string
  phone: string
  email: string
  logoUrl: string
  bankDetails?: string
}

/** Static fallback logo served from public/assets */
export const LOGO_URL = '/assets/logo-vanspace.jpeg'

export const DEFAULT_COMPANY: CompanyData = {
  name: 'VanSpace Workshop',
  nif: '',
  address: '',
  phone: '',
  email: '',
  logoUrl: LOGO_URL,
}

/**
 * Loads company data from the `company_info` table.
 * Returns DEFAULT_COMPANY values as fallback for missing fields.
 * The logo defaults to the static file unless overridden in the DB.
 */
export async function loadCompanyInfo(): Promise<CompanyData> {
  try {
    const rows = await ConfigService.getCompanyInfo()
    if (!rows || rows.length === 0) return { ...DEFAULT_COMPANY }

    const get = (campo: string) => rows.find(r => r.campo === campo)?.valor ?? ''

    return {
      name: get('nombre_empresa') || DEFAULT_COMPANY.name,
      nif: get('nif') || DEFAULT_COMPANY.nif,
      address: get('direccion') || DEFAULT_COMPANY.address,
      phone: get('telefono') || DEFAULT_COMPANY.phone,
      email: get('email') || DEFAULT_COMPANY.email,
      logoUrl: get('logo_url') || LOGO_URL,
      bankDetails: get('DATOS_BANCARIOS') || undefined,
    }
  } catch {
    return { ...DEFAULT_COMPANY }
  }
}

/**
 * Converts the company logo to a base64 data URI.
 * Required for html2canvas / jsPDF workflows where external URLs may fail.
 */
export async function logoToBase64(url?: string): Promise<string> {
  const src = url || LOGO_URL
  try {
    const resp = await fetch(src)
    const blob = await resp.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}
