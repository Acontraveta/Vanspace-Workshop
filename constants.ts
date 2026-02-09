
import { Project, ProjectStatus, TaskStatus, User, ProjectType, Phase } from './types';

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Oscar GP', username: 'admin', password: '123', role: 'ADMIN', avatar: 'https://picsum.photos/seed/oscar/100/100' },
  { id: 'u2', name: 'Ana Diseño', username: 'ana', password: '123', role: 'DESIGN', avatar: 'https://picsum.photos/seed/ana/100/100' },
  { id: 'u3', name: 'Carlos Marketing', username: 'carlos', password: '123', role: 'MARKETING', avatar: 'https://picsum.photos/seed/carlos/100/100' },
  { id: 'u4', name: 'Marta Pedidos', username: 'marta', password: '123', role: 'ORDERS', avatar: 'https://picsum.photos/seed/marta/100/100' },
  { id: 'u5', name: 'Luis Producción', username: 'luis', password: '123', role: 'PRODUCTION', avatar: 'https://picsum.photos/seed/luis/100/100' },
];

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const DEFAULT_TEMPLATES: Record<ProjectType, Phase[]> = {
  CAMPERIZACION: [
    {
      id: generateId(), name: '1. Presupuesto y Diseño Base (Marketing)', order: 1,
      tasks: [
        { id: generateId(), title: 'Reunión inicial con cliente', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Creación de presupuesto detallado', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Diseño conceptual y renders base', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Presentación y aprobación del cliente', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '2. Pedidos y Compras', order: 2,
      tasks: [
        { id: generateId(), title: 'Verificación de stock de materiales', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Lista de compras de elementos faltantes', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Gestión de pedidos a proveedores', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Recepción y verificación de materiales', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '3. Diseño Técnico Detallado', order: 3,
      tasks: [
        { id: generateId(), title: 'Diseño interior y distribución de muebles', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Planos de despiece de mobiliario', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Plano de instalación eléctrica 12V/230V', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Plano de fontanería (agua/gas)', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Especificaciones técnicas finales', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '4. Producción - Preparación', order: 4,
      tasks: [
        { id: generateId(), title: 'Recepción del vehículo en taller', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Protección integral de cabina', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Limpieza técnica desengrasante', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '5. Producción - Estructura', order: 5,
      tasks: [
        { id: generateId(), title: 'Marcado de ventanas y claraboyas', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Corte de chapa y tratamiento anticorrosión', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Instalación de rastreles de suelo', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Instalación de aislamiento térmico', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '6. Producción - Instalaciones', order: 6,
      tasks: [
        { id: generateId(), title: 'Canalización de cableado eléctrico', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Instalación de depósitos y fontanería', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Instalación de circuito de gas', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Conexiones y pruebas eléctricas', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '7. Producción - Acabados', order: 7,
      tasks: [
        { id: generateId(), title: 'Panelado de paredes y techo', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Fabricación y montaje de muebles', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Instalación de encimeras y suelo', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Montaje de accesorios finales', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '8. Control de Calidad y Entrega', order: 8,
      tasks: [
        { id: generateId(), title: 'Inspección de calidad integral', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Pruebas funcionales de todos los sistemas', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Limpieza y preparación para entrega', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Entrega y explicación al cliente', status: TaskStatus.PENDING }
      ]
    }
  ],
  ACCESORIOS: [
    {
      id: generateId(), name: '1. Presupuesto (Marketing)', order: 1,
      tasks: [
        { id: generateId(), title: 'Consulta y presupuesto de accesorios', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Aprobación del cliente', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '2. Compra de Material (Pedidos)', order: 2,
      tasks: [
        { id: generateId(), title: 'Verificación de stock', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Pedido de accesorios faltantes', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '3. Instalación (Producción)', order: 3,
      tasks: [
        { id: generateId(), title: 'Marcado de puntos de anclaje', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Instalación y fijación', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Pruebas y entrega', status: TaskStatus.PENDING }
      ]
    }
  ],
  REFORMA: [
    {
      id: generateId(), name: '1. Evaluación y Presupuesto (Marketing)', order: 1,
      tasks: [
        { id: generateId(), title: 'Inspección del estado actual', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Presupuesto de reforma', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '2. Planificación (Diseño + Pedidos)', order: 2,
      tasks: [
        { id: generateId(), title: 'Diseño de modificaciones', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Lista de materiales y compras', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '3. Ejecución (Producción)', order: 3,
      tasks: [
        { id: generateId(), title: 'Desmontaje controlado', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Reforma e integración', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Acabados y entrega', status: TaskStatus.PENDING }
      ]
    }
  ],
  REPARACION: [
    {
      id: generateId(), name: '1. Diagnóstico (Marketing/Producción)', order: 1,
      tasks: [
        { id: generateId(), title: 'Identificación de avería', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Presupuesto de reparación', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '2. Material (Pedidos)', order: 2,
      tasks: [
        { id: generateId(), title: 'Pedido de piezas/materiales', status: TaskStatus.PENDING }
      ]
    },
    {
      id: generateId(), name: '3. Reparación (Producción)', order: 3,
      tasks: [
        { id: generateId(), title: 'Ejecución de reparación', status: TaskStatus.PENDING },
        { id: generateId(), title: 'Prueba operativa', status: TaskStatus.PENDING }
      ]
    }
  ]
};

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p1',
    clientName: 'Furgonetas Pro S.L.',
    vehicleModel: 'Mercedes Sprinter L2H2',
    plate: '1234ABC',
    status: ProjectStatus.IN_PROGRESS,
    projectType: 'CAMPERIZACION',
    startDate: '2024-03-01',
    progress: 15,
    phases: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES.CAMPERIZACION))
  },
  {
    id: 'p2',
    clientName: 'Ana Belén Martínez',
    vehicleModel: 'Ford Transit Custom',
    plate: '9988XYZ',
    status: ProjectStatus.IN_PROGRESS,
    projectType: 'CAMPERIZACION',
    startDate: '2024-03-10',
    progress: 8,
    phases: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES.CAMPERIZACION))
  }
];
