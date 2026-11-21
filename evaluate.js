(function () {
  const node = typeof module === 'object';
  const { assess, baseline } = node ? require('./engine') : GridEngine;
  const { scenarios, now } = node ? require('./scenarios') : GridDemo;

  function evaluate(iterations = 200) {
    return ['Latest English record', 'Latest multilingual record', 'Evidence gate'].map((method, index) => {
      const run = index === 2 ? s => assess(s.records, s.asset, now).outcome :
        s => baseline(s.records, s.asset, index === 1);
      const results = scenarios.map(s => ({ ...s, outcome: run(s) }));
      const summarize = rows => ({
        cases: rows.length,
        assertions: rows.filter(s => s.outcome !== 'REVIEW').length,
        wrongState: rows.filter(s => s.outcome !== 'REVIEW' && s.outcome !== s.truth).length,
        unsupported: rows.filter(s => s.outcome !== 'REVIEW' && s.expected === 'REVIEW').length,
        policyMatches: rows.filter(s => s.outcome === s.expected).length
      });
      const latency = [];
      for (let i = 0; i < iterations; i++) {
        for (const s of scenarios) {
          const start = performance.now();
          run(s);
          latency.push(performance.now() - start);
        }
      }
      latency.sort((a, b) => a - b);
      const degraded = results.filter(s => [2, 3, 4, 5, 6, 7].includes(s.index));
      return {
        method, ...summarize(results),
        languages: Object.fromEntries(['en', 'es', 'ur', 'mixed'].map(lang =>
          [lang, summarize(results.filter(s => s.lang === lang))])),
        degradedReviews: degraded.filter(s => s.outcome === 'REVIEW').length,
        degradedCases: degraded.length,
        p95Ms: latency[Math.ceil(latency.length * 0.95) - 1]
      };
    });
  }
  if (node) {
    module.exports = evaluate;
    if (require.main === module) {
      const results = evaluate();
      console.log(JSON.stringify(results, null, 2));
      const gate = results.at(-1);
      if (gate.policyMatches !== scenarios.length || gate.wrongState ||
          gate.unsupported) process.exitCode = 1;
      const duplicate = scenarios.find(s => s.name === 'Duplicate report');
      const verified = [...duplicate.records, { ...duplicate.records[0],
        id: 'verification', source: 'CREW-VERIFY', kind: 'field', observed: new Date(now - 60000).toISOString() }];
      const assert = require('node:assert/strict');
      assert.equal(assess(duplicate.records, duplicate.asset, now).outcome, 'REVIEW');
      assert.equal(assess(verified, duplicate.asset, now).outcome, 'OFF');
      assert.equal(assess(verified, duplicate.asset, now + 61 * 60000).outcome, 'REVIEW');
    }
  } else globalThis.evaluateGrid = evaluate;
})();
