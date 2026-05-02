# 📖 Guía Final del Ecosistema VFPE

Bienvenido a la documentación oficial de **VFPE**. Esta guía detalla el funcionamiento de los tres pilares del proyecto: la **Mini App**, el **Bot Moderador** y el **Panel de Administración**.

---

## 1. Mini App VFPE (Frontend de Usuario)

La Mini App es el punto de encuentro entre usuarios y plugs verificados.

### Para Usuarios:
- **Mapa Interactivo:** Localiza plugs cerca de ti en España, Alemania y Holanda. Los números en el mapa indican la cantidad de plugs por ciudad (clusters).
- **Filtros Avanzados:** Puedes filtrar por país o por tipo de servicio (**Delivery**, **Meetup**, **Postal**).
- **Perfiles Detallados:** Consulta la descripción, redes sociales (Instagram/Telegram) y la reputación del plug.
- **Reseñas y Likes:** Valorar un plug ayuda a la comunidad. Los likes se guardan localmente y en el servidor para mostrar popularidad.
- **Reportes:** Si encuentras algo sospechoso, usa el botón de reporte para alertar a los moderadores.

### Para Dueños de Plugs (Verified Plugs):
- **Dashboard de Gestión:** Si el bot te reconoce como dueño, verás el botón "Manage My Plug".
- **Estadísticas Reales:** Consulta cuántas personas han visto tu perfil ("Views"), han hecho clic en tus enlaces ("Clicks") y cuántos "Likes" tienes.
- **Anuncios (Plan Advanced):** Puedes publicar un mensaje corto (ej: "¡Nuevo stock!") que aparecerá destacado en tu tarjeta durante 24 horas.

---

## 2. Bot Moderador (Seguridad y Comunidad)

El bot `@VerifyPlugEU_bot` (o el configurado como moderador) asegura que el grupo de Telegram sea un entorno seguro.

### Reglas de Auto-Moderación:
1. **Anti-Flood:** Si un usuario envía más de 5 mensajes en 10 segundos, será silenciado automáticamente por 1 hora.
2. **Filtro de Palabras Clave:** El bot elimina mensajes que contengan palabras prohibidas (ventas no autorizadas, estafas, etc.). Esta lista se actualiza dinámicamente desde la base de datos.
3. **Bloqueo Multimedia:** Solo los **Plugs Verificados** y Admins pueden enviar fotos, vídeos o archivos. Los mensajes de otros usuarios con multimedia serán eliminados.
4. **Sistema de Avisos:**
    - 1er y 2do aviso: Mensaje de advertencia.
    - 3er aviso: Baneo automático del grupo.

### Comandos de Administración:
- `/stats`: Ver cuántos usuarios hay en la base de datos y cuántos tienen advertencias.
- `/admin`: Panel rápido con lista de baneados y plugs activos.
- `/unmute [reply]`: Quita el silencio a un usuario.
- `/pin [texto]`: Crea un mensaje fijado con estilo VFPE.

---

## 3. Panel Admin (Gestión de Negocio)

Accesible desde Telegram para los administradores designados.

### Flujo de Aprobación de Plugs:
1. **Pendiente:** El plug envía su solicitud desde la Mini App.
2. **Aceptar:** El admin revisa y pulsa "Aceptar". El bot envía automáticamente las opciones de pago (BTC, ETH, USDT, XRP, SOL) al usuario.
3. **Publicar:** Una vez confirmado el pago, el admin pulsa "Confirmar Pago y Publicar". El plug pasa a estar visible y se le otorgan 30 días de suscripción.
4. **Promoción:** Los plugs con Plan Advanced pueden ser marcados como "Premium" (borde dorado y posición prioritaria).

### Analíticas:
- El panel muestra el **Top 5 de Ciudades** con más plugs y el **Top 5 de Plugs** con más clics, permitiendo medir el crecimiento del ecosistema.

---

## 4. Planes y Monetización

| Característica | Basic (50€) | PRO (80€) | Advanced (100€) |
| :--- | :---: | :---: | :---: |
| Duración | 30 días | 30 días | 30 días |
| Verificación | ✅ | Prioritaria | Máxima |
| Redes Sociales | 1 Link | Todos | Todos |
| Promo en Canal | ❌ | ✅ | ✅ |
| **Borde Dorado** | ❌ | ❌ | ✅ |
| **Anuncios 24h** | ❌ | ❌ | ✅ |

---

## Soporte y Mantenimiento

- **Base de Datos:** PostgreSQL para persistencia de plugs, usuarios y reglas.
- **Servidor:** Node.js Express alojado en Render.
- **Actualizaciones:** El sistema de "Self-Management" permite que el directorio se mantenga actualizado sin intervención constante de los admins.

---
*VFPE — Safe. Real. Trusted.*
