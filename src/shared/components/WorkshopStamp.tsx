/**
 * WorkshopStamp.tsx
 *
 * Sello/firma digital del taller generado automáticamente a partir
 * de los datos de empresa. Diseñado para embeberse en documentos PDF
 * renderizados vía html2canvas / jsPDF.
 *
 * Usa solo inline styles (no Tailwind) para compatibilidad con la
 * generación de PDF offscreen.
 */

import type { CompanyData } from '@/shared/utils/companyInfo'

interface WorkshopStampProps {
  company: CompanyData
  date?: string           // fecha del documento
  width?: number          // px, default 210
}

export default function WorkshopStamp({ company, date, width = 210 }: WorkshopStampProps) {
  const today = date || new Date().toLocaleDateString('es-ES')

  return (
    <div
      style={{
        width: `${width}px`,
        border: '2px solid #1e3a5f',
        borderRadius: '8px',
        padding: '8px 12px',
        position: 'relative',
        background: 'rgba(30, 58, 95, 0.03)',
      }}
    >
      {/* Logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        {company.logoUrl && (
          <img
            src={company.logoUrl}
            alt="logo"
            style={{ height: '22px', objectFit: 'contain' }}
            crossOrigin="anonymous"
          />
        )}
        <div style={{ fontWeight: 700, fontSize: '11px', color: '#1e3a5f', letterSpacing: '0.5px' }}>
          {company.name}
        </div>
      </div>

      {/* NIF */}
      {company.nif && (
        <div style={{ fontSize: '9px', color: '#374151' }}>
          NIF: {company.nif}
        </div>
      )}

      {/* Address */}
      {company.address && (
        <div style={{ fontSize: '8px', color: '#6b7280', lineHeight: 1.3 }}>
          {company.address}
        </div>
      )}

      {/* Contact */}
      {(company.phone || company.email) && (
        <div style={{ fontSize: '8px', color: '#6b7280' }}>
          {[company.phone, company.email].filter(Boolean).join(' · ')}
        </div>
      )}

      {/* Date */}
      <div style={{ fontSize: '8px', color: '#9ca3af', marginTop: '4px', textAlign: 'right' }}>
        {today}
      </div>

      {/* Decorative seal ring */}
      <div
        style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          border: '2px solid #1e3a5f',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
        }}
      >
        ✓
      </div>
    </div>
  )
}
