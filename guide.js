// Mode d'emploi: a few illustrated cards for a newcomer. Swipe left / right
// (or the arrows), each card scrolls up / down. Built once, on first open.
import { ICONS } from './icons.js';

// The real clock, live and small: the app itself in a demo scene (see runDemo in app.js).
// A little film of the real app (see runDemo in app.js); its explanation comes in step by step.
const live = kind => `<figure class="gd-live"><div class="gl-frame" data-demo="${kind}"></div><figcaption class="gl-cap" aria-live="polite"></figcaption></figure>`;
const lives = (...xs) => `<div class="gd-lives">${xs.map(x => live(...x)).join('')}</div>`;
const ic = k => `<span class="gd-ic">${ICONS[k] || ''}</span>`;
// A tiny clock: two halves and the bar, coloured like the real one.
const phone = (top, bot, mid = '', topTxt = '', botTxt = '') => `<div class="gd-phone">
  <div class="gp-h gp-top ${top}">${topTxt}</div><div class="gp-bar">${mid}</div><div class="gp-h ${bot}">${botTxt}</div></div>`;
const frieze = (cur = -1) => `<div class="gd-frieze">${['chess', 'pause', 'box', 'pause', 'chess', 'pause', 'box', 'pause', 'chess'].map((k, i) =>
  k === 'pause' ? `<i class="gf-p${i === cur ? ' now' : ''}"></i>` : `<b class="gf-${k}${i === cur ? ' now' : ''}">${k === 'chess' ? ICONS.pawn : ICONS.glove}</b>`).join('')}</div>`;

const CARDS = [
  { t: 'Comment ça marche', s: "Échecs et boxe, une seule pendule, comment on gagne", h: `<div class="gd-hero">${ICONS.pawn}<span>+</span>${ICONS.glove}</div>`, b: `
    <p class="gd-lead">Le chessboxing alterne des <b>rounds d'échecs</b> et des <b>rounds de boxe</b>.</p>
    <p>L'appli est la <b>pendule d'échecs</b> des deux joueurs et le <b>chrono des rounds</b> : elle sonne la cloche et enchaîne tout le combat seule.</p>
    <p>Pose le téléphone entre les deux joueurs : chacun a sa moitié d'écran, tournée vers lui.</p>
    <p class="gd-win">On gagne par <b>mat</b>, par <b>K.-O.</b>, au <b>temps</b> (pendule à 0), ou si l'autre prend trop de <b>comptes</b> (fiche 7).</p>` },
  { t: 'Round par round', s: "L'ordre des rounds et les deux chronos", h: frieze(), b: `
    <ul class="gd-leg"><li><b class="gf-chess">${ICONS.pawn}</b>Échecs <em>3:00</em></li><li><i class="gf-p"></i>Pause <em>1:00</em></li><li><b class="gf-box">${ICONS.glove}</b>Boxe <em>3:00</em></li></ul>
    <p class="gd-lead">Le combat classique fait <b>5 rounds</b> : 3 d'échecs, 2 de boxe, une pause entre chaque.</p>
    <p>Il y a <b>deux chronos</b> : le <b>round</b>, le même pour les deux, et la <b>pendule</b> de chaque joueur, qui ne tourne que pendant ses coups (<b>4:30</b> pour 5 rounds, <b>6:00</b> pour 7…).</p>
    <p>Le dernier round d'échecs n'a pas de limite : il continue jusqu'à ce qu'une pendule tombe à 0.</p>` },
  { t: 'Régler le combat', s: 'Nombre de rounds, durées, installer', l: lives(['setup']), b: `
    <ul class="gd-steps">
      <li><b>Rounds</b> : touche le carré pour choisir 5, 7, 9 ou 11 rounds, ou la <b>pendule classique</b> (sans rounds, temps et incrément réglables).</li>
      <li><b>Échecs, Boxe, Pause</b> : touche une durée, puis fais glisser la règle qui s'ouvre.</li>
      <li>${ic('replay')} remet le combat classique : 5 rounds, 3:00 / 3:00 / 1:00.</li>
      <li>${ic('install')} <b>Installer</b> : met la pendule sur l'écran d'accueil du téléphone ; elle marche ensuite sans réseau.</li></ul>
    <p class="gd-note">Boxe à <em>0:00</em> : pas de boxe, seulement des rounds d'échecs avec des pauses.</p>` },
  { t: 'Jouer aux échecs', s: 'Qui a les Blancs, taper sa moitié, le vert', l: lives(['chess']), b: `
    <ul class="gd-steps">
      <li>Le premier qui touche sa moitié prend les <b>Noirs</b> : la pendule des Blancs démarre.</li>
      <li>Après ton coup, <b>touche ta moitié</b> : ta pendule s'arrête, celle de l'autre repart.</li>
      <li>La moitié <b class="g-green">verte</b> est celle du joueur qui doit jouer.</li>
      <li>En haut, <b>ROUND 2:58</b> : le temps qui reste au round. À 0, la cloche sonne.</li></ul>` },
  { t: 'Pause et boxe', s: 'Bleu = pause, rouge = boxe, cloche, Prêt ?', l: lives(['flow']), b: `
    <ul class="gd-steps">
      <li><b class="g-blue">Bleu</b> = pause, <b class="g-red">rouge</b> = boxe. Le grand chrono est celui du round ; la pendule de chacun reste en petit, en haut.</li>
      <li>Le claquoir (toc toc toc) sonne 10 s avant la fin, puis la cloche.</li>
      <li>Pendant la pause, le <b>prochain round clignote</b> dans la barre du milieu.</li>
      <li><b>Prêt ?</b> : avant chaque round d'échecs, la pendule attend qu'on touche l'écran, le temps d'enlever les gants.</li></ul>` },
  { t: 'Arrêter ou refaire', s: 'Mettre en pause, refaire le round, nouveau combat', l: lives(['pause']), b: `
    <p class="gd-lead">Le bouton ${ic('pause')} au bout de la barre du milieu arrête tout.</p>
    <ul class="gd-steps">
      <li>${ic('play')} <b>GO</b> : on reprend. Toucher l'écran ailleurs reprend aussi.</li>
      <li>${ic('replay')} <b>Round</b> : refait le round en cours depuis son début.</li>
      <li>${ic('home')} <b>Accueil</b> : arrête le combat et remet une pendule neuve. C'est aussi ce qu'on fait après un mat, un K.-O. ou un abandon.</li></ul>` },
  { t: "Pour l'arbitre", s: 'Joueur trop lent, coup illégal, défaite', l: lives(['referee']), b: `
    <p class="gd-lead">Deux aides, à allumer dans les réglages, carte <b>Arbitre</b>.</p>
    <ul class="gd-steps">
      <li><b>Comptes</b> (rien à voir avec le compte en boxe) : si un joueur réfléchit trop longtemps, un toc d'alerte, puis la pendule compte 10 s, avec des mains comme un arbitre. Chaque compte commencé est noté. <b>À 0, le combat est perdu.</b></li>
      <li><b>Coups illégaux</b> : chacun a un drapeau dans sa moitié. Tu le touches quand l'autre a joué un coup illégal : il rejoue, et ça lui fait un compte.</li>
      <li><b>3 comptes dans un round, ou 4 au total</b> : combat perdu (réglable).</li></ul>` },
  { t: 'Réglages', s: 'Son, batterie, sens de l’écran, chiffres', l: lives(['settings']), b: `
    <p class="gd-lead">Le bouton <b>Réglages</b> est sous le temps de chaque joueur.</p>
    <ul class="gd-steps">
      <li><b>Son</b> : coupe ou remet tous les sons. Plus bas, le volume des alertes et celui des appuis se règlent à part.</li>
      <li><b>Éco</b> : écran noir, moins de lumière, pour garder la batterie.</li>
      <li><b>Sens</b> : face à face, ou les deux chiffres tournés du même côté. Pencher le téléphone le fait aussi.</li>
      <li><b>Chiffres</b> : le style des chiffres de la pendule.</li>
      <li><b>Temps par coup</b> : la moyenne de chaque joueur, montrée aux pauses.</li></ul>
    <p class="gd-end">Bon combat !</p>` },
];

// First card: the contents, one tap to jump to a chapter.
CARDS.unshift({ t: 'Sommaire', toc: true });
let built = false, $ = id => document.getElementById(id);
function build() {
  const toc = `<ol class="gd-toc">${CARDS.slice(1).map((c, i) => `<li><button type="button" data-go="${i + 1}"><span>${i + 1}</span><em class="gd-tt">${c.t}<small>${c.s}</small></em><i>›</i></button></li>`).join('')}</ol>
    <p class="gd-hint">Glisse à gauche ou à droite, ou touche les flèches en bas, pour changer de page.</p>`;
  $('gd-track').innerHTML = CARDS.map((c, i) => `<section class="gd-card" data-i="${i}"><div class="gd-in">
    ${c.toc ? `<h2>${c.t}</h2>${toc}` : `<p class="gd-k">${i} / ${CARDS.length - 1}</p><h2>${c.t}</h2>${c.h ? `<div class="gd-fig">${c.h}</div>` : ''}${c.l || ''}<div class="gd-body">${c.b}</div>`}</div></section>`).join('');
  $('gd-toc').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>`;
  $('gd-dots').innerHTML = CARDS.map((_, i) => `<i data-go="${i}"></i>`).join('');
  $('gd-close').innerHTML = ICONS.close;
  // One page at a time in a single vertical scroller (no nested scrolling, which iPhones handled badly);
  // a horizontal swipe, the arrows, the dots or the Sommaire change the page.
  const tr = $('gd-track');
  let cur = 0;
  const at = () => cur;
  const show = () => {
    const i = cur;
    tr.querySelectorAll('.gd-card').forEach((c, k) => { c.hidden = k !== i; });
    $('gd-dots').querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === i));
    $('gd-n').textContent = i ? `${i} / ${CARDS.length - 1}` : 'Sommaire';
    $('gd-toc').classList.toggle('on', i === 0);
    $('gd-prev').disabled = i === 0; $('gd-next').disabled = i === CARDS.length - 1;
    mount(tr.children[i]);
  };
  const go = (i, dir = 0) => {
    i = Math.max(0, Math.min(CARDS.length - 1, i));
    if (i === cur) return;
    dir = dir || (i > cur ? 1 : -1);
    cur = i; show(); tr.scrollTop = 0;
    const c = tr.children[i];
    c.classList.remove('in-l', 'in-r'); void c.offsetWidth; c.classList.add(dir > 0 ? 'in-r' : 'in-l');
  };
  goTo = i => { cur = -1; go(i); };
  let t0 = null;
  tr.addEventListener('touchstart', e => { const t = e.touches[0]; t0 = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, at: Date.now() } : null; }, { passive: true });
  tr.addEventListener('touchend', e => {
    if (!t0) return;
    const t = e.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0.at < 800) go(cur + (dx < 0 ? 1 : -1));
    t0 = null;
  }, { passive: true });
  $('gd-prev').addEventListener('click', () => go(cur - 1));
  $('gd-next').addEventListener('click', () => go(cur + 1));
  $('gd-dots').addEventListener('click', e => { const d = e.target.closest('[data-go]'); if (d) go(+d.dataset.go); });
  tr.addEventListener('click', e => { const d = e.target.closest('[data-go]'); if (d) go(+d.dataset.go); });
  $('gd-toc').addEventListener('click', () => go(0));
  $('gd-close').addEventListener('click', closeGuide);
  document.addEventListener('keydown', e => {
    if ($('guide').hidden) return;
    if (e.key === 'ArrowRight') go(at() + 1); else if (e.key === 'ArrowLeft') go(at() - 1); else if (e.key === 'Escape') closeGuide();
  });
  built = true;
  return show;
}
// The pictures are the real app, running a scripted scene (?demo=…) in small frames. Only the visible
// page holds frames, so at most three tiny clocks run at once; leaving the page or closing removes them.
function mount(card) {
  document.querySelectorAll('#gd-track .gl-frame iframe').forEach(f => { if (!card || !card.contains(f)) f.remove(); });
  if (!card) return;
  card.querySelectorAll('.gl-frame[data-demo]').forEach(fr => {
    if (fr.firstChild) return;
    fr.parentNode.querySelector('.gl-cap').textContent = '';
    const f = document.createElement('iframe');
    f.src = `./?demo=${fr.dataset.demo}`; fit(fr, f); f.tabIndex = -1; f.setAttribute('aria-hidden', 'true'); f.loading = 'eager';
    fr.appendChild(f);
  });
}
function fit(fr, f) { f.style.transform = `scale(${fr.clientWidth / 390})`; }
addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || typeof e.data.demoCap !== 'string') return;
  const f = [...document.querySelectorAll('#gd-track .gl-frame iframe')].find(x => x.contentWindow === e.source);
  const c = f && f.closest('.gd-live').querySelector('.gl-cap');
  if (c) { c.textContent = e.data.demoCap; c.classList.remove('new'); void c.offsetWidth; c.classList.add('new'); }
});
addEventListener('resize', () => document.querySelectorAll('#gd-track .gl-frame iframe').forEach(f => fit(f.parentNode, f)));
let refresh = null, goTo = () => {};
export function openGuide() {
  if (!built) refresh = build();
  $('guide').hidden = false;
  goTo(0);
}
export function closeGuide() { $('guide').hidden = true; mount(null); }
