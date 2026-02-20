import { useRef, useState, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, Html } from '@react-three/drei'
import * as THREE from 'three'
import { InteractivePiece, ModuleDimensions, CatalogMaterial } from '../types/furniture.types'
import { PIECE_COLORS } from '../constants/furniture.constants'

interface FurnitureIsoViewProps {
  module: ModuleDimensions
  pieces: InteractivePiece[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  catalogMaterials?: CatalogMaterial[]
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex)
}

// ─── Single piece box ─────────────────────────────────────────────────────────

function PieceBox({
  piece, isSelected, onPointerDown, materialColor,
}: {
  piece: InteractivePiece
  isSelected: boolean
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void
  materialColor?: string
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const colors = PIECE_COLORS[piece.type]
  const baseColor = isSelected ? colors.selected : (materialColor ?? colors.fill)
  const isFrontal = piece.type === 'frontal'

  // mm → scene units (1 unit = 1 mm, we scale the whole scene)
  const sx = piece.w
  const sy = piece.h
  const sz = piece.d
  const px = piece.x + sx / 2
  const py = piece.y + sy / 2
  const pz = piece.z + sz / 2

  return (
    <mesh
      ref={meshRef}
      position={[px, py, pz]}
      onPointerDown={onPointerDown}
    >
      <boxGeometry args={[sx, sy, sz]} />
      <meshStandardMaterial
        color={hexToThreeColor(baseColor)}
        transparent={isFrontal}
        opacity={isFrontal ? 0.55 : 0.92}
        roughness={0.65}
        metalness={0.02}
      />
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(sx, sy, sz)]} />
          <lineBasicMaterial color="#f59e0b" linewidth={2} />
        </lineSegments>
      )}
    </mesh>
  )
}

// ─── Ground grid ──────────────────────────────────────────────────────────────

function GroundPlane({ width, depth }: { width: number; depth: number }) {
  return (
    <group position={[width / 2, -0.5, depth / 2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width + 200, depth + 200]} />
        <meshStandardMaterial color="#e2e8f0" transparent opacity={0.5} />
      </mesh>
      <gridHelper
        args={[Math.max(width, depth) + 200, Math.ceil(Math.max(width, depth) / 50) + 4, '#cbd5e1', '#e2e8f0']}
        position={[0, 0.5, 0]}
        rotation={[0, 0, 0]}
      />
    </group>
  )
}

// ─── Dimension labels (HTML overlays) ─────────────────────────────────────────

function DimensionLabels({ module: m }: { module: ModuleDimensions }) {
  return (
    <>
      <Html position={[m.width / 2, -20, -20]} center
        style={{ pointerEvents: 'none' }}>
        <span className="text-[9px] font-mono font-bold text-blue-600 bg-white/90 shadow-sm px-1.5 py-0.5 rounded whitespace-nowrap">
          {m.width} mm
        </span>
      </Html>
      <Html position={[-20, m.height / 2, -20]} center
        style={{ pointerEvents: 'none' }}>
        <span className="text-[9px] font-mono font-bold text-blue-600 bg-white/90 shadow-sm px-1.5 py-0.5 rounded whitespace-nowrap">
          {m.height} mm
        </span>
      </Html>
      <Html position={[m.width + 20, -20, m.depth / 2]} center
        style={{ pointerEvents: 'none' }}>
        <span className="text-[9px] font-mono font-bold text-blue-600 bg-white/90 shadow-sm px-1.5 py-0.5 rounded whitespace-nowrap">
          {m.depth} mm
        </span>
      </Html>
    </>
  )
}

// ─── Wireframe box outline ────────────────────────────────────────────────────

function ModuleOutline({ module: m }: { module: ModuleDimensions }) {
  const geo = useMemo(() => new THREE.BoxGeometry(m.width, m.height, m.depth), [m.width, m.height, m.depth])
  return (
    <lineSegments position={[m.width / 2, m.height / 2, m.depth / 2]}>
      <edgesGeometry args={[geo]} />
      <lineBasicMaterial color="#94a3b8" transparent opacity={0.4} />
    </lineSegments>
  )
}

// ─── Camera auto-fit ──────────────────────────────────────────────────────────

function CameraSetup({ module: m }: { module: ModuleDimensions }) {
  const { camera } = useThree()
  const hasSet = useRef(false)
  useFrame(() => {
    if (hasSet.current) return
    hasSet.current = true
    const maxDim = Math.max(m.width, m.height, m.depth)
    const dist = maxDim * 1.6
    camera.position.set(m.width * 0.8, m.height * 0.9, m.depth + dist * 0.6)
    camera.lookAt(m.width / 2, m.height / 2, m.depth / 2)
  })
  return null
}

// ═════════════════════════════════════════════════════════════════════════════

export function FurnitureIsoView({ module: mod, pieces, selectedId, onSelect, catalogMaterials = [] }: FurnitureIsoViewProps) {
  const [showFrontals, setShowFrontals] = useState(true)
  const [wireframe, setWireframe]       = useState(false)

  const visiblePieces = useMemo(
    () => pieces.filter(p => showFrontals || p.type !== 'frontal'),
    [pieces, showFrontals]
  )

  const handleBgClick = useCallback(() => onSelect(null), [onSelect])

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden select-none relative"
      style={{ minHeight: 560 }}>

      {/* Header controls */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-gray-50">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
          Vista 3D · Orbitar
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showFrontals} onChange={e => setShowFrontals(e.target.checked)}
              className="w-3 h-3 rounded border-slate-300 accent-blue-600" />
            <span className="text-[10px] font-medium text-slate-500">Frontales</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={wireframe} onChange={e => setWireframe(e.target.checked)}
              className="w-3 h-3 rounded border-slate-300 accent-blue-600" />
            <span className="text-[10px] font-medium text-slate-500">Contorno</span>
          </label>
        </div>
      </div>

      {/* Three.js Canvas */}
      <div className="flex-1 relative" style={{ minHeight: 500 }}>
        <Canvas
          gl={{ antialias: true, alpha: false }}
          onPointerMissed={handleBgClick}
          style={{ background: '#f8fafc' }}
        >
          <CameraSetup module={mod} />
          <OrbitControls
            target={[mod.width / 2, mod.height / 2, mod.depth / 2]}
            enableDamping
            dampingFactor={0.12}
            minDistance={100}
            maxDistance={Math.max(mod.width, mod.height, mod.depth) * 5}
          />

          {/* Lighting — no shadows to avoid dark cutting artifacts */}
          <ambientLight intensity={0.55} />
          <hemisphereLight args={['#dbeafe', '#e2e8f0', 0.4]} />
          <directionalLight
            position={[mod.width * 2, mod.height * 3, mod.depth * 2]}
            intensity={0.6}
          />
          <directionalLight
            position={[-mod.width, mod.height * 1.5, -mod.depth]}
            intensity={0.3}
          />
          <directionalLight
            position={[mod.width * 0.5, -mod.height, mod.depth * 1.5]}
            intensity={0.15}
          />

          {/* Ground */}
          <GroundPlane width={mod.width} depth={mod.depth} />

          {/* Module outline */}
          {wireframe && <ModuleOutline module={mod} />}

          {/* Pieces */}
          {visiblePieces.map(p => {
            const mat = catalogMaterials.find(m => m.id === p.materialId)
            return (
              <PieceBox
                key={p.id}
                piece={p}
                isSelected={p.id === selectedId}
                onPointerDown={e => { e.stopPropagation(); onSelect(p.id) }}
                materialColor={mat?.color_hex}
              />
            )
          })}

          {/* Dimension labels */}
          <DimensionLabels module={mod} />
        </Canvas>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-gray-50">
        <span className="text-[10px] font-medium text-slate-500">{pieces.length} piezas</span>
        <span className="text-[10px] text-slate-400">Clic + arrastrar para orbitar · Scroll para zoom</span>
      </div>
    </div>
  )
}
