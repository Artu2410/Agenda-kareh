🏥 Kareh Pro - Clinic Management System

Kareh Pro
    Es una plataforma integral de gestión para centros de kinesiología y rehabilitación.
    El sistema optimiza el flujo de trabajo clínico, desde el agendamiento inteligente hasta el seguimiento riguroso de la historia clínica y alertas de seguridad del paciente.

🚀 Arquitectura del Sistema

El proyecto sigue una arquitectura desacoplada con un enfoque en la integridad de datos atómica.

    Frontend: Single Page Application (SPA) construida con React y Tailwind CSS para una interfaz de alta reactividad.
    Backend: API RESTful sobre Node.js/Express utilizando módulos ESM nativos.
    Database: Gestión de datos mediante Prisma ORM para garantizar tipos seguros y migraciones consistentes.

✨ Módulos y Funcionalidades Críticas

    1. Gestión de Turnos y Slots Reutilizables
    El sistema permite hasta 5 slots simultáneos por cada franja horaria.La lógica de negocio previene
    el sobre-agendamiento validando la disponibilidad en tiempo real antes de confirmar el ciclo de sesiones.

    2. Sincronización de Antecedentes (Persistencia Blindada)
    Se implementó una Transacción Atómica de Prisma para asegurar que los antecedentes críticos
    (Marcapasos, Electroacupuntura, Estado Oncológico) se actualicen en toda la ficha del paciente al
    editar cualquier turno individual.

        Nota Técnica: Se utiliza el operador de coalescencia nula ?? en el controlador para
        forzar la persistencia de valores booleanos false, evitando que la base de datos ignore
        cambios de desmarcación.

    3. Sistema de Tickets y Sesiones Proyectadas

    El módulo de impresión genera un desglose de las próximas 10 sesiones. La ruta GET /:id/batch
    calcula dinámicamente el ciclo basándose en el historial y la programación futura del paciente.

🛠️ Instalación y Configuración

    Prerrequisitos

    Node.js v24.12.0 o superior.

    Instancia de base de datos (PostgreSQL recomendada).

    Configuración del Servidor

    1. Navega al directorio del servidor: cd server
    2. Instala dependencias: npm install
    3. Configura las variables de entorno (.env):
    Fragmento de código

    DATABASE_URL="postgresql://user:password@localhost:5432/kareh_db"
    PORT=3001

    4. Genera el cliente de Prisma y ejecuta migraciones:

    Bash
    npx prisma generate
    npx prisma migrate dev --name init_schema

    5. Inicia en modo desarrollo: npm run dev

    📡 API Reference (Endpoints Clave)

    Appointments

        Método,     Endpoint,                                    Descripción
        GET,       /api/appointments/week,                       Consulta de agenda por rango de fechas.
        POST,      /api/appointments,                            Generación masiva de ciclos (1-10 sesiones).
        PATCH,     /api/appointments/:id/evolution,              Actualización de diagnóstico y ficha clínica.
        GET,       /api/appointments/:id/batch,                  Recuperación de sesiones para ticketera.
        DELETE,    /api/appointments/patients/:id/cancel-future, Limpieza de agenda futura por paciente.

🛡️ Estándares de Seguridad y Validación
    Validación de Tipos: Conversión forzosa de DNI a String para prevenir errores de truncamiento en números grandes.

    Trazabilidad: Cada cambio en el diagnóstico médico dispara una nueva entrada en la tabla ClinicalHistory.

    Loop Safety: Los algoritmos de generación de ciclos incluyen un contador de seguridad limitado a 150 iteraciones para prevenir bucles infinitos en calendarios mal configurados.

📝 Troubleshooting (Solución de Problemas)
    ¿Los cambios de EA/Marcapasos no se guardan? Verifica que el AppointmentController.js esté usando la versión con $transaction. Asegúrate de que el Frontend envíe el objeto patientData con booleanos explícitos.

    ¿El ticket de sesiones sale vacío? Revisa que la ruta /:id/batch esté definida antes de rutas con parámetros genéricos en appointments.routes.js para evitar conflictos de matching.
👨‍💻 Desarrollo
    Desarrollado por Arturo Azocar para Kareh Pro.