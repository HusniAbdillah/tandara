# Vikey chat and Gemini embedding verification — 13 October 2026

The configured Vikey key passed live triage, grounded-answer and no-evidence
abstention checks using `deepseek/deepseek-v4-flash`. Using that chat model on
Vikey's embeddings endpoint returned HTTP 404. Gemini replaces that embedding
profile; the generation provider remains Vikey.

The Google key is stored only in the ignored local `.env`. The active embedding
profile is `gemini-embedding-001`, 1,536 dimensions, with native `embedContent`
requests and `x-goog-api-key` authentication. Live document and query requests
returned the requested dimensions and passed finite/nonzero and normalization
checks. Google did not report token usage for those responses; the ledger keeps
that usage labelled estimated.

An isolated temporary PostgreSQL database exercised the actual app services and
both real providers against one explicitly owned synthetic reference:

- A coordinator imported the plaintext; a different administrator approved it.
- Two chunks were ingested using Gemini's document task.
- A Gemini query vector retrieved the approved source; Vikey produced a grounded
  answer with authorized exact quotations and a human-review flag.
- Replaying the completed run made no additional provider calls.
- Human acceptance was recorded separately from the original model output.
- Withdrawing the reference retracted the dependent result.

The successful workflow made three Gemini requests and one Vikey request. The
temporary database was dropped after closing application connections. No resident
reports, contacts, photos or precise coordinates were sent in that verification.

One live answer initially paraphrased a quotation while labelling it explicit.
The validator rejected it. The prompt now provides an exact-quotation example and
explicit copying instructions; the workflow version is `assistance-2`. The
unchanged validator and the repeated live workflow passed afterward. This is a
smoke test, not the reviewed 1,000-case model-quality benchmark.

Regression checks cover separate provider credentials, pinned Google endpoints,
native payloads, task types, dimensionality, normalization, malformed/zero vectors,
sanitized HTTP errors, retries, usage accounting, reindexing, scoped retrieval and
source withdrawal. Native Gemini requests in automated integration tests are
redirected only inside the test process to a loopback fixture with a fixture key.
Browser regressions use rules/disabled embeddings to avoid uncontrolled inference
charges; the live provider workflow above is verified separately.

Final checks passed: 96 unit/API/tooling tests, 46 PostgreSQL integration tests
and 13 browser workflows. Formatting, lint, boundaries, TypeScript and builds
passed. `pnpm ai:verify` also passed for both configured live providers. The local
Docker services were rebuilt and restored to the compatible provider profile
after the browser fixture run.

Local embedding price configuration uses a conservative estimate of 500,000
micro USD per million input tokens; daily/monthly/organization/run funding caps
are preserved. This is an admission estimate, not a billing statement. Review
current [Google pricing](https://ai.google.dev/gemini-api/docs/pricing) and the
account's processing/billing terms before production use. Production data
processing approval remains false and the installation remains simulation.

The native adapter also supports `gemini-embedding-2` using its documented
retrieval prefixes; that model's request shape has fixture coverage. The live
profile verified here is `gemini-embedding-001`. Changing the model or dimensions
requires a new vector profile, complete source-version ingestion and matching
production release evidence. See [provider setup](../ai/provider-setup.md) and
[remaining launch gates](../ai/readiness.md).
