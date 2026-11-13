// Anonymous counts on GoatCounter (no cookies, nothing personal): visits, installs, fights.
// A plain GET to the counter, the same request as opening the count link by hand.
// Only from the real site, never from a test copy.
const URL_COUNT = 'https://lassolas.goatcounter.com/count';
const live = /chessboxingparis\.com$|github\.io$/.test(location.hostname) && !/[?&]demo=/.test(location.search);

// path: what is counted ('/' a visit, 'combat-debut' an event); event: true for actions.
export function count(path, event = false) {
  if (!live) return;
  const q = new URLSearchParams({ p: path, t: event ? path : document.title, e: event ? 'true' : 'false',
    s: `${screen.width},${screen.height},${devicePixelRatio || 1}`, rnd: Math.random().toString(36).slice(2) });
  const img = new Image();
  img.referrerPolicy = 'no-referrer-when-downgrade';
  img.src = `${URL_COUNT}?${q}`;
}
