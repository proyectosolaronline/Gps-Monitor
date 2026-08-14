/**
 * ==========================================================
 * FLOTILLA GPS PRO — auth.js
 * Script compartido que protege TODAS las páginas del sistema.
 * Inclúyelo con <script src="auth.js"></script> ANTES de
 * cualquier otro script en Monitor.html, Transito.html,
 * Chat.html y Admin.html.
 * ==========================================================
 *
 * Uso típico al inicio de cada página protegida:
 *
 *   FlotillaAuth.proteger({ roles: ['admin'] }).then(function(usuario){
 *       // usuario ya viene verificado contra el servidor
 *       iniciarPagina(usuario);
 *   });
 *
 * Si no se pasa "roles", cualquier usuario logueado puede entrar.
 * ==========================================================
 */

const FlotillaAuth = (function () {

  // Reemplaza esta URL por la de tu implementación de Apps Script (Web App)
  const API_URL = 'https://script.google.com/macros/s/AKfycbyAqi-Kj_kegpMLXpoxxo3GE1eaNCuwXqmct0aDkdDJ2M01lmjDc0c0vJz9H2aOHWZ4fg/exec';

  const CLAVE_TOKEN = 'flotilla_token';
  const CLAVE_USUARIO = 'flotilla_usuario';

  function guardarSesion(token, usuario) {
    sessionStorage.setItem(CLAVE_TOKEN, token);
    sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
  }

  function obtenerToken() {
    return sessionStorage.getItem(CLAVE_TOKEN);
  }

  function obtenerUsuario() {
    try {
      return JSON.parse(sessionStorage.getItem(CLAVE_USUARIO));
    } catch (e) {
      return null;
    }
  }

  function limpiarSesion() {
    sessionStorage.removeItem(CLAVE_TOKEN);
    sessionStorage.removeItem(CLAVE_USUARIO);
  }

  function irALogin(mensaje) {
    limpiarSesion();
    const destino = 'Login.html' + (mensaje ? ('?msg=' + encodeURIComponent(mensaje)) : '');
    window.location.href = destino;
  }

  /**
   * Llama a la API. Adjunta el token automáticamente salvo
   * que se pase { sinToken: true } (usado solo por login).
   */
  function llamar(accion, datos, opciones) {
    datos = datos || {};
    opciones = opciones || {};

    if (!opciones.sinToken) {
      datos.token = obtenerToken();
    }
    datos.accion = accion;

    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(datos)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.codigo === 'SESION_INVALIDA') {
          irALogin('Tu sesión expiró. Inicia sesión de nuevo.');
          return Promise.reject(res);
        }
        return res;
      })
      .catch(function (err) {
        if (err && err.codigo) throw err; // ya manejado arriba
        console.error('Error de red:', err);
        return { exito: false, mensaje: 'No se pudo conectar con el servidor.' };
      });
  }

  function llamarGet(accion, parametros) {
    parametros = parametros || {};
    parametros.accion = accion;
    parametros.token = obtenerToken();

    const query = Object.keys(parametros)
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(parametros[k]); })
      .join('&');

    return fetch(API_URL + '?' + query)
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.codigo === 'SESION_INVALIDA') {
          irALogin('Tu sesión expiró. Inicia sesión de nuevo.');
          return Promise.reject(res);
        }
        return res;
      });
  }

  /**
   * Inicia sesión contra el servidor y guarda token + usuario.
   */
  function iniciarSesion(email, password) {
    return llamar('login', { email: email, password: password }, { sinToken: true })
      .then(function (res) {
        if (res.exito) {
          guardarSesion(res.token, res.usuario);
        }
        return res;
      });
  }

  function cerrarSesion() {
    return llamar('logout', {}).finally(function () {
      irALogin();
    });
  }

  /**
   * Protege la página actual: exige token guardado localmente Y
   * lo revalida contra el servidor (para detectar expiración o
   * desactivación de cuenta). Si roles se especifica, exige que
   * el rol del usuario esté en esa lista.
   *
   * Devuelve una Promise que resuelve con el usuario si todo está bien,
   * o redirige a Login.html y nunca resuelve (para cortar la ejecución
   * del resto del script de la página).
   */
  function proteger(opciones) {
    opciones = opciones || {};
    const token = obtenerToken();

    if (!token) {
      irALogin();
      return new Promise(function () {}); // nunca resuelve; ya estamos redirigiendo
    }

    return llamarGet('verificarSesion', {}).then(function (res) {
      if (!res.exito) {
        irALogin(res.mensaje || 'Sesión inválida.');
        return new Promise(function () {});
      }

      if (opciones.roles && opciones.roles.indexOf(res.usuario.Rol) === -1) {
        irASinPermiso();
        return new Promise(function () {});
      }

      guardarSesion(token, res.usuario);
      return res.usuario;
    });
  }

  function irASinPermiso() {
    document.body.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
      'flex-direction:column;gap:14px;font-family:sans-serif;background:#0b1420;color:#e8eef5;">' +
      '<h2 style="margin:0;">Acceso no autorizado</h2>' +
      '<p style="color:#8ea3b8;margin:0;">Tu rol no tiene permiso para ver esta página.</p>' +
      '<a href="Login.html" style="color:#35c2a4;">Volver al inicio</a></div>';
  }

  return {
    proteger: proteger,
    iniciarSesion: iniciarSesion,
    cerrarSesion: cerrarSesion,
    llamar: llamar,
    llamarGet: llamarGet,
    obtenerUsuario: obtenerUsuario,
    obtenerToken: obtenerToken
  };
})();
