# Grid Ledger · HS-0124

Grid Ledger triages feeder outage and restoration reports. Open `index.html` in a modern browser. The app and evaluation run locally without installation or a network connection. Run `node evaluate.js` to reproduce the benchmark from the command line.

## Three-minute demo

1. Open **Corroborated outage**. Inspect the two fresh observations and their IDs, origins, timestamps and original text.
2. Compare **Expired outage**, **Duplicate report** and **Conflicting reports**. Each lands in review for a different reason. In **Duplicate report**, save a review and then add simulated crew verification to see the decision change while the earlier review remains visible. Select Mixed languages for six additional cases.
3. In **Missing feed**, select **Request field verification** and enter a reviewer and ticket reference. The history records the disposition, gate outcome and evidence snapshot in browser storage. Reopening the same case in the same browser shows the saved review when storage is available.
4. Import `sample-observations.json` to inspect a mixed-language batch. Imports use the live browser clock, so the fixed sample becomes stale. For the fresh path, replace both timestamps with recent ISO 8601 times with a timezone. Import malformed JSON to see the existing queue retained.
5. Run **Baseline comparison** and compare the wrong-state, unsupported-assertion, language, degradation and compute latency results.

## Decision and data contract

Each JSON row has a feeder `asset`, record `id`, origin `source`, source `kind` (`telemetry`, `field` or `customer`), ISO 8601 `observed` timestamp with timezone, `lang` (`en`, `es` or `ur`) and original `text`. Supported phrases are listed in `engine.js`. Each origin should use a stable source ID across feeds and retransmissions.

The engine applies freshness windows of 15 minutes for telemetry, 60 for field reports and 120 for customer reports. It flags future or missing timestamps, unknown phrases and duplicate eligible observations. Repeated records from a source cannot raise the source count. Any eligible disagreement holds the case for review. Two distinct eligible sources agreeing on a state produce a corroborated finding. The evidence score is 0% for missing or conflicting evidence, 50% for one eligible source and 100% when the corroboration rule passes. It has no statistical calibration. Raw observations and their eligibility are displayed even when they disagree.

The technician can submit a batch or record verification findings. The operator can review evidence, request field verification or record supervisor escalation. Review entries are local records of disposition. They do not send messages, dispatch crews or operate equipment.

## Evaluation

The documented comparison heuristic is a plausible latest-report workflow: choose the newest feeder record and assert its state if the phrase is recognized in English, otherwise defer. It has no freshness, duplicate or corroboration rule. This is a synthetic baseline, not a measured utility workflow.

The fixture crosses eight scenarios with three languages and adds six mixed-language cases. A second latest-record baseline shares the multilingual dictionary with the evidence gate. Each case defines a simulated physical state separately from its expected triage decision. Unsupported assertions are cases where a method asserts a state despite a review label. Wrong-state assertions compare against simulated truth and can overlap with unsupported assertions. Degraded cases cover stale, conflicting, duplicate, unknown, absent and future observations.

| Metric | Latest English | Latest multilingual | Evidence gate |
|---|---:|---:|---:|
| Expected decisions matched | 20/30 | 15/30 | 30/30 |
| State assertions | 6 | 23 | 8 |
| Wrong-state assertions | 3 | 11 | 0 |
| Unsupported assertions | 4 | 15 | 0 |
| Degraded cases deferred | 18/22 | 7/22 | 22/22 |
| Matches by language (EN / ES / UR / mixed) | 4/8, 6/8, 6/8, 4/6 | 4/8, 4/8, 4/8, 3/6 | 8/8, 8/8, 8/8, 6/6 |

Latency measures the p95 of 6,000 compute calls per method. One local Node run measured about 0.002 ms for both baselines and 0.006 ms for the evidence gate. Import, rendering and storage are outside that measurement. The matched-language cases test language parity for supported phrases only. Unsupported phrasing, code-switching and real reporting disparities need representative field data. The test cases are hand-built and reflect the stated policy, so the results demonstrate behavior on known cases and do not establish field accuracy.

## MVP scope

The engine scans the batch per feeder assessment and the browser caps imports at 5,000 observations and 1 MB. Different source IDs are a proxy for independent origin. Deployment would require verified source lineage, authenticated shared reviews, a feed health signal and validation against historical field outcomes. The simulated findings are for triage only. Corroborated restoration cannot establish that equipment is safe to approach or operate.

