const STYLE_ID = 'centinela-star-trek-theme';

const css = `
body.tema-star-trek {
  --st-bg: #020b12; --st-panel: rgba(4, 25, 38, .94); --st-cyan: #70f5ff;
  --st-blue: #159fca; --st-line: rgba(80, 221, 255, .48); --st-text: #d8f8ff;
  background: radial-gradient(ellipse at 50% -20%, #123b56 0%, #061725 42%, #01070c 100%) fixed !important;
  color: var(--st-text) !important; font-family: 'Trebuchet MS', Arial, sans-serif !important;
}
body.tema-star-trek::before {
  content: ''; pointer-events:none; position:fixed; inset:0; z-index:9990; opacity:.12;
  background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(80,220,255,.15) 4px);
}
.tema-star-trek .app-header {
  background: rgba(1, 12, 20, .96) !important; border-bottom:1px solid var(--st-line) !important;
  box-shadow:0 4px 22px rgba(0,195,255,.16); color:var(--st-cyan) !important;
}
.tema-star-trek .app-header h1, .tema-star-trek h1, .tema-star-trek h2, .tema-star-trek h3 {
  color:var(--st-cyan) !important; text-shadow:0 0 12px rgba(63,220,255,.28); letter-spacing:.06em;
}
.tema-star-trek .card, .tema-star-trek #vista-dinamica > section, .tema-star-trek #vista-dinamica > div,
.tema-star-trek .modal-content, .tema-star-trek form {
  border-color:var(--st-line) !important; border-radius:3px 18px 3px 18px !important;
}
.tema-star-trek .card, .tema-star-trek #main-content .card {
  background:linear-gradient(145deg,rgba(6,43,62,.96),rgba(2,16,28,.98)) !important;
  border:1px solid var(--st-line) !important; box-shadow:inset 0 0 18px rgba(0,183,255,.06),0 0 14px rgba(0,160,220,.08) !important;
}
.tema-star-trek .card:hover { border-color:var(--st-cyan) !important; box-shadow:0 0 18px rgba(0,220,255,.24) !important; }
.tema-star-trek button, .tema-star-trek .menu-toggle, .tema-star-trek .btn-header-inicio {
  background:linear-gradient(135deg,#0c536e,#08273b) !important; color:var(--st-cyan) !important;
  border:1px solid var(--st-cyan) !important; border-radius:3px 12px 3px 12px !important;
  box-shadow:inset 0 0 12px rgba(0,200,255,.08);
}
.tema-star-trek input, .tema-star-trek select, .tema-star-trek textarea {
  background:#03131e !important; color:#e1fbff !important; border:1px solid #2689a8 !important; border-radius:2px 8px 2px 8px !important;
}
.tema-star-trek label, .tema-star-trek p, .tema-star-trek span, .tema-star-trek li { color:inherit; }
.tema-star-trek #side-menu {
  background:linear-gradient(180deg,#061b2a,#020a12) !important; border-right:1px solid var(--st-line) !important;
}
.tema-star-trek #side-menu li:hover { background:rgba(0,196,255,.12) !important; border-left-color:var(--st-cyan) !important; }
.tema-star-trek #main-content .card-img { background:linear-gradient(145deg,#0a3449,#04111e) !important; }
.tema-star-trek #vista-dinamica { color:var(--st-text); }
.tema-star-trek table { border-color:var(--st-line) !important; }
.tema-star-trek th { background:#0a3b51 !important; color:var(--st-cyan) !important; }
.tema-star-trek td { border-color:rgba(80,221,255,.18) !important; }
#btn-star-trek-toggle { width:100%; text-align:left; padding:12px; margin-top:8px; font-weight:700; cursor:pointer; }
#star-trek-status { font-size:11px; letter-spacing:.15em; color:#8af5ff; padding:8px 12px; opacity:.85; }
@media (prefers-reduced-motion:no-preference) {
 .tema-star-trek .card { animation: st-boot .45s ease-out both; }
 @keyframes st-boot { from { opacity:.35; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
}

`;

export function alternarTemaStarTrek(force) {
  const enabled = typeof force === 'boolean' ? force : !document.body.classList.contains('tema-star-trek');
  let style = document.getElementById(STYLE_ID);
  if (enabled && !style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }
  document.body.classList.toggle('tema-star-trek', enabled);
  try { localStorage.setItem('centinela-tema-personal', enabled ? 'star-trek' : 'normal'); } catch (_) {}
  const button = document.getElementById('btn-star-trek-toggle');
  if (button) button.textContent = enabled ? '🖖 Volver al diseño estándar' : '🖖 Activar modo Star Trek';
  const status = document.getElementById('star-trek-status');
  if (status) status.textContent = enabled ? 'LCARS / INTERFAZ ESTELAR ACTIVA' : 'INTERFAZ ESTÁNDAR';
  return enabled;
}

export function inicializarTemaStarTrek(menu) {
  if (!menu || document.getElementById('btn-star-trek-toggle')) return;
  const li = document.createElement('li');
  li.style.listStyle = 'none';
  li.innerHTML = '<button id="btn-star-trek-toggle" type="button">🖖 Activar modo Star Trek</button><div id="star-trek-status">INTERFAZ ESTÁNDAR</div>';
  menu.appendChild(li);
  const button = li.querySelector('button');
  button.addEventListener('click', () => alternarTemaStarTrek());
  let saved = '';
  try { saved = localStorage.getItem('centinela-tema-personal') || ''; } catch (_) {}
  if (saved === 'star-trek') alternarTemaStarTrek(true);
}

/* LCARS 3.0 — ajustes de alto contraste para que el cambio sea claramente visible */
body.tema-star-trek #side-menu {
  width:min(82vw, 430px) !important;
  background:#070910 !important;
  border-right:12px solid #ff9b51 !important;
}
body.tema-star-trek #side-menu > * {
  background:transparent !important;
}
body.tema-star-trek #side-menu summary,
body.tema-star-trek #side-menu .menu-grupo summary {
  display:flex !important; align-items:center !important; justify-content:space-between !important;
  min-height:54px !important; margin:10px 8px 10px 0 !important;
  padding:12px 14px !important; background:#ff9b51 !important; color:#15101b !important;
  border-radius:0 28px 4px 0 !important; border:0 !important;
  box-shadow:inset -18px 0 0 rgba(255,255,255,.16) !important;
  font-size:15px !important; line-height:1.2 !important;
}
body.tema-star-trek #side-menu .menu-grupo:nth-of-type(2n) summary { background:#c9a5ff !important; }
body.tema-star-trek #side-menu .menu-grupo:nth-of-type(3n) summary { background:#ffca9a !important; }
body.tema-star-trek #side-menu .menu-grupo ul li {
  background:#101522 !important; color:#d9f5ff !important;
  border-left:5px solid #82dfff !important; border-radius:0 15px 3px 0 !important;
  margin:6px 10px 6px 7px !important; padding:12px !important;
}
body.tema-star-trek #side-menu .drawer-list > li,
body.tema-star-trek #side-menu li:not(.menu-grupo) {
  border-radius:0 16px 3px 0 !important;
}
body.tema-star-trek #side-menu #btn-star-trek-toggle {
  width:calc(100% - 18px) !important; margin:16px 8px !important;
  min-height:56px !important; border-radius:0 28px 4px 0 !important;
  background:#ff9b51 !important; color:#15101b !important;
}
body.tema-star-trek #main-content {
  background:linear-gradient(135deg,#090b15 0%,#11172a 55%,#080910 100%) !important;
}
body.tema-star-trek #main-content .card,
body.tema-star-trek #vista-dinamica .card {
  border:0 !important; border-left:12px solid #ff9b51 !important;
  border-radius:0 30px 5px 0 !important;
  background:linear-gradient(105deg,#171a2a 0%,#0c101d 100%) !important;
  box-shadow:inset 0 1px 0 #ffffff13, 0 8px 0 #0005 !important;
  padding-top:18px !important; padding-bottom:18px !important;
}
body.tema-star-trek #main-content .card:nth-child(3n+2),
body.tema-star-trek #vista-dinamica .card:nth-child(3n+2) { border-left-color:#c9a5ff !important; }
body.tema-star-trek #main-content .card:nth-child(3n),
body.tema-star-trek #vista-dinamica .card:nth-child(3n) { border-left-color:#ff8db7 !important; }
body.tema-star-trek #main-content button,
body.tema-star-trek #vista-dinamica button {
  min-height:42px; border-radius:0 18px 3px 0 !important;
}
body.tema-star-trek .app-header {
  background:#070910 !important; border-bottom:10px solid #ff9b51 !important;
}
body.tema-star-trek .app-header::after {
  content:'STARFLEET • SECURITY OPERATIONS • LCARS 47-B' !important;
  display:block !important; color:#ffca9a !important; font-size:10px !important;
  letter-spacing:.18em !important; padding:5px 10px !important;
}
@media(max-width:600px) {
 body.tema-star-trek #side-menu { width:86vw !important; border-right-width:8px !important; }
 body.tema-star-trek #side-menu summary,
 body.tema-star-trek #side-menu .menu-grupo summary { min-height:48px !important; margin:7px 5px 7px 0 !important; }
}

