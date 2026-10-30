// Anonymous counts on GoatCounter (no cookies, nothing personal): visits, installs, fights.
// Through GoatCounter's own script, loaded only on the real site (never from a test copy).
const URL_COUNT = 'https://lassolas.goatcounter.com/count';
const live = /chessboxingparis\.com$|github\.io$/.test(location.hostname);
const queue = [];
if (live) {
  window.goatcounter = { no_onload: true };  // we say what to count
  const sc = document.createElement('script');
  sc.async = true;
  sc.src = 'https://gc.zgo.at/count.js';
  sc.dataset.goatcounter = URL_COUNT;
  sc.onload = () => { while (queue.length) send(queue.shift()); };
  document.head.appendChild(sc);
}
function send(v) { try { window.goatcounter.count(v); } catch {} }

// path: what is counted ('/' a visit, 'combat-debut' an event); event: true for actions.
export function count(path, event = false) {
  if (!live) return;
  const v = { path, title: event ? path : document.title, event };
  if (typeof window.goatcounter?.count === 'function') send(v);
  else queue.push(v);
}
