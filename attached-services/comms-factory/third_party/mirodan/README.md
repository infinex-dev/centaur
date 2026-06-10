# Canonical Mirodan Source Bundle

This directory vendors the source artifacts that Actor/Director memory indexes
at runtime.

Why this is in the repo: `src/actor-memory.ts` builds a source index with file
existence, byte size, and SHA-256 hashes. A fresh clone must be able to produce
that index without relying on `/Users/opaque/Downloads` or Claude-local memory
paths.

Files:

| File | Role | SHA-256 |
|---|---|---|
| `mirodan-ch1-basic-concepts.md` | Chapter 1 markdown extraction | `d2aca26949ae10be0fc548291e25330ccbd57ce9bb2e8670b7a5fe87be26a216` |
| `mirodan-ch2-attitudes.md` | Chapter 2 markdown extraction | `65b474a679dc976eb14b5395d27b023a83f06a6e24d16002b46facb51f9a46a0` |
| `mirodan-ch3-drives.md` | Chapter 3 markdown extraction | `be9e2c4cc4b9b85ecf89ef1b4b90b0ae5614ad2653d0ec4b2d39f8e4dd3a0e2b` |
| `mirodan-ch4-applications.md` | Chapter 4 markdown extraction | `8e7b8c6b2af12336da40f2d86be8bae869453d1d2df1f247a2e9335a35ebabcf` |
| `laban-mirodan-reference-2026-04-28.md` | Summarized Laban/Mirodan reference | `ca98eede505c7d50361c8cf300d1a2186baa51b5eb94efe55ceff585945e57b5` |
| `Mirodan-PhD-1997-Vol2.pdf` | Primary PDF reference | `e0eaf8ba4ffe65f2d10d57af383a2d6e9a48c8857cc7900f059b4a6d826ce5bd` |
| `mirodan-source-files-location.md` | Original local source-location note | `9943efc62db57710929b41a3907f63e711341b489e994917b075fb28af1dd0ec` |

This repository is internal. If this repo is ever made public or transferred
outside Infinex-controlled GitHub visibility, review the PDF and extracted
chapter files for redistribution rights first.
