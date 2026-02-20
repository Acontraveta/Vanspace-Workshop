
export type ModuleType = 'armario' | 'cajonera' | 'cocina' | 'arcon' | 'altillo' | 'personalizado';

export interface InteractivePiece {
  id: string;
  name: string;
  type: 'estructura' | 'frontal' | 'trasera';
  // Posición en el espacio 3D (esquina inferior trasera izquierda)
  x: number; 
  y: number;
  z: number;
  // Dimensiones físicas
  w: number; // Ancho (eje X)
  h: number; // Alto (eje Y)
  d: number; // Fondo (eje Z)
}

export interface FrontPanel extends InteractivePiece {
  panelType: 'puerta' | 'cajon' | 'fijo';
}

export interface ModuleDimensions {
  name: string;
  type: ModuleType;
  width: number;
  height: number;
  depth: number;
  thickness: number;
  materialPrice: number;
}

export interface Piece {
  ref: string;
  w: number;
  h: number;
  type: 'estructura' | 'frontal' | 'trasera';
  id?: string;
}

export interface PlacedPiece extends Piece {
  x: number;
  y: number;
}
