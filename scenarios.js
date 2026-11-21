(function () {
  const now = Date.parse('2026-11-10T09:00:00+05:00');
  const phrases = { en: ['power off', 'power on'], es: ['sin suministro', 'con suministro'], ur: ['بجلی بند', 'بجلی بحال'] };
  const scenarios = [];
  const cases = [
    ['Corroborated outage', 'OFF', 'OFF', [[0, 2], [0, 4]]],
    ['Corroborated restoration', 'ON', 'ON', [[1, 2], [1, 4]]],
    ['Expired outage', 'ON', 'REVIEW', [[0, 180], [0, 200]]],
    ['Conflicting reports', 'OFF', 'REVIEW', [[1, 2], [0, 4]]],
    ['Duplicate report', 'OFF', 'REVIEW', [[0, 2], [0, 2, 0]]],
    ['Unknown wording', 'OFF', 'REVIEW', [[0, 2, 0, '???'], [0, 4]]],
    ['Missing feed', 'ON', 'REVIEW', null],
    ['Future timestamp', 'OFF', 'REVIEW', [[1, -4], [0, 4]]]
  ];
  for (const lang of Object.keys(phrases)) {
    cases.forEach(([name, truth, expected, inputs], index) => {
      const asset = `FD-${101 + scenarios.length}`;
      const records = inputs?.map(([state, age, origin = 1, override], i) => ({
        id: `${asset}-R${i + 1}`, asset, lang,
        source: origin === 0 || i === 0 ? 'RTU-04' : 'CREW-17',
        kind: origin === 0 || i === 0 ? 'telemetry' : 'field',
        observed: new Date(now - age * 60000).toISOString(),
        text: override ?? phrases[lang][state]
      })) ?? null;
      scenarios.push({ asset, name, truth, expected, records, lang, index });
    });
  }
  const mixedCases = [
    ['Mixed-language outage', 'OFF', 'OFF', [['es', 0, 2], ['ur', 0, 4]]],
    ['Mixed-language restoration', 'ON', 'ON', [['ur', 1, 2], ['en', 1, 4]]],
    ['Mixed-language conflict', 'OFF', 'REVIEW', [['es', 1, 2], ['ur', 0, 4]]],
    ['Stale mixed-language reports', 'ON', 'REVIEW', [['ur', 0, 180], ['es', 0, 190]]],
    ['Mixed-language retransmission', 'OFF', 'REVIEW', [['es', 0, 2], ['ur', 0, 2, true]]],
    ['Unrecognized free-text note', 'ON', 'REVIEW', [['en', 1, 2, false, 'Power on at the office, feeder unknown'], ['ur', 1, 4]]]
  ].map(([name, truth, expected, inputs], i) => {
    const asset = `FD-${201 + i}`;
    const records = inputs.map(([lang, state, age, repeated, note], j) => ({
      id: `${asset}-R${j + 1}`, asset, lang,
      source: j === 0 || repeated ? 'RTU-04' : 'CREW-17',
      kind: j === 0 || repeated ? 'telemetry' : 'field',
      observed: new Date(now - age * 60000).toISOString(),
      text: note ?? phrases[lang][state]
    }));
    return { asset, name, truth, expected, records, lang: 'mixed', index: expected === 'REVIEW' ? 2 : 0 };
  });
  const api = { now, scenarios: [...scenarios, ...mixedCases] };
  if (typeof module === 'object') module.exports = api;
  else globalThis.GridDemo = api;
})();
