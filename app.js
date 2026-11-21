const byId = id => document.getElementById(id);
const labels = { OFF: 'Outage corroborated', ON: 'Restoration corroborated', REVIEW: 'Hold for review' };
const scenarios = JSON.parse(JSON.stringify(GridDemo.scenarios));
let imported = [];
let current = scenarios[0];
let decision;
let audit = [];
const auditKey = 'grid-ledger-reviews-v1';
try {
  const saved = JSON.parse(localStorage.getItem(auditKey) ?? '[]');
  if (Array.isArray(saved)) audit = saved;
} catch {
  byId('review-status').textContent = 'Saved reviews could not be loaded.';
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderHistory() {
  byId('history').replaceChildren(...audit.filter(item => item.caseKey === caseKey())
    .map(item => element('li', `${item.time} · ${item.disposition} · ${item.note} · Gate: ${item.outcome} · Evidence: ${item.evidence.map(row => row.id).join(', ') || 'none'}`)));
}

function caseKey() {
  return JSON.stringify([current.asset, current.originalRecords ?? current.records]);
}

function render() {
  const visible = [...scenarios.filter(s => s.lang === byId('language').value), ...imported];
  const queue = visible.map(s => {
    const button = element('button', s.name);
    button.append(element('span', s.asset));
    button.setAttribute('aria-current', s === current);
    button.onclick = () => {
      current = s;
      byId('note').value = '';
      byId('review-status').textContent = '';
      render();
      byId('case-title').focus();
    };
    return button;
  });
  byId('queue').replaceChildren(...queue);
  const now = current.imported ? Date.now() : GridDemo.now;
  decision = GridEngine.assess(current.records, current.asset, now);
  byId('clock').textContent = `ASSESSMENT TIME / ${new Date(now).toISOString()}`;
  byId('case-title').textContent = `${current.asset} · ${current.name}`;
  byId('case-title').tabIndex = -1;
  byId('verification').hidden = current.name !== 'Duplicate report' || !!current.originalRecords;
  const card = byId('decision');
  card.className = decision.outcome === 'REVIEW' ? 'hold' : '';
  card.replaceChildren(element('strong', labels[decision.outcome]),
    element('p', decision.reason),
    element('p', `Evidence sufficiency ${decision.support * 100}% · rule score, not a probability`));
  const rows = decision.evidence.map(row => {
    const card = element('div', '', 'record');
    const raw = element('div', typeof row.text === 'string' ? row.text : 'No text supplied');
    raw.dir = 'auto';
    card.append(element('strong', `${row.status} · ${row.state ?? 'Unknown state'}`), raw,
      element('small', `${row.id ?? 'Missing ID'} · ${row.source ?? 'Missing source'} · ${row.kind ?? '?'} · ${row.lang ?? '?'} · ${row.observed ?? 'Missing time'} · ${row.age === null ? 'unknown age' : row.age.toFixed(1) + ' min'}`));
    return card;
  });
  byId('evidence').replaceChildren(...(rows.length ? rows : [element('p', 'No records available. Obtain an independent observation.')]));
  renderHistory();
}

byId('language').onchange = () => {
  current = scenarios.find(s => s.lang === byId('language').value);
  byId('note').value = '';
  byId('review-status').textContent = '';
  render();
};
byId('verification').onclick = () => {
  const original = current.records[0];
  current.originalRecords = current.records;
  current.records = [...current.records, {
    ...original, id: `${current.asset}-VERIFY`, kind: 'field', source: 'CREW-VERIFY',
    observed: new Date(GridDemo.now - 60000).toISOString()
  }];
  render();
  byId('case-title').focus();
};
byId('file').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  const status = byId('import-status');
  try {
    if (file.size > 1000000) throw Error('File must be under 1 MB.');
    const rows = JSON.parse(await file.text());
    if (!Array.isArray(rows) || !rows.length || rows.length > 5000 ||
        rows.some(row => !row || typeof row.asset !== 'string' || !row.asset.trim())) {
      throw Error('Expected 1–5,000 records with a feeder asset ID on each.');
    }
    const assets = new Map();
    for (const row of rows) {
      if (!assets.has(row.asset)) assets.set(row.asset, []);
      assets.get(row.asset).push(row);
    }
    imported = Array.from(assets, ([asset, records]) => ({ asset, records, name: 'Imported observations', imported: true }));
    current = imported[0];
    byId('note').value = '';
    byId('review-status').textContent = '';
    status.textContent = `Loaded ${rows.length} observations across ${imported.length} feeders.`;
    render();
  } catch (error) {
    status.textContent = `Import rejected. Existing queue retained. ${error.message}`;
  } finally {
    event.target.value = '';
  }
};
byId('review').onsubmit = event => {
  event.preventDefault();
  const note = byId('note').value.trim();
  if (!note) {
    byId('review-status').textContent = 'Enter a reviewer and verification note.';
    return;
  }
  render();
  const entry = { caseKey: caseKey(), time: new Date().toISOString(), disposition: byId('disposition').value,
    note, outcome: decision.outcome, evidence: decision.evidence };
  try {
    localStorage.setItem(auditKey, JSON.stringify([entry, ...audit]));
    audit.unshift(entry);
    byId('note').value = '';
    byId('review-status').textContent = 'Review recorded in this browser.';
    renderHistory();
  } catch {
    byId('review-status').textContent = 'Review could not be saved. Your note is still in the form.';
  }
};

byId('evaluate').onclick = () => {
  const results = evaluateGrid();
  const table = element('table', '');
  const addRow = (cells, header = false) => {
    const row = table.insertRow();
    cells.forEach((cell, i) => {
      const heading = header || i === 0;
      const node = element(heading ? 'th' : 'td', cell);
      if (heading) node.scope = header ? 'col' : 'row';
      row.append(node);
    });
  };
  addRow(['Measure', ...results.map(r => r.method)], true);
  const metric = (title, getValue) => addRow([title, ...results.map(getValue)]);
  metric('Policy decisions matched', r => `${r.policyMatches}/${r.cases}`);
  metric('Wrong state assertions', r => r.wrongState);
  metric('Unsupported assertions', r => r.unsupported);
  metric('Degraded cases held for review', r => `${r.degradedReviews}/${r.degradedCases}`);
  for (const lang of ['en', 'es', 'ur', 'mixed']) {
    metric(`Policy decisions matched · ${lang}`, r => `${r.languages[lang].policyMatches}/${r.languages[lang].cases}`);
    metric(`State assertions · ${lang}`, r => `${r.languages[lang].assertions}/${r.languages[lang].cases}`);
  }
  metric('p95 compute latency (ms)', r => r.p95Ms.toFixed(4));
  const wrap = element('div', '', 'table-wrap');
  wrap.append(table);
  byId('metrics').replaceChildren(wrap);
};

render();
byId('evaluate').click();
setInterval(() => {
  if (current.imported) {
    const focused = document.activeElement;
    if (!byId('queue').contains(focused)) render();
  }
}, 15000);
