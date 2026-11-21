import {literatureLocation} from './talent-literature.js';

function reference(title, url) {
  const a = document.createElement('a');
  a.href = url;
  a.textContent = title;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

export function readingContent(record) {
  const {membership, bio, profile} = record.literature;
  const fragment = document.createDocumentFragment();
  const bioText = document.createElement('p');
  bioText.textContent = bio;
  const sourceText = document.createElement('p');
  sourceText.className = 'reading-evidence';
  sourceText.append(membership.date + ' · ' + membership.account);
  const refs = document.createElement('p');
  refs.className = 'reading-links';
  refs.append(reference(membership.title, membership.url), reference(...profile));
  if (record.survey) refs.append(reference('桥头名录原片', 'https://www.youtube.com/watch?v=YaOHuAAV-lQ&t=2886s'));
  fragment.append(bioText, sourceText);
  if (record.physicalImage) {
    const observation = document.createElement('p');
    observation.className = 'reading-evidence';
    observation.textContent = record.evidenceNote;
    fragment.append(observation);
    refs.append(reference('实拍与游戏近照', '/comparison/plaques.html#' + record.id));
  }
  if (record.id === 'wang-jian') {
    const caption = document.createElement('p');
    caption.className = 'reading-evidence';
    caption.textContent = '柱上演示肖像取自 2010 年深圳华大总部合影中的汪建。原柱的刻像仍待近照核对。';
    fragment.append(caption);
    refs.append(reference('2010 年合影与署名', 'https://commons.wikimedia.org/wiki/File:Wang_Jian_showing_Sydney_Brenner_around_BGI.jpg'));
  }
  fragment.append(refs);
  return fragment;
}

// Index only the eight researched records. Walking up to a column and jumping
// to it from the directory both use its actual scene coordinates.
export function columnReader(details, columns) {
  const summary = details.querySelector('summary');
  const content = details.querySelector('div');
  const stops = columns.flatMap(column => column.faces.filter(record => record?.literature)
    .map(record => ({x: column.x, z: column.z, record})));
  let current = null;
  return (position, requestedId = null) => {
    let nearest = null, distance = 3.1;
    for (const stop of stops) {
      const gap = Math.hypot(stop.x - position.x, stop.z - position.z);
      if (gap < distance) { nearest = stop.record; distance = gap; }
    }
    if (nearest !== current) {
      current = nearest;
      details.hidden = !current;
      details.open = false;
      content.replaceChildren();
      if (current) {
        summary.textContent = current.name + ' · 文献导览';
        const location = document.createElement('p');
        location.className = 'reading-location';
        location.textContent = literatureLocation(current);
        content.append(location, readingContent(current));
      }
    }
    if (requestedId && current?.id === requestedId) details.open = true;
  };
}
