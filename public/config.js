/**
 * Configuración dinámica de API para el frontend.
 * Detecta automáticamente el dominio, puerto y subdirectorio (ej. /cards)
 * donde está corriendo la aplicación, permitiendo funcionar sin cambios
 * en localhost, staging o servidores de producción.
 */

(function () {
  const origin = window.location.origin
  const pathname = window.location.pathname

  // Obtener el subdirectorio actual (ej. '/cards/index.html' -> '/cards')
  const lastSlashIndex = pathname.lastIndexOf('/')
  const baseDir = lastSlashIndex > 0 ? pathname.substring(0, lastSlashIndex) : ''

  // Permitir sobreescritura manual si existiera una variable global pre-configurada
  window.API_BASE = window.ENV_API_BASE || `${origin}${baseDir}/api`

  console.log('[API Config] Entorno detectado. API Base:', window.API_BASE)
})()
