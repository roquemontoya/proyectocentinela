import { clienteSupabase } from './supabaseClient.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

async function factoresTOTP() {
  const { data, error } = await clienteSupabase.auth.mfa.listFactors();
  if (error) throw error;
  return {
    verified: (data?.totp || []).filter((factor) => factor.status === 'verified'),
    unverified: (data?.totp || []).filter((factor) => factor.status !== 'verified')
  };
}

// Si el usuario ya registró un segundo factor, no se permite entrar a los módulos
// hasta completar el desafío TOTP. Si no lo registró, puede ingresar y activarlo luego.
export async function verificarSegundoFactor() {
  const { verified } = await factoresTOTP();
  if (!verified.length) return true;

  for (let intento = 0; intento < 3; intento += 1) {
    const codigo = window.prompt('Esta cuenta tiene 2FA activado. Ingresá el código de 6 dígitos de tu aplicación autenticadora. Cancelar cerrará el acceso.');
    if (codigo === null) return false;
    const factor = verified[0];
    const { data: challenge, error: challengeError } = await clienteSupabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError) throw challengeError;
    const { error: verifyError } = await clienteSupabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: codigo.replace(/\s+/g, '')
    });
    if (!verifyError) {
      const { data: assurance, error: assuranceError } = await clienteSupabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance?.currentLevel === 'aal2') return true;
    }
    window.alert('El código no es válido o venció. Revisá la aplicación autenticadora e intentá nuevamente.');
  }
  return false;
}

function cerrarModal() {
  document.getElementById('seguridad-cuenta-modal')?.remove();
}

function renderModal(contenido) {
  cerrarModal();
  const modal = document.createElement('section');
  modal.id = 'seguridad-cuenta-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'seguridad-cuenta-titulo');
  modal.style.cssText = 'position:fixed;inset:0;z-index:12000;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
  modal.innerHTML = `<div style="width:100%;max-width:520px;max-height:90vh;overflow:auto;background:#1e1e1e;color:#e5e7eb;border:1px solid #475569;border-radius:14px;padding:22px;box-sizing:border-box;font-family:Arial,sans-serif;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 id="seguridad-cuenta-titulo" style="margin:0;font-size:20px">Seguridad de la cuenta</h2><button id="seguridad-cerrar" type="button" aria-label="Cerrar" style="font-size:24px;background:transparent;color:#fff;border:0;cursor:pointer">×</button></div>
    <div id="seguridad-cuenta-contenido" style="margin-top:16px;line-height:1.5">${contenido}</div>
  </div>`;
  modal.addEventListener('click', (event) => { if (event.target === modal) cerrarModal(); });
  document.body.appendChild(modal);
  modal.querySelector('#seguridad-cerrar').addEventListener('click', cerrarModal);
  return modal;
}

export async function abrirSeguridadCuenta() {
  const { data: sessionData } = await clienteSupabase.auth.getSession();
  if (!sessionData.session) {
    window.alert('Ingresá a Centinela antes de configurar la seguridad de tu cuenta.');
    return;
  }
  renderModal('<p>Consultando los factores de autenticación…</p>');
  try {
    const { verified, unverified } = await factoresTOTP();
    const contenido = document.getElementById('seguridad-cuenta-contenido');
    if (!contenido) return;
    if (verified.length) {
      contenido.innerHTML = `<p style="color:#86efac">✓ La verificación en dos pasos está activada para esta cuenta.</p>
        <p style="color:#cbd5e1;font-size:14px">Al iniciar sesión se solicitará un código temporal de tu aplicación autenticadora.</p>
        <button id="seguridad-desactivar" type="button" style="width:100%;padding:11px;background:#451a1a;border:1px solid #b91c1c;border-radius:7px;color:#fecaca;cursor:pointer">Desactivar 2FA</button>`;
      contenido.querySelector('#seguridad-desactivar').addEventListener('click', async () => {
        if (!window.confirm('¿Desactivar la verificación en dos pasos de esta cuenta?')) return;
        try {
          const { error } = await clienteSupabase.auth.mfa.unenroll({ factorId: verified[0].id });
          if (error) throw error;
          await abrirSeguridadCuenta();
        } catch (error) {
          window.alert(error?.message || 'No se pudo desactivar 2FA.');
        }
      });
      return;
    }

    const aviso = unverified.length ? '<p style="color:#fcd34d">Hay una configuración pendiente. Podés iniciar una nueva para completarla.</p>' : '';
    contenido.innerHTML = `${aviso}<p>Activá una segunda verificación con una aplicación autenticadora compatible con TOTP (por ejemplo, Microsoft Authenticator, Google Authenticator o 2FAS).</p>
      <ol style="padding-left:22px"><li>Generá el código QR.</li><li>Escanealo con tu aplicación autenticadora.</li><li>Ingresá el código de 6 dígitos para confirmar.</li></ol>
      <button id="seguridad-iniciar-alta" type="button" style="width:100%;padding:12px;background:#0c4a6e;border:1px solid #38bdf8;border-radius:7px;color:#fff;font-weight:bold;cursor:pointer">Configurar 2FA</button>
      <p style="font-size:12px;color:#9ca3af">No compartas el código QR ni la clave secreta. La huella digital del teléfono puede desbloquear la aplicación autenticadora, pero Centinela validará el código TOTP.</p>`;
    contenido.querySelector('#seguridad-iniciar-alta').addEventListener('click', iniciarAltaTOTP);
  } catch (error) {
    const contenido = document.getElementById('seguridad-cuenta-contenido');
    if (contenido) contenido.innerHTML = `<p role="alert" style="color:#fca5a5">No se pudo consultar la configuración de seguridad: ${esc(error?.message || 'Error desconocido')}</p>`;
  }
}

async function iniciarAltaTOTP() {
  const contenido = document.getElementById('seguridad-cuenta-contenido');
  if (!contenido) return;
  const boton = contenido.querySelector('#seguridad-iniciar-alta');
  if (boton) { boton.disabled = true; boton.textContent = 'Generando…'; }
  try {
    const { data, error } = await clienteSupabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Centinela - aplicación autenticadora'
    });
    if (error) throw error;
    const factorId = data.id;
    const qr = data.totp?.qr_code || '';
    const secret = data.totp?.secret || '';
    contenido.innerHTML = `<p>Escaneá este código QR con tu aplicación autenticadora.</p>
      <div style="display:flex;justify-content:center;background:#fff;border-radius:8px;padding:12px;margin:14px 0"><img alt="Código QR para configurar 2FA" src="${esc(qr)}" style="width:220px;max-width:100%;height:auto"></div>
      <details style="margin:12px 0"><summary style="cursor:pointer">No puedo escanear el QR</summary><p style="font-size:13px;overflow-wrap:anywhere;background:#111827;padding:10px;border-radius:6px">${esc(secret)}</p></details>
      <form id="seguridad-verificar-form"><label for="seguridad-codigo" style="display:block;margin-bottom:6px">Código de 6 dígitos</label><input id="seguridad-codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,8}" maxlength="8" required style="box-sizing:border-box;width:100%;padding:12px;background:#111827;color:#fff;border:1px solid #475569;border-radius:7px;margin-bottom:12px"><button id="seguridad-verificar" type="submit" style="width:100%;padding:12px;background:#166534;border:1px solid #22c55e;border-radius:7px;color:#fff;font-weight:bold;cursor:pointer">Verificar y activar 2FA</button></form>
      <p id="seguridad-alta-error" role="alert" style="color:#fca5a5;font-size:13px"></p>
      <p style="font-size:12px;color:#9ca3af">Guardá la cuenta en tu aplicación autenticadora antes de cerrar esta ventana.</p>`;
    contenido.querySelector('#seguridad-verificar-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const codeInput = contenido.querySelector('#seguridad-codigo');
      const submit = contenido.querySelector('#seguridad-verificar');
      const errorEl = contenido.querySelector('#seguridad-alta-error');
      submit.disabled = true;
      try {
        const { error: verifyError } = await clienteSupabase.auth.mfa.challengeAndVerify({
          factorId,
          code: codeInput.value.replace(/\s+/g, '')
        });
        if (verifyError) throw verifyError;
        contenido.innerHTML = '<p style="color:#86efac;font-weight:bold">✓ 2FA quedó activado correctamente.</p><p>La próxima vez que ingreses a Centinela, se te pedirá el código de tu aplicación autenticadora.</p><button id="seguridad-finalizar" type="button" style="width:100%;padding:11px;background:#166534;border:1px solid #22c55e;border-radius:7px;color:#fff;cursor:pointer">Finalizar</button>';
        contenido.querySelector('#seguridad-finalizar').addEventListener('click', cerrarModal);
      } catch (error) {
        errorEl.textContent = error?.message || 'No se pudo validar el código. Revisá que sea el código actual.';
        submit.disabled = false;
      }
    });
  } catch (error) {
    const current = document.getElementById('seguridad-cuenta-contenido');
    if (current) current.innerHTML = `<p role="alert" style="color:#fca5a5">No se pudo iniciar la configuración: ${esc(error?.message || 'Error desconocido')}</p><button id="seguridad-volver" type="button">Volver</button>`;
    current?.querySelector('#seguridad-volver')?.addEventListener('click', abrirSeguridadCuenta);
  }
}

window.abrirSeguridadCuenta = abrirSeguridadCuenta;
