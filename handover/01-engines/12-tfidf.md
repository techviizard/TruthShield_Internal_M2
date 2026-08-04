# Engine: TF-IDF / Similarity

**File:** `src/lib/engines/tfidf.ts` · **Deps:** none · **Status:** ✅ Real

## What it is
Text vectorization + similarity primitives: tokenization, term-frequency, TF-IDF vectors, cosine similarity, and MinHash signatures. Shared building block for Campaign Detection (clustering) and Network Analysis (provenance).

## How it's built
Pure functions: `tokenize`, `termFrequency`, `tfidfCorpus`, `cosineSim`, plus MinHash helpers. A built-in English stopword set filters noise.

## How it works (logic)
1. **Tokenize:** lowercase, strip non-letter/number (Unicode-aware `\p{L}\p{N}`), drop tokens <3 chars and stopwords.
2. **TF:** count term occurrences per document.
3. **TF-IDF:** weight each term by `tf × log(N / df)` — rare-but-present terms score highest, common terms are damped.
4. **Cosine similarity:** dot product of two normalized TF-IDF vectors → 0..1 closeness.
5. **MinHash:** compact signatures for fast approximate set-similarity at scale.

## Future scope & enterprise enhancements
- Swap TF-IDF for **sentence embeddings** (multilingual model) — critical for Indic languages where lexical overlap is weak; keep `cosineSim` signature.
- Add **LSH banding** over MinHash for sub-linear near-dup search across large corpora.
- Persist an **inverted index** instead of recomputing IDF per request.
- Extend stopwords per language (currently English-only).
