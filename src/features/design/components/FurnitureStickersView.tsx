import { Piece, PlacedPiece } from '../types/furniture.types'

interface FurnitureStickersViewProps {
  pieces: Piece[] | PlacedPiece[]
  moduleName: string
  projectInfo?: string        // e.g. "PRJ-001 · Mario García"
  defaultMaterial?: string    // fallback material name when piece has none
}

/**
 * Sticker labels sized for standard A4 sheets:
 *   3 columns × 7 rows = 21 labels per page
 *   Each label: 70 mm × 42.4 mm  (3×70 = 210 mm = A4 width, 7×42.4 = 296.8 mm ≈ A4 height)
 */
const COLS = 3
const LABELS_PER_PAGE = COLS * 7   // 21

export function FurnitureStickersView({ pieces, moduleName, projectInfo, defaultMaterial }: FurnitureStickersViewProps) {
  // Split pieces into pages of 21
  const pages: (Piece | PlacedPiece)[][] = []
  for (let i = 0; i < pieces.length; i += LABELS_PER_PAGE) {
    pages.push(pieces.slice(i, i + LABELS_PER_PAGE))
  }

  return (
    <div className="stickers-root bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
      {/* Toolbar – hidden when printing */}
      <div className="flex justify-between items-center mb-6 no-print">
        <div>
          <h3 className="text-base font-black uppercase tracking-tight text-slate-900">
            Etiquetas de Identificación
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Formato 70×42.4 mm · {pieces.length} piezas · {pages.length} {pages.length === 1 ? 'página' : 'páginas'}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all"
        >
          🖨️ Imprimir etiquetas
        </button>
      </div>

      {pages.map((pagePieces, pageIdx) => (
        <div key={pageIdx} className="sticker-page">
          {pagePieces.map((p, i) => {
            const globalIdx = pageIdx * LABELS_PER_PAGE + i
            const placed = 'board' in p ? (p as PlacedPiece) : null
            const boardNum = placed?.board != null ? placed.board + 1 : null
            const matName  = p.materialName
            const rotated  = placed?.rotated

            return (
              <div key={globalIdx} className="sticker-label">
                <div>
                  <div className="sticker-project">
                    {projectInfo ?? moduleName}
                  </div>
                  <div className="sticker-ref">
                    {p.ref}
                  </div>
                  <div className="sticker-tags">
                    {boardNum != null && (
                      <span className="sticker-tag-board">TAB {boardNum}</span>
                    )}
                    <span className="sticker-tag-mat">
                      {matName || defaultMaterial || 'Sin material'}
                    </span>
                  </div>
                </div>
                <div className="sticker-bottom">
                  <div>
                    <span className="sticker-dim-label">Medidas</span>
                    <div className="sticker-dim-value">
                      {p.w}<span className="sticker-dim-x">×</span>{p.h}mm
                      {rotated && <span className="sticker-rotated">↻</span>}
                    </div>
                  </div>
                  <div className="sticker-idx">#{globalIdx + 1}</div>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <style>{`
        /* ── Screen preview ── */
        .sticker-page {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          margin-bottom: 24px;
        }
        .sticker-label {
          border: 2px solid #0f172a;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: white;
          overflow: hidden;
          height: 42.4mm;
          box-sizing: border-box;
        }
        .sticker-project {
          font-size: 7px; font-weight: 900; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.1em; line-height: 1;
        }
        .sticker-ref {
          font-size: 11px; font-weight: 900; color: #0f172a;
          text-transform: uppercase; line-height: 1.2;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 2px; margin-top: 2px;
        }
        .sticker-tags { display: flex; align-items: center; gap: 4px; margin-top: 3px; }
        .sticker-tag-board {
          font-size: 7px; font-weight: 900; color: #d97706;
          background: #fffbeb; padding: 1px 4px; border-radius: 3px; flex-shrink: 0;
        }
        .sticker-tag-mat {
          font-size: 7px; font-weight: 700; color: #047857;
          background: #ecfdf5; padding: 1px 4px; border-radius: 3px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .sticker-bottom { display: flex; justify-content: space-between; align-items: flex-end; }
        .sticker-dim-label { font-size: 6px; font-weight: 900; color: #94a3b8; text-transform: uppercase; display: block; }
        .sticker-dim-value { font-size: 16px; font-weight: 900; color: #2563eb; font-family: monospace; line-height: 1; }
        .sticker-dim-x { font-size: 9px; color: #cbd5e1; margin: 0 1px; }
        .sticker-rotated { font-size: 9px; color: #8b5cf6; margin-left: 3px; }
        .sticker-idx { font-size: 8px; font-weight: 700; color: #cbd5e1; }

        /* ── Print: exact A4 with 3 cols × 7 rows, 70×42.4 mm labels ── */
        @media print {
          /* Hide everything except sticker pages */
          .no-print, .stickers-root > .no-print { display: none !important; }

          /* Reset page */
          @page {
            size: 210mm 297mm;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Container reset */
          .stickers-root {
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          /* Each page = exactly A4 */
          .sticker-page {
            display: grid;
            grid-template-columns: repeat(3, 70mm);
            grid-auto-rows: 42.4mm;
            gap: 0;
            width: 210mm;
            height: 296.8mm;
            margin: 0;
            padding: 0;
            page-break-after: always;
            break-after: page;
          }
          .sticker-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          /* Each label = exactly 70×42.4 mm */
          .sticker-label {
            width: 70mm;
            height: 42.4mm;
            border: 0.3mm solid #333;
            padding: 2mm 2.5mm;
            margin: 0;
            box-sizing: border-box;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}
