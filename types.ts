
export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED'
}

export enum ProjectStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD'
}

export type ProjectType = 'CAMPERIZACION' | 'ACCESORIOS' | 'REFORMA' | 'REPARACION';
export type AppointmentType = 'RECEPCION' | 'ENTREGA' | 'REVISION' | 'OTROS';

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface ReformSheet {
  applicant?: { name: string; address: string; phone: string; email: string; dni: string };
  itv?: { province: string; email: string };
  workshop?: { name: string; registration: string; activity: string };
  furniture: string[]; // IDs de muebles instalados: 'bajo', 'altillo', 'wc', etc.
  electrical12v: Record<string, any>;
  electrical230v: Record<string, any>;
  gas: Record<string, any>;
  water: Record<string, any>;
  measures: { height: string; taraIncrement: string };
}

export interface HomologationDoc {
  id: string;
  type: string;
  name: string;
  url: string;
  uploadedAt: string;
  status: 'PENDING' | 'UPLOADED' | 'VALIDATED';
}

export interface Project {
  id: string;
  clientName: string;
  vehicleModel: string;
  plate: string;
  status: ProjectStatus;
  projectType: ProjectType;
  startDate: string;
  progress: number;
  phases: Phase[];
  homologationModel?: 'ESOTION' | 'TH_HOMOLOGACIONES';
  homologationDocs?: HomologationDoc[];
  reformSheet?: ReformSheet;
}

export interface Phase {
  id: string;
  name: string;
  order: number;
  tasks: Task[];
  responsibleTechId?: string; // Responsable de la fase completa
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  startedAt?: string;
  completedAt?: string;
  totalDurationMs?: number;
  technicianIds?: string[];
  attachments?: Attachment[];
  technicianNotes?: string;
}

export interface Appointment {
  id: string;
  projectId?: string;
  clientName: string;
  vehicleModel?: string;
  date: string;
  time: string;
  type: AppointmentType;
  notes?: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: 'ADMIN' | 'DESIGN' | 'MARKETING' | 'ORDERS' | 'PRODUCTION';
  avatar: string;
}
