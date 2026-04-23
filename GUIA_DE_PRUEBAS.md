# 🌿 Guía de Pruebas: Ecosistema VFPE (Verify Plug Europe)

Esta guía detalla el funcionamiento de los tres componentes del sistema (Bot Principal, Mini App y Moderador) para facilitar las pruebas de validación del MVP.

---

## 1. Bot Principal (@VFPE_bot)
Es el núcleo del sistema y el punto de entrada para los usuarios.

### Qué probar:
*   **Comando `/start`:** Verifica que muestra el menú principal con botones interactivos.
*   **Buscador de Clubes:** Pulsa en "🗺 Find a Club" -> España -> Madrid. Deberías ver la lista de clubes verificados con sus tarjetas.
*   **Ficha de Detalle:** Pulsa en "ℹ️ Info" dentro de una tarjeta para ver la descripción ampliada sin salir de Telegram.
*   **Registro de Clubes:** Pulsa en "✅ Get Verified" y sigue el flujo de preguntas (Nombre, Ciudad, etc.). Al finalizar, verifica que recibes el mensaje de "Solicitud enviada".
*   **Panel de Administración (Solo Admins):** Escribe `/admin` para ver las solicitudes pendientes y aprobarlas con un clic.

---

## 2. Telegram Mini App
Interfaz visual avanzada accesible desde el bot o mediante enlace directo.

### Qué probar:
*   **Acceso:** Pulsa en el icono de la web app en el bot principal o entra en: `https://vfpe.onrender.com/`.
*   **Buscador en tiempo real:** Escribe el nombre de una ciudad o club en la barra superior.
*   **Filtros:** Cambia entre países para ver cómo se actualiza la lista.
*   **Pantalla de Detalle:** Haz clic en cualquier tarjeta de club para abrir la vista premium a pantalla completa.
*   **Formulario Web:** Pulsa "Apply for Verification" en la web y rellena los datos. Verifica que el disclaimer legal aparece correctamente al final.

---

## 3. Bot Moderador (En el Grupo de Comunidad)
Gestiona la seguridad y el orden del grupo de Telegram automáticamente.

### Qué probar:
*   **Detección de Spam:** Escribe palabras prohibidas como *"vendo"*, *"precio"* o *"€/g"*. El bot borrará el mensaje y te dará un aviso.
*   **Bloqueo de Links:** Intenta poner un enlace de otro grupo (ej: `t.me/otro_grupo`). El bot lo eliminará al instante.
*   **Comandos de Admin (Solo Admins):** 
    *   Responde a un mensaje con `/warn` o `/mute`.
    *   Escribe `/stats` para ver el estado de salud del grupo.
    *   Escribe `/rules` para desplegar el reglamento oficial.

---

## 4. Canal de Publicaciones (@VFPEchannel)
*   **Publicación Automática:** Cada vez que un admin aprueba un club desde el Bot Principal (`/admin`), se genera automáticamente un post profesional en este canal con la ficha del club.

---

### Notas Técnicas:
*   **Persistencia:** Todos los datos se guardan en una base de datos PostgreSQL en la nube.
*   **Actualizaciones:** El sistema se actualiza automáticamente cada vez que subimos cambios al repositorio.
*   **Tono:** Se ha respetado el tono "Safe. Real. Trusted." y el uso minimalista de emojis definidos en la especificación.
