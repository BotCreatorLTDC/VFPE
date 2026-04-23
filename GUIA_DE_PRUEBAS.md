# 🌿 Guía de Pruebas: Ecosistema VFPE (Verify Plug Europe)

Esta guía detalla el funcionamiento de los componentes del sistema para facilitar las pruebas de validación del MVP.

---

## 🔗 Enlaces Directos
*   **Bot Principal:** [@VPFE_bot](https://t.me/VPFE_bot)
*   **Bot Moderador:** [@VPFE_mod_bot](https://t.me/VPFE_mod_bot)
*   **Grupo de Comunidad:** [VFPE Community](https://t.me/+vHqaWGNOnEJkOWM0)
*   **Canal de Publicaciones:** [VFPE Channel](https://t.me/+C3a94m0YWChhOGE0)
*   **Mini App (Web):** [https://vfpe.onrender.com/](https://vfpe.onrender.com/)

---

## 1. Bot Principal (@VFPE_bot)
Es el núcleo del sistema y el punto de entrada para los usuarios.

### Qué probar:
*   **Comando `/start`:** Verifica que muestra el menú principal con botones interactivos.
*   **Buscador de Clubes:** Pulsa en "🗺 Find a Club" -> España -> Madrid. Deberías ver la lista de clubes verificados.
*   **Ficha de Detalle:** Pulsa en "ℹ️ Info" dentro de una tarjeta para ver la descripción ampliada.
*   **Registro de Clubes:** Pulsa en "✅ Get Verified" y completa el formulario conversacional.
*   **Panel de Administración (Solo Admins):** Escribe `/admin` para aprobar o rechazar solicitudes pendientes.

---

## 2. Telegram Mini App
Interfaz visual avanzada accesible desde el bot.

### Qué probar:
*   **Acceso:** Pulsa en el icono de la web app en el bot principal.
*   **Buscador y Filtros:** Prueba la barra de búsqueda y los selectores de país.
*   **Pantalla de Detalle:** Haz clic en una tarjeta para abrir la vista premium.
*   **Formulario Web:** Pulsa "Apply for Verification" y rellena los datos de prueba.

---

## 3. Bot Moderador (En el Grupo @verifyplug_group)
Gestiona la seguridad y el orden del grupo automáticamente.

### Qué probar:
*   **Detección de Spam:** Escribe palabras como *"vendo"*, *"precio"* o *"€/g"*. El bot borrará el mensaje.
*   **Bloqueo de Links:** Intenta poner un enlace tipo `t.me/link`.
*   **Comandos de Admin:** Responde a un mensaje con `/mute` o `/stats`.

---

## 4. Canal de Publicaciones (@verifyplugchannel)
*   **Publicación Automática:** Cada vez que un admin aprueba un club desde el Bot Principal (`/admin`), se genera automáticamente un post en este canal.

---

### Notas Técnicas:
*   **Persistencia:** Base de datos PostgreSQL en Render.
*   **Tono:** "Safe. Real. Trusted."
