const shapes = {
  cloud:'<path d="M6.5 18a4.5 4.5 0 0 1-.3-9A6 6 0 0 1 17.8 8a5 5 0 1 1 .4 10Z"/>',
  drone:'<path d="m6 6 4.5 4.5m3 3L18 18m0-12-4.5 4.5m-3 3L6 18"/><circle cx="5.5" cy="5.5" r="3"/><circle cx="18.5" cy="5.5" r="3"/><circle cx="5.5" cy="18.5" r="3"/><circle cx="18.5" cy="18.5" r="3"/><rect x="9" y="9" width="6" height="6" rx="2"/>',
  play:'<path d="m7 4 13 8-13 8z"/>', pause:'<path d="M8 5v14m8-14v14" stroke-width="4"/>',
  map:'<path d="m2 5 6-2 8 3 6-2v15l-6 2-8-3-6 2zM8 3v15m8-12v15"/>',
  pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/>',
  radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 8-8"/>',
  layers:'<path d="m2 8 10-5 10 5-10 5zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  car:'<path d="m4 10 2-5h12l2 5m-17 1 2-1h14l2 1v7H3zm2 7v2m14-2v2M6 14h2m8 0h2"/>',
  mute:'<path d="M3 9h4l5-5v16l-5-5H3zM16 9l6 6m0-6-6 6"/>', sound:'<path d="M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2.2c-1 .8-2 1.1-2 3M12 17h.01"/>',
  expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  bird:'<path d="m2 12 20-8-7 16-3-7z"/>', walk:'<circle cx="14" cy="4" r="2"/><path d="m7 12 3-4 4 1 2 4 4 1m-7-5-2 6 4 3 1 4m-5-7-4 7"/>',
  home:'<path d="m2 11 10-8 10 8M5 10v11h14V10M10 21v-7h4v7"/>', plus:'<path d="M4 12h16M12 4v16"/>',minus:'<path d="M4 12h16"/>',
  headlight:'<path d="M13 6H9a5 5 0 0 0 0 12h4c1.6 0 2.5-1.2 2.5-6S14.6 6 13 6Z"/><path d="M18 8h3m-3 4h4m-4 4h3"/>',
  tour:'<circle cx="12" cy="12" r="9" stroke-dasharray="4 3"/><path d="m10 8 6 4-6 4z"/>',
  eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.8"/>'
};
export const icon = (name) => '<svg aria-hidden="true" viewBox="0 0 24 24">'+(shapes[name] || '')+'</svg>';
export function applyIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
