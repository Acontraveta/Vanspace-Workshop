// ── Van Configuration Presets ──────────────────────────────────────
// Shared between exterior and interior design pages.
// All dimensions in mm.

export interface VanConfig {
  length: number      // overall length
  width: number       // overall width
  height: number      // overall height
  bodyStart: number   // where cargo body starts from front bumper
  bodyLength: number  // cargo body length
  bodyHeight: number  // interior body height
  roofArc: number     // roof curvature offset
  wheelDia: number
  frontWheelX: number
  rearWheelX: number
}

export const VAN_PRESETS: Record<string, VanConfig & { label: string }> = {
  'sprinter-l2h2': {
    label: 'Mercedes Sprinter L2H2',
    length: 6967, width: 1993, height: 2729,
    bodyStart: 2400, bodyLength: 3700, bodyHeight: 1946,
    roofArc: 200, wheelDia: 700,
    frontWheelX: 1300, rearWheelX: 5600,
  },
  'sprinter-l3h3': {
    label: 'Mercedes Sprinter L3H3',
    length: 7345, width: 1993, height: 2959,
    bodyStart: 2400, bodyLength: 4200, bodyHeight: 2100,
    roofArc: 220, wheelDia: 700,
    frontWheelX: 1300, rearWheelX: 5900,
  },
  'ducato-l3h2': {
    label: 'Fiat Ducato L3H2',
    length: 5998, width: 2050, height: 2524,
    bodyStart: 1800, bodyLength: 3700, bodyHeight: 1932,
    roofArc: 180, wheelDia: 650,
    frontWheelX: 1100, rearWheelX: 4800,
  },
  'ducato-l4h3': {
    label: 'Fiat Ducato L4H3',
    length: 6363, width: 2050, height: 2764,
    bodyStart: 1800, bodyLength: 4070, bodyHeight: 2100,
    roofArc: 200, wheelDia: 650,
    frontWheelX: 1100, rearWheelX: 5100,
  },
  'crafter-l3h3': {
    label: 'VW Crafter L3H3',
    length: 6836, width: 2040, height: 2798,
    bodyStart: 2300, bodyLength: 3640, bodyHeight: 2100,
    roofArc: 210, wheelDia: 700,
    frontWheelX: 1300, rearWheelX: 5500,
  },
  'transit-l3h2': {
    label: 'Ford Transit L3H2',
    length: 5981, width: 2059, height: 2550,
    bodyStart: 1800, bodyLength: 3700, bodyHeight: 1900,
    roofArc: 170, wheelDia: 650,
    frontWheelX: 1100, rearWheelX: 4700,
  },
}

export const DEFAULT_PRESET = 'sprinter-l2h2'
export const DEFAULT_VAN: VanConfig = VAN_PRESETS[DEFAULT_PRESET]

/** Find which preset matches (by key dimensions), or null → custom */
export function findPreset(cfg: VanConfig): string | null {
  for (const [key, p] of Object.entries(VAN_PRESETS)) {
    if (p.length === cfg.length && p.width === cfg.width &&
      p.height === cfg.height && p.bodyLength === cfg.bodyLength)
      return key
  }
  return null
}

/** Persist van config to localStorage */
export function saveVanConfig(id: string, config: VanConfig) {
  localStorage.setItem(`vanCfg-${id}`, JSON.stringify(config))
}

/** Load van config from localStorage */
export function loadVanConfig(id: string): VanConfig | null {
  try {
    const raw = localStorage.getItem(`vanCfg-${id}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
