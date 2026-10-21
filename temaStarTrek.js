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
/* LCARS personal edition: geometría y paleta inspiradas en interfaces de ciencia ficción */
.tema-star-trek {
  --lcars-orange:#ff9b51; --lcars-peach:#ffca9a; --lcars-lilac:#c9a5ff;
  --lcars-pink:#ff8db7; --lcars-blue:#82dfff; --lcars-cream:#ffe3a6;
}
.tema-star-trek .app-header {
  border-bottom:5px solid var(--lcars-orange) !important;
  border-radius:0 0 0 34px !important;
  padding-left:22px !important;
}
.tema-star-trek .app-header::after {
  content:'LCARS  •  CENTINELA OPERATIONS'; display:block; font-size:10px;
  letter-spacing:.22em; color:var(--lcars-peach); padding:4px 10px 7px;
}
.tema-star-trek #side-menu {
  border-right:7px solid var(--lcars-orange) !important;
  border-radius:0 0 0 34px !important;
  box-shadow:8px 0 26px rgba(0,0,0,.35) !important;
}
.tema-star-trek #side-menu > * { border-radius:0 0 0 24px; }
.tema-star-trek #side-menu .drawer-list > li {
  border-left:7px solid var(--lcars-lilac);
  margin:5px 7px 5px 0 !important; padding:12px 13px !important;
  background:linear-gradient(90deg,rgba(201,165,255,.14),rgba(4,25,38,.3)) !important;
  border-radius:0 18px 3px 0 !important;
}
.tema-star-trek #side-menu .drawer-list > li:nth-child(4n+2) { border-left-color:var(--lcars-orange); }
.tema-star-trek #side-menu .drawer-list > li:nth-child(4n+3) { border-left-color:var(--lcars-pink); }
.tema-star-trek #side-menu .drawer-list > li:nth-child(4n) { border-left-color:var(--lcars-blue); }
.tema-star-trek #side-menu .menu-grupo { border-left:0 !important; padding:0 !important; background:transparent !important; }
.tema-star-trek #side-menu summary {
  padding:13px 12px !important; margin:5px 0 !important; cursor:pointer;
  color:#06111b !important; background:var(--lcars-peach) !important;
  border-radius:0 22px 4px 0 !important; font-weight:800 !important;
  letter-spacing:.025em; list-style:none;
}
.tema-star-trek #side-menu .menu-grupo:nth-of-type(3n) summary { background:var(--lcars-lilac) !important; }
.tema-star-trek #side-menu .menu-grupo:nth-of-type(3n+1) summary { background:var(--lcars-orange) !important; }
.tema-star-trek #side-menu .menu-grupo summary::-webkit-details-marker { display:none; }
.tema-star-trek #side-menu .menu-grupo ul { padding:4px 0 8px 9px !important; }
.tema-star-trek #side-menu .menu-grupo ul li {
  border-left:4px solid var(--lcars-blue) !important; border-radius:0 12px 3px 0 !important;
  margin:5px 0 !important; padding:10px !important; background:rgba(7,29,43,.82) !important;
}
.tema-star-trek .card, .tema-star-trek #main-content .card {
  position:relative; overflow:hidden; border:0 !important;
  border-left:9px solid var(--lcars-orange) !important;
  border-radius:0 24px 4px 0 !important;
  background:linear-gradient(110deg,rgba(8,43,61,.98),rgba(2,14,25,.98)) !important;
}
.tema-star-trek #main-content .card:nth-child(4n+2) { border-left-color:var(--lcars-lilac) !important; }
.tema-star-trek #main-content .card:nth-child(4n+3) { border-left-color:var(--lcars-pink) !important; }
.tema-star-trek #main-content .card:nth-child(4n) { border-left-color:var(--lcars-blue) !important; }
.tema-star-trek .card-title { color:var(--lcars-cream) !important; letter-spacing:.04em; }
.tema-star-trek button, .tema-star-trek .menu-toggle, .tema-star-trek .btn-header-inicio {
  background:var(--lcars-orange) !important; color:#07131d !important;
  border:0 !important; border-radius:0 17px 3px 0 !important; font-weight:800 !important;
  box-shadow:none !important;
}
.tema-star-trek button:hover { background:var(--lcars-peach) !important; filter:brightness(1.04); }
.tema-star-trek input, .tema-star-trek select, .tema-star-trek textarea {
  border-radius:0 12px 3px 0 !important; border-left:5px solid var(--lcars-lilac) !important;
}
.tema-star-trek #star-trek-status { color:var(--lcars-cream) !important; }
.tema-star-trek .dynamic-container { border-top:5px solid var(--lcars-pink) !important; }

/* LCARS 2.0 — diseño visual solamente; no altera el comportamiento de la aplicación */
body.tema-star-trek { background:#05060b !important; color:#f5e8d8 !important; }
body.tema-star-trek::before { opacity:.035; }
.tema-star-trek .app-header {
  min-height:72px !important; background:#05060b !important; border:0 !important;
  border-bottom:8px solid #ff9b51 !important; border-radius:0 0 0 32px !important;
  box-shadow:none !important; padding:12px 16px !important;
}
.tema-star-trek .app-header h1 { color:#ffca9a !important; text-shadow:none !important; letter-spacing:.04em; }
.tema-star-trek #side-menu {
  background:#080a12 !important; border:0 !important; border-right:9px solid #ff9b51 !important;
  border-radius:0 0 0 36px !important; box-shadow:10px 0 28px #0009 !important;
}
.tema-star-trek #side-menu > * { border-radius:0 0 0 24px; }
.tema-star-trek #side-menu .drawer-list { padding:10px 8px 16px !important; }
.tema-star-trek #side-menu .drawer-list > li {
  margin:6px 0 !important; padding:11px 13px !important; min-height:42px;
  border:0 !important; border-left:7px solid #c9a5ff !important;
  border-radius:0 20px 4px 0 !important; background:#111522 !important; color:#f8e9db !important;
}
.tema-star-trek #side-menu .drawer-list > li:nth-child(4n+1) { border-left-color:#ff9b51 !important; }
.tema-star-trek #side-menu .drawer-list > li:nth-child(4n+2) { border-left-color:#c9a5ff !important; }
.tema-star-trek #side-menu .drawer-list > li:nth-child(4n+3) { border-left-color:#ff8db7 !important; }
.tema-star-trek #side-menu .drawer-list > li:nth-child(4n) { border-left-color:#82dfff !important; }
.tema-star-trek #side-menu .menu-grupo { border:0 !important; background:transparent !important; padding:0 !important; }
.tema-star-trek #side-menu .menu-grupo summary {
  margin:8px 0 !important; padding:13px 12px !important; border:0 !important;
  border-radius:0 24px 4px 0 !important; background:#ffca9a !important; color:#15111b !important;
  font-weight:800 !important; letter-spacing:.02em; list-style:none;
}
.tema-star-trek #side-menu .menu-grupo:nth-of-type(3n) summary { background:#c9a5ff !important; }
.tema-star-trek #side-menu .menu-grupo:nth-of-type(3n+1) summary { background:#ff9b51 !important; }
.tema-star-trek #side-menu .menu-grupo ul { padding:2px 0 8px 10px !important; }
.tema-star-trek #side-menu .menu-grupo ul li {
  margin:5px 0 !important; padding:10px 12px !important; border:0 !important;
  border-left:4px solid #82dfff !important; border-radius:0 13px 3px 0 !important;
  background:#101724 !important; color:#d8f5ff !important;
}
.tema-star-trek #side-menu li:hover { filter:brightness(1.18); background:#202033 !important; }
.tema-star-trek #btn-star-trek-toggle {
  margin:14px 8px 0 !important; width:calc(100% - 16px) !important; padding:14px !important;
  background:#ff9b51 !important; color:#17101b !important; border:0 !important;
  border-radius:0 22px 4px 0 !important; text-align:left !important;
}
.tema-star-trek #star-trek-status { color:#ffe3a6 !important; letter-spacing:.2em; padding:10px 18px !important; }
.tema-star-trek #main-content { background:transparent !important; }
.tema-star-trek #main-content .card, .tema-star-trek .card {
  border:0 !important; border-left:9px solid #ff9b51 !important;
  border-radius:0 26px 5px 0 !important; background:#111522 !important;
  box-shadow:none !important; overflow:hidden;
}
.tema-star-trek #main-content .card:nth-child(4n+2), .tema-star-trek .card:nth-child(4n+2) { border-left-color:#c9a5ff !important; }
.tema-star-trek #main-content .card:nth-child(4n+3), .tema-star-trek .card:nth-child(4n+3) { border-left-color:#ff8db7 !important; }
.tema-star-trek #main-content .card:nth-child(4n), .tema-star-trek .card:nth-child(4n) { border-left-color:#82dfff !important; }
.tema-star-trek .card h2, .tema-star-trek .card h3, .tema-star-trek #vista-dinamica h2 { color:#ffca9a !important; text-shadow:none !important; }
.tema-star-trek button, .tema-star-trek .menu-toggle, .tema-star-trek .btn-header-inicio {
  background:#ff9b51 !important; color:#16101a !important; border:0 !important;
  border-radius:0 18px 4px 0 !important; font-weight:800 !important; box-shadow:none !important;
}
.tema-star-trek input, .tema-star-trek select, .tema-star-trek textarea {
  background:#090e18 !important; color:#fff0e5 !important; border:1px solid #7d6caa !important;
  border-left:5px solid #c9a5ff !important; border-radius:0 13px 4px 0 !important;
}
.tema-star-trek table { border-collapse:separate !important; border-spacing:0 3px !important; }
.tema-star-trek th { background:#c9a5ff !important; color:#17101b !important; border:0 !important; }
.tema-star-trek td { background:#101522 !important; border-color:#303247 !important; }
.tema-star-trek #vista-dinamica > section, .tema-star-trek #vista-dinamica > div {
  border-color:#343047 !important;
}
@media(max-width:600px) {
  .tema-star-trek .app-header { padding:8px 10px !important; border-bottom-width:6px !important; }
  .tema-star-trek #side-menu { border-right-width:6px !important; }
  .tema-star-trek #side-menu .drawer-list { padding:7px 5px 12px !important; }
  .tema-star-trek #side-menu .menu-grupo summary { padding:11px 9px !important; margin:6px 0 !important; }
  .tema-star-trek #side-menu .menu-grupo ul { padding-left:6px !important; }
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
