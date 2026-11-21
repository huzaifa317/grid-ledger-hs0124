(function () {
  const vocabulary = {
    en: ['power off', 'power on'],
    es: ['sin suministro', 'con suministro'],
    ur: ['بجلی بند', 'بجلی بحال']
  };
  const ttl = { telemetry: 15, field: 60, customer: 120 };
  const normalize = row => {
    const phrases = vocabulary[row.lang];
    if (!Array.isArray(phrases) || typeof row.text !== 'string') return null;
    const index = phrases.indexOf(row.text.normalize('NFKC').trim().toLowerCase());
    return ['OFF', 'ON'][index] ?? null;
  };

  function assess(records, asset, now) {
    if (!Array.isArray(records) || !Number.isFinite(now)) {
      return { outcome: 'REVIEW', support: 0, evidence: [], reason: 'Feed unavailable' };
    }
    const seen = new Set();
    const votes = new Map();
    const evidence = records.filter(row => row && row.asset === asset).map(row => {
      const state = normalize(row);
      const timestamp = typeof row.observed === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(row.observed)
        ? Date.parse(row.observed) : NaN;
      const age = (now - timestamp) / 60000;
      const key = JSON.stringify([row.source, row.kind, timestamp, state]);
      let status = 'Eligible';
      if (!Number.isFinite(age) || age < 0 || !Object.hasOwn(ttl, row.kind) ||
          typeof row.source !== 'string' || !row.source.trim() ||
          typeof row.id !== 'string' || !row.id.trim()) status = 'Invalid metadata';
      else if (age > ttl[row.kind]) status = 'Stale';
      else if (!state) status = 'Unrecognized phrase';
      else if (seen.has(key)) status = 'Duplicate';
      if (status === 'Eligible') {
        seen.add(key);
        const source = votes.get(row.source) ?? new Set();
        source.add(state);
        votes.set(row.source, source);
      }
      return { ...row, state, age: Number.isFinite(age) ? age : null, status };
    });
    const states = new Set([...votes.values()].flatMap(source => [...source]));
    const conflict = states.size > 1;
    const support = conflict ? 0 : Math.min(votes.size, 2) / 2;
    const outcome = support === 1 ? [...states][0] : 'REVIEW';
    const reason = conflict ? 'Fresh sources disagree' : support === 1 ?
      'Two or more distinct sources agree' : votes.size ?
      'Only one eligible source' : 'No eligible observations';
    return { outcome, reason, support, evidence };
  }

  function baseline(records, asset, multilingual = false) {
    if (!Array.isArray(records)) return 'REVIEW';
    const latest = records.filter(row => row && row.asset === asset)
      .sort((a, b) => Date.parse(b.observed) - Date.parse(a.observed))[0];
    return latest && (multilingual || latest.lang === 'en') ? normalize(latest) ?? 'REVIEW' : 'REVIEW';
  }

  const api = { assess, baseline, vocabulary, ttl };
  if (typeof module === 'object') module.exports = api;
  else globalThis.GridEngine = api;
})();
