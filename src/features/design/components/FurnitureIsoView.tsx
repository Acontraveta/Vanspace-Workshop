import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { InteractivePiece, ModuleDimensions, CatalogMaterial } from '../types/furniture.types'
import { PIECE_COLORS, PIECE_COLORS_3D } from '../constants/furniture.constants'

interface FurnitureIsoViewProps {
  module: ModuleDimensions
  pieces: InteractivePiece[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdatePiece?: (id: string, updates: Partial<InteractivePiece>) => void
  catalogMaterials?: CatalogMaterial[]
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex)
}

// ─── Single piece box ─────────────────────────────────────────────────────────

function PieceBox({
  piece, isSelected, onPointerDown, materialColor, transparent,
}: {
  piece: InteractivePiece
  isSelected: boolean
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void
  materialColor?: string
  transparent?: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const colors = PIECE_COLORS[piece.type]
  const woodFallback = PIECE_COLORS_3D[piece.type]
  const baseColor = isSelected ? colors.selected : (materialColor ?? woodFallback)
  const isFrontal = piece.type === 'frontal'
  const useTransparency = transparent || isFrontal
  const opacityVal = transparent ? 0.35 : (isFrontal ? 0.55 : 0.92)

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
        transparent={useTransparency}
        opacity={opacityVal}
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
  // Set once on mount
  if (!hasSet.current) {
    hasSet.current = true
    const maxDim = Math.max(m.width, m.height, m.depth)
    const dist = maxDim * 1.6
    camera.position.set(m.width * 0.8, m.height * 0.9, m.depth + dist * 0.6)
    camera.lookAt(m.width / 2, m.height / 2, m.depth / 2)
  }
  return null
}

// ─── Scene content — Three.js objects + drag controller ──────────────────────

function SceneContent({
  mod, visiblePieces, selectedId, onSelect, onUpdatePiece, wireframe, catalogMaterials, transparent,
}: {
  mod: ModuleDimensions
  visiblePieces: InteractivePiece[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdatePiece?: (id: string, updates: Partial<InteractivePiece>) => void
  wireframe: boolean
  catalogMaterials: CatalogMaterial[]
  transparent: boolean
}) {
  const { camera, gl, raycaster } = useThree()
  const controlsRef = useRef<any>(null)
  const dragRef = useRef<{
    id: string; startPoint: THREE.Vector3
    startPos: { x: number; y: number; z: number }; plane: THREE.Plane
  } | null>(null)

  // DOM-level pointer events for reliable drag tracking
  useEffect(() => {
    const canvas = gl.domElement
    const handleMove = (e: PointerEvent) => {
      const dr = dragRef.current
      if (!dr || !onUpdatePiece) return
      const rect = canvas.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera)
      const target = new THREE.Vector3()
      if (raycaster.ray.intersectPlane(dr.plane, target)) {
        const delta = target.clone().sub(dr.startPoint)
        // Only allow vertical (Y-axis) movement in 3D — X/Z from 2D view
        onUpdatePiece(dr.id, {
          y: Math.round(dr.startPos.y + delta.y),
        })
      }
    }
    const handleUp = () => {
      if (dragRef.current) {
        dragRef.current = null
        if (controlsRef.current) controlsRef.current.enabled = true
        canvas.style.cursor = ''
      }
    }
    canvas.addEventListener('pointermove', handleMove)
    canvas.addEventListener('pointerup', handleUp)
    return () => {
      canvas.removeEventListener('pointermove', handleMove)
      canvas.removeEventListener('pointerup', handleUp)
    }
  }, [camera, gl, raycaster, onUpdatePiece])

  const handlePieceDown = useCallback((e: ThreeEvent<PointerEvent>, p: InteractivePiece) => {
    e.stopPropagation()
    if (selectedId === p.id && onUpdatePiece) {
      // Already selected → start drag on camera-facing plane
      const normal = camera.getWorldDirection(new THREE.Vector3()).negate()
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, e.point)
      dragRef.current = {
        id: p.id, startPoint: e.point.clone(),
        startPos: { x: p.x, y: p.y, z: p.z }, plane,
      }
      if (controlsRef.current) controlsRef.current.enabled = false
      gl.domElement.style.cursor = 'grabbing'
    }
    onSelect(p.id)
  }, [selectedId, onUpdatePiece, onSelect, camera, gl])

  return (
    <>
      <CameraSetup module={mod} />
      <OrbitControls
        ref={controlsRef}
        target={[mod.width / 2, mod.height / 2, mod.depth / 2]}
        enableDamping dampingFactor={0.12}
        minDistance={100} maxDistance={Math.max(mod.width, mod.height, mod.depth) * 5}
      />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#dbeafe', '#e2e8f0', 0.4]} />
      <directionalLight position={[mod.width * 2, mod.height * 3, mod.depth * 2]} intensity={0.6} />
      <directionalLight position={[-mod.width, mod.height * 1.5, -mod.depth]} intensity={0.3} />
      <directionalLight position={[mod.width * 0.5, -mod.height, mod.depth * 1.5]} intensity={0.15} />
      <GroundPlane width={mod.width} depth={mod.depth} />
      {wireframe && <ModuleOutline module={mod} />}
      {visiblePieces.map(p => {
        const mat = catalogMaterials.find(m => m.id === p.materialId)
        return (
          <PieceBox key={p.id} piece={p} isSelected={p.id === selectedId}
            onPointerDown={e => handlePieceDown(e, p)}
            materialColor={mat?.color_hex}
            transparent={transparent} />
        )
      })}
      <DimensionLabels module={mod} />
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════════

export function FurnitureIsoView({ module: mod, pieces, selectedId, onSelect, onUpdatePiece, catalogMaterials = [] }: FurnitureIsoViewProps) {
  const [showFrontals, setShowFrontals] = useState(true)
  const [wireframe, setWireframe]       = useState(false)
  const [transparent, setTransparent]   = useState(false)

  const visiblePieces = useMemo(
    () => pieces.filter(p => !p.hidden && (showFrontals || p.type !== 'frontal')),
    [pieces, showFrontals]
  )

  const handleBgClick = useCallback(() => onSelect(null), [onSelect])

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden select-none relative"
      style={{ minHeight: 560 }}>

      {/* Header controls */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-gray-50">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
          Vista 3D · Arrastra arriba/abajo
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
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={transparent} onChange={e => setTransparent(e.target.checked)}
              className="w-3 h-3 rounded border-slate-300 accent-blue-600" />
            <span className="text-[10px] font-medium text-slate-500">Transparente</span>
          </label>
        </div>
      </div>

      {/* Three.js Canvas */}
      <div className="flex-1 relative" style={{ minHeight: 500 }}>
        <Canvas
          camera={{ near: 1, far: 100000, fov: 50 }}
          gl={{ antialias: true, alpha: false, logarithmicDepthBuffer: true }}
          onPointerMissed={handleBgClick}
          onCreated={({ scene }) => { scene.background = new THREE.Color('#f1f5f9') }}
        >
          <SceneContent
            mod={mod} visiblePieces={visiblePieces} selectedId={selectedId}
            onSelect={onSelect} onUpdatePiece={onUpdatePiece}
            wireframe={wireframe} catalogMaterials={catalogMaterials}
            transparent={transparent}
          />
        </Canvas>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-gray-50">
        <span className="text-[10px] font-medium text-slate-500">{pieces.length} piezas</span>
        <span className="text-[10px] text-slate-400">1er clic selecciona · 2do clic + arrastrar sube/baja</span>
      </div>
    </div>
  )
}
