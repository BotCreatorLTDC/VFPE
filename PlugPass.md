He preparado una guía detallada lista para copiar y pegar en Antigravity. Está pensada para que el IDE entienda el contexto y genere una primera versión funcional del sistema PlugPass integrado en VerifyPlugEU.

markdown
# Prompt para Antigravity IDE: Integrar PlugPass en VerifyPlugEU

## 1. DESCRIPCIÓN GENERAL DEL PROYECTO
VerifyPlugEU es un directorio web de plugs verificados del sector cannábico. Actualmente los plugs tienen un perfil estático con un sello de “verificado”. Queremos añadir **PlugPass**, una capa de reputación portátil y anónima que permite a cada plug generar un "pasaporte de confianza" basado en su actividad real (entregas completadas, feedback de clientes), sin exponer datos sensibles.

**Objetivo del MVP:**
- Desde el panel de plug en VerifyPlugEU, el usuario puede activar PlugPass.
- Se genera una página pública de verificación (ej. `verifyplug.eu/p/abc123`) que muestra:
  - Sello de verificación
  - Contador de operaciones confirmadas
  - Porcentaje de feedback positivo
  - Tiempo medio de entrega (opcional)
- En el directorio, los plugs con PlugPass activo muestran una insignia dinámica ("PlugPass activo", nivel oro/plata).
- Un bot de Telegram asociado permite a los plugs registrar entregas completadas mediante un mensaje simple, y el sistema actualiza las métricas de forma anónima.

## 2. TECNOLOGÍAS ASUMIDAS
- **Frontend:** React con Next.js (App Router), Tailwind CSS.
- **Backend:** Node.js con Express o Next.js API routes, Prisma ORM.
- **Base de datos:** PostgreSQL (ya existente con tabla `plugs`, `users`, etc.)
- **Autenticación:** Sesiones con JWT o NextAuth, panel de plug ya funcional.
- **Bot de Telegram:** Webhook con una API route, librería `telegraf`.

## 3. CAMBIOS EN EL MODELO DE DATOS (Prisma Schema)
Agregar las siguientes tablas al esquema actual:

```prisma
model PlugPass {
  id           String   @id @default(cuid())
  plugId       String   @unique // Relación con el plug existente
  plug         Plug     @relation(fields: [plugId], references: [id])
  active       Boolean  @default(false)
  totalOps     Int      @default(0)
  positiveOps  Int      @default(0)
  avgDelivery  Float?   // minutos, opcional
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  slug         String   @unique   // abc123 para la URL pública
  displayLevel String   @default("basic") // basic, silver, gold
}

model Transaction {
  id        String   @id @default(cuid())
  plugPassId String
  plugPass  PlugPass @relation(fields: [plugPassId], references: [id])
  type      String   // "delivery_completed", "dispute", "feedback_positive", etc.
  metadata  Json?    // datos anónimos (tiempo entrega, etc.)
  createdAt DateTime @default(now())
}
Asegúrate de que la tabla Plug ya existente tenga un campo pass opcional (relación 1:1 con PlugPass).

4. NUEVOS ENDPOINTS DE LA API
4.1. Activar PlugPass
POST /api/plugpass/activate

Body: { plugId: string } (obtenido de la sesión)

Lógica:

Verifica que el plug está verificado.

Si no tiene PlugPass, crea uno con active: true, slug único (generar con nanoid de 6 caracteres).

Asocia el slug al perfil del plug.

Respuesta: { passId, slug, active: true }

4.2. Obtener datos del Pass público
GET /api/plugpass/public/:slug

Devuelve:

json
{
  "active": true,
  "totalOps": 187,
  "positivePercentage": 100,
  "avgDelivery": 18,
  "displayLevel": "gold",
  "plug": {
    "name": "GreenHaze",
    "city": "Madrid",
    "verified": true
  }
}
No expone el plugId real ni datos sensibles.

4.3. Registrar una transacción (desde bot o interno)
POST /api/plugpass/transaction

Body: { plugPassId: string, type: string, metadata?: { deliveryTime?: number } }

Lógica:

Busca el PlugPass por ID (no por slug público).

Crea una entrada en Transaction.

Actualiza contadores en PlugPass:

Si type = delivery_completed: incrementa totalOps, recalcula avgDelivery con los últimos 30 registros (media móvil).

Si type = feedback_positive: incrementa positiveOps.

Si type = feedback_negative: solo incrementa totalOps (la positiva no sube).

Recalcula displayLevel:

basic: < 20 ops

silver: 20-99 ops y > 90% positivas

gold: >= 100 ops y > 95% positivas

Seguridad: Este endpoint debe aceptar una API key interna (del bot) o estar protegido para que solo el plug autenticado pueda registrar sus propias transacciones.

4.4. Webhook del bot de Telegram (interno)
POST /api/bot/telegram-webhook

Configura un bot con telegraf.

Comandos principales:

/start: Vincula la cuenta de Telegram con el plug (pedirle que ingrese su slug o un código de vinculación único). Almacenamos telegramId en PlugPass.

/entrega: El plug envía una foto o texto; el bot responde con un menú inline: "✅ Entrega completada", "❌ Cancelar". Al confirmar, llama a POST /api/plugpass/transaction con type: delivery_completed y opcionalmente tiempo desde que se tomó el pedido (se puede preguntar con un botón "¿En cuánto entregaste?" y opciones: 5, 10, 15, 20, 30 min).

/feedback pos y /feedback neg: Permite al plug registrar feedback de cliente (para simular o en caso de que el cliente no lo haga). El plug puede enviar estos comandos para actualizar sus métricas (con límite diario).

El bot debe ser privado, solo accesible para plugs con PlugPass activo (verificar telegramId vinculado).

5. FRONTEND – COMPONENTES Y PÁGINAS
5.1. Panel de Plug: Sección "PlugPass"
Ruta: /dashboard/pass

Contenido:

Si no está activado: botón grande "Activar PlugPass". Al pulsar, llamar a POST /api/plugpass/activate y refrescar.

Si está activo:

Mostrar estadísticas: total ops, % positivo, nivel, avg delivery.

Mostrar slug y enlace público (https://verifyplug.eu/p/slug).

Botón para copiar enlace, descargar QR (generar con qrcode.react).

Sección "Vincular Telegram": si no tiene telegramId, mostrar instrucciones y un código de vinculación temporal (6 dígitos) para que lo envíe al bot.

Botón "Editar visibilidad": permite elegir qué métricas mostrar (p.ej., ocultar tiempo de entrega, mostrar solo "100+ ops").

5.2. Página pública de verificación PlugPass
Ruta: /p/[slug] (Next.js page)

Obtiene datos de GET /api/plugpass/public/:slug.

Diseño limpio, con los colores de la marca:

Cabecera: "PlugPass by VerifyPlugEU"

Nombre del plug (público), ciudad, sello de verificado.

Métricas en tarjetas: "187 entregas confirmadas", "100% positivas", "Tiempo medio 18 min".

Si no hay suficientes datos, mostrar "En construcción" con una barra de progreso.

Incluir un pequeño texto informativo sobre la privacidad: "Los datos se basan en pruebas anónimas de transacciones reales".

Botón para reportar (opcional por ahora).

5.3. Directorio principal: Insignia PlugPass
Archivo: componente PlugCard en la lista de resultados.

Si plug.pass.active === true:

Mostrar una insignia junto al nombre: "PlugPass Gold/Silver/Basic" (con color distintivo).

Al hacer hover: tooltip que resume las métricas clave.

Añadir filtro en la búsqueda: "Con PlugPass" (checkbox) y "Nivel Oro" etc.

6. LÓGICA DEL BOT DE TELEGRAM (MVP)
Archivo bot.js (usar telegraf):

Inicializar con BOT_TOKEN de variables de entorno.

Base de datos para guardar vinculación: tabla TelegramLink { telegramId, plugPassId }.

Comando /start: Si ya vinculado, mostrar saludo. Si no, pedir el código de vinculación que el plug ve en su panel.

Al recibir el código, buscar en una tabla temporal LinkCodes { code, plugPassId, expiresAt } y asociar.

Comando /entrega:

Bot manda mensaje: "¿En cuánto tiempo entregaste?" con botones inline: 5 min, 10 min, 15 min, 20 min, 30 min, Otro.

Tras seleccionar (o escribir "otro"), guarda la transacción con delivery_completed y el tiempo.

Responde: "✅ Entrega registrada. Tus métricas se actualizarán pronto."

También pueden simplemente enviar una foto o sticker y el bot automáticamente la interpreta como entrega, preguntando el tiempo con teclado inline.

Comando /feedback pos y /feedback neg: registrar tipos de feedback.

Limitaciones: máximo 5 entregas por día por plug para evitar spam (ajustable).

En cada registro, hacer fetch a la API interna.

7. SEGURIDAD Y PRIVACIDAD
El PlugPass nunca almacena nombres reales, ubicaciones exactas ni detalles de productos. Solo contadores y tiempos anónimos.

La API pública /api/plugpass/public/:slug no debe revelar IDs internos ni correlacionar con otras tablas.

El bot de Telegram debe validar que el telegramId esté vinculado y que el PlugPass esté activo.

Las transacciones se almacenan con metadata genérica (JSON), sin datos sensibles.

8. PASOS DE IMPLEMENTACIÓN CON ANTIGRAVITY
Actualizar el esquema de Prisma con los modelos PlugPass y Transaction, y añadir relaciones.

Crear las migraciones y seeders de prueba (un plug verificado y su pass).

Codificar los endpoints:

pages/api/plugpass/activate.js

pages/api/plugpass/public/[slug].js

pages/api/plugpass/transaction.js

pages/api/bot/telegram-webhook.js

Construir el panel del plug:

Componente PassDashboard dentro de /dashboard/pass.

Construir la página pública /p/[slug].js con getServerSideProps.

Añadir la insignia en el directorio editando el componente de tarjeta y añadiendo el filtro.

Configurar el bot de Telegram:

Crear el archivo bot.js y configurar el webhook en producción.

Conectar variables de entorno (TELEGRAM_BOT_TOKEN, INTERNAL_API_KEY).

Probar el flujo: Activar PlugPass, vincular Telegram, registrar entregas, verificar métricas y página pública.

9. NOTAS ADICIONALES PARA ANTIGRAVITY
Utiliza componentes de shadcn/ui si ya están en el proyecto, si no, Tailwind estándar.

Mantén el diseño consistente con la identidad de VerifyPlugEU (verde cannábico, negro, fuentes modernas).

Asegúrate de que todas las rutas nuevas sean responsivas y funcionen como miniapp.

El bot de Telegram puede ser simulado con un archivo temporal hasta que se configure el webhook real.

¡Crea esta integración paso a paso y notifica cualquier duda sobre la implementación!