/**
 * pdfGenerator.ts
 * Genera un PDF real a partir del HTML renderizado por QuotePDF.
 *
 * Usa html2canvas para rasterizar el contenedor y jsPDF para empaquetar
 * la imagen en un PDF A4 de alta resolución.
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * Renderiza el elemento #quote-pdf-content del DOM actual en un Blob PDF.
 * El elemento debe existir y ser visible en el viewport (puede estar off-screen
 * si está en un overflow:auto container — html2canvas lo maneja).
 */
export async function generatePdfBlob(element?: HTMLElement): Promise<Blob> {
  const el = element ?? document.getElementById('quote-pdf-content')
  if (!el) throw new Error('No se encontró el contenedor del PDF (#quote-pdf-content)')

  // Renderizar a canvas con alta resolución
  const canvas = await html2canvas(el, {
    scale: 2,              // 2x para buena resolución
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  })

  // Calcular dimensiones A4 en mm
  const A4_WIDTH_MM = 210
  const A4_HEIGHT_MM = 297
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const imgData = canvas.toDataURL('image/jpeg', 0.95)
  const imgWidth = A4_WIDTH_MM
  const imgHeight = (canvas.height * A4_WIDTH_MM) / canvas.width

  // Si el contenido cabe en una página
  if (imgHeight <= A4_HEIGHT_MM) {
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight)
  } else {
    // Multi-página: recortar el canvas por secciones
    let yOffset = 0
    let page = 0
    const pageHeightPx = (canvas.width * A4_HEIGHT_MM) / A4_WIDTH_MM

    while (yOffset < canvas.height) {
      if (page > 0) pdf.addPage()

      // Crear un canvas parcial para esta página
      const sliceHeight = Math.min(pageHeightPx, canvas.height - yOffset)
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = sliceHeight
      const ctx = pageCanvas.getContext('2d')!
      ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)

      const pageImg = pageCanvas.toDataURL('image/jpeg', 0.95)
      const sliceHeightMM = (sliceHeight * A4_WIDTH_MM) / canvas.width
      pdf.addImage(pageImg, 'JPEG', 0, 0, imgWidth, sliceHeightMM)

      yOffset += pageHeightPx
      page++
    }
  }

  return pdf.output('blob')
}

/**
 * Genera PDF y lo descarga directamente en el navegador.
 */
export async function downloadPdf(filename: string, element?: HTMLElement): Promise<void> {
  const blob = await generatePdfBlob(element)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
