# Evaluation harness

Measures detection quality against **labeled** data, so accuracy claims come from a run
that anyone can repeat rather than from a number typed into a slide.

```bash
npm run eval                          # default corpus, threshold 50
npm run eval -- --dataset eval/corpora/text-smoke.jsonl --threshold 60
npm run eval -- --limit 10            # short smoke run
```

Each run writes an `EvalRun` row plus one `EvalSample` row per item, and prints the
confusion matrix, precision/recall/F1, ROC-AUC and calibration error. The Model Metrics
tab reads the latest run and lets you re-tune the decision threshold **without re-running
the model**, because every per-sample score is stored.

## Corpus format

JSON Lines, one object per line:

```json
{"id":"en-fake-01","language":"en","label":1,"text":"…"}
```

- `label: 1` — content that *should* be flagged (misinformation, hoax, manipulation)
- `label: 0` — genuine content that should pass
- `language` — used for the per-language breakdown; any ISO code
- `id` — stable, so results are comparable across runs

## About the bundled corpus

`corpora/text-smoke.jsonl` is a **small authored smoke corpus** (~36 items, en/hi/gu/ta),
written for this repository to exercise the pipeline end to end and to check that Indic
input is scored at all. It is *not* a benchmark, and a score on it is not a claim about
field accuracy — the set is tiny, the fake items use obvious viral-forward patterns, and
it has never been held out from development.

For numbers worth quoting, point `--dataset` at a real labeled set (e.g. an internal
tagged case corpus, or a public fake-news dataset converted to the format above) and say
which set produced the figure. `datasetHash` is stored on every run so a reported metric
can always be traced back to the exact file it came from.

## Where the score comes from

The harness calls the same `/api/analyze/text` path the product uses, and converts the
returned trust score to a suspicion score (`100 - trustScore`). No separate evaluation-only
code path exists — if the product regresses, the harness sees it.
