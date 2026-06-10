# References — codebase orientation, postmortem culture, human error theory

Compiled 2026-05-28 from the comms-factory pipeline-orientation postmortem session. The single most-relevant lens: smart people make locally rational choices that look stupid at the system level. Read in roughly this priority order.

## Top picks (read these first)

1. **"The Field Guide to Understanding Human Error" — Sidney Dekker.** Why smart people make orientation errors. Reframes "you should have known" into "what about the task structure made the right move feel optional." Most-cited safety-culture book in tech postmortem discipline.
2. **"Working Effectively with Legacy Code" — Michael Feathers.** Specifically Ch. 6 ("I Don't Have Much Time and I Have to Change It") and Ch. 16 ("I Don't Understand the Code Well Enough to Change It"). Textbook on "map before you change." Engineer-dense but the principles transfer.
3. **Sidney Dekker — "The human factor: Pursuing success and averting drift into failure"** (DDD Europe 2018, ~45min). https://www.youtube.com/watch?v=9fwJ9xgvu3A — The canonical Dekker tech-conference talk. Shorter version from DevOps Enterprise Summit 2017: https://www.youtube.com/watch?v=pmZ6wtOmTZU
4. **Google SRE book, "Postmortem Culture" chapter.** Free online at https://sre.google/sre-book/postmortem-culture/ — blameless postmortems as institutional discipline.

## Books

- **"The Field Guide to Understanding Human Error"** — Sidney Dekker. Human error theory; reframes blame as a design problem.
- **"Drift Into Failure"** — Sidney Dekker. How systems slide toward failure through accumulated locally-rational decisions.
- **"Just Culture"** — Sidney Dekker. The third Dekker book. How to do accountability without blame.
- **"Working Effectively with Legacy Code"** — Michael Feathers. Map before you change.
- **"A Philosophy of Software Design"** — John Ousterhout. Especially the chapters on "Information Hiding and Leakage" and "Pulling Complexity Downward."
- **"The Pragmatic Programmer"** — Andy Hunt & Dave Thomas. Orthogonality, tracer bullets, reversibility.
- **"Code Reading"** — Diomidis Spinellis. Older, underrated, all about reading large unfamiliar codebases systematically.
- **"Site Reliability Engineering"** — Google (free at https://sre.google/sre-book/table-of-contents/). The book that defined modern postmortem culture.
- **"The Architecture of Open Source Applications"** — free at http://aosabook.org/ — case studies in real system architecture. The "where do I start reading" discipline.

## Talks (YouTube)

- **Sidney Dekker — "The human factor: Pursuing success and averting drift into failure"** (DDD Europe 2018). https://www.youtube.com/watch?v=9fwJ9xgvu3A
- **Sidney Dekker — "The Pursuit of Success & Averting Drift into Failure"** (DevOps Enterprise Summit 2017). https://www.youtube.com/watch?v=pmZ6wtOmTZU
- **John Allspaw — "Blameless Postmortems"** talks (Etsy). Search YouTube for "Allspaw blameless postmortems" — 20-30min, easier than Dekker, very tech-native.
- **Talks at Google** YouTube series. Long catalogue; many engineering-discipline talks. Available as audio in podcast apps too.

## Podcasts

- **SRE Prodcast** (Google SRE team). Pun on "prod." Episodes on postmortem culture, incident command, capacity planning. Spotify / Apple Podcasts. Search "Google SRE Prodcast."
- **Corecursive.** Story-driven engineering postmortems. Episodes about how engineers got things wrong and learned.
- **Signals and Threads** (Jane Street). Yaron Minsky on system design and forensics.
- **On the Metal / Oxide and Friends.** Engineering culture and architecture discipline.
- **Software Engineering Daily.** Broad; has good codebase-archaeology episodes.

## Essays & free articles

- **Chesterton's Fence** — G.K. Chesterton original; widely cited in tech. "Don't tear down what you don't understand." Search "Chesterton's Fence" — many tech-blogger variants.
- **Google SRE Book — "Postmortem Culture"** chapter. https://sre.google/sre-book/postmortem-culture/
- **Google SRE Book — "Managing Incidents"** chapter. https://sre.google/sre-book/managing-incidents/
- **IT Revolution writeup of Dekker's "human factor" talk.** https://itrevolution.com/articles/human-factor-sidney-dekker/
- **Sidney Dekker's site.** https://sidneydekker.com/

## Key concepts (search terms)

- **Local rationality** (Dekker) — why every step felt right at the time
- **Drift into failure** (Dekker) — slow accumulation of locally-rational decisions
- **Just culture** (Dekker) — accountability without blame
- **The new view of human error** vs old view (Dekker) — paradigm shift in safety thinking
- **Blameless postmortems** (Allspaw, Google SRE)
- **Pinch points** (Feathers) — places to insert sensing before changing
- **Sprout / Wrap / Strangler** (Feathers) — patterns for changing without understanding

## Why these were collected

This list came out of a specific failure: 12 hours of session work optimizing the wrong pipeline in a multi-pipeline codebase. The orientation error pattern was textbook Dekker: every individual move was locally rational (CLI was the visible entry, the bigger file felt more central, the analysis was working in the wrong-pipeline's vocabulary). Only the system view exposed the gap.

The Feathers + Dekker pair covers the technical and social-science halves of the same lesson:
- **Feathers:** how to map a system before changing it (the engineering discipline)
- **Dekker:** why smart people fail to do this (the human factors theory)

Read together they answer two complementary questions: "what's the right move" and "why does the wrong move feel like the right one."
