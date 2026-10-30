// Anonymous counts on GoatCounter (no cookies, nothing personal): visits, installs, fights.
// Nothing is sent until CODE is set to the club's GoatCounter code, nor from a test copy.
const CODE = 'lassolas';
const live = CODE && /chessboxingparis\.com$|github\.io$/.test(location.hostname);

// path: what is counted ('/' a visit, 'combat-debut' an event); event: true for actions.
export function count(path, event = false) {
  if (!live) return;
  const q = new URLSearchParams({ p: path, e: event ? 'true' : 'false', t: event ? path : document.title,
    s: `${screen.width},${screen.height},${devicePixelRatio || 1}`, rnd: Math.random().toString(36).slice(2) });
  const url = `https://${CODE}.goatcounter.com/count?${q}`;
  try { if (navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch {}
  new Image().src = url;
}
