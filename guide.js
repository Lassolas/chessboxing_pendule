// Mode d'emploi: a few illustrated cards for a newcomer. Swipe left / right
// (or the arrows), each card scrolls up / down. Built once, on first open.
import { ICONS } from './icons.js';

const ic = k => `<span class="gd-ic">${ICONS[k] || ''}</span>`;
// A tiny clock: two halves and the bar, coloured like the real one.
const phone = (top, bot, mid = '', topTxt = '', botTxt = '') => `<div class="gd-phone">
  <div class="gp-h gp-top ${top}">${topTxt}</div><div class="gp-bar">${mid}</div><div class="gp-h ${bot}">${botTxt}</div></div>`;
const frieze = (cur = -1) => `<div class="gd-frieze">${['chess', 'pause', 'box', 'pause', 'chess', 'pause', 'box', 'pause', 'chess'].map((k, i) =>
  k === 'pause' ? `<i class="gf-p${i === cur ? ' now' : ''}"></i>` : `<b class="gf-${k}${i === cur ? ' now' : ''}">${k === 'chess' ? ICONS.pawn : ICONS.glove}</b>`).join('')}</div>`;

const CARDS = [
  { t: 'À quoi ça sert', h: `<div class="gd-hero">${ICONS.pawn}<span>+</span>${ICONS.glove}</div>`, b: `
    <p class="gd-lead">Le chessboxing alterne des <b>rounds d'échecs</b> et des <b>rounds de boxe</b>.</p>
    <p>Cette appli est à la fois la <b>pendule d'échecs</b> des deux joueurs et le <b>chrono des rounds</b> : elle sonne la cloche, compte les pauses et enchaîne tout le combat toute seule.</p>
    <p>Pose le téléphone entre les deux joueurs : chacun a sa moitié d'écran, tournée vers lui.</p>
    <p class="gd-win">On gagne par <b>mat</b>, par <b>K.-O.</b>, au <b>temps</b>, ou si l'autre prend trop de <b>comptes</b>.</p>` },
  { t: 'Un combat', h: frieze(), b: `
    <p class="gd-lead">Échecs, pause, boxe, pause, échecs… jusqu'à la fin.</p>
    <ul class="gd-leg"><li><b class="gf-chess">${ICONS.pawn}</b>Round d'échecs : <em>3:00</em></li><li><i class="gf-p"></i>Pause : <em>1:00</em></li><li><b class="gf-box">${ICONS.glove}</b>Round de boxe : <em>3:00</em></li></ul>
    <p>Le combat classique fait <b>5 rounds</b> (3 d'échecs, 2 de boxe). Le dernier round d'échecs dure jusqu'à la fin du temps à la pendule.</p>
    <p>Le temps à la pendule de chaque joueur dépend du nombre de rounds : <b>4:30</b> pour 5 rounds, <b>6:00</b> pour 7…</p>` },
  { t: "L'accueil", h: `<div class="gd-bar"><span class="gb-r">5</span><span class="gb-c">3:00</span><span class="gb-c red">3:00</span><span class="gb-c blue">1:00</span><span class="gb-t">${ICONS.replay}</span></div>`, b: `
    <ul class="gd-steps">
      <li><b>Rounds</b> : touche le carré pour choisir 5, 7, 9 ou 11 rounds, ou la <b>pendule classique</b> (sans rounds, temps et incrément réglables).</li>
      <li><b>Échecs, Boxe, Pause</b> : touche un chrono pour changer sa durée. Fais glisser la règle. Boxe à <em>0:00</em> = pas de boxe.</li>
      <li>${ic('replay')} <b>Standard</b> : remet le combat classique (5 rounds, 3:00 / 3:00 / 1:00).</li>
      <li>${ic('install')} <b>Installer</b> : met la pendule sur l'écran d'accueil du téléphone ; elle marche ensuite sans réseau.</li>
      <li><b>Réglages</b> : sous le temps de chaque joueur.</li></ul>` },
  { t: 'Jouer aux échecs', h: phone('', 'gp-go', '', '<span class="gp-d">4:30</span>', '<span class="gp-d">4:29</span>'), b: `
    <ul class="gd-steps">
      <li>Le premier qui touche sa moitié prend les <b>Noirs</b> : la pendule des Blancs démarre.</li>
      <li>Après chaque coup, <b>touche ta moitié</b> : ta pendule s'arrête, celle de l'autre repart.</li>
      <li>La moitié <b class="g-green">verte</b> est celle du joueur qui doit jouer.</li>
      <li>En haut de chaque moitié, le petit <b>ROUND 2:59</b> dit combien de temps reste au round.</li>
      <li>À la fin du round : la cloche, puis la pause.</li></ul>` },
  { t: 'Pause et boxe', h: `<div class="gd-pair">${phone('gp-blue', 'gp-blue', '', '<span class="gp-w">PAUSE</span>', '<span class="gp-w">PAUSE</span>')}${phone('gp-red', 'gp-red', '', '<span class="gp-w">BOXE</span>', '<span class="gp-w">BOXE</span>')}</div>`, b: `
    <ul class="gd-steps">
      <li><b class="g-blue">Bleu</b> = pause. <b class="g-red">Rouge</b> = boxe. Le grand chrono est celui du round.</li>
      <li>Le temps à la pendule de chacun reste écrit en petit, en haut : <b>PENDULE 4:29</b>.</li>
      <li>Dans la barre, le <b>prochain round clignote</b> pendant la pause.</li>
      <li>Le claquoir sonne 10 s avant la fin, puis la cloche.</li>
      <li><b>Prêt ?</b> : avant chaque round d'échecs, la pendule attend qu'on touche l'écran (les gants s'enlèvent…).</li></ul>` },
  { t: 'Arrêter, reprendre', h: `<div class="gd-pm"><span class="gb-t">${ICONS.home}</span><span class="gd-pill">${ICONS.replay}ROUND</span><span class="gd-go">${ICONS.play}GO</span></div>`, b: `
    <p class="gd-lead">Le bouton ${ic('pause')} au bout de la barre arrête tout.</p>
    <ul class="gd-steps">
      <li><b>GO</b> : on reprend. Toucher ailleurs reprend aussi.</li>
      <li>${ic('replay')} <b>Round</b> : recommence le round en cours, comme il était à son début.</li>
      <li>${ic('home')} <b>Accueil</b> : abandonne le combat et revient à une pendule neuve.</li>
      <li><b>Réglages</b> : sous le temps de chaque joueur.</li></ul>` },
  { t: "L'arbitre", h: `<div class="gd-hero gd-ref"><span class="gd-flag">⚑</span><span class="gd-ten">10</span></div>`, b: `
    <p class="gd-lead">Dans Réglages › <b>Arbitre</b>, deux aides pour l'arbitre :</p>
    <ul class="gd-steps">
      <li><b>Comptes</b> : si un joueur réfléchit trop longtemps, une alerte sonne, puis l'arbitre compte 10 s : chaque compte commencé est noté. <b>Si le compte arrive à 0, le combat est perdu.</b></li>
      <li><b>Coups illégaux</b> : un drapeau dans chaque moitié. On le touche quand l'autre a joué un coup illégal : il rejoue, et ça compte aussi.</li>
      <li><b>Perdu à</b> : au bout de 3 comptes dans un round, ou 4 au total, le combat est perdu (réglable).</li></ul>` },
  { t: 'Réglages', h: `<div class="gd-sq"><span>${ICONS.sound}<b>Son</b></span><span>${ICONS.eco}<b>Éco</b></span><span>${ICONS.rotate}<b>Sens</b></span></div>`, b: `
    <ul class="gd-steps">
      <li><b>Son</b> : coupe ou remet la cloche, le claquoir et les appuis. Les volumes sont plus bas, dans la carte Son.</li>
      <li><b>Éco</b> : écran noir, moins de lumière et d'animations, pour garder la batterie.</li>
      <li><b>Sens</b> : face à face, ou les deux chiffres tournés d'un côté. Pencher le téléphone le fait aussi.</li>
      <li><b>Chiffres</b> : le style des chiffres de la pendule.</li>
      <li><b>Temps par coup</b> : la moyenne de chaque joueur, montrée aux pauses.</li></ul>
    <p class="gd-end">Bon combat !</p>` },
];

// First card: the contents, one tap to jump to a chapter.
CARDS.unshift({ t: 'Sommaire', toc: true });
let built = false, $ = id => document.getElementById(id);
function build() {
  const toc = `<ol class="gd-toc">${CARDS.slice(1).map((c, i) => `<li><button type="button" data-go="${i + 1}"><span>${i + 1}</span>${c.t}<i>›</i></button></li>`).join('')}</ol>
    <p class="gd-hint">Glisse à gauche ou à droite pour passer d'une page à l'autre.</p>`;
  $('gd-track').innerHTML = CARDS.map((c, i) => `<section class="gd-card" data-i="${i}"><div class="gd-in">
    ${c.toc ? `<h2>${c.t}</h2>${toc}` : `<p class="gd-k">${i} / ${CARDS.length - 1}</p><h2>${c.t}</h2><div class="gd-fig">${c.h}</div><div class="gd-body">${c.b}</div>`}</div></section>`).join('');
  $('gd-toc').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>`;
  $('gd-dots').innerHTML = CARDS.map((_, i) => `<i data-go="${i}"></i>`).join('');
  $('gd-close').innerHTML = ICONS.close;
  const tr = $('gd-track');
  const at = () => Math.round(tr.scrollLeft / tr.clientWidth);
  const show = () => {
    const i = at();
    $('gd-dots').querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === i));
    $('gd-n').textContent = i ? `${i} / ${CARDS.length - 1}` : 'Sommaire';
    $('gd-toc').classList.toggle('on', i === 0);
    $('gd-prev').disabled = i === 0; $('gd-next').disabled = i === CARDS.length - 1;
  };
  const go = i => { const c = tr.children[i]; if (c) c.scrollTop = 0; tr.scrollTo({ left: Math.max(0, Math.min(CARDS.length - 1, i)) * tr.clientWidth, behavior: 'smooth' }); };
  tr.addEventListener('scroll', () => requestAnimationFrame(show), { passive: true });
  $('gd-prev').addEventListener('click', () => go(at() - 1));
  $('gd-next').addEventListener('click', () => go(at() + 1));
  $('gd-dots').addEventListener('click', e => { const d = e.target.closest('[data-go]'); if (d) go(+d.dataset.go); });
  tr.addEventListener('click', e => { const d = e.target.closest('[data-go]'); if (d) go(+d.dataset.go); });
  $('gd-toc').addEventListener('click', () => go(0));
  $('gd-track').querySelectorAll('.gd-card').forEach(c => { c.tabIndex = -1; });
  $('gd-close').addEventListener('click', closeGuide);
  document.addEventListener('keydown', e => {
    if ($('guide').hidden) return;
    if (e.key === 'ArrowRight') go(at() + 1); else if (e.key === 'ArrowLeft') go(at() - 1); else if (e.key === 'Escape') closeGuide();
  });
  built = true;
  return show;
}
let refresh = null;
export function openGuide() {
  if (!built) refresh = build();
  $('guide').hidden = false;
  $('gd-track').scrollLeft = 0;
  refresh();
}
export function closeGuide() { $('guide').hidden = true; }
