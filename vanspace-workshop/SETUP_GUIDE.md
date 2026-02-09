# 🚀 Guía de Instalación - VanSpace Workshop

## ⚡ Inicio Rápido (3 minutos)

### 1️⃣ Instalar Node.js
Si no tienes Node.js instalado:
- Ve a https://nodejs.org
- Descarga la versión LTS (recomendada)
- Instala siguiendo las instrucciones

### 2️⃣ Instalar Dependencias

Abre la terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
```

Este comando instalará:
- React (interfaz de usuario)
- Vite (servidor de desarrollo rápido)
- Supabase (base de datos opcional)
- Tailwind CSS (estilos)

### 3️⃣ Iniciar la Aplicación

```bash
npm run dev
```

Verás algo como:

```
  VITE v6.2.0  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.1.100:3000/
```

### 4️⃣ Acceder

Abre tu navegador en `http://localhost:3000`

**Credenciales por defecto:**
- Usuario: `admin`
- Contraseña: `123`

---

## 🔧 Configuración Avanzada

### Modo 1: Local (Sin base de datos)
✅ **Recomendado para empezar**

La app funciona sin configuración adicional. Los datos se guardan en el navegador (localStorage).

**Ventajas:**
- Sin configuración
- Funcionamiento inmediato

**Limitaciones:**
- Los datos no se sincronizan entre dispositivos
- Si borras los datos del navegador, pierdes la información

### Modo 2: Con Supabase (Sincronización en tiempo real)
🌐 **Para uso profesional multi-dispositivo**

#### Paso 1: Crear cuenta en Supabase

1. Ve a https://supabase.com
2. Haz clic en "Start your project"
3. Crea una cuenta (gratis)

#### Paso 2: Crear un nuevo proyecto

1. Haz clic en "New Project"
2. Elige un nombre (ej: `vanspace-taller`)
3. Crea una contraseña segura (¡guárdala!)
4. Selecciona una región cercana (ej: Europe West)
5. Espera unos minutos mientras se crea

#### Paso 3: Configurar la base de datos

1. En Supabase, ve a "SQL Editor"
2. Copia y pega este código:

```sql
-- Tabla de proyectos
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  clientName TEXT NOT NULL,
  vehicleModel TEXT NOT NULL,
  plate TEXT NOT NULL,
  status TEXT NOT NULL,
  projectType TEXT NOT NULL,
  startDate TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  phases JSONB,
  homologationModel TEXT,
  homologationDocs JSONB,
  reformSheet JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de fases
CREATE TABLE phases (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  responsibleTechId TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de tareas
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  phase_id TEXT REFERENCES phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  startedAt TEXT,
  completedAt TEXT,
  totalDurationMs INTEGER,
  technicianIds JSONB,
  attachments JSONB,
  technicianNotes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Habilitar seguridad a nivel de fila
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Políticas (permitir todo para usuarios autenticados)
CREATE POLICY "Enable all for authenticated users" ON projects
  FOR ALL USING (true);

CREATE POLICY "Enable all for authenticated users" ON phases
  FOR ALL USING (true);

CREATE POLICY "Enable all for authenticated users" ON tasks
  FOR ALL USING (true);
```

3. Haz clic en "Run" (abajo a la derecha)

#### Paso 4: Obtener las credenciales

1. Ve a "Project Settings" (⚙️ en la barra lateral)
2. Haz clic en "API"
3. Copia estos dos valores:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public** key (una clave larga que empieza con `eyJ...`)

#### Paso 5: Conectar la app

1. En VanSpace, haz clic en "Equipo" (menú lateral)
2. Baja hasta "Conexión a la Nube"
3. Pega tu **Supabase URL**
4. Pega tu **Anon Public Key**
5. Haz clic en "Guardar y Conectar"

¡Listo! Ahora tus datos se sincronizan en tiempo real 🎉

---

## 📱 Acceso desde otros dispositivos

Si configuraste Supabase, puedes acceder desde cualquier dispositivo:

1. En la terminal, busca la línea que dice `Network:`
2. Copia la URL (ej: `http://192.168.1.100:3000`)
3. Abre esa URL en otro dispositivo conectado a la misma red WiFi

---

## 🆘 Solución de Problemas

### "npm: command not found"
→ Node.js no está instalado. Descárgalo de https://nodejs.org

### "Port 3000 is already in use"
→ Otro programa está usando el puerto 3000. Opciones:
- Cierra ese programa
- O usa otro puerto: `npm run dev -- --port 3001`

### "Failed to fetch" al conectar Supabase
→ Revisa que las credenciales sean correctas:
- La URL debe empezar con `https://`
- La clave debe empezar con `eyJ`
- No debe haber espacios extra

### Los cambios no se guardan
→ Si estás en modo local:
- Los datos están en el navegador
- No uses "modo incógnito"
- No borres los datos del navegador

→ Si tienes Supabase:
- Verifica que veas "Sincronizado" en la esquina superior derecha
- Si no, haz clic en "Equipo" y vuelve a conectar

---

## 🎯 Primer Uso

Una vez configurado, te recomendamos:

1. **Cambiar las contraseñas** de los usuarios por defecto
2. **Crear tus propios técnicos** en "Equipo"
3. **Probar creando un proyecto** en "Taller"
4. **Personalizar las plantillas** en "Procedimientos"

---

## 📞 Contacto

¿Necesitas ayuda? Consulta la documentación completa en el README.md

**¡Bienvenido a VanSpace! 🚐✨**
