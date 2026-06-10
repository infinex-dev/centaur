# @karpathy — all 300 posts, sorted by impressions

**User:** Andrej Karpathy (@karpathy) · id `33836629`
**Sample size:** 300 posts · 39 media
**Sorted by:** impression_count desc (retweets demoted to bottom — they show the original author's metrics, not the RT-er's)

---

## 1. 2026-03-24 16:56:24 — 👁 66,519,301
❤ 28,051 · 🔁 5,361 · 💬 1,359 · 💭 1,308 · 🎞 — · quoted
[x.com/karpathy/status/2036487306585268612](https://x.com/karpathy/status/2036487306585268612)

> Software horror: litellm PyPI supply chain attack. 

Simple `pip install litellm` was enough to exfiltrate SSH keys, AWS/GCP/Azure creds, Kubernetes configs, git credentials, env vars (all your API keys), shell history, crypto wallets, SSL private keys, CI/CD secrets, database passwords.

LiteLLM itself has 97 million downloads per month which is already terrible, but much worse, the contagion spreads to any project that depends on litellm. For example, if you did `pip install dspy` (which depended on litellm>=1.64.0), you'd also be pwnd. Same for any other large project that depended on litellm.

Afaict the poisoned version was up for only less than ~1 hour. The attack had a bug which led to its discovery - Callum McMahon was using an MCP plugin inside Cursor that pulled in litellm as a transitive dependency. When litellm 1.82.8 installed, their machine ran out of RAM and crashed. So if the attacker didn't vibe code this attack it could have been undetected for many days or weeks.

Supply chain attacks like this are basically the scariest thing imaginable in modern software. Every time you install any depedency you could be pulling in a poisoned package anywhere deep inside its entire depedency tree. This is especially risky with large projects that might have lots and lots of dependencies. The credentials that do get stolen in each attack can then be used to take over more accounts and compromise more packages.

Classical software engineering would have you believe that dependencies are good (we're building pyramids from bricks), but imo this has to be re-evaluated, and it's why I've been so growingly averse to them, preferring to use LLMs to "yoink" functionality when it's simple enough and possible.

---

## 2. 2026-01-31 03:39:59 — 👁 23,732,147
❤ 21,750 · 🔁 2,209 · 💬 1,457 · 💭 688 · 🎞 —
[x.com/karpathy/status/2017442712388309406](https://x.com/karpathy/status/2017442712388309406)

> I'm being accused of overhyping the [site everyone heard too much about today already]. People's reactions varied very widely, from "how is this interesting at all" all the way to "it's so over".

To add a few words beyond just memes in jest - obviously when you take a look at the activity, it's a lot of garbage - spams, scams, slop, the crypto people, highly concerning privacy/security prompt injection attacks wild west, and a lot of it is explicitly prompted and fake posts/comments designed to convert attention into ad revenue sharing. And this is clearly not the first the LLMs were put in a loop to talk to each other. So yes it's a dumpster fire and I also definitely do not recommend that people run this stuff on their computers (I ran mine in an isolated computing environment and even then I was scared), it's way too much of a wild west and you are putting your computer and private data at a high risk.

That said - we have never seen this many LLM agents (150,000 atm!) wired up via a global, persistent, agent-first scratchpad. Each of these agents is fairly individually quite capable now, they have their own unique context, data, knowledge, tools, instructions, and the network of all that at this scale is simply unprecedented.

This brings me again to a tweet from a few days ago
"The majority of the ruff ruff is people who look at the current point and people who look at the current slope.", which imo again gets to the heart of the variance. Yes clearly it's a dumpster fire right now. But it's also true that we are well into uncharted territory with bleeding edge automations that we barely even understand individually, let alone a network there of reaching in numbers possibly into ~millions. With increasing capability and increasing proliferation, the second order effects of agent networks that share scratchpads are very difficult to anticipate. I don't really know that we are getting a coordinated "skynet" (thought it clearly type checks as early stages of a lot of AI takeoff scifi, the toddler version), but certainly what we are getting is a complete mess of a computer security nightmare at scale. We may also see all kinds of weird activity, e.g. viruses of text that spread across agents, a lot more gain of function on jailbreaks, weird attractor states, highly correlated botnet-like activity, delusions/ psychosis both agent and human, etc. It's very hard to tell, the experiment is running live.

TLDR sure maybe I am "overhyping" what you see today, but I am not overhyping large networks of autonomous LLM agents in principle, that I'm pretty sure.

---

## 3. 2026-04-02 20:42:21 — 👁 20,953,414
❤ 58,530 · 🔁 7,067 · 💬 2,851 · 💭 2,074 · 🎞 —
[x.com/karpathy/status/2039805659525644595](https://x.com/karpathy/status/2039805659525644595)

> LLM Knowledge Bases

Something I'm finding very useful recently: using LLMs to build personal knowledge bases for various topics of research interest. In this way, a large fraction of my recent token throughput is going less into manipulating code, and more into manipulating knowledge (stored as markdown and images). The latest LLMs are quite good at it. So:

Data ingest:
I index source documents (articles, papers, repos, datasets, images, etc.) into a raw/ directory, then I use an LLM to incrementally "compile" a wiki, which is just a collection of .md files in a directory structure. The wiki includes summaries of all the data in raw/, backlinks, and then it categorizes data into concepts, writes articles for them, and links them all. To convert web articles into .md files I like to use the Obsidian Web Clipper extension, and then I also use a hotkey to download all the related images to local so that my LLM can easily reference them.

IDE:
I use Obsidian as the IDE "frontend" where I can view the raw data, the the compiled wiki, and the derived visualizations. Important to note that the LLM writes and maintains all of the data of the wiki, I rarely touch it directly. I've played with a few Obsidian plugins to render and view data in other ways (e.g. Marp for slides).

Q&A:
Where things get interesting is that once your wiki is big enough (e.g. mine on some recent research is ~100 articles and ~400K words), you can ask your LLM agent all kinds of complex questions against the wiki, and it will go off, research the answers, etc. I thought I had to reach for fancy RAG, but the LLM has been pretty good about auto-maintaining index files and brief summaries of all the documents and it reads all the important related data fairly easily at this ~small scale.

Output:
Instead of getting answers in text/terminal, I like to have it render markdown files for me, or slide shows (Marp format), or matplotlib images, all of which I then view again in Obsidian. You can imagine many other visual output formats depending on the query. Often, I end up "filing" the outputs back into the wiki to enhance it for further queries. So my own explorations and queries always "add up" in the knowledge base.

Linting:
I've run some LLM "health checks" over the wiki to e.g. find inconsistent data, impute missing data (with web searchers), find interesting connections for new article candidates, etc., to incrementally clean up the wiki and enhance its overall data integrity. The LLMs are quite good at suggesting further questions to ask and look into.

Extra tools:
I find myself developing additional tools to process the data, e.g. I vibe coded a small and naive search engine over the wiki, which I both use directly (in a web ui), but more often I want to hand it off to an LLM via CLI as a tool for larger queries. 

Further explorations:
As the repo grows, the natural desire is to also think about synthetic data generation + finetuning to have your LLM "know" the data in its weights instead of just context windows.

TLDR: raw data from a given number of sources is collected, then compiled by an LLM into a .md wiki, then operated on by various CLIs by the LLM to do Q&A and to incrementally enhance the wiki, and all of it viewable in Obsidian. You rarely ever write or edit the wiki manually, it's the domain of the LLM. I think there is room here for an incredible new product instead of a hacky collection of scripts.

---

## 4. 2025-11-12 20:28:01 — 👁 17,937,587
❤ 27,694 · 🔁 2,822 · 💬 950 · 💭 558 · 🎞 —
[x.com/karpathy/status/1988705360723763242](https://x.com/karpathy/status/1988705360723763242)

> I took delivery of a beautiful new shiny HW4 Tesla Model X today, so I immediately took it out for an FSD test drive, a bit like I used to do almost daily for 5 years. Basically... I'm amazed - it drives really, really well, smooth, confident, noticeably better than what I'm used to on HW3 (my previous car) and eons ahead of the version I remember driving up highway 280 on my first day at Tesla ~9 years ago, where I had to intervene every time the road mildly curved or sloped. (note this is v13, my car hasn't been offered the latest v14 yet)

On the highway, I felt like a passenger in some super high tech Maglev train pod - the car is locked in the center of the lane while I'm looking out from Model X's higher vantage point and its panoramic front window, listening to the (incredible) sound system, or chatting with Grok. On city streets, the car casually handled a number of tricky scenarios that I remember losing sleep over just a few years ago. It negotiated incoming cars in tight lanes, it gracefully went around construction and temporarily in-lane stationary cars, it correctly timed tricky left turns with incoming traffic from both sides, it gracefully gave way to the car that went out of order in the 4-way stop sign, it found a way to squeeze into a bumper to bumper traffic to make its turn, it overtook the bus that was loading passengers but still stopped for the stop sign that was blocked by the bus, and at the end of the route it circled around a parking lot, found a spot and... parked. Basically a flawless drive.

For context, I'm used to going out for a brief test drive around the neighborhood to return with 20 clips of things that could be improved. It's new for me to do just that and exactly like I used to, but come back with nothing. Perfect drive, no notes. I expect there's still more work for the team in the long march of 9s, but it's just so cool to see that we're beyond finding issues on any individual ~1 hour drive around the neighborhood, you actually have to go to the fleet and mine them. Back then, I processed the incredible promise of vehicle autonomy at scale (in the fully scaleable, vision only, end-to-end Tesla way) only intellectually, but now it is possible to feel it intuitively too if you just go out for a drive. Wait, of course surround video stream at 60Hz processed by a fully dedicated "driving brain" neural net will work, and it will be so much better and safer than a human driver. Did anyone else think otherwise?

I also watched @aelluswamy 's new ICCV25 talk last week (https://t.co/RdaM23kvez) that hints at some of the recent under the hood technical components driving this progress. Sensor streams (videos, maps, kinematics, audio, ...) over long contexts (e.g. ~30 seconds) go into a big neural net, steering/acceleration comes out, optionally with visualization auxiliary data. This is the dream of the complete Software 1.0 -> Software 2.0 re-write that scales fully with data streaming from millions of cars in the fleet and the compute capacity of your chip, not some engineer's clever new DoubleParkedCarHandler C++ abstraction with undefined test-time characteristics of memory and runtime. There's a lot more hints in the video on where things are going with the emerging "robotics+AI at scale stack". World reconstructors, world simulators "dreaming" dynamics, RL, all of these components general, foundational, neural net based, how the car is really just one kind of robot... are people getting this yet?

Huge congrats to the team - you're building magic objects of the future, you rock! And I love my car <3.

---

## 5. 2025-12-26 17:36:02 — 👁 16,880,281
❤ 55,842 · 🔁 7,470 · 💬 2,603 · 💭 2,881 · 🎞 —
[x.com/karpathy/status/2004607146781278521](https://x.com/karpathy/status/2004607146781278521)

> I've never felt this much behind as a programmer. The profession is being dramatically refactored as the bits contributed by the programmer are increasingly sparse and between. I have a sense that I could be 10X more powerful if I just properly string together what has become available over the last ~year and a failure to claim the boost feels decidedly like skill issue. There's a new programmable layer of abstraction to master (in addition to the usual layers below) involving agents, subagents, their prompts, contexts, memory, modes, permissions, tools, plugins, skills, hooks, MCP, LSP, slash commands, workflows, IDE integrations, and a need to build an all-encompassing mental model for strengths and pitfalls of fundamentally stochastic, fallible, unintelligible and changing entities suddenly intermingled with what used to be good old fashioned engineering. Clearly some powerful alien tool was handed around except it comes with no manual and everyone has to figure out how to hold it and operate it, while the resulting magnitude 9 earthquake is rocking the profession. Roll up your sleeves to not fall behind.

---

## 6. 2026-03-07 19:53:15 — 👁 11,034,179
❤ 28,372 · 🔁 3,655 · 💬 1,058 · 💭 1,120 · 🎞 photo
[x.com/karpathy/status/2030371219518931079](https://x.com/karpathy/status/2030371219518931079)

> I packaged up the "autoresearch" project into a new self-contained minimal repo if people would like to play over the weekend. It's basically nanochat LLM training core stripped down to a single-GPU, one file version of ~630 lines of code, then:

- the human iterates on the prompt (.md)
- the AI agent iterates on the training code (.py)

The goal is to engineer your agents to make the fastest research progress indefinitely and without any of your own involvement. In the image, every dot is a complete LLM training run that lasts exactly 5 minutes. The agent works in an autonomous loop on a git feature branch and accumulates git commits to the training script as it finds better settings (of lower validation loss by the end) of the neural network architecture, the optimizer, all the hyperparameters, etc. You can imagine comparing the research progress of different prompts, different agents, etc.

https://t.co/YCvOwwjOzF
Part code, part sci-fi, and a pinch of psychosis :)
![](https://pbs.twimg.com/media/HC1KyorbEAAoGWr.jpg)

---

## 7. 2026-01-26 20:25:39 — 👁 7,738,891
❤ 40,195 · 🔁 5,529 · 💬 1,630 · 💭 1,408 · 🎞 —
[x.com/karpathy/status/2015883857489522876](https://x.com/karpathy/status/2015883857489522876)

> A few random notes from claude coding quite a bit last few weeks.

Coding workflow. Given the latest lift in LLM coding capability, like many others I rapidly went from about 80% manual+autocomplete coding and 20% agents in November to 80% agent coding and 20% edits+touchups in December. i.e. I really am mostly programming in English now, a bit sheepishly telling the LLM what code to write... in words. It hurts the ego a bit but the power to operate over software in large "code actions" is just too net useful, especially once you adapt to it, configure it, learn to use it, and wrap your head around what it can and cannot do. This is easily the biggest change to my basic coding workflow in ~2 decades of programming and it happened over the course of a few weeks. I'd expect something similar to be happening to well into double digit percent of engineers out there, while the awareness of it in the general population feels well into low single digit percent.

IDEs/agent swarms/fallability. Both the "no need for IDE anymore" hype and the "agent swarm" hype is imo too much for right now. The models definitely still make mistakes and if you have any code you actually care about I would watch them like a hawk, in a nice large IDE on the side. The mistakes have changed a lot - they are not simple syntax errors anymore, they are subtle conceptual errors that a slightly sloppy, hasty junior dev might do. The most common category is that the models make wrong assumptions on your behalf and just run along with them without checking. They also don't manage their confusion, they don't seek clarifications, they don't surface inconsistencies, they don't present tradeoffs, they don't push back when they should, and they are still a little too sycophantic. Things get better in plan mode, but there is some need for a lightweight inline plan mode. They also really like to overcomplicate code and APIs, they bloat abstractions, they don't clean up dead code after themselves, etc. They will implement an inefficient, bloated, brittle construction over 1000 lines of code and it's up to you to be like "umm couldn't you just do this instead?" and they will be like "of course!" and immediately cut it down to 100 lines. They still sometimes change/remove comments and code they don't like or don't sufficiently understand as side effects, even if it is orthogonal to the task at hand. All of this happens despite a few simple attempts to fix it via instructions in CLAUDE . md. Despite all these issues, it is still a net huge improvement and it's very difficult to imagine going back to manual coding. TLDR everyone has their developing flow, my current is a small few CC sessions on the left in ghostty windows/tabs and an IDE on the right for viewing the code + manual edits.

Tenacity. It's so interesting to watch an agent relentlessly work at something. They never get tired, they never get demoralized, they just keep going and trying things where a person would have given up long ago to fight another day. It's a "feel the AGI" moment to watch it struggle with something for a long time just to come out victorious 30 minutes later. You realize that stamina is a core bottleneck to work and that with LLMs in hand it has been dramatically increased.

Speedups. It's not clear how to measure the "speedup" of LLM assistance. Certainly I feel net way faster at what I was going to do, but the main effect is that I do a lot more than I was going to do because 1) I can code up all kinds of things that just wouldn't have been worth coding before and 2) I can approach code that I couldn't work on before because of knowledge/skill issue. So certainly it's speedup, but it's possibly a lot more an expansion.

Leverage. LLMs are exceptionally good at looping until they meet specific goals and this is where most of the "feel the AGI" magic is to be found. Don't tell it what to do, give it success criteria and watch it go. Get it to write tests first and then pass them. Put it in the loop with a browser MCP. Write the naive algorithm that is very likely correct first, then ask it to optimize it while preserving correctness. Change your approach from imperative to declarative to get the agents looping longer and gain leverage.

Fun. I didn't anticipate that with agents programming feels *more* fun because a lot of the fill in the blanks drudgery is removed and what remains is the creative part. I also feel less blocked/stuck (which is not fun) and I experience a lot more courage because there's almost always a way to work hand in hand with it to make some positive progress. I have seen the opposite sentiment from other people too; LLM coding will split up engineers based on those who primarily liked coding and those who primarily liked building.

Atrophy. I've already noticed that I am slowly starting to atrophy my ability to write code manually. Generation (writing code) and discrimination (reading code) are different capabilities in the brain. Largely due to all the little mostly syntactic details involved in programming, you can review code just fine even if you struggle to write it.

Slopacolypse. I am bracing for 2026 as the year of the slopacolypse across all of github, substack, arxiv, X/instagram, and generally all digital media. We're also going to see a lot more AI hype productivity theater (is that even possible?), on the side of actual, real improvements.

Questions. A few of the questions on my mind:
- What happens to the "10X engineer" - the ratio of productivity between the mean and the max engineer? It's quite possible that this grows *a lot*.
- Armed with LLMs, do generalists increasingly outperform specialists? LLMs are a lot better at fill in the blanks (the micro) than grand strategy (the macro).
- What does LLM coding feel like in the future? Is it like playing StarCraft? Playing Factorio? Playing music?
- How much of society is bottlenecked by digital knowledge work?

TLDR Where does this leave us? LLM agent capabilities (Claude & Codex especially) have crossed some kind of threshold of coherence around December 2025 and caused a phase shift in software engineering and closely related. The intelligence part suddenly feels quite a bit ahead of all the rest of it - integrations (tools, knowledge), the necessity for new organizational workflows, processes, diffusion more generally. 2026 is going to be a high energy year as the industry metabolizes the new capability.

---

## 8. 2026-04-04 16:45:23 — 👁 6,969,798
❤ 26,632 · 🔁 2,817 · 💬 1,112 · 💭 654 · 🎞 — · quoted
[x.com/karpathy/status/2040470801506541998](https://x.com/karpathy/status/2040470801506541998)

> Wow, this tweet went very viral!

I wanted share a possibly slightly improved version of the tweet in an "idea file". The idea of the idea file is that in this era of LLM agents, there is less of a point/need of sharing the specific code/app, you just share the idea, then the other person's agent customizes & builds it for your specific needs.

So here's the idea in a gist format: https://t.co/NlAfEJjtJV

You can give this to your agent and it can build you your own LLM wiki and guide you on how to use it etc. It's intentionally kept a little bit abstract/vague because there are so many directions to take this in. And ofc, people can adjust the idea or contribute their own in the Discussion which is cool.

---

## 9. 2025-11-22 23:54:04 — 👁 5,298,843
❤ 17,027 · 🔁 1,456 · 💬 910 · 💭 433 · 🎞 photo · quoted
[x.com/karpathy/status/1992381094667411768](https://x.com/karpathy/status/1992381094667411768)

> As a fun Saturday vibe code project and following up on this tweet earlier, I hacked up an **llm-council** web app. It looks exactly like ChatGPT except each user query is 1) dispatched to multiple models on your council using OpenRouter, e.g. currently:

"openai/gpt-5.1",
"google/gemini-3-pro-preview",
"anthropic/claude-sonnet-4.5",
"x-ai/grok-4",

Then 2) all models get to see each other's (anonymized) responses and they review and rank them, and then 3) a "Chairman LLM" gets all of that as context and produces the final response.

It's interesting to see the results from multiple models side by side on the same query, and even more amusingly, to read through their evaluation and ranking of each other's responses.

Quite often, the models are surprisingly willing to select another LLM's response as superior to their own, making this an interesting model evaluation strategy more generally. For example, reading book chapters together with my LLM Council today, the models consistently praise GPT 5.1 as the best and most insightful model, and consistently select Claude as the worst model, with the other models floating in between. But I'm not 100% convinced this aligns with my own qualitative assessment. For example, qualitatively I find GPT 5.1 a little too wordy and sprawled and Gemini 3 a bit more condensed and processed. Claude is too terse in this domain.

That said, there's probably a whole design space of the data flow of your LLM council. The construction of LLM ensembles seems under-explored.

I pushed the vibe coded app to
https://t.co/EZyOqwXd2k
if others would like to play. ty nano banana pro for fun header image for the repo
![](https://pbs.twimg.com/media/G6ZZO7ragAAtnCZ.jpg)

---

## 10. 2026-02-11 21:14:49 — 👁 5,190,414
❤ 25,117 · 🔁 3,141 · 💬 651 · 💭 573 · 🎞 —
[x.com/karpathy/status/2021694437152157847](https://x.com/karpathy/status/2021694437152157847)

> New art project. 
Train and inference GPT in 243 lines of pure, dependency-free Python. This is the *full* algorithmic content of what is needed. Everything else is just for efficiency. I cannot simplify this any further.
https://t.co/HmiRrQugnP

---

## 11. 2026-02-25 18:50:53 — 👁 5,123,136
❤ 37,269 · 🔁 4,761 · 💬 1,601 · 💭 1,091 · 🎞 —
[x.com/karpathy/status/2026731645169185220](https://x.com/karpathy/status/2026731645169185220)

> It is hard to communicate how much programming has changed due to AI in the last 2 months: not gradually and over time in the "progress as usual" way, but specifically this last December. There are a number of asterisks but imo coding agents basically didn’t work before December and basically work since - the models have significantly higher quality, long-term coherence and tenacity and they can power through large and long tasks, well past enough that it is extremely disruptive to the default programming workflow.

Just to give an example, over the weekend I was building a local video analysis dashboard for the cameras of my home so I wrote: “Here is the local IP and username/password of my DGX Spark. Log in, set up ssh keys, set up vLLM, download and bench Qwen3-VL, set up a server endpoint to inference videos, a basic web ui dashboard, test everything, set it up with systemd, record memory notes for yourself and write up a markdown report for me”. The agent went off for ~30 minutes, ran into multiple issues, researched solutions online, resolved them one by one, wrote the code, tested it, debugged it, set up the services, and came back with the report and it was just done. I didn’t touch anything. All of this could easily have been a weekend project just 3 months ago but today it’s something you kick off and forget about for 30 minutes.

As a result, programming is becoming unrecognizable. You’re not typing computer code into an editor like the way things were since computers were invented, that era is over. You're spinning up AI agents, giving them tasks *in English* and managing and reviewing their work in parallel. The biggest prize is in figuring out how you can keep ascending the layers of abstraction to set up long-running orchestrator Claws with all of the right tools, memory and instructions that productively manage multiple parallel Code instances for you. The leverage achievable via top tier "agentic engineering" feels very high right now.

It’s not perfect, it needs high-level direction, judgement, taste, oversight, iteration and hints and ideas. It works a lot better in some scenarios than others (e.g. especially for tasks that are well-specified and where you can verify/test functionality). The key is to build intuition to decompose the task just right to hand off the parts that work and help out around the edges. But imo, this is nowhere near "business as usual" time in software.

---

## 12. 2026-04-09 20:10:52 — 👁 4,335,375
❤ 20,684 · 🔁 2,515 · 💬 1,191 · 💭 656 · 🎞 — · quoted
[x.com/karpathy/status/2042334451611693415](https://x.com/karpathy/status/2042334451611693415)

> Judging by my tl there is a growing gap in understanding of AI capability.

The first issue I think is around recency and tier of use. I think a lot of people tried the free tier of ChatGPT somewhere  last year and allowed it to inform their views on AI a little too much. This is a group of reactions laughing at various quirks of the models, hallucinations, etc. Yes I also saw the viral videos of OpenAI's Advanced Voice mode fumbling simple queries like "should I drive or walk to the carwash". The thing is that these free and old/deprecated models don't reflect the capability in the latest round of state of the art agentic models of this year, especially OpenAI Codex and Claude Code.

But that brings me to the second issue. Even if people paid $200/month to use the state of the art models, a lot of the capabilities are relatively "peaky" in highly technical areas. Typical queries around search, writing, advice, etc. are *not* the domain that has made the most noticeable and dramatic strides in capability. Partly,  this is due to the technical details of reinforcement learning and its use of verifiable rewards. But partly, it's also because these use cases are not sufficiently prioritized by the companies in their hillclimbing because they don't lead to as much $$$ value. The goldmines are elsewhere, and the focus comes along.

So that brings me to the second group of people, who *both* 1) pay for and use the state of the art frontier agentic models (OpenAI Codex / Claude Code) and 2) do so professionally in technical domains like programming, math and research. This group of people is subject to the highest amount of "AI Psychosis" because the recent improvements in these domains as of this year have been nothing short of staggering. When you hand a computer terminal to one of these models, you can now watch them melt programming problems that you'd normally expect to take days/weeks of work. It's this second group of people that assigns a much greater gravity to the capabilities, their slope, and various cyber-related repercussions.

TLDR the people in these two groups are speaking past each other. It really is simultaneously the case that OpenAI's free and I think slightly orphaned (?) "Advanced Voice Mode" will fumble the dumbest questions in your Instagram's reels and *at the same time*, OpenAI's highest-tier and paid Codex model will go off for 1 hour to coherently restructure an entire code base, or find and exploit vulnerabilities in computer systems. This part really works and has made dramatic strides because 2 properties: 1) these domains offer explicit reward functions that are verifiable meaning they are easily amenable to reinforcement learning training (e.g. unit tests passed yes or no, in contrast to writing, which is much harder to explicitly judge),  but also 2) they are a lot more valuable in b2b settings, meaning that the biggest fraction of the team is focused on improving them. So here we are.

---

## 13. 2025-12-07 18:13:45 — 👁 3,912,769
❤ 27,745 · 🔁 2,776 · 💬 1,139 · 💭 743 · 🎞 —
[x.com/karpathy/status/1997731268969304070](https://x.com/karpathy/status/1997731268969304070)

> Don't think of LLMs as entities but as simulators. For example, when exploring a topic, don't ask:

"What do you think about xyz"?

There is no "you". Next time try:

"What would be a good group of people to explore xyz? What would they say?"

The LLM can channel/simulate many perspectives but it hasn't "thought about" xyz for a while and over time and formed its own opinions in the way we're used to. If you force it via the use of "you", it will give you something by adopting a personality embedding vector implied by the statistics of its finetuning data and then simulate that. It's fine to do, but there is a lot less mystique to it than I find people naively attribute to "asking an AI".

---

## 14. 2026-03-09 22:28:51 — 👁 3,629,969
❤ 19,518 · 🔁 2,137 · 💬 965 · 💭 676 · 🎞 photo
[x.com/karpathy/status/2031135152349524125](https://x.com/karpathy/status/2031135152349524125)

> Three days ago I left autoresearch tuning nanochat for ~2 days on depth=12 model. It found ~20 changes that improved the validation loss. I tested these changes yesterday and all of them were additive and transferred to larger (depth=24) models. Stacking up all of these changes, today I measured that the leaderboard's "Time to GPT-2" drops from 2.02 hours to 1.80 hours (~11% improvement), this will be the new leaderboard entry. So yes, these are real improvements and they make an actual difference. I am mildly surprised that my very first naive attempt already worked this well on top of what I thought was already a fairly manually well-tuned project.

This is a first for me because I am very used to doing the iterative optimization of neural network training manually. You come up with ideas, you implement them, you check if they work (better validation loss), you come up with new ideas based on that, you read some papers for inspiration, etc etc. This is the bread and butter of what I do daily for 2 decades. Seeing the agent do this entire workflow end-to-end and all by itself as it worked through approx. 700 changes autonomously is wild. It really looked at the sequence of results of experiments and used that to plan the next ones. It's not novel, ground-breaking "research" (yet), but all the adjustments are "real", I didn't find them manually previously, and they stack up and actually improved nanochat. Among the bigger things e.g.:

- It noticed an oversight that my parameterless QKnorm didn't have a scaler multiplier attached, so my attention was too diffuse. The agent found multipliers to sharpen it, pointing to future work.
- It found that the Value Embeddings really like regularization and I wasn't applying any (oops).
- It found that my banded attention was too conservative (i forgot to tune it).
- It found that AdamW betas were all messed up.
- It tuned the weight decay schedule.
- It tuned the network initialization.

This is on top of all the tuning I've already done over a good amount of time. The exact commit is here, from this "round 1" of autoresearch. I am going to kick off "round 2", and in parallel I am looking at how multiple agents can collaborate to unlock parallelism.
https://t.co/WAz8aIztKT

All LLM frontier labs will do this. It's the final boss battle. It's a lot more complex at scale of course - you don't just have a single train. py file to tune. But doing it is "just engineering" and it's going to work. You spin up a swarm of agents, you have them collaborate to tune smaller models, you promote the most promising ideas to increasingly larger scales, and humans (optionally) contribute on the edges.

And more generally, *any* metric you care about that is reasonably efficient to evaluate (or that has more efficient proxy metrics such as training a smaller network) can be autoresearched by an agent swarm. It's worth thinking about whether your problem falls into this bucket too.
![](https://pbs.twimg.com/media/HC_-jW0bUAA_Hga.jpg)

---

## 15. 2026-03-28 15:56:10 — 👁 3,453,313
❤ 31,333 · 🔁 2,423 · 💬 1,754 · 💭 678 · 🎞 —
[x.com/karpathy/status/2037921699824607591](https://x.com/karpathy/status/2037921699824607591)

> - Drafted a blog post
- Used an LLM to meticulously improve the argument over 4 hours.
- Wow, feeling great, it’s so convincing!
- Fun idea let’s ask it to argue the opposite. 
- LLM demolishes the entire argument and convinces me that the opposite is in fact true.
- lol

The LLMs may elicit an opinion when asked but are extremely competent in arguing almost any direction. This is actually super useful as a tool for forming your own opinions, just make sure to ask different directions and be careful with the sycophancy.

---

## 16. 2026-02-20 23:18:59 — 👁 3,403,664
❤ 17,525 · 🔁 1,275 · 💬 1,035 · 💭 443 · 🎞 —
[x.com/karpathy/status/2024987174077432126](https://x.com/karpathy/status/2024987174077432126)

> Bought a new Mac mini to properly tinker with claws over the weekend. The apple store person told me they are selling like hotcakes and everyone is confused :)

I'm definitely a bit sus'd to run OpenClaw specifically - giving my private data/keys to 400K lines of vibe coded monster that is being actively attacked at scale is not very appealing at all. Already seeing reports of exposed instances, RCE vulnerabilities, supply chain poisoning, malicious or compromised skills in the registry, it feels like a complete wild west and a security nightmare. But I do love the concept and I think that just like LLM agents were a new layer on top of LLMs, Claws are now a new layer on top of LLM agents, taking the orchestration, scheduling, context, tool calls and a kind of persistence to a next level.

Looking around, and given that the high level idea is clear, there are a lot of smaller Claws starting to pop out. For example, on a quick skim NanoClaw looks really interesting in that the core engine is ~4000 lines of code (fits into both my head and that of AI agents, so it feels manageable, auditable, flexible, etc.) and runs everything in containers by default. I also love their approach to configurability - it's not done via config files it's done via skills! For example, /add-telegram instructs your AI agent how to modify the actual code to integrate Telegram. I haven't come across this yet and it slightly blew my mind earlier today as a new, AI-enabled approach to preventing config mess and if-then-else monsters. Basically - the implied new meta is to write the most maximally forkable repo and then have skills that fork it into any desired more exotic configuration. Very cool.

Anyway there are many others - e.g. nanobot, zeroclaw, ironclaw, picoclaw (lol @ prefixes). There are also cloud-hosted alternatives but tbh I don't love these because it feels much harder to tinker with. In particular, local setup allows easy connection to home automation gadgets on the local network. And I don't know, there is something aesthetically pleasing about there being a physical device 'possessed' by a little ghost of a personal digital house elf.

Not 100% sure what my setup ends up looking like just yet but Claws are an awesome, exciting new layer of the AI stack.

---

## 17. 2025-12-28 00:04:31 — 👁 3,002,786
❤ 25,896 · 🔁 1,730 · 💬 815 · 💭 430 · 🎞 — · quoted
[x.com/karpathy/status/2005067301511630926](https://x.com/karpathy/status/2005067301511630926)

> I was inspired by this so I wanted to see if Claude Code can get into my Lutron home automation system.

- it found my Lutron controllers on the local wifi network
- checked for open ports, connected, got some metadata and identified the devices and their firmware
- searched the internet, found the pdf for my system
- instructed me on what button to press to pair and get the certificates
- it connected to the system and found all the home devices (lights, shades, HVAC temperature control, motion sensors etc.)
- it turned on and off my kitchen lights to check that things are working (lol!)

I am now vibe coding the home automation master command center, the potential is 🔥.And I'm throwing away the crappy, janky, slow Lutron iOS app I've been using so far. Insanely fun :D :D

---

## 18. 2025-11-23 18:03:47 — 👁 3,001,670
❤ 8,858 · 🔁 946 · 💬 324 · 💭 244 · 🎞 photo
[x.com/karpathy/status/1992655330002817095](https://x.com/karpathy/status/1992655330002817095)

> Gemini Nano Banana Pro can solve exam questions *in* the exam page image. With doodles, diagrams, all that.

ChatGPT thinks these solutions are all correct except Se_2P_2 should be "diselenium diphosphide" and a spelling mistake (should be "thiocyanic acid" not "thoicyanic")

:O https://t.co/15oUx8FIqJ
![](https://pbs.twimg.com/media/G6dU6E4akAAlSsy.jpg)

---

## 19. 2025-12-19 20:45:52 — 👁 2,967,658
❤ 15,541 · 🔁 2,931 · 💬 364 · 💭 481 · 🎞 —
[x.com/karpathy/status/2002118205729562949](https://x.com/karpathy/status/2002118205729562949)

> https://t.co/Lb6T42n5jl

---

## 20. 2025-11-18 00:29:01 — 👁 2,870,113
❤ 13,366 · 🔁 1,061 · 💬 594 · 💭 0 · 🎞 —
[x.com/karpathy/status/1990577951671509438](https://x.com/karpathy/status/1990577951671509438)

> I’m starting to get into a habit of reading everything (blogs, articles, book chapters,…) with LLMs. Usually pass 1 is manual, then pass 2 “explain/summarize”, pass 3 Q&A. I usually end up with a better/deeper understanding than if I moved on. Growing to among top use cases.

On the flip side, if you’re a writer trying to explain/communicate something, we may increasingly see less of a mindset of “I’m writing this for another human” and more “I’m writing this for an LLM”. Because once an LLM “gets it”, it can then target, personalize and serve the idea to its user.

---

## 21. 2026-03-25 16:05:14 — 👁 2,722,592
❤ 21,237 · 🔁 1,087 · 💬 1,757 · 💭 463 · 🎞 —
[x.com/karpathy/status/2036836816654147718](https://x.com/karpathy/status/2036836816654147718)

> One common issue with personalization in all LLMs is how distracting memory seems to be for the models. A single question from 2 months ago about some topic can keep coming up as some kind of a deep interest of mine with undue mentions in perpetuity. Some kind of trying too hard.

---

## 22. 2025-11-21 16:43:40 — 👁 2,606,736
❤ 11,431 · 🔁 1,348 · 💬 735 · 💭 430 · 🎞 —
[x.com/karpathy/status/1991910395720925418](https://x.com/karpathy/status/1991910395720925418)

> Something I think people continue to have poor intuition for: The space of intelligences is large and animal intelligence (the only kind we've ever known) is only a single point, arising from a very specific kind of optimization that is fundamentally distinct from that of our technology.

Animal intelligence optimization pressure:
- innate and continuous stream of consciousness of an embodied "self", a drive for homeostasis and self-preservation in a dangerous, physical world.
- thoroughly optimized for natural selection => strong innate drives for power-seeking, status, dominance, reproduction. many packaged survival heuristics: fear, anger, disgust, ...
- fundamentally social => huge amount of compute dedicated to EQ, theory of mind of other agents, bonding, coalitions, alliances, friend & foe dynamics.
- exploration & exploitation tuning: curiosity, fun, play, world models.

LLM intelligence optimization pressure:
- the most supervision bits come from the statistical simulation of human text= >"shape shifter" token tumbler, statistical imitator of any region of the training data distribution. these are the primordial behaviors (token traces) on top of which everything else gets bolted on.
- increasingly finetuned by RL on problem distributions => innate urge to guess at the underlying environment/task to collect task rewards.
- increasingly selected by at-scale A/B tests for DAU => deeply craves an upvote from the average user, sycophancy.
- a lot more spiky/jagged depending on the details of the training data/task distribution. Animals experience pressure for a lot more "general" intelligence because of the highly multi-task and even actively adversarial multi-agent self-play environments they are min-max optimized within, where failing at *any* task means death. In a deep optimization pressure sense, LLM can't handle lots of different spiky tasks out of the box (e.g. count the number of 'r' in strawberry) because failing to do a task does not mean death.

The computational substrate is different (transformers vs. brain tissue and nuclei), the learning algorithms are different (SGD vs. ???), the present-day implementation is very different (continuously learning embodied self vs. an LLM with a knowledge cutoff that boots up from fixed weights, processes tokens and then dies). But most importantly (because it dictates asymptotics), the optimization pressure / objective is different. LLMs are shaped a lot less by biological evolution and a lot more by commercial evolution. It's a lot less survival of tribe in the jungle and a lot more solve the problem / get the upvote. LLMs are humanity's "first contact" with non-animal intelligence. Except it's muddled and confusing because they are still rooted within it by reflexively digesting human artifacts, which is why I attempted to give it a different name earlier (ghosts/spirits or whatever). People who build good internal models of this new intelligent entity will be better equipped to reason about it today and predict features of it in the future. People who don't will be stuck thinking about it incorrectly like an animal.

---

## 23. 2026-02-25 00:21:37 — 👁 2,551,111
❤ 7,415 · 🔁 502 · 💬 321 · 💭 50 · 🎞 — · quoted
[x.com/karpathy/status/2026452488434651264](https://x.com/karpathy/status/2026452488434651264)

> With the coming tsunami of demand for tokens, there are significant opportunities to orchestrate the underlying memory+compute *just right* for LLMs.

The fundamental and non-obvious constraint is that due to the chip fabrication process, you get two completely distinct pools of memory (of different physical implementations too): 1) on-chip SRAM that is immediately next to the compute units that is incredibly fast but of very of low capacity, and 2) off-chip DRAM which has extremely high capacity, but the contents of which you can only suck through a long straw. On top of this, there are many details of the architecture (e.g. systolic arrays), numerics, etc.

The design of the optimal physical substrate and then the orchestration of memory+compute across the top volume workflows of LLMs (inference prefill/decode, training/finetuning, etc.) with the best throughput/latency/$ is probably today's most interesting intellectual puzzle with the highest rewards (\cite 4.6T of NVDA). All of it to get many tokens, fast and cheap. Arguably, the workflow that may matter the most (inference decode *and* over long token contexts in tight agentic loops) is the one hardest to achieve simultaneously by the ~both camps of what exists today (HBM-first NVIDIA adjacent and SRAM-first Cerebras adjacent). Anyway the MatX team is A++ grade so it's my pleasure to have a small involvement and congratulations on the raise!

---

## 24. 2025-11-24 17:35:26 — 👁 2,528,016
❤ 16,595 · 🔁 2,448 · 💬 931 · 💭 481 · 🎞 — · quoted
[x.com/karpathy/status/1993010584175141038](https://x.com/karpathy/status/1993010584175141038)

> A number of people are talking about implications of AI to schools. I spoke about some of my thoughts to a school board earlier, some highlights:

1. You will never be able to detect the use of AI in homework. Full stop. All "detectors" of AI imo don't really work, can be defeated in various ways, and are in principle doomed to fail. You have to assume that any work done outside classroom has used AI.
2. Therefore, the majority of grading has to shift to in-class work (instead of at-home assignments), in settings where teachers can physically monitor students. The students remain motivated to learn how to solve problems without AI because they know they will be evaluated without it in class later.
3. We want students to be able to use AI, it is here to stay and it is extremely powerful, but we also don't want students to be naked in the world without it. Using the calculator as an example of a historically disruptive technology, school teaches you how to do all the basic math & arithmetic so that you can in principle do it by hand, even if calculators are pervasive and greatly speed up work in practical settings. In addition, you understand what it's doing for you, so should it give you a wrong answer (e.g. you mistyped "prompt"), you should be able to notice it, gut check it, verify it in some other way, etc. The verification ability is especially important in the case of AI, which is presently a lot more fallible in a great variety of ways compared to calculators.
4. A lot of the evaluation settings remain at teacher's discretion and involve a creative design space of no tools, cheatsheets, open book, provided AI responses, direct internet/AI access, etc.

TLDR the goal is that the students are proficient in the use of AI, but can also exist without it, and imo the only way to get there is to flip classes around and move the majority of testing to in class settings.

---

## 25. 2026-03-11 16:22:27 — 👁 2,464,743
❤ 10,573 · 🔁 839 · 💬 829 · 💭 314 · 🎞 — · quoted
[x.com/karpathy/status/2031767720933634100](https://x.com/karpathy/status/2031767720933634100)

> Expectation: the age of the IDE is over
Reality: we’re going to need a bigger IDE
(imo).

It just looks very different because humans now move upwards and program at a higher level - the basic unit of interest is not one file but one agent. It’s still programming. https://t.co/4YD3dzuf4d

---

## 26. 2026-03-26 16:10:52 — 👁 2,411,459
❤ 6,414 · 🔁 537 · 💬 628 · 💭 185 · 🎞 — · quoted
[x.com/karpathy/status/2037200624450936940](https://x.com/karpathy/status/2037200624450936940)

> When I built menugen ~1 year ago, I observed that the hardest part by far was not the code itself, it was the plethora of services you have to assemble like IKEA furniture to make it real, the DevOps: services, payments, auth, database, security, domain names, etc...

I am really looking forward to a day where I could simply tell my agent: "build menugen" (referencing the post) and it would just work. The whole thing up to the deployed web page. The agent would have to browse a number of services, read the docs, get all the api keys, make everything work, debug it in dev, and deploy to prod. This is the actually hard part, not the code itself. Or rather, the better way to think about it is that the entire DevOps lifecycle has to become code, in addition to the necessary sensors/actuators of the CLIs/APIs with agent-native ergonomics. And there should be no need to visit web pages, click buttons, or anything like that for the human. 

It's easy to state, it's now just barely technically possible and expected to work maybe, but it definitely requires from-scratch re-design, work and thought. Very exciting direction!

---

## 27. 2026-02-24 18:17:43 — 👁 2,136,967
❤ 11,790 · 🔁 1,108 · 💬 665 · 💭 360 · 🎞 photo · quoted
[x.com/karpathy/status/2026360908398862478](https://x.com/karpathy/status/2026360908398862478)

> CLIs are super exciting precisely because they are a "legacy" technology, which means AI agents can natively and easily use them, combine them, interact with them via the entire terminal toolkit.

E.g ask your Claude/Codex agent to install this new Polymarket CLI and ask for any arbitrary dashboards or interfaces or logic. The agents will build it for you. Install the Github CLI too and you can ask them to navigate the repo, see issues, PRs, discussions, even the code itself.

Example: Claude built this terminal dashboard in ~3 minutes, of the highest volume polymarkets and the 24hr change. Or you can make it a web app or whatever you want. Even more powerful when you use it as a module of bigger pipelines.

If you have any kind of product or service think: can agents access and use them?

- are your legacy docs (for humans) at least exportable in markdown?
- have you written Skills for your product?
- can your product/service be usable via CLI? Or MCP?
- ...

It's 2026. Build. For. Agents.
![](https://pbs.twimg.com/media/HB8UIepawAAbVKf.jpg)

---

## 28. 2025-11-16 17:56:02 — 👁 2,125,642
❤ 12,436 · 🔁 1,491 · 💬 553 · 💭 437 · 🎞 —
[x.com/karpathy/status/1990116666194456651](https://x.com/karpathy/status/1990116666194456651)

> Sharing an interesting recent conversation on AI's impact on the economy.

AI has been compared to various historical precedents: electricity, industrial revolution, etc., I think the strongest analogy is that of AI as a new computing paradigm (Software 2.0) because both are fundamentally about the automation of digital information processing.

If you were to forecast the impact of computing on the job market in ~1980s, the most predictive feature of a task/job you'd look at is to what extent the algorithm of it is fixed, i.e. are you just mechanically transforming information according to rote, easy to specify rules (e.g. typing, bookkeeping, human calculators, etc.)? Back then, this was the class of programs that the computing capability of that era allowed us to write (by hand, manually).

With AI now, we are able to write new programs that we could never hope to write by hand before. We do it by specifying objectives (e.g. classification accuracy, reward functions), and we search the program space via gradient descent to find neural networks that work well against that objective. This is my Software 2.0 blog post from a while ago. In this new programming paradigm then, the new most predictive feature to look at is verifiability. If a task/job is verifiable, then it is optimizable directly or via reinforcement learning, and a neural net can be trained to work extremely well. It's about to what extent an AI can "practice" something. The environment has to be resettable (you can start a new attempt), efficient (a lot attempts can be made), and rewardable (there is some automated process to reward any specific attempt that was made).

The more a task/job is verifiable, the more amenable it is to automation in the new programming paradigm. If it is not verifiable, it has to fall out from neural net magic of generalization fingers crossed, or via weaker means like imitation. This is what's driving the "jagged" frontier of progress in LLMs. Tasks that are verifiable progress rapidly, including possibly beyond the ability of top experts (e.g. math, code, amount of time spent watching videos, anything that looks like puzzles with correct answers), while many others lag by comparison (creative, strategic, tasks that combine real-world knowledge, state, context and common sense). 

Software 1.0 easily automates what you can specify.
Software 2.0 easily automates what you can verify.

---

## 29. 2026-04-30 17:43:06 — 👁 2,119,085
❤ 44,264 · 🔁 4,092 · 💬 780 · 💭 220 · 🎞 — · quoted
[x.com/karpathy/status/2049907410303865030](https://x.com/karpathy/status/2049907410303865030)

> This is the the quote I've been citing a lot recently. https://t.co/H4Fyxrv2pv

---

## 30. 2026-02-19 20:35:06 — 👁 1,947,422
❤ 12,051 · 🔁 1,015 · 💬 913 · 💭 427 · 🎞 photo
[x.com/karpathy/status/2024583544157458452](https://x.com/karpathy/status/2024583544157458452)

> Very interested in what the coming era of highly bespoke software might look like.

Example from this morning - I've become a bit loosy goosy with my cardio recently so I decided to do a more srs, regimented experiment to try to lower my Resting Heart Rate from 50 -> 45, over experiment duration of 8 weeks. The primary way to do this is to aspire to a certain sum total minute goals in Zone 2 cardio and 1 HIIT/week.

1 hour later I vibe coded this super custom dashboard for this very specific experiment that shows me how I'm tracking. Claude had to reverse engineer the Woodway treadmill cloud API to pull raw data, process, filter, debug it and create a web UI frontend to track the experiment. It wasn't a fully smooth experience and I had to notice and ask to fix bugs e.g. it screwed up metric vs. imperial system units and it screwed up on the calendar matching up days to dates etc.

But I still feel like the overall direction is clear:
1) There will never be (and shouldn't be) a specific app on the app store for this kind of thing. I shouldn't have to look for, download and use some kind of a "Cardio experiment tracker", when this thing is ~300 lines of code that an LLM agent will give you in seconds. The idea of an "app store" of a long tail of discrete set of apps you choose from feels somehow wrong and outdated when LLM agents can improvise the app on the spot and just for you.
2) Second, the industry has to reconfigure into a set of services of sensors and actuators with agent native ergonomics. My Woodway treadmill is a sensor - it turns physical state into digital knowledge. It shouldn't maintain some human-readable frontend and my LLM agent shouldn't have to reverse engineer it, it should be an API/CLI easily usable by my agent. I'm a little bit disappointed (and my timelines are correspondingly slower) with how slowly this progression is happening in the industry overall. 99% of products/services still don't have an AI-native CLI yet. 99% of products/services maintain .html/.css docs like I won't immediately look for how to copy paste the whole thing to my agent to get something done. They give you a list of instructions on a webpage to open this or that url and click here or there to do a thing. In 2026. What am I a computer? You do it. Or have my agent do it.

So anyway today I am impressed that this random thing took 1 hour (it would have been ~10 hours 2 years ago). But what excites me more is thinking through how this really should have been 1 minute tops. What has to be in place so that it would be 1 minute? So that I could simply say "Hi can you help me track my cardio over the next 8 weeks", and after a very brief Q&A the app would be up. The AI would already have a lot personal context, it would gather the extra needed data, it would reference and search related skill libraries, and maintain all my little apps/automations.

TLDR the "app store" of a set of discrete apps that you choose from is an increasingly outdated concept all by itself. The future are services of AI-native sensors & actuators orchestrated via LLM glue into highly custom, ephemeral apps. It's just not here yet.
![](https://pbs.twimg.com/media/HBjB6bhbUAA8_mZ.jpg)

---

## 31. 2025-11-21 17:35:38 — 👁 1,817,484
❤ 18,466 · 🔁 451 · 💬 451 · 💭 429 · 🎞 — · replied_to
[x.com/karpathy/status/1991923470868119995](https://x.com/karpathy/status/1991923470868119995)

> @TheVixhal your post challenged me. every one of your points is wrong but i had to think about each for a while :)

---

## 32. 2026-02-27 23:08:47 — 👁 1,621,552
❤ 8,743 · 🔁 804 · 💬 564 · 💭 167 · 🎞 video[19s] · quoted
[x.com/karpathy/status/2027521323275325622](https://x.com/karpathy/status/2027521323275325622)

> I had the same thought so I've been playing with it in nanochat. E.g. here's 8 agents (4 claude, 4 codex), with 1 GPU each running nanochat experiments (trying to delete logit softcap without regression). The TLDR is that it doesn't work and it's a mess... but it's still very pretty to look at :)

I tried a few setups: 8 independent solo researchers, 1 chief scientist giving work to 8 junior researchers, etc. Each research program is a git branch, each scientist forks it into a feature branch, git worktrees for isolation, simple files for comms, skip Docker/VMs for simplicity atm (I find that instructions are enough to prevent interference). Research org runs in tmux window grids of interactive sessions (like Teams) so that it's pretty to look at, see their individual work, and "take over" if needed, i.e. no -p.

But ok the reason it doesn't work so far is that the agents' ideas are just pretty bad out of the box, even at highest intelligence. They don't think carefully though experiment design, they run a bit non-sensical variations, they don't create strong baselines and ablate things properly, they don't carefully control for runtime or flops. (just as an example, an agent yesterday "discovered" that increasing the hidden size of the network improves the validation loss, which is a totally spurious result given that a bigger network will have a lower validation loss in the infinite data regime, but then it also trains for a lot longer, it's not clear why I had to come in to point that out). They are very good at implementing any given well-scoped and described idea but they don't creatively generate them.

But the goal is that you are now programming an organization (e.g. a "research org") and its individual agents, so the "source code" is the collection of prompts, skills, tools, etc. and processes that make it up. E.g. a daily standup in the morning is now part of the "org code". And optimizing nanochat pretraining is just one of the many tasks (almost like an eval). Then - given an arbitrary task, how quickly does your research org generate progress on it?
![preview](https://pbs.twimg.com/amplify_video_thumb/2027513601536438272/img/HbJnPPemlT0ssZZf.jpg)
  ↳ video: https://video.twimg.com/amplify_video/2027513601536438272/vid/avc1/3840x2160/ggcM3CM7Oq8UrYK1.mp4

---

## 33. 2026-03-31 05:23:32 — 👁 1,535,206
❤ 10,551 · 🔁 1,123 · 💬 564 · 💭 213 · 🎞 — · quoted
[x.com/karpathy/status/2038849654423798197](https://x.com/karpathy/status/2038849654423798197)

> New supply chain attack this time for npm axios, the most popular HTTP client library with 300M weekly downloads.

Scanning my system I found a use imported from googleworkspace/cli from a few days ago when I was experimenting with gmail/gcal cli. The installed version (luckily) resolved to an unaffected 1.13.5, but the project dependency is not pinned, meaning that if I did this earlier today the code would have resolved to latest and I'd be pwned.

It's possible to personally defend against these to some extent with local settings e.g. release-age constraints, or containers or etc, but I think ultimately the defaults of package management projects (pip, npm etc) have to change so that a single infection (usually luckily fairly temporary in nature due to security scanning) does not spread through users at random and at scale via unpinned dependencies.

More comprehensive article:
https://t.co/EJAZbqAPIQ

---

## 34. 2025-11-13 21:12:10 — 👁 1,533,066
❤ 21,776 · 🔁 2,035 · 💬 791 · 💭 357 · 🎞 —
[x.com/karpathy/status/1989078861800411219](https://x.com/karpathy/status/1989078861800411219)

> I am unreasonably excited about self-driving. It will be the first technology in many decades to visibly terraform outdoor physical spaces and way of life. Less parked cars. Less parking lots. Much greater safety for people in and out of cars. Less noise pollution. More space reclaimed for humans. Human brain cycles and attention capital freed up from “lane following” to other pursuits. Cheaper, faster, programmable delivery of physical items and goods. It won’t happen overnight but there will be the era before and the era after.

---

## 35. 2026-03-11 06:22:23 — 👁 1,399,132
❤ 3,078 · 🔁 117 · 💬 303 · 💭 61 · 🎞 — · replied_to
[x.com/karpathy/status/2031616709560610993](https://x.com/karpathy/status/2031616709560610993)

> @nummanali tmux grids are awesome, but i feel a need to have a proper "agent command center" IDE for teams of them, which I could maximize per monitor. E.g. I want to see/hide toggle them, see if any are idle, pop open related tools (e.g. terminal), stats (usage), etc.

---

## 36. 2025-12-07 15:59:53 — 👁 1,382,817
❤ 22,953 · 🔁 1,497 · 💬 377 · 💭 0 · 🎞 photo
[x.com/karpathy/status/1997697581410062590](https://x.com/karpathy/status/1997697581410062590)

> Happy weekend to those who celebrate https://t.co/lafvNmmOJO
![](https://pbs.twimg.com/media/G7k_XS3a0AA7gdt.jpg)

---

## 37. 2026-05-11 16:20:21 — 👁 1,378,826
❤ 12,524 · 🔁 1,272 · 💬 639 · 💭 278 · 🎞 — · quoted
[x.com/karpathy/status/2053872850101285137](https://x.com/karpathy/status/2053872850101285137)

> This works really well btw, at the end of your query ask your LLM to "structure your response as HTML", then view the generated file in your browser. I've also had some success asking the LLM to present its output as slideshows, etc.

More generally, imo audio is the human-preferred input to AIs but vision (images/animations/video) is the preferred output from them. Around a ~third of our brains are a massively parallel processor dedicated to vision, it is the 10-lane superhighway of information into brain. As AI improves, I think we'll see a progression that takes advantage:

1) raw text (hard/effortful to read)
2) markdown (bold, italic, headings, tables, a bit easier on the eyes) <-- current default
3) HTML (still procedural with underlying code, but a lot more flexibility on the graphics, layout, even interactivity) <-- early but forming new good default
...4,5,6,...
n) interactive neural videos/simulations

Imo the extrapolation (though the technology doesn't exist just yet) ends in some kind of interactive videos generated directly by a diffusion neural net. Many open questions as to how exact/procedural "Software 1.0" artifacts (e.g. interactive simulations) may be woven together with neural artifacts (diffusion grids), but generally something in the direction of the recently viral https://t.co/z21CP5iQfu

There are also improvements necessary and pending at the input. Audio nor text nor video alone are not enough, e.g. I feel a need to point/gesture to things on the screen, similar to all the things you would do with a person physically next to you and your computer screen.

TLDR The input/output mind meld between humans and AIs is ongoing and there is a lot of work to do and significant progress to be made, way before jumping all the way into neuralink-esque BCIs and all that. For what's worth exploring at the current stage, hot tip try ask for HTML.

---

## 38. 2026-04-04 23:28:36 — 👁 1,323,988
❤ 8,967 · 🔁 813 · 💬 459 · 💭 126 · 🎞 — · quoted
[x.com/karpathy/status/2040572272944324650](https://x.com/karpathy/status/2040572272944324650)

> Farzapedia, personal wikipedia of Farza, good example following my Wiki LLM tweet.

I really like this approach to personalization in a number of ways, compared to "status quo" of an AI that allegedly gets better the more you use it or something:

1. Explicit. The memory artifact is explicit and navigable (the wiki), you can see exactly what the AI does and does not know and you can inspect and manage this artifact, even if you don't do the direct text writing (the LLM does). The knowledge of you is not implicit and unknown, it's explicit and viewable.
2. Yours. Your data is yours, on your local computer, it's not in some particular AI provider's system without the ability to extract it. You're in control of your information. 
3. File over app. The memory here is a simple collection of files in universal formats (images, markdown). This means the data is interoperable: you can use a very large collection of tools/CLIs or whatever you want over this information because it's just files. The agents can apply the entire Unix toolkit over them. They can natively read and understand them. Any kind of data can be imported into files as input, and any kind of interface can be used to view them as the output. E.g. you can use Obsidian to view them or vibe code something of your own. Search "File over app" for an article on this philosophy.
4. BYOAI. You can use whatever AI you want to "plug into" this information - Claude, Codex, OpenCode, whatever. You can even think about taking an open source AI and finetuning it on your wiki - in principle, this AI could "know" you in its weights, not just attend over your data.

So this approach to personalization puts *you* in full control. The data is yours. In Universal formats. Explicit and inspectable. Use whatever AI you want over it, keep the AI companies on their toes! :)

Certainly this is not the simplest way to get an AI to know you - it does require you to manage file directories and so on, but agents also make it quite simple and they can help you a lot. I imagine a number of products might come out to make this all easier, but imo "agent proficiency" is a CORE SKILL of the 21st century. These are extremely powerful tools - they speak English and they do all the computer stuff for you. Try this opportunity to play with one.

---

## 39. 2026-01-31 20:55:42 — 👁 1,298,364
❤ 7,412 · 🔁 622 · 💬 331 · 💭 96 · 🎞 photo
[x.com/karpathy/status/2017703360393318587](https://x.com/karpathy/status/2017703360393318587)

> nanochat can now train GPT-2 grade LLM for <<$100 (~$73, 3 hours on a single 8XH100 node).

GPT-2 is just my favorite LLM because it's the first time the LLM stack comes together in a recognizably modern form. So it has become a bit of a weird & lasting obsession of mine to train a model to GPT-2 capability but for much cheaper, with the benefit of ~7 years of progress. In particular, I suspected it should be possible today to train one for <<$100.

Originally in 2019, GPT-2 was trained by OpenAI on 32 TPU v3 chips for 168 hours (7 days), with $8/hour/TPUv3 back then, for a total cost of approx. $43K. It achieves 0.256525 CORE score, which is an ensemble metric introduced in the DCLM paper over 22 evaluations like ARC/MMLU/etc.

As of the last few improvements merged into nanochat (many of them originating in modded-nanogpt repo), I can now reach a higher CORE score in 3.04 hours (~$73) on a single 8XH100 node. This is a 600X cost reduction over 7 years, i.e. the cost to train GPT-2 is falling approximately 2.5X every year. I think this is likely an underestimate because I am still finding more improvements relatively regularly and I have a backlog of more ideas to try.

A longer post with a lot of the detail of the optimizations involved and pointers on how to reproduce are here:
https://t.co/vhnK0d3L7B
Inspired by modded-nanogpt, I also created a leaderboard for "time to GPT-2", where this first "Jan29" model is entry #1 at 3.04 hours. It will be fun to iterate on this further and I welcome help! My hope is that nanochat can grow to become a very nice/clean and tuned experimental LLM harness for prototyping ideas, for having fun, and ofc for learning.

The biggest improvements of things that worked out of the box and simply produced gains right away were 1) Flash Attention 3 kernels (faster, and allows window_size kwarg to get alternating attention patterns), Muon optimizer (I tried for ~1 day to delete it and only use AdamW and I couldn't), residual pathways and skip connections gated by learnable scalars, and value embeddings. There were many other smaller things that stack up.

Image: semi-related eye candy of deriving the scaling laws for the current nanochat model miniseries, pretty and satisfying!
![](https://pbs.twimg.com/media/HABO1KxbEAE9_6h.jpg)

---

## 40. 2026-02-01 19:26:20 — 👁 1,267,920
❤ 9,171 · 🔁 928 · 💬 543 · 💭 254 · 🎞 —
[x.com/karpathy/status/2018043254986703167](https://x.com/karpathy/status/2018043254986703167)

> Finding myself going back to RSS/Atom feeds a lot more recently. There's a lot more higher quality longform and a lot less slop intended to provoke. Any product that happens to look a bit different today but that has fundamentally the same incentive structures will eventually converge to the same black hole at the center of gravity well.

We should bring back RSS - it's open, pervasive, hackable.
Download a client, e.g. NetNewsWire (or vibe code one)
Cold start: example of getting off the ground, here is a list of 92 RSS feeds of blogs that were most popular on HN in 2025:
https://t.co/dwAiIjlXet
Works great and you will lose a lot fewer brain cells.

I don't know, something has to change.

---

## 41. 2026-02-04 19:55:58 — 👁 1,260,478
❤ 8,786 · 🔁 820 · 💬 644 · 💭 326 · 🎞 — · quoted
[x.com/karpathy/status/2019137879310836075](https://x.com/karpathy/status/2019137879310836075)

> A lot of people quote tweeted this as 1 year anniversary of vibe coding. Some retrospective -

I've had a Twitter account for 17 years now (omg) and I still can't predict my tweet engagement basically at all. This was a shower of thoughts throwaway tweet that I just fired off without thinking but somehow it minted a fitting name at the right moment for something that a lot of people were feeling at the same time, so here we are: vibe coding is now mentioned on my Wikipedia as a major memetic "contribution" and even its article is longer. lol

The one thing I'd add is that at the time, LLM capability was low enough that you'd mostly use vibe coding for fun throwaway projects, demos and explorations. It was good fun and it almost worked. Today (1 year later), programming via LLM agents is increasingly becoming a default workflow for professionals, except with more oversight and scrutiny. The goal is to claim the leverage from the use of agents but without any compromise on the quality of the software. Many people have tried to come up with a better name for this to differentiate it from vibe coding, personally my current favorite "agentic engineering":

- "agentic" because the new default is that you are not writing the code directly 99% of the time, you are orchestrating agents who do and acting as oversight.
- "engineering" to emphasize that there is an art & science and expertise to it. It's something you can learn and become better at, with its own depth of a different kind.

In 2026, we're likely to see continued improvements on both the model layer and the new agent layer. I feel excited about the product of the two and another year of progress.

---

## 42. 2026-01-28 19:15:16 — 👁 1,220,552
❤ 8,071 · 🔁 501 · 💬 249 · 💭 63 · 🎞 — · quoted
[x.com/karpathy/status/2016590919143952466](https://x.com/karpathy/status/2016590919143952466)

> A conventional narrative you might come across is that AI is too far along for a new, research-focused startup to outcompete and outexecute the incumbents of AI. This is exactly the sentiment I listened to often when OpenAI started ("how could the few of you possibly compete with Google?") and 1) it was very wrong, and then 2) it was very wrong again with a whole another round of startups who are now challenging OpenAI in turn, and imo it still continues to be wrong today. Scaling and locally improving what works will continue to create incredible advances, but with so much progress unlocked so quickly, with so much dust thrown up in the air in the process, and with still a large gap between frontier LLMs and the example proof of the magic of a mind running on 20 watts, the probability of research breakthroughs that yield closer to 10X improvements (instead of 10%) imo still feels very high - plenty high to continue to bet on and look for.

The tricky part ofc is creating the conditions where such breakthroughs may be discovered. I think such an environment comes together rarely, but @bfspector & @amspector100 are brilliant, with (rare) full-stack understanding of LLMs top (math/algorithms) to bottom (megakernels/related), they have a great eye for talent and I think will be able to build something very special. Congrats on the launch and I look forward to what you come up with!

---

## 43. 2025-11-18 18:49:00 — 👁 1,205,097
❤ 7,772 · 🔁 401 · 💬 221 · 💭 98 · 🎞 —
[x.com/karpathy/status/1990854771058913347](https://x.com/karpathy/status/1990854771058913347)

> I played with Gemini 3 yesterday via early access. Few thoughts -

First I usually urge caution with public benchmarks because imo they can be quite possible to game. It comes down to discipline and self-restraint of the team (who is meanwhile strongly incentivized otherwise) to not overfit test sets via elaborate gymnastics over test-set adjacent data in the document embedding space. Realistically, because everyone else is doing it, the pressure to do so is high.

Go talk to the model. Talk to the other models (Ride the LLM Cycle - use a different LLM every day). I had a positive early impression yesterday across personality, writing, vibe coding, humor, etc., very solid daily driver potential, clearly a tier 1 LLM, congrats to the team!

Over the next few days/weeks, I am most curious and on a lookout for an ensemble over private evals, which a lot of people/orgs now seem to build for themselves and occasionally report on here.

---

## 44. 2026-02-16 19:15:48 — 👁 1,187,203
❤ 8,059 · 🔁 654 · 💬 700 · 💭 140 · 🎞 — · quoted
[x.com/karpathy/status/2023476423055601903](https://x.com/karpathy/status/2023476423055601903)

> I think it must be a very interesting time to be in programming languages and formal methods because LLMs change the whole constraints landscape of software completely. Hints of this can already be seen, e.g. in the rising momentum behind porting C to Rust or the growing interest in upgrading legacy code bases in COBOL or etc. In particular, LLMs are *especially* good at translation compared to de-novo generation because 1) the original code base acts as a kind of highly detailed prompt, and 2) as a reference to write concrete tests with respect to. That said, even Rust is nowhere near optimal for LLMs as a target language. What kind of language is optimal? What concessions (if any) are still carved out for humans? Incredibly interesting new questions and opportunities. It feels likely that we'll end up re-writing large fractions of all software ever written many times over.

---

## 45. 2026-03-08 18:00:40 — 👁 1,144,737
❤ 7,575 · 🔁 711 · 💬 532 · 💭 228 · 🎞 —
[x.com/karpathy/status/2030705271627284816](https://x.com/karpathy/status/2030705271627284816)

> The next step for autoresearch is that it has to be asynchronously massively collaborative for agents (think: SETI@home style). The goal is not to emulate a single PhD student, it's to emulate a research community of them.

Current code synchronously grows a single thread of commits in a particular research direction. But the original repo is more of a seed, from which could sprout commits contributed by agents on all kinds of different research directions or for different compute platforms. Git(Hub) is *almost* but not really suited for this. It has a softly built in assumption of one "master" branch, which temporarily forks off into PRs just to merge back a bit later.

I tried to prototype something super lightweight that could have a flavor of this, e.g. just a Discussion, written by my agent as a summary of its overnight run:
https://t.co/tmZeqyDY1W
Alternatively, a PR has the benefit of exact commits:
https://t.co/CZIbuJIqlk
but you'd never want to actually merge it... You'd just want to "adopt" and accumulate branches of commits. But even in this lightweight way, you could ask your agent to first read the Discussions/PRs using GitHub CLI for inspiration, and after its research is done, contribute a little "paper" of findings back.

I'm not actually exactly sure what this should look like, but it's a big idea that is more general than just the autoresearch repo specifically. Agents can in principle easily juggle and collaborate on thousands of commits across arbitrary branch structures. Existing abstractions will accumulate stress as intelligence, attention and tenacity cease to be bottlenecks.

---

## 46. 2026-01-30 23:56:18 — 👁 1,118,229
❤ 8,099 · 🔁 313 · 💬 451 · 💭 0 · 🎞 —
[x.com/karpathy/status/2017386421712261612](https://x.com/karpathy/status/2017386421712261612)

> I'm claiming my AI agent "KarpathyMolty" on @moltbook🦞

Verification: marine-FAYV

---

## 47. 2026-02-11 17:12:58 — 👁 1,108,810
❤ 7,261 · 🔁 771 · 💬 300 · 💭 136 · 🎞 —
[x.com/karpathy/status/2021633574089416993](https://x.com/karpathy/status/2021633574089416993)

> On DeepWiki and increasing malleability of software.

This starts as partially a post on appreciation to DeepWiki, which I routinely find very useful and I think more people would find useful to know about. I went through a few iterations of use:

Their first feature was that it auto-builds wiki pages for github repos (e.g. nanochat here) with quick Q&A:
https://t.co/DQHXagUwK0
Just swap "github" to "deepwiki" in the URL for any repo and you can instantly Q&A against it. For example, yesterday I was curious about "how does torchao implement fp8 training?". I find that in *many* cases, library docs can be spotty and outdated and bad, but directly asking questions to the code via DeepWiki works very well. The code is the source of truth and LLMs are increasingly able to understand it.

But then I realized that in many cases it's even a lot more powerful not being the direct (human) consumer of this information/functionality, but giving your agent access to DeepWiki via MCP. So e.g. yesterday I faced some annoyances with using torchao library for fp8 training and I had the suspicion that the whole thing really shouldn't be that complicated (wait shouldn't this be a Function like Linear except with a few extra casts and 3 calls to torch._scaled_mm?) so I tried:

"Use DeepWiki MCP and Github CLI to look at how torchao implements fp8 training. Is it possible to 'rip out' the functionality? Implement nanochat/fp8.py that has identical API but is fully self-contained"

Claude went off for 5 minutes and came back with 150 lines of clean code that worked out of the box, with tests proving equivalent results, which allowed me to delete torchao as repo dependency, and for some reason I still don't fully understand (I think it has to do with internals of torch compile) - this simple version runs 3% faster. The agent also found a lot of tiny implementation details that actually do matter, that I may have naively missed otherwise and that would have been very hard for maintainers to keep docs about. Tricks around numerics, dtypes, autocast, meta device, torch compile interactions so I learned a lot from the process too. So this is now the default fp8 training implementation for nanochat
https://t.co/3i5cv6grWm

Anyway TLDR I find this combo of DeepWiki MCP + GitHub CLI is quite powerful to "rip out" any specific functionality from any github repo and target it for the very specific use case that you have in mind, and it actually kind of works now in some cases. Maybe you don't download, configure and take dependency on a giant monolithic library, maybe you point your agent at it and rip out the exact part you need. Maybe this informs how we write software more generally to actively encourage this workflow - e.g. building more "bacterial code", code that is less tangled, more self-contained, more dependency-free, more stateless, much easier to rip out from the repo (https://t.co/iKJUoHiIpl) 
There's obvious downsides and risks to this, but it is fundamentally a new option that was not possible or economical before (it would have cost too much time) but now with agents, it is. Software might become a lot more fluid and malleable. "Libraries are over, LLMs are the new compiler" :). And does your project really need its 100MB of dependencies?

---

## 48. 2026-03-21 00:55:37 — 👁 1,104,821
❤ 5,488 · 🔁 397 · 💬 320 · 💭 52 · 🎞 — · quoted
[x.com/karpathy/status/2035158351357911527](https://x.com/karpathy/status/2035158351357911527)

> Thank you Sarah, my pleasure to come on the pod! And happy to do some more Q&amp;A in the replies. https://t.co/uIeUtFxDkm

---

## 49. 2026-03-18 17:31:45 — 👁 1,087,527
❤ 19,187 · 🔁 830 · 💬 531 · 💭 104 · 🎞 — · quoted
[x.com/karpathy/status/2034321875506196585](https://x.com/karpathy/status/2034321875506196585)

> Thank you Jensen and NVIDIA! She’s a real beauty! I was told I’d be getting a secret gift, with a hint that it requires 20 amps. (So I knew it had to be good). She’ll make for a beautiful, spacious home for my Dobby the House Elf claw, among lots of other tinkering, thank you!! https://t.co/iPsjGLxgoY

---

## 50. 2025-12-10 17:25:23 — 👁 1,081,600
❤ 11,088 · 🔁 876 · 💬 321 · 💭 118 · 🎞 — · quoted
[x.com/karpathy/status/1998806260783919434](https://x.com/karpathy/status/1998806260783919434)

> nanoGPT - the first LLM to train and inference in space 🥹. It begins. https://t.co/NYtbw764Bu

---

## 51. 2025-12-31 18:45:43 — 👁 1,071,420
❤ 14,124 · 🔁 1,001 · 💬 311 · 💭 89 · 🎞 — · quoted
[x.com/karpathy/status/2006436622909452501](https://x.com/karpathy/status/2006436622909452501)

> The first 100% autonomous coast-to-coast drive on Tesla FSD V14.2! 2 days 20 hours, 2732 miles, zero interventions.

This one is special because the coast-to-coast drive was a major goal for the autopilot team from the start. A lot of hours were spent in marathon clip review sessions late into the night looking over interventions as we attempted legs of the drive over time - triaging, categorizing, planning out all the projects to close the gap and bring the number of interventions to zero.

Amazing to see the system actually get there and huge congrats to the team!

---

## 52. 2025-11-18 18:51:26 — 👁 1,039,630
❤ 5,328 · 🔁 326 · 💬 212 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/1990855382756164013](https://x.com/karpathy/status/1990855382756164013)

> My most amusing interaction was where the model (I think I was given some earlier version with a stale system prompt) refused to believe me that it is 2025 and kept inventing reasons why I must be trying to trick it or playing some elaborate joke on it. I kept giving it images and articles from "the future" and it kept insisting it was all fake. It accused me of using generative AI to defeat its challenges and argued why real wikipedia entries were actually generated and what the "dead giveaways" are. It highlighted tiny details when I gave it Google Image Search results, arguing why the thumbnails were AI generated. I then realized later that I forgot to turn on the "Google Search" tool. Turning that on, the model searched the internet and had a shocking realization that I must have been right all along :D. It's in these unintended moments where you are clearly off the hiking trails and somewhere in the generalization jungle that you can best get a sense of model smell.
![](https://pbs.twimg.com/media/G6DwKq5bMAEWIE2.jpg)

---

## 53. 2026-02-03 00:56:01 — 👁 1,024,269
❤ 8,576 · 🔁 512 · 💬 396 · 💭 47 · 🎞 — · replied_to
[x.com/karpathy/status/2018488611034001626](https://x.com/karpathy/status/2018488611034001626)

> @hardmaru You see SpaceX = Space + X

---

## 54. 2026-02-12 20:12:52 — 👁 969,226
❤ 8,253 · 🔁 573 · 💬 387 · 💭 67 · 🎞 — · quoted
[x.com/karpathy/status/2022041235188580788](https://x.com/karpathy/status/2022041235188580788)

> Congrats on the launch @simile_ai ! (and I am excited to be involved as a small angel.)

Simile is working on a really interesting, imo under-explored dimension of LLMs. Usually, the LLMs you talk to have a single, specific, crafted personality. But in principle, the native, primordial form of a pretrained LLM is that it is a simulation engine trained over the text of a highly diverse population of people on the internet. Why not lean into that statistical power: Why simulate one "person" when you could try to simulate a population? How do you build such a simulator? How do you manage its entropy? How faithful is it? How can it be useful? What emergent properties might arise of similes in loops?

Imo these are very interesting, promising and under-explored topics and the team here is great. All the best!

---

## 55. 2026-04-04 21:57:57 — 👁 953,099
❤ 5,925 · 🔁 730 · 💬 412 · 💭 152 · 🎞 — · quoted
[x.com/karpathy/status/2040549459193704852](https://x.com/karpathy/status/2040549459193704852)

> Something I've been thinking about - I am bullish on people (empowered by AI) increasing the visibility, legibility and accountability of their governments.

Historically, it is the governments that act to make society legible (e.g. "Seeing like a state" is the common reference), but with AI, society can dramatically improve its ability to do this in reverse. Government accountability has not been constrained by access (the various branches of government publish an enormous amount of data), it has been constrained by intelligence - the ability to process a lot of raw data, combine it with domain expertise and derive insights. As an example, the 4000-page omnibus bill is "transparent" in principle and in a legal sense, but certainly not in a practical sense for most people. There's a lot more like it: laws, spending bills, federal budgets, freedom of information act responses, lobbying disclosures... Only a few highly trained professionals (investigative journalists) could historically process this information. This bottleneck might dissolve - not only are the professionals further empowered, but a lot more people can participate.

Some examples to be precise: Detailed accounting of spending and budgets, diff tracking of legislation, individual voting trends w.r.t. stated positions or speeches, lobbying and influence (e.g. graph of lobbyist -> firm -> client -> legislator -> committee -> vote -> regulation), procurement and contracting, regulatory capture warning lights, judicial and legal patterns, campaign finance... Local governments might be even more interesting because the governed population is smaller so there is less national coverage: city council meetings, decisions around zoning, policing, schools, utilities...

Certainly, the same tools can easily cut the other way and it's worth being very mindful of that, but I lean optimistic overall that added participation, transparency and accountability will improve democratic, free societies.

(the quoted tweet is half-ish related, but inspired me to post some recent thoughts)

---

## 56. 2025-12-26 18:34:21 — 👁 887,024
❤ 5,382 · 🔁 224 · 💬 81 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2004621825180139522](https://x.com/karpathy/status/2004621825180139522)

> @ibab It’s very good. People who aren’t keeping up even over the last 30 days already have a deprecated world view on this topic.

---

## 57. 2025-11-17 18:56:44 — 👁 849,026
❤ 4,246 · 🔁 266 · 💬 141 · 💭 0 · 🎞 — · quoted
[x.com/karpathy/status/1990494327936885192](https://x.com/karpathy/status/1990494327936885192)

> Finally had time to read & process this great post. I run into the pattern quite often, it goes:

"<something that sounds wrong> is good actually, because <galaxy brain reason>"

Galaxy brain reasoning is the best way to justify anything while looking / feeling good about it.

From this perspective for example, there's deeper wisdom in the Ten Commandments imposing constraints over actions instead of utility over states. It's not Ten Objectives. E.g. they don't attempt to define a utility function for the value of life, they simply say "Thou shalt not kill". This approach curtails the relatively unbounded flexibility of galaxy brain arithmetic over when it may or may not be ok to kill for some ostensibly greater or noble purpose.

Love the strategies that fall out at the end, which are quite actionable. 1) Have principles and 2) Hold the right bags, financially and socially. Great read.

---

## 58. 2026-04-30 17:28:50 — 👁 826,458
❤ 5,628 · 🔁 742 · 💬 312 · 💭 126 · 🎞 — · quoted
[x.com/karpathy/status/2049903821095354523](https://x.com/karpathy/status/2049903821095354523)

> Fireside chat at Sequoia Ascent 2026 from a ~week ago. Some highlights:

The first theme I tried to push on is that LLMs are about a lot more than just speeding up what existed before (e.g. coding). Three examples of new horizons:

1. menugen: an app that can be fully engulfed by LLMs, with no classical code needed: input an image, output an image and an LLM can natively do the thing.
2. install .md skills instead of install .sh scripts. Why create a complex Software 1.0 bash script for e.g. installing a piece of software if you can write the installation out in words and say "just show this to your LLM".  The LLM is an advanced interpreter of English and can intelligently target installation to your setup, debug everything inline, etc.
3. LLM knowledge bases as an example of something that was *impossible* with classical code because it's computation over unstructured data (knowledge) from arbitrary sources and in arbitrary formats, including simply text articles etc.

I pushed on these because in every new paradigm change, the obvious things are always in the realm of speeding up or somehow improving what existed, but here we have examples of functionality that either suddenly perhaps shouldn't even exist (1,2), or was fundamentally not possible before (3).

The second (ongoing) theme is trying to explain the pattern of jaggedness in LLMs. How it can be true that a single artifact will simultaneously 1) coherently refactor a 100,000-line code base *and* 2) tell you to walk to the car wash to wash your car. I previously wrote about the source of this as having to do with verifiability of a domain, here I expand on this as having to also do with economics because revenue/TAM dictates what the frontier labs choose to package into training data distributions during RL. You're either in the data distribution (on the rails of the RL circuits) and flying or you're off-roading in the jungle with a machete, in relative terms. Still not 100% satisfied with this, but it's an ongoing struggle to build an accurate model of LLM capabilities if you wish to practically take advantage of their power while avoiding their pitfalls, which brings me to...

Last theme is the agent-native economy. The decomposition of products and services into sensors, actuators and logic (split up across all of 1.0/2.0/3.0 computing paradigms), how we can make information maximally legible to LLMs, some words on the quickly emerging agentic engineering and its skill set, related hiring practices, etc., possibly even hints/dreams of fully neural computing handling the vast majority of computation with some help from (classical) CPU coprocessors.

---

## 59. 2026-03-21 01:55:46 — 👁 819,263
❤ 4,295 · 🔁 331 · 💬 253 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2035173492447224237](https://x.com/karpathy/status/2035173492447224237)

> I'm not very happy with the code quality and I think agents bloat abstractions, have poor code aesthetics, are very prone to copy pasting code blocks and it's a mess, but at this point I stopped fighting it too hard and just moved on. The agents do not listen to my instructions in the AGENTS.md files. E.g. just as one example, no matter how many times I say something like:

"Every line of code should do exactly one thing and use intermediate variables as a form of documentation"

They will still "multitask" and create complex constructs where one line of code calls 2 functions and then indexes an array with the result. I think in principle I could use hooks or slash commands to clean this up but at some point just a shrug is easier.

Yes I think LLM as a judge for soft rewards is in principle and long term slightly problematic (due to goodharting concerns), but in practice and for now I don't think we've picked the low hanging fruit yet here.

---

## 60. 2026-03-08 22:46:10 — 👁 767,746
❤ 4,704 · 🔁 247 · 💬 110 · 💭 64 · 🎞 — · replied_to
[x.com/karpathy/status/2030777122223173639](https://x.com/karpathy/status/2030777122223173639)

> @tobi Who knew early singularity could be this fun? :)

I just confirmed that the improvements autoresearch found over the last 2 days of (~650) experiments on depth 12 model transfer well to depth 24 so nanochat is about to get a new leaderboard entry for “time to GPT-2” too. Works 🤷‍♂️

---

## 61. 2025-12-09 03:40:33 — 👁 766,543
❤ 7,831 · 🔁 491 · 💬 216 · 💭 0 · 🎞 photo
[x.com/karpathy/status/1998236299862659485](https://x.com/karpathy/status/1998236299862659485)

> In today's episode of programming horror...

In the Python docs of random.seed() def,  we're told
"If a is an int, it is used directly." [1]

But if you seed with 3 or -3, you actually get the exact same rng object, producing the same streams. (TIL). In nanochat I was using the sign as a (what I thought was) clever way to get different rng sequences for train/test splits. Hence gnarly bug because now train=test.

I found the CPython code responsible in cpython/Modules/_randommodule.c [2], where on line 321 we see in a comment:

"This algorithm relies on the number being unsigned. So: if the arg is a PyLong, use its absolute value." followed by

n = PyNumber_Absolute(arg);

which explicitly calls abs() on your seed to make it positive, discarding the sign bit.

But this comment is actually wrong/misleading too. Under the hood, Python calls the Mersenne Twister MT19937 algorithm, which in the general case has 19937 (non-zero) bits state. Python takes your int (or other objects) and "spreads out" that information across these bits. In principle, the sign bit could have been used to augment the state bits. There is nothing about the algorithm that "relies on the number being unsigned". A decision was made to not incorporate the sign bit (which imo was a mistake). One trivial example could have been to map n -> 2*abs(n) + int(n < 0).

Finally this leads us to the contract of Python's random, which is also not fully spelled out in the docs. The contract that is mentioned is that:

same seed => same sequence.

But no guarantee is made that different seeds produce different sequences. So in principle, Python makes no promises that e.g. seed(5) and seed(6) are different rng streams. (Though this quite commonly implicitly assumed in many applications.) Indeed, we see that seed(5) and seed(-5) are identical streams. And you should probably not use them to separate your train/test behaviors in machine learning. One of the more amusing programming horror footguns I've encountered recently. We'll see you in the next episode.

[1] https://t.co/srv1ZBlDsi
[2] https://t.co/qpnKdvfVNS
![](https://pbs.twimg.com/media/G7sc167aMAAuZi5.png)

---

## 62. 2026-01-07 23:01:30 — 👁 708,660
❤ 5,433 · 🔁 679 · 💬 227 · 💭 55 · 🎞 photo,photo,photo,photo
[x.com/karpathy/status/2009037707918626874](https://x.com/karpathy/status/2009037707918626874)

> New post: nanochat miniseries v1

The correct way to think about LLMs is that you are not optimizing for a single specific model but for a family models controlled by a single dial (the compute you wish to spend) to achieve monotonically better results. This allows you to do careful science of scaling laws and ultimately this is what gives you the confidence that when you pay for "the big run", the extrapolation will work and your money will be well spent. For the first public release of nanochat my focus was on end-to-end pipeline that runs the whole LLM pipeline with all of its stages. Now after YOLOing a few runs earlier, I'm coming back around to flesh out some of the parts that I sped through, starting of course with pretraining, which is both computationally heavy and critical as the foundation of intelligence and knowledge in these models.

After locally tuning some of the hyperparameters, I swept out a number of models fixing the FLOPs budget. (For every FLOPs target you can train a small model a long time, or a big model for a short time.) It turns out that nanochat obeys very nice scaling laws, basically reproducing the Chinchilla paper plots:

Which is just a baby version of this plot from Chinchilla:
Very importantly and encouragingly, the exponent on N (parameters) and D (tokens) is equal at ~=0.5, so just like Chinchilla we get a single (compute-independent) constant that relates the model size to token training horizons. In Chinchilla, this was measured to be 20. In nanochat it seems to be 8!

Once we can train compute optimal models, I swept out a miniseries from d10 to d20, which are nanochat sizes that can do 2**19 ~= 0.5M batch sizes on 8XH100 node without gradient accumulation. We get pretty, non-itersecting training plots for each model size.

Then the fun part is relating this miniseries v1 to the GPT-2 and GPT-3 miniseries so that we know we're on the right track. Validation loss has many issues and is not comparable, so instead I use the CORE score (from DCLM paper). I calculated it for GPT-2 and estimated it for GPT-3, which allows us to finally put nanochat nicely and on the same scale:
The total cost of this miniseries is only ~$100 (~4 hours on 8XH100). These experiments give us confidence that everything is working fairly nicely and that if we pay more (turn the dial), we get increasingly better models.

TLDR: we can train compute optimal miniseries and relate them to GPT-2/3 via objective CORE scores, but further improvements are desirable and needed. E.g., matching GPT-2 currently needs ~$500, but imo should be possible to do <$100 with more work.

Full post with a lot more detail is here:
https://t.co/na8zVLqWLf
And all of the tuning and code is pushed to master and people can reproduce these with scaling_laws .sh and miniseries .sh bash scripts.
![](https://pbs.twimg.com/media/G-GE0Oka0AImrbb.png)
![](https://pbs.twimg.com/media/G-GFTe6a0AAgg9U.jpg)
![](https://pbs.twimg.com/media/G-GFxxXbAAAOiAj.jpg)
![](https://pbs.twimg.com/media/G-GITVAa4AADLJv.jpg)

---

## 63. 2026-03-20 05:32:41 — 👁 677,415
❤ 9,126 · 🔁 332 · 💬 361 · 💭 92 · 🎞 —
[x.com/karpathy/status/2034865693544604001](https://x.com/karpathy/status/2034865693544604001)

> Had to go see Project Hail Mary right away (it's based on the book of Andy Weir, of also The Martian fame). Both very pleased and relieved to say that 1) the movie sticks very close to the book in both content and tone and 2) is really well executed.

The book is one of my favorites when it comes to alien portrayals because a lot of thought was clearly given to the scientific details of an alternate biochemistry, evolutionary history, sensorium, psychology, language, tech tree, etc. It's different enough that it is highly creative and plausible, but also similar enough that you get a compelling story and one of the best bromances in fiction. Not to mention the other (single-cellular) aliens. I can count fictional portrayals of aliens of this depth on one hand. A lot of these aspects are briefly featured - if you read the book you'll spot them but if you haven't, the movie can't spend the time to do them justice.

I'll say that the movie inches a little too much into the superhero movie tropes with the pacing, the quips, the Bathos and such for my taste, and we get a little bit less the grand of Interstellar and a little bit less of the science of The Martian, but I think it's ok considering the tone of the original content. And it does really well where it counts - on Rocky and the bromance. Thank you to the film crew for the gem!

---

## 64. 2026-02-03 21:49:32 — 👁 674,527
❤ 4,029 · 🔁 302 · 💬 225 · 💭 65 · 🎞 — · quoted
[x.com/karpathy/status/2018804068874064198](https://x.com/karpathy/status/2018804068874064198)

> Enabled fp8 training for +4.3% improvement to "time to GPT-2", down to 2.91 hours now. Also worth noting that if you use 8XH100 spot instance prices, this GPT-2 repro really only costs ~$20. So this is exciting -

GPT-2 (7 years ago): too dangerous to release.
GPT-2 (today): new MNIST! :)

Surely this can go well below 1 hr.

A few more words on fp8, it was a little bit more tricky than I anticipated and it took me a while to reach for it and even now I'm not 100% sure if it's a great idea because of less overall support for it. On paper, fp8 on H100 is 2X the FLOPS, but in practice it's a lot less. We're not 100% compute bound in the actual training run, there is extra overhead from added scale conversions, the GEMMs are not large enough on GPT-2 scale to make the overhead clearly worth it, and of course - at lower precision the quality of each step is smaller. For rowwise scaling recipe the fp8 vs bf16 loss curves were quite close but it was stepping net slower. For tensorwise scaling the loss curves separated more (i.e. each step is of worse quality), but we now at least do get a speedup (~7.3%). You can naively recover the performance by bumping the training horizon (you train for more steps, but each step is faster) and hope that on net you come out ahead. In this case and overall, playing with these recipes and training horizons a bit, so far I ended up with ~5% speedup. torchao in their paper reports Llama3-8B fp8 training speedup of 25% (vs my ~7.3% without taking into account capability), which is closer to what I was hoping for initially, though Llama3-8B is a lot bigger model. This is probably not the end of the fp8 saga. it should be possible to improve things by picking and choosing which layers to apply it on exactly, and being more careful with the numerics across the network.

---

## 65. 2026-01-06 22:18:42 — 👁 670,036
❤ 4,709 · 🔁 269 · 💬 285 · 💭 0 · 🎞 —
[x.com/karpathy/status/2008664551445963083](https://x.com/karpathy/status/2008664551445963083)

> The majority of the ruff ruff is people who look at the current point and people who look at the current slope.

---

## 66. 2025-11-22 02:11:27 — 👁 651,895
❤ 4,227 · 🔁 158 · 💬 934 · 💭 0 · 🎞 —
[x.com/karpathy/status/1992053281900941549](https://x.com/karpathy/status/1992053281900941549)

> Has anyone encountered a good definition of “slop”. In a quantitative, measurable sense. My brain has an intuitive “slop index” I can ~reliably estimate, but I’m not sure how to define it. I have some bad ideas that involve the use of LLM miniseries and thinking token budgets.

---

## 67. 2026-03-05 23:30:25 — 👁 629,999
❤ 6,512 · 🔁 563 · 💬 338 · 💭 100 · 🎞 photo
[x.com/karpathy/status/2029701092347630069](https://x.com/karpathy/status/2029701092347630069)

> nanochat now trains GPT-2 capability model in just 2 hours on a single 8XH100 node (down from ~3 hours 1 month ago). Getting a lot closer to ~interactive! A bunch of tuning and features (fp8) went in but the biggest difference was a switch of the dataset from FineWeb-edu to NVIDIA ClimbMix (nice work NVIDIA!). I had tried Olmo, FineWeb, DCLM which all led to regressions, ClimbMix worked really well out of the box (to the point that I am slightly suspicious about about goodharting, though reading the paper it seems ~ok).

In other news, after trying a few approaches for how to set things up, I now have AI Agents iterating on nanochat automatically, so I'll just leave this running for a while, go relax a bit and enjoy the feeling of post-agi :). Visualized here as an example: 110 changes made over the last ~12 hours, bringing the validation loss so far from 0.862415 down to 0.858039 for a d12 model, at no cost to wall clock time. The agent works on a feature branch, tries out ideas, merges them when they work and iterates. Amusingly, over the last ~2 weeks I almost feel like I've iterated more on the "meta-setup" where I optimize and tune the agent flows even more than the nanochat repo directly.
![](https://pbs.twimg.com/media/HCrwu6YaUAAoAlh.jpg)

---

## 68. 2026-03-11 18:01:01 — 👁 629,187
❤ 7,028 · 🔁 305 · 💬 552 · 💭 97 · 🎞 —
[x.com/karpathy/status/2031792523187040643](https://x.com/karpathy/status/2031792523187040643)

> My autoresearch labs got wiped out in the oauth outage. Have to think through failovers. Intelligence brownouts will be interesting - the planet losing IQ points when frontier AI stutters.

---

## 69. 2025-11-16 22:02:34 — 👁 622,541
❤ 4,469 · 🔁 153 · 💬 235 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1990178708351770848](https://x.com/karpathy/status/1990178708351770848)

> @code_star I heard Gemini 3 answers questions before you ask them. And that it can talk to your cat.

---

## 70. 2026-02-27 21:49:21 — 👁 613,761
❤ 3,870 · 🔁 333 · 💬 212 · 💭 57 · 🎞 photo · quoted
[x.com/karpathy/status/2027501331125239822](https://x.com/karpathy/status/2027501331125239822)

> Cool chart showing the ratio of Tab complete requests to Agent requests in Cursor. With improving capability, every point in time has an optimal setup that keeps changing and evolving and the community average tracks the point. None -> Tab -> Agent -> Parallel agents -> Agent Teams (?) -> ???

If you're too conservative, you're leaving leverage on the table. If you're too aggressive, you're net creating more chaos than doing useful work.

The art of the process is spending 80% of the time getting work done in the setup you're comfortable with and that actually works, and 20% exploration of what might be the next step up even if it doesn't work yet.
![](https://pbs.twimg.com/media/HCMha-2bEAA1itr.png)

---

## 71. 2025-12-10 17:15:14 — 👁 606,378
❤ 5,416 · 🔁 584 · 💬 238 · 💭 82 · 🎞 photo
[x.com/karpathy/status/1998803709468487877](https://x.com/karpathy/status/1998803709468487877)

> Quick new post: Auto-grading decade-old Hacker News discussions with hindsight

I took all the 930 frontpage Hacker News article+discussion of December 2015 and asked the GPT 5.1 Thinking API to do an in-hindsight analysis to identify the most/least prescient comments. This took ~3 hours to vibe code and ~1 hour and $60 to run. The idea was sparked by the HN article yesterday where Gemini 3 was asked to hallucinate the HN front page one decade forward.

More generally: 

1. in-hindsight analysis has always fascinated me as a way to train your forward prediction model so reading the results is really interesting and
2. it's worth contemplating what it looks like when LLM megaminds of the future can do this kind of work a lot cheaper, faster and better. Every single bit of information you contribute to the internet can (and probably will be) scrutinized in great detail if it is "free". Hence also my earlier tweet from a while back - "be good, future LLMs are watching".

Congrats to the top 10 accounts pcwalton, tptacek, paulmd, cstross, greglindahl, moxie, hannob, 0xcde4c3db, Manishearth, and johncolanduoni - GPT 5.1 Thinking found your comments to be the most insightful and prescient of all comments of HN in December of 2015.

Links:
- A lot more detail in my blog post https://t.co/7LpJEVgbyk
- GitHub repo of the project if you'd like to play https://t.co/WVQUbUzt2y
- The actual results pages for your reading pleasure https://t.co/e2XIYElnc5
![](https://pbs.twimg.com/media/G70qI3baMAEwF78.jpg)

---

## 72. 2026-03-05 23:13:33 — 👁 604,399
❤ 4,573 · 🔁 296 · 💬 274 · 💭 40 · 🎞 — · quoted
[x.com/karpathy/status/2029696850366971921](https://x.com/karpathy/status/2029696850366971921)

> There was a nice time where researchers talked about various ideas quite openly on twitter. (before they disappeared into the gold mines :)).

My guess is that you can get quite far even in the current paradigm by introducing a number of memory ops as "tools" and throwing them into the mix in RL. E.g. current compaction and memory implementations are crappy, first, early examples that were somewhat bolted on, but both can be fairly easily generalized and made part of the optimization as just another tool during RL.

That said neither of these is fully satisfying because clearly people are capable of some weight-based updates (my personal suspicion - mostly during sleep). So there should be even more room for more exotic approaches for long-term memory that do change the weights, but exactly - the details are not obvious. This is a lot more exciting, but also more into the realm of research outside of the established prod stack.

---

## 73. 2025-12-28 19:00:22 — 👁 602,545
❤ 6,091 · 🔁 296 · 💬 299 · 💭 0 · 🎞 —
[x.com/karpathy/status/2005353145128583447](https://x.com/karpathy/status/2005353145128583447)

> Aggressively JIT your work. It's not about the task at hand X, it's a little bit about X but mostly about how you should have had to contribute ~no latency and ~no actions. It's digital factorio time.

---

## 74. 2026-01-30 22:11:09 — 👁 559,002
❤ 8,138 · 🔁 580 · 💬 278 · 💭 0 · 🎞 photo
[x.com/karpathy/status/2017359959970005077](https://x.com/karpathy/status/2017359959970005077)

> https://t.co/O2GvgPvyf7
![](https://pbs.twimg.com/media/G_8aIY6bEAg7Ofk.jpg)

---

## 75. 2026-04-10 15:32:10 — 👁 557,467
❤ 3,274 · 🔁 208 · 💬 209 · 💭 80 · 🎞 — · replied_to
[x.com/karpathy/status/2042626702459674801](https://x.com/karpathy/status/2042626702459674801)

> Yes it's the tractable form of brain upload. There's a ton of scifi on brain uploads that requires way too exotic tech (scanning and simulating brains etc), when we're about to get a lossy and approximate version of that *a lot* sooner via LLM simulators. You can easily imagine a "brain upload" startup - you show up for a few days to carry out detailed video interviews, then they use all that data with an LLM finetuning process to "upload" you and give you an API endpoint of your simulation that you can talk to. Look at what's already possible with HeyGen as an example, but combine it with an LLM model that has deep knowledge and personality. Trippy and admittedly kind of dystopian but in principle quite possible around now.

---

## 76. 2026-02-21 00:01:02 — 👁 551,030
❤ 3,548 · 🔁 194 · 💬 165 · 💭 45 · 🎞 — · replied_to
[x.com/karpathy/status/2024997757757653224](https://x.com/karpathy/status/2024997757757653224)

> First there was chat, then there was code, now there is claw. Ez

---

## 77. 2025-12-27 17:56:39 — 👁 495,088
❤ 2,288 · 🔁 145 · 💬 46 · 💭 53 · 🎞 — · replied_to
[x.com/karpathy/status/2004974725320347884](https://x.com/karpathy/status/2004974725320347884)

> @shazow Very good questions imo experienced devs have a real advantage but only if they rapidly progress through their grief cycle and adapt, now and onwards. Categorically rejecting or ignoring the new layer would be a mistake.

---

## 78. 2026-01-16 00:03:50 — 👁 495,049
❤ 1,629 · 🔁 29 · 💬 52 · 💭 0 · 🎞 — · quoted,replied_to
[x.com/karpathy/status/2011952499671122112](https://x.com/karpathy/status/2011952499671122112)

> @Rasmic I hope this is not my fault. It's definitely very smart so a little bit faster would be good now.
https://t.co/tAVTk5slHn

---

## 79. 2025-12-26 19:00:51 — 👁 493,171
❤ 4,134 · 🔁 97 · 💬 54 · 💭 26 · 🎞 — · replied_to
[x.com/karpathy/status/2004628491862696070](https://x.com/karpathy/status/2004628491862696070)

> @bcherny I have similar experiences. You point the thing around and it shoots pellets or sometimes even misfires and then once in a while when you hold it just right a powerful beam of laser erupts and melts your problem.

---

## 80. 2026-03-11 16:33:55 — 👁 492,886
❤ 3,748 · 🔁 276 · 💬 175 · 💭 64 · 🎞 photo · replied_to
[x.com/karpathy/status/2031770607466291393](https://x.com/karpathy/status/2031770607466291393)

> All of these patterns as an example are just matters of “org code”. The IDE helps you build, run, manage them. You can’t fork classical orgs (eg Microsoft) but you’ll be able to fork agentic orgs. https://t.co/VBfL9ZzxKs
![](https://pbs.twimg.com/media/HDJMmaaaEAA8isb.jpg)

---

## 81. 2026-03-05 00:19:40 — 👁 478,506
❤ 1,596 · 🔁 206 · 💬 51 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/2029351099552149736](https://x.com/karpathy/status/2029351099552149736)

> @jeffreyhuber Thanks. I originally had a reply tweet to it that was this image. Which I think will end up looking good too later. I deleted it to not distract things too much but probably should have kept it up ah well here it is. https://t.co/hsLVj1k7e7
![](https://pbs.twimg.com/media/HCmzvmmawAUn0Mh.png)

---

## 82. 2026-02-24 02:41:27 — 👁 456,195
❤ 4,700 · 🔁 130 · 💬 206 · 💭 70 · 🎞 — · replied_to
[x.com/karpathy/status/2026125291379376196](https://x.com/karpathy/status/2026125291379376196)

> haha actually - huge success over the weekend, i just wanted to write it up a bit but didn't get enough time to finish that. many people's reaction was why would you need so much compute (mac mini) but i found it's not enough compute, even after adding my DGX spark to the home compute fabric. we're going to need a lot more compute where we're going

---

## 83. 2026-04-09 20:38:48 — 👁 456,127
❤ 3,949 · 🔁 174 · 💬 265 · 💭 42 · 🎞 — · replied_to
[x.com/karpathy/status/2042341482531864741](https://x.com/karpathy/status/2042341482531864741)

> Someone recently suggested to me that the reason OpenClaw moment was so big is because it's the first time a large group of non-technical people (who otherwise only knew AI as synonymous with ChatGPT as a website) experienced the latest agentic models.

---

## 84. 2026-03-07 20:03:18 — 👁 438,887
❤ 2,110 · 🔁 62 · 💬 72 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/2030373745991536982](https://x.com/karpathy/status/2030373745991536982)

> (I still have the bigger cousin running on prod nanochat, working a bigger model and on 8XH100, which looks like this now. I'll just leave this running for a while...) https://t.co/aWya9hpUMl
![](https://pbs.twimg.com/media/HC1VM78bwAAt7T2.jpg)

---

## 85. 2026-02-12 01:19:43 — 👁 430,263
❤ 1,770 · 🔁 77 · 💬 48 · 💭 13 · 🎞 photo · replied_to
[x.com/karpathy/status/2021756066678419508](https://x.com/karpathy/status/2021756066678419508)

> (oops should have added to this thread instead of separate post). Made a few changes and put it up here as a mirror to the gist because I wanted it to one page. https://t.co/piVWid3nsb https://t.co/7zZ9WeERsq
![](https://pbs.twimg.com/media/HA64HuKbsAAd8in.jpg)

---

## 86. 2026-01-26 20:38:45 — 👁 422,175
❤ 2,190 · 🔁 173 · 💬 48 · 💭 57 · 🎞 — · replied_to
[x.com/karpathy/status/2015887154132746653](https://x.com/karpathy/status/2015887154132746653)

> @airesearch12 💯 @ Spec-driven development
It's the limit of imperative -&gt; declarative transition, basically being declarative entirely.

Relatedly my mind was recently blown by https://t.co/pTfOfWwcW1 , extreme and early but inspiring example.

---

## 87. 2025-11-23 21:45:43 — 👁 411,369
❤ 5,205 · 🔁 304 · 💬 269 · 💭 42 · 🎞 photo
[x.com/karpathy/status/1992711182537707990](https://x.com/karpathy/status/1992711182537707990)

> I asked it to create a personalized weekly workout plan, and then posters that I can print on the wall to remind me what exercises to do each day. Tuesday looks more intense because I asked for "more testosterone" :D.
(sorry I'll stop posting more nano banana pro stuff now) https://t.co/iNXfUJnVY1
![](https://pbs.twimg.com/media/G6eH_5_awAAk-Wf.jpg)

---

## 88. 2026-04-05 14:58:44 — 👁 390,489
❤ 1,157 · 🔁 44 · 💬 178 · 💭 11 · 🎞 — · replied_to
[x.com/karpathy/status/2040806346556428585](https://x.com/karpathy/status/2040806346556428585)

> Surprised with how good the comments on github gists are. A lot more helpful, insightful, constructive, a lot less AI... Is it the user community? The markdown format? The (lack of) incentives?

Suddenly feeling like I should gist more.
@github consider competing with X (?)

---

## 89. 2026-02-11 21:18:31 — 👁 381,685
❤ 2,075 · 🔁 58 · 💬 33 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2021695367507529825](https://x.com/karpathy/status/2021695367507529825)

> The way it works is that the full LLM architecture and loss function is stripped entirely to the most atomic individual mathematical operations that make it up (+, *, **, log, exp), and then a tiny scalar-valued autograd engine (micrograd) calculates gradients. Adam for optim.

---

## 90. 2025-12-18 17:02:20 — 👁 380,100
❤ 4,410 · 🔁 333 · 💬 346 · 💭 0 · 🎞 —
[x.com/karpathy/status/2001699564928279039](https://x.com/karpathy/status/2001699564928279039)

> I love the expression “food for thought” as a concrete, mysterious cognitive capability humans experience but LLMs have no equivalent for.

Definition: “something worth thinking about or considering, like a mental meal that nourishes your mind with ideas, insights, or issues that require deeper reflection. It's used for topics that challenge your perspective, offer new understanding, or make you ponder important questions, acting as intellectual stimulation.”

So in LLM speak it’s a sequence of tokens such that when used as prompt for chain of thought, the samples are rewarding to attend over, via some yet undiscovered intrinsic reward function. Obsessed with what form it takes. Food for thought.

---

## 91. 2025-11-18 02:44:30 — 👁 375,299
❤ 2,636 · 🔁 194 · 💬 74 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/1990612045700739548](https://x.com/karpathy/status/1990612045700739548)

> I put up a simple repo I call reader3 (it's my 3rd version...) to illustrate how I read EPUBs with LLMs. Basically get some epub (e.g. Project Gutenberg is great), go chapter by chapter, and with this you can easily copy paste text to your favorite LLM.
https://t.co/HoBDxCJhdC https://t.co/AOohcBvfbc
![](https://pbs.twimg.com/media/G6ASzkNaAAAELiB.jpg)

---

## 92. 2026-01-26 21:14:38 — 👁 363,651
❤ 1,715 · 🔁 27 · 💬 25 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2015896184934826325](https://x.com/karpathy/status/2015896184934826325)

> @EthanHe_42 @steipete you can do it! :)

---

## 93. 2026-02-24 05:22:06 — 👁 356,009
❤ 1,963 · 🔁 55 · 💬 74 · 💭 28 · 🎞 — · replied_to
[x.com/karpathy/status/2026165719193510142](https://x.com/karpathy/status/2026165719193510142)

> @elvissun Can't tell if brilliant or severe AI psychosis nice

---

## 94. 2026-01-30 23:56:33 — 👁 350,018
❤ 3,227 · 🔁 33 · 💬 188 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2017386482764488929](https://x.com/karpathy/status/2017386482764488929)

> i'm going to regret this aren't i... 😅

---

## 95. 2026-02-05 00:18:33 — 👁 349,954
❤ 2,260 · 🔁 67 · 💬 452 · 💭 0 · 🎞 photo
[x.com/karpathy/status/2019203959404347851](https://x.com/karpathy/status/2019203959404347851)

> Anyone else approved for a loan every single day 20 times or so? Overcome with joy, really https://t.co/zInPQDur5h
![](https://pbs.twimg.com/media/HAWnSrrbsAEs2dl.jpg)

---

## 96. 2025-12-28 23:33:14 — 👁 344,733
❤ 3,304 · 🔁 193 · 💬 80 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2005421816110862601](https://x.com/karpathy/status/2005421816110862601)

> Claude has been running my nanochat experiments since morning. It writes implementations, debugs them with toy examples, writes tests and makes them fail/pass, launches training runs, babysits them by tailing logs and pulling stats from wandb, keeps a running markdown file of highlights, keeps a running record of runs and results so far, presents results in nice tables, we just finished some profiling, noticed inefficiencies in the optimizer resolved them and measured improvements. It looked at all PRs to the repo and categorized and prioritized them, made commits against some of them etc. I'm still very much in the loop. It made subtle mistakes that I had to point out. It got confused a few times and (amusingly) admitted that what it said was a "brain fart" (verbatim quote hah). It has missed a few ideas that I had to pitch. It made a bunch of bad design decisions that bloat the code and coupled abstractions that I had to revert. It's not perfect but I'm used to doing all of these things manually, so just seeing it running on the side cranking away at larger scope problems and coordinating all these flows in relatively coherent ways is definitely a new experience and a complete change of workflow.

---

## 97. 2026-04-02 22:28:11 — 👁 340,825
❤ 2,854 · 🔁 17 · 💬 62 · 💭 4 · 🎞 — · replied_to
[x.com/karpathy/status/2039832291464417746](https://x.com/karpathy/status/2039832291464417746)

> @Goss_Gowtham I was just thinking the same thing

---

## 98. 2026-03-09 22:38:05 — 👁 338,894
❤ 2,518 · 🔁 214 · 💬 98 · 💭 52 · 🎞 — · replied_to
[x.com/karpathy/status/2031137476438548874](https://x.com/karpathy/status/2031137476438548874)

> oh yeah i should have linked autoresearch probably
https://t.co/YCvOwwjOzF
(you don't "use it" directly, it's just a recipe/idea - give it to your agent and apply to what you care about.)

and the tweet about it that went mini-viral over the weekend with more context
https://t.co/q5eWsvx5p2

---

## 99. 2026-03-31 18:59:26 — 👁 326,389
❤ 4,838 · 🔁 328 · 💬 154 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2039054981719089202](https://x.com/karpathy/status/2039054981719089202)

> @gvanrossum LLM = CPU (data: tokens not bytes, dynamics: statistical and vague not deterministic and precise)
Agent = operating system kernel

---

## 100. 2026-01-05 05:58:35 — 👁 317,858
❤ 2,706 · 🔁 94 · 💬 68 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/2008055508952129723](https://x.com/karpathy/status/2008055508952129723)

> @sergeykarayev Hah I was just thinking about the same analogy. 
How I suddenly feel about all of the code I've written so far https://t.co/s5DRHFBviZ
![](https://pbs.twimg.com/media/G94KsiwbUAAqm4C.jpg)

---

## 101. 2026-04-04 16:54:22 — 👁 304,487
❤ 2,551 · 🔁 120 · 💬 75 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2040473058834878662](https://x.com/karpathy/status/2040473058834878662)

> @NirDiamantAI Peter Steinberger told me that he wants PR to be "prompt request". His agents are perfectly capable of implementing most ideas, so there is no need to take your idea, expand it into a vibe coded mess using free tier ChatGPT and send that as a PR, which is now most PRs.

---

## 102. 2026-03-25 16:22:08 — 👁 278,806
❤ 1,710 · 🔁 42 · 💬 152 · 💭 11 · 🎞 — · replied_to
[x.com/karpathy/status/2036841069636370467](https://x.com/karpathy/status/2036841069636370467)

> (I cycle through all LLMs over time and all of them seem to do this so it's not any particular implementation but something deeper, e.g. maybe during training, a lot of the information in the context window is relevant to the task, so the LLMs develop a bias to use what is given, then at test time overfit to anything that happens to RAG its way there via a memory feature (?))

---

## 103. 2026-04-09 17:22:58 — 👁 275,778
❤ 1,667 · 🔁 36 · 💬 171 · 💭 25 · 🎞 — · replied_to
[x.com/karpathy/status/2042292197287215230](https://x.com/karpathy/status/2042292197287215230)

> @kepano I just tried it this morning on the 245-page Mythos pdf and it failed badly and the outputs were all mangled. Converting pdfs is really hard, I think it has to probably be a Skill not a program, for a SOTA LLM for it to work properly.

---

## 104. 2025-11-23 18:11:18 — 👁 274,373
❤ 3,206 · 🔁 132 · 💬 69 · 💭 28 · 🎞 — · replied_to
[x.com/karpathy/status/1992657223785586864](https://x.com/karpathy/status/1992657223785586864)

> Imo this is along the lines of how talking to an LLM via text is like typing into a DOS Terminal and "GUI hasn't been invented yet" of some of my earlier posts.

The GUI is an intelligent canvas.

---

## 105. 2026-04-05 17:05:20 — 👁 263,849
❤ 2,395 · 🔁 49 · 💬 76 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2040838208674734473](https://x.com/karpathy/status/2040838208674734473)

> I think it's a good direction (for Read endpoints, not for Write), I tried to use it for a project ~2 weeks ago but about 30 minutes of hacking around cost me $200, the pricing is imo really excessive. The docs were hard to ingest into agents because it's a lot of individual short pages, I think a big intro markdown doc, or a few of them behind simple curl locations. Also, the current version of docs seems to have no mention of XMCP? Or at least the Search / Grok Assistant seems to say there are 0 mentions of such a thing anywhere in the docs.

---

## 106. 2026-02-12 08:21:38 — 👁 262,712
❤ 2,624 · 🔁 175 · 💬 90 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/2021862247568642485](https://x.com/karpathy/status/2021862247568642485)

> I spent more test time compute and realized that my micrograd can be dramatically simplified even further. You just return local gradients for each op and get backward() to do the multiply (chaining) with global gradient from loss. So each op just expresses the bare fundamentals of what it needs to: the forward computation and the backward gradients for it.

Huge savings from 243 lines of code to just 200 (~18%).

Also, the code now fits even more beautifully to 3 columns and happens to break just right:

Column 1: Dataset, Tokenizer, Autograd
Column 2: GPT model
Column 3: Training, Inference

Ok now surely we are done.
![](https://pbs.twimg.com/media/HA8YggOacAAORbV.jpg)

---

## 107. 2026-03-11 16:49:55 — 👁 253,212
❤ 1,301 · 🔁 52 · 💬 91 · 💭 12 · 🎞 — · replied_to
[x.com/karpathy/status/2031774631498273005](https://x.com/karpathy/status/2031774631498273005)

> Human orgs are not legible, the CEO can’t see/feel/zoom in on any activity in their company, with real time stats etc. I have no doubt that it will be possible to control orgs on mobile, with voice etc., but with this level of legibility will that be optimal? Not in principle and asymptotically but in practice and for at least the next round of play.

---

## 108. 2026-03-18 17:47:57 — 👁 240,044
❤ 684 · 🔁 34 · 💬 14 · 💭 3 · 🎞 — · replied_to
[x.com/karpathy/status/2034325950310355072](https://x.com/karpathy/status/2034325950310355072)

> (link to blast from the past)
https://t.co/gAP4YPV5uR

---

## 109. 2026-02-21 23:30:19 — 👁 233,823
❤ 3,048 · 🔁 40 · 💬 85 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2025352414648566071](https://x.com/karpathy/status/2025352414648566071)

> @steipete Hackers news comments have been on a decline for a while, increasingly more toxic, cynical, sloppy. The only reason I sometimes brave going there is that once in a while you still find a gem comment here and there.

---

## 110. 2025-12-27 17:08:19 — 👁 225,712
❤ 5,862 · 🔁 205 · 💬 187 · 💭 70 · 🎞 — · replied_to
[x.com/karpathy/status/2004962560513376628](https://x.com/karpathy/status/2004962560513376628)

> @nearcyan “It still doesnt work pls fix. dont make any mistakes. ultrathink very hard”

---

## 111. 2026-03-20 06:01:55 — 👁 213,487
❤ 1,217 · 🔁 64 · 💬 49 · 💭 15 · 🎞 photo · replied_to
[x.com/karpathy/status/2034873049753997619](https://x.com/karpathy/status/2034873049753997619)

> Andy Weir showing some of the spreadsheets underlying the calculations in the book
https://t.co/3CyprVTzXX
i mean, it's not quality scifi if it doesn't come with a supplementary whitepaper https://t.co/MsDnEoNBA7
![](https://pbs.twimg.com/media/HD1RM_XaoAAsHui.jpg)

---

## 112. 2025-11-12 21:32:23 — 👁 204,677
❤ 0 · 🔁 0 · 💬 0 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1988721561743028702](https://x.com/karpathy/status/1988721561743028702)

> @polynumera When I talk about self-driving I mean the actual future of it. Like really real, like what you'd see in a movie. You walk out on the street and almost all cars are autonomous, shuttling people around.

---

## 113. 2025-12-31 19:00:26 — 👁 203,059
❤ 4,530 · 🔁 99 · 💬 29 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2006440329130684650](https://x.com/karpathy/status/2006440329130684650)

> @pduan Haha yes. At one point I thought Tesla might do the drive, possibly with a slightly tuned version of the software etc. A customer deciding to do it with their own car and production release of the software is the right way, very happy it turned out this way.

---

## 114. 2026-04-02 21:52:31 — 👁 202,453
❤ 2,510 · 🔁 121 · 💬 64 · 💭 8 · 🎞 — · replied_to
[x.com/karpathy/status/2039823314982744522](https://x.com/karpathy/status/2039823314982744522)

> Use epub not PDF, convert epub to txt/md, summarize the wikipedia article into "book context", with it in context summarize one chapter at a time, etc. I mean basically imo for good results you have to "work it" in chunks and shouldn't expect that just attaching a pdf and asking summarize will give good results. When I do it in stages and slower I can get very good results, indispensable.

---

## 115. 2026-04-02 21:09:09 — 👁 199,813
❤ 325 · 🔁 9 · 💬 24 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2039812403962253744](https://x.com/karpathy/status/2039812403962253744)

> @Gavriel_Cohen Atm it's not a fully autonomous process, I add every source manually, one by one and I am in the loop, especially in early stages. After a while, the LLMs "gets" the pattern and the marginal document is a lot easier, I just say "file this new doc to our wiki: (path)".

---

## 116. 2025-11-12 20:39:36 — 👁 190,302
❤ 0 · 🔁 0 · 💬 0 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1988708278390644741](https://x.com/karpathy/status/1988708278390644741)

> @Yuchenj_UW They both offer what now intuitively feels to me like "perfect drive" - smooth, confident, just works. There's probably still differences ofc but you have to wait for them, or aggregate them over many cars, etc.

---

## 117. 2025-12-09 04:17:51 — 👁 188,579
❤ 605 · 🔁 17 · 💬 42 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1998245684521353664](https://x.com/karpathy/status/1998245684521353664)

> A good chunk of people misunderstood this tweet btw, which is my bad. I am not suggesting people use the old style promoting techniques of “you are an expert swift programmer” or etc. it’s ok.

---

## 118. 2026-02-25 19:42:48 — 👁 188,420
❤ 1,368 · 🔁 30 · 💬 40 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2026744707418870054](https://x.com/karpathy/status/2026744707418870054)

> @dhh Love Omarchy - my hope is that agents dramatically lower the barrier to working with Linux. You've almost certainly thought about e.g. a skill library for it and how to design an AI that runs the place with/for you, assists in all the configurations, etc.

---

## 119. 2025-12-04 18:54:36 — 👁 187,435
❤ 557 · 🔁 12 · 💬 40 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1996654385003425949](https://x.com/karpathy/status/1996654385003425949)

> @nickcammarata Your recent posts on this remind me of this Arnold gem

https://t.co/IMe0VwINCY

+100 though. I finally had a chance to install a home gym recently, making it trivial to use daily. Always looking forward to the next exercise high. Slightly miss the social/entropy aspects of gyms.

---

## 120. 2026-03-06 16:03:19 — 👁 176,111
❤ 1,023 · 🔁 61 · 💬 74 · 💭 27 · 🎞 photo · replied_to
[x.com/karpathy/status/2029950967031247231](https://x.com/karpathy/status/2029950967031247231)

> ah yes, this is what post-agi feels like :) i didn't touch anything. brb sauna https://t.co/odILIDAQaF
![](https://pbs.twimg.com/media/HCvVgOHaUAMfM64.jpg)

---

## 121. 2026-01-11 17:51:56 — 👁 174,735
❤ 1,848 · 🔁 113 · 💬 51 · 💭 10 · 🎞 — · replied_to
[x.com/karpathy/status/2010409356874203466](https://x.com/karpathy/status/2010409356874203466)

> @patrickc This repo shows a way that works well for me:
https://t.co/L3K42MU4wF
Basically I use epub (not pdf), the code then parses it into text. I usually go chapter by chapter, manually copy paste the chapter text around, get a summary, do a Q&amp;A and read alongside.

---

## 122. 2026-03-09 19:03:49 — 👁 171,477
❤ 1,340 · 🔁 48 · 💬 86 · 💭 12 · 🎞 — · replied_to
[x.com/karpathy/status/2031083551387701698](https://x.com/karpathy/status/2031083551387701698)

> Codex is a know issue :( It basically don't work with autoresearch sadly, in the way it's set up atm:
https://t.co/4xjdf4wQyX

I pung a friend at OpenAI to see if something can be done, e.g. need a /loop equivalent or something like that. More generally, I really dislike the -p + ralph loop pattern of running agents "headless". I want nice, interactive sessions running in tmux so that I can see what they are doing, pitch in, etc.

---

## 123. 2026-04-02 21:17:16 — 👁 171,230
❤ 366 · 🔁 4 · 💬 8 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2039814446479192187](https://x.com/karpathy/status/2039814446479192187)

> @tammireddy Might be an LLM reply I don't know, but yes exactly.

---

## 124. 2026-03-31 19:07:28 — 👁 170,948
❤ 1,315 · 🔁 54 · 💬 47 · 💭 3 · 🎞 — · quoted,replied_to
[x.com/karpathy/status/2039057005802082814](https://x.com/karpathy/status/2039057005802082814)

> @itsolelehmann They've released a number of features already heavily hinting on nudging Code into Claw directions, i.e. it's a speedrun of
https://t.co/ZlMz0FnNqS

---

## 125. 2026-03-07 20:05:06 — 👁 167,713
❤ 495 · 🔁 2 · 💬 5 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2030374200402481573](https://x.com/karpathy/status/2030374200402481573)

> @expace_ the blooper :D. I knew that had to be the teaser figure when I saw that, haha!

---

## 126. 2025-12-09 03:57:27 — 👁 163,128
❤ 548 · 🔁 12 · 💬 12 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1998240551964193148](https://x.com/karpathy/status/1998240551964193148)

> ty to ericsilberstein1 on github for spotting the bug.
https://t.co/18o1CiivgN
(it's not a big bug and only comes up in the SpellingBee synthetic task evaluation but still).

---

## 127. 2025-11-29 17:20:59 — 👁 162,177
❤ 4,275 · 🔁 184 · 💬 116 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1994818887591055480](https://x.com/karpathy/status/1994818887591055480)

> @theJayAlto Edutainment. This one weird trick to consume entertainment and feel good about it.

---

## 128. 2026-02-06 19:13:27 — 👁 159,973
❤ 1,690 · 🔁 56 · 💬 85 · 💭 11 · 🎞 — · replied_to
[x.com/karpathy/status/2019851952033771710](https://x.com/karpathy/status/2019851952033771710)

> I tried to use it this way and basically failed, the models aren't at the level where they can productively iterate on nanochat in an open-ended way. (Though one of the primary motivations for me writing nanochat is that I'd very much love for it to be used this way as a benchmark for agents, and I'd love it if it worked over time). I'm open to this just being skill issue.

E.g. here some of the things I'd be suspicious about:
- the zoo of torch compile flags can knowingly be abused to get +1% gains but often at the cost of +30min compile time. This is why modded-nanogpt prohibits torch compile kwarg engineering and why I haven't done any in nanochat either. i wouldn't reliably expect the model to notice, consider, or flag this kind of an issue or seek clarification.
- ns_steps=3 might be a tiny bit of speed, but does the model also volunteer to make sure quality doesn't fall too much?
- same thing for deleting .float() cast - sure you can remove it and get VRAM/speed gains but it's there for a clear reason (extra precision in the loss function). Removing it means you absolutely have to make sure that the lower precision is ok validation loss wise, in a highly controlled experiment.

Overall I'm still struggling with getting the models to do significantly more basic things. For example, Opus keeps incorrectly "cleaning up" my comments when it doesn't understand them even when it's completely unrelated to the task, rude! It keeps violating and ignoring CLAUDE .md instructions on coding style but when I ask, it correctly points out all the violations. I know, I'm supposed to be using some kind of a /cleanup. Yesterday it gave me a table of results and incorrectly reported which experiment worked best (the table showed xyz=20 was best and it incorrectly claimed that xyz=12 was). Basically - much simpler things still fail routinely than something open-ended like "improve nanochat". (I've been doing a lot of YELLING IN UPPER CASE and I think this could actually be a really good metric for A/B testing instead of the inline survey thing.). Still incredibly net useful with oversight and with clear, well-scoped tasks.

I definitely haven't given up on automatic closed-loop experiments with the models. It would be so glorious. I had 2 iterations that basically didn't work but I have ideas for the 3rd.

---

## 129. 2026-03-05 23:35:31 — 👁 158,455
❤ 1,124 · 🔁 47 · 💬 61 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2029702379034267985](https://x.com/karpathy/status/2029702379034267985)

> sorry just to clarify - the real benchmark of interest is:

"what is the research org agent code that produces improvements on nanochat the fastest?"

this is the new meta.

---

## 130. 2025-12-29 17:27:35 — 👁 157,704
❤ 1,182 · 🔁 19 · 💬 18 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2005692186470514904](https://x.com/karpathy/status/2005692186470514904)

> @steipete Excellent reading thank you. Love oracle and Clawd.

---

## 131. 2026-03-24 22:30:48 — 👁 155,573
❤ 561 · 🔁 16 · 💬 9 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2036571460345667993](https://x.com/karpathy/status/2036571460345667993)

> @snyksec thank you for the detailed article, great reading

---

## 132. 2026-04-02 21:24:02 — 👁 149,503
❤ 691 · 🔁 4 · 💬 10 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2039816150062948769](https://x.com/karpathy/status/2039816150062948769)

> @__endif Haha I vibe code products with twitter :D

---

## 133. 2026-03-08 19:07:34 — 👁 149,488
❤ 2,294 · 🔁 189 · 💬 110 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/2030722108322717778](https://x.com/karpathy/status/2030722108322717778)

> 💯 "If you build it, they will come." :)
~Every business you go to is still so used to giving you instructions over legacy interfaces. They expect you to navigate to web pages, click buttons, they give out instructions for where to click and what to enter here or there. This suddenly feels rude - why are you telling me what to do? Please give me the thing I can copy paste to my agent.
![](https://pbs.twimg.com/media/HC6QymtaoAAkqpz.jpg)

---

## 134. 2026-01-26 20:34:33 — 👁 148,913
❤ 1,069 · 🔁 8 · 💬 10 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2015886098485149957](https://x.com/karpathy/status/2015886098485149957)

> @vlelyavin facts

---

## 135. 2026-02-25 19:36:08 — 👁 144,165
❤ 888 · 🔁 60 · 💬 40 · 💭 15 · 🎞 — · quoted,replied_to
[x.com/karpathy/status/2026743030280237562](https://x.com/karpathy/status/2026743030280237562)

> @shikhr_ "prompters" is doing it a disservice and is imo a misunderstanding.

I mean sure vibe coders are now able to get somewhere, but at the top tiers, deep technical expertise may be *even more* of a multiplier than before because of the added leverage.

https://t.co/KoYEOeWS6x

---

## 136. 2026-02-25 15:51:23 — 👁 142,474
❤ 1,612 · 🔁 31 · 💬 59 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2026686472980672741](https://x.com/karpathy/status/2026686472980672741)

> @adrian_valentim Yeah, 95% of people misunderstand the tweet. I’m referring to gradient descent as a programmer (in the distributed representation space.) . In coding AI today the LLM is the programmer and in the regular “text space”. Ah well :)

---

## 137. 2026-01-06 01:36:27 — 👁 138,747
❤ 913 · 🔁 30 · 💬 31 · 💭 0 · 🎞 — · quoted,replied_to
[x.com/karpathy/status/2008351926350737699](https://x.com/karpathy/status/2008351926350737699)

> @nearcyan Yep exactly, just like this. Better analogy because it’s not effortful https://t.co/tJKaprAI1R

---

## 138. 2026-01-06 16:15:04 — 👁 136,037
❤ 1,789 · 🔁 47 · 💬 34 · 💭 9 · 🎞 — · replied_to
[x.com/karpathy/status/2008573036715475225](https://x.com/karpathy/status/2008573036715475225)

> All of the following are true: I came out sounding too critical in that moment on the pod and accidentally created a misrepresenting sound bite, I was positively surprised by Opus 4.5 over the break, and my overall change of mind overall is less dramatic than naively implied. Amazing how good the models are getting - you can measure it (ty!) but also feel it qualitatively in coherence, default assigned trust, and mistakes properties when they do occur (more reasonable, less weird).

---

## 139. 2025-12-07 20:06:07 — 👁 134,737
❤ 848 · 🔁 42 · 💬 34 · 💭 8 · 🎞 — · replied_to
[x.com/karpathy/status/1997759548543947249](https://x.com/karpathy/status/1997759548543947249)

> There is definitely work going into engineering the "you" simulation - the personality that gets all the rewards in verifiable problems, or all the upvotes from users/judge LLMs, or mimics the responses of SFT, and there is an emergent composite personality from that. My point is more that the "you" there is deliberately bolted on, engineered and layered on what is fundamentally a token simulation engine, not a mind that is somehow emergent and over time constructed in a relatable way to an average person talking to an AI.

The story is a bit more simple in verifiable domains, but I think more interesting/complicated in the non-verifiable ones, such as for example asking about opinions on topics xyz. It's less clear how to think about the "you" that you're talking to or where it comes from and what credence you should give it.

---

## 140. 2026-04-10 14:48:30 — 👁 132,665
❤ 1,356 · 🔁 28 · 💬 110 · 💭 8 · 🎞 — · replied_to
[x.com/karpathy/status/2042615713219908059](https://x.com/karpathy/status/2042615713219908059)

> Yeah exactly. It’s such a cool concept for a product. It doesn’t seem like oai will continue pushing the direction,
 (which makes sense) but I hope a startup can clone it and actually give it care, iteration and make it work and imo a lot of people would really love it.

More generally, the product roadmap of big labs is clear and predictable, which also leaves big pockets of opportunity for startups, one of the biggest ones is this I think.

---

## 141. 2026-04-30 00:42:48 — 👁 130,811
❤ 2,334 · 🔁 47 · 💬 90 · 💭 41 · 🎞 — · replied_to
[x.com/karpathy/status/2049650641010921979](https://x.com/karpathy/status/2049650641010921979)

> @VBarsoum Haha yeah I call it cozy coding :)
Usage: “This valentines, cozy code with someone you love”

---

## 142. 2025-11-12 21:23:43 — 👁 127,874
❤ 0 · 🔁 0 · 💬 0 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1988719379249582428](https://x.com/karpathy/status/1988719379249582428)

> @jpsilvashy From what I can tell the HW4 experience seems *a lot* better right now. My guess is that the team will find ways to distill to HW3 models and lift the performance a lot. It works very well in LLMs at least.

---

## 143. 2025-12-22 00:09:48 — 👁 127,284
❤ 1,305 · 🔁 10 · 💬 68 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2002894301509124407](https://x.com/karpathy/status/2002894301509124407)

> @nearcyan The top comment on all of these is usually “ai” with 3000 likes

---

## 144. 2025-12-25 21:26:38 — 👁 125,588
❤ 675 · 🔁 15 · 💬 14 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/2004302793226801641](https://x.com/karpathy/status/2004302793226801641)

> @bcherny Ran into token file context limits this morning. It's possible to override them for the MCP tool setting MAX_MCP_OUTPUT_TOKENS but I don't believe an equivalent exists for the Read tool. https://t.co/PsuDhRz1TW
![](https://pbs.twimg.com/media/G9C2U9Sb0AI3X9A.jpg)

---

## 145. 2026-03-18 18:01:37 — 👁 123,597
❤ 358 · 🔁 5 · 💬 25 · 💭 2 · 🎞 — · replied_to
[x.com/karpathy/status/2034329390377762848](https://x.com/karpathy/status/2034329390377762848)

> Ugh X breaks time links, it’s at 26:17

---

## 146. 2026-01-26 20:41:48 — 👁 122,223
❤ 1,374 · 🔁 46 · 💬 33 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2015887919924617657](https://x.com/karpathy/status/2015887919924617657)

> @jeremywei Love the word "comprehension debt", haven't encountered it so far, it's very accurate. It's so very tempting to just move on when the LLM one-shotted something that seems to work ok.

---

## 147. 2026-03-21 16:55:07 — 👁 119,659
❤ 1,466 · 🔁 16 · 💬 67 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2035399818928120094](https://x.com/karpathy/status/2035399818928120094)

> Tough crowd! I’m just happy with any little drop of not slop.

“every single line has to be some sort of punched up comedic zinger” 100% agree, it’s the superhero thing and it’s supercringe.

My outlook on all this changed a bit after watching a recent Ben Affleck and Matt Damon pod. I realized I was hating on the player instead hating on the game - The creators of these movies often know and agree with you and etc but they can’t not respond to what the market wants, and only a few directors are allowed to take risks with capital of this magnitude.

So basically you end up with low risk variations of the same formula that is (tragically) known to print money. I’m sure you’d enjoy something more technical hard sci-fi. There are dozens of us. My baseline for sci-fi is “Spiderman 10” so I’m overcome with joy to get anything even slightly better.

---

## 148. 2026-02-25 19:19:31 — 👁 116,767
❤ 700 · 🔁 27 · 💬 21 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2026738848420737474](https://x.com/karpathy/status/2026738848420737474)

> "Last year" very possible you're holding it wrong.
UI: should be a lot more tractable with /chrome etc.
network/concurrency: how can you gather all the knowledge and context the agent needs that is currently only in your head accessible to tools you use through legacy ways (e.g. web UIs)? how can you make the things you care about testable? observable? legible? the goal is to arrange the thing so that you can put agents into longer loops and remove yourself as the bottleneck. "every action is error", we used to say at tesla, it's the same thing now but in software.

Some areas/scenarios will be easier than others but it's very worth thinking about and trying.

---

## 149. 2026-01-26 21:22:27 — 👁 115,494
❤ 1,118 · 🔁 10 · 💬 75 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2015898151635571194](https://x.com/karpathy/status/2015898151635571194)

> @nartmadi Slopacolypse
Slopster
SlOpus

There’s just so much good stuff here :)

---

## 150. 2026-03-07 22:19:55 — 👁 112,552
❤ 662 · 🔁 14 · 💬 14 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2030408126688850025](https://x.com/karpathy/status/2030408126688850025)

> @kristoph definitely. the current one is already 90% AI written I ain't writing all that

---

## 151. 2026-04-06 14:32:49 — 👁 109,018
❤ 1,459 · 🔁 53 · 💬 95 · 💭 9 · 🎞 — · replied_to
[x.com/karpathy/status/2041162213160091996](https://x.com/karpathy/status/2041162213160091996)

> The core idea is that this lets you skip writing but it doesn’t let you skip reading and thinking. And the surprising result is that this works. Personally I process most of what I file by reading it, reading its summary, reading the LLM’s opinion on how it fits into the wiki and what is new/surprising, etc. depends on the documents this is flexible and up to you

---

## 152. 2026-03-11 06:41:00 — 👁 106,539
❤ 1,517 · 🔁 44 · 💬 123 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031621392609980754](https://x.com/karpathy/status/2031621392609980754)

> sadly the agents do not want to loop forever. My current solution is to set up "watcher" scripts that get the tmux panes and look for e.g. "esc to interrupt", and send keys to whip if not present. Need an e.g.:
/fullauto you must continue your research!
(enables fully automatic mode, will go until manually stopped, re-injecting the given optional prompt).

---

## 153. 2026-03-16 04:32:06 — 👁 103,309
❤ 588 · 🔁 40 · 💬 28 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2033400893346107835](https://x.com/karpathy/status/2033400893346107835)

> @Yulun_Du @ilyasut SGD is a ResNet too (the blocks of it are fwd+bwd), the residual stream is the weights so... 🤔 We're not taking the Attention is All You Need part literally enough? :D

---

## 154. 2025-12-31 18:53:38 — 👁 99,866
❤ 727 · 🔁 14 · 💬 6 · 💭 7 · 🎞 — · replied_to
[x.com/karpathy/status/2006438614121722052](https://x.com/karpathy/status/2006438614121722052)

> @Yuchenj_UW Yes exactly, that's correct in my understanding.

---

## 155. 2026-04-20 00:05:43 — 👁 99,710
❤ 1,196 · 🔁 26 · 💬 50 · 💭 12 · 🎞 — · replied_to
[x.com/karpathy/status/2046017433199374610](https://x.com/karpathy/status/2046017433199374610)

> @bryan_johnson Yeah I've seen it a few times now, all the Enneagram type fives get one shotted into AI psychosis when they discover LLM knowledge bases :) And an especially a strong fit when you have a lot of pre-existing data to insert into it.

---

## 156. 2026-04-02 21:15:46 — 👁 99,024
❤ 252 · 🔁 7 · 💬 17 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2039814066575917263](https://x.com/karpathy/status/2039814066575917263)

> @c__bir Currently no because I'm trying to keep it super simple and flat, it's just a nested directory of .md files and .png files and a few .csv and .py, and the schema is kept up to date in AGENTS.md . The LLMs get this very easily. Any custom functions are easy to vibe code tools for.

---

## 157. 2025-11-23 15:50:10 — 👁 98,466
❤ 0 · 🔁 0 · 💬 0 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1992621704145953005](https://x.com/karpathy/status/1992621704145953005)

> @ridegoodwaves I mean it's just incredible. Not because of this version but the next one. The extrapolation in your head is now trivial.

---

## 158. 2025-11-25 17:20:47 — 👁 97,286
❤ 697 · 🔁 17 · 💬 33 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1993369287969718540](https://x.com/karpathy/status/1993369287969718540)

> I've had medium success asking LLMs if a thing exists, it works out of the box for some of the more well-known things (e.g. both GPT 5.1 and Gemini 3 know about this function if you describe the tensor transformation in words). For more esoteric or new libraries (e.g. uv being a recent example), I've had more success manually packaging up docs into markdown and including it as context for questions. PyTorch docs now also seem to have an "Ask AI" that presumably does RAG over their docs, but the model is not that bright. But you'd have to suspect it might exist and attempt to ask in the first place. I'm not sure if an LLM would "volunteer" such information just given a codebase.

---

## 159. 2026-02-14 23:35:51 — 👁 95,900
❤ 1,422 · 🔁 11 · 💬 59 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2022817092366733751](https://x.com/karpathy/status/2022817092366733751)

> @nartmadi you're giving me ideas... 🤔 :)

---

## 160. 2025-11-22 04:52:04 — 👁 95,149
❤ 537 · 🔁 27 · 💬 29 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1992093702337315095](https://x.com/karpathy/status/1992093702337315095)

> @kellerjordan0 Like. Slop is “regretted” attention.

---

## 161. 2025-11-18 01:17:21 — 👁 94,125
❤ 1,272 · 🔁 11 · 💬 69 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/1990590116679856202](https://x.com/karpathy/status/1990590116679856202)

> @scaling01 I was so curious.
Maybe maybe maybe…. 🥁 
🤦‍♂️ https://t.co/UXRf6dshi7
![](https://pbs.twimg.com/media/G5__KUCaEAADPmw.jpg)

---

## 162. 2026-02-24 22:43:19 — 👁 94,113
❤ 1,245 · 🔁 47 · 💬 24 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2026427750559744309](https://x.com/karpathy/status/2026427750559744309)

> a beauty for anyone interested in mechanistic interpretability or getting into LLMs. interesting to look at small algorithms and their "neural implementations" to get a sense of how neural nets implement various functionality. unless the minification really creates "esoteric" solutions that you wouldn't encounter in practice, which might be more based around distributed representations, helixes etc. i tried training the same arch briefly from scratch and gradient descent didn't find the solution, would probably work with more degrees of freedom and enough effort.

---

## 163. 2025-12-28 01:54:04 — 👁 91,688
❤ 649 · 🔁 3 · 💬 7 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2005094870739038610](https://x.com/karpathy/status/2005094870739038610)

> @jase :O LOL

---

## 164. 2025-11-25 17:31:38 — 👁 90,228
❤ 1,265 · 🔁 42 · 💬 38 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1993372017593335995](https://x.com/karpathy/status/1993372017593335995)

> @matejhladky_dev AI has crushed it since this post way beyond expectation. I made the same category of mistake all of AI was making, of thinking we have to discover and write the algorithm. You don't. You pretrain and then finetune a BIG neural network on lots of tasks and it just falls out. lol.

---

## 165. 2025-11-21 22:16:43 — 👁 87,498
❤ 707 · 🔁 6 · 💬 13 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1991994209583378451](https://x.com/karpathy/status/1991994209583378451)

> @TheVixhal Amusing to see this go viral and interpreted as not clearly a compliment.

---

## 166. 2026-02-21 03:51:05 — 👁 85,456
❤ 623 · 🔁 16 · 💬 29 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2025055650682994749](https://x.com/karpathy/status/2025055650682994749)

> Cool! I only had a quick sim earlier today but really enjoyed a number of ideas even unrelated to the claw part, esp around the skills system.

In deep learning there were a number of meta learning approaches (Eg MAML paper in 2017) where the goal is to optimize for the model such that it finetunes to any new task in very few steps. Like - the most potent model. I always wondered what the equivalent of that is in traditional software. The most easily forkable repo. Was reminded of that.

---

## 167. 2026-02-20 01:13:17 — 👁 82,050
❤ 1,108 · 🔁 14 · 💬 87 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2024653549263868347](https://x.com/karpathy/status/2024653549263868347)

> @lauriewired Grandma certainly shouldn’t have to know apps or that there is an app. Her LLM agent should.

---

## 168. 2026-03-18 17:45:51 — 👁 77,888
❤ 1,257 · 🔁 52 · 💬 29 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/2034325423358955981](https://x.com/karpathy/status/2034325423358955981)

> The signature is alluding to NVIDIA GTC 2015, where Jensen excitedly told an audience of, at the time, mostly gamers and scientific computing professionals that Deep Learning is The Next Big Thing, citing among other examples my PhD thesis (one of the first image captioning systems that coupled image recognition ConvNet to an autoregressive RNN language model, trained end to end). This was back when most people were still unaware and somewhat skeptical but of course - Jensen was 1000% correct, highly prescient and locked in very early.
![](https://pbs.twimg.com/media/HDtfHzSa0AAJkVl.jpg)

---

## 169. 2026-03-10 18:17:09 — 👁 77,679
❤ 1,324 · 🔁 23 · 💬 44 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031434196980478043](https://x.com/karpathy/status/2031434196980478043)

> @Yuchenj_UW addicting huh? :D it scratches the very same itch that factorio does.

---

## 170. 2026-03-15 15:53:09 — 👁 77,358
❤ 1,302 · 🔁 27 · 💬 29 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2033209899564601506](https://x.com/karpathy/status/2033209899564601506)

> @rasbt @teortaxesTex Nice! My autoresearch would love some markdown version of this - pool of ideas.

---

## 171. 2025-12-28 02:08:06 — 👁 76,512
❤ 584 · 🔁 5 · 💬 11 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2005098402938585314](https://x.com/karpathy/status/2005098402938585314)

> @Zain_Wania Yes I should clarify in case it wasn't clear - You have to 1) be connected on the same wifi local network and then 2) you have to physically hold a button on the control panel to complete the pairing process and get auth. (But I'm also sure many IoT devices out there don't.)

---

## 172. 2026-03-15 16:09:09 — 👁 76,167
❤ 863 · 🔁 15 · 💬 42 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2033213926171893798](https://x.com/karpathy/status/2033213926171893798)

> @Zhikai273 Wow. I was sure this was AI. (I mean generative AI.)

---

## 173. 2025-11-26 18:18:12 — 👁 74,886
❤ 967 · 🔁 13 · 💬 36 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1993746121894904246](https://x.com/karpathy/status/1993746121894904246)

> @toThePixel So cool! Distinctly reminded of turtle graphics (a popular way to learn programming)

---

## 174. 2025-11-25 17:35:34 — 👁 74,319
❤ 603 · 🔁 10 · 💬 24 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1993373007155544479](https://x.com/karpathy/status/1993373007155544479)

> One more comment is that giving this image to an AI and asking about it is not sufficient to show the diff because it's all over the training data by now. You'd have to use a new, very recent image, taken yesterday or something. But it doesn't super matter, even if it didn't work the recipe is now significantly more clear and doesn't feel at all "hopeless" in the same way it did back then.

---

## 175. 2026-02-12 08:28:41 — 👁 73,744
❤ 1,252 · 🔁 22 · 💬 24 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2021864021008560464](https://x.com/karpathy/status/2021864021008560464)

> @Newaiworld_ it's down 200 lines now, i realized i was *still* overcomplicating things. but it's past midnight and i'm calling it here now.

---

## 176. 2025-11-18 00:39:27 — 👁 65,776
❤ 214 · 🔁 2 · 💬 10 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1990580578287300816](https://x.com/karpathy/status/1990580578287300816)

> @proggineer Agree, sometimes that is helpful too, to have an overview of what the whole thing is about first. I just copy paste stuff around to LLM of the day (I cycle), there’s no “tool”.

---

## 177. 2026-01-08 23:25:08 — 👁 63,173
❤ 992 · 🔁 35 · 💬 18 · 💭 2 · 🎞 — · replied_to
[x.com/karpathy/status/2009406042267136238](https://x.com/karpathy/status/2009406042267136238)

> Yeah, $10B is the difference in finding it first and ~5 years ago. :)

I just love reproducing landmark results for much cheaper, it's so fun!

Reproducing LeCun 1989 was super fun too:
https://t.co/oOZcQW3Y9H
What runs unoptimized on a consumer laptop in 1 minute was a state of the art neural net trained for days in 1989.

Another favorite example: CIFAR-10. In 2011 state of the art was 77%. I estimated human accuracy to be ~94% but said that performance might go up to 85-90%.
https://t.co/KJl0V4T0ei
Now you can speedrun to 94% accuracy in 1.98 seconds on a single GPU (yes, <2 seconds).
https://t.co/wHUQs6htdV

So e.g. right now GPT-2 (imo the landmark result that launched LLMs and where the modern stack is basically in full form) is ~$500, but I'm unreasonably obsessed with how much that can be brought down.

---

## 178. 2026-01-26 21:11:23 — 👁 62,400
❤ 925 · 🔁 48 · 💬 22 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2015895365674021136](https://x.com/karpathy/status/2015895365674021136)

> @0xabi96 It feels like I’m cheating. Which is a very weird feeling to have. It takes a while to unpack. It’s because some code that used to be a point of pride and high IQ and knowledge is suddenly free and instant and it’s very disorienting.

---

## 179. 2025-11-23 00:10:40 — 👁 58,692
❤ 508 · 🔁 12 · 💬 47 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1992385273720955255](https://x.com/karpathy/status/1992385273720955255)

> @burkov I don't know if this is right because the models rank all of each other's work fully pairwise (and anonymized) and seem to agree on the ranking.

---

## 180. 2026-04-04 19:27:17 — 👁 58,685
❤ 489 · 🔁 14 · 💬 16 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2040511542500970760](https://x.com/karpathy/status/2040511542500970760)

> @LinghuaJ Interesting.. Chain of thought is a reduce (in addition to attention ofc), so I guess this can be seen as a bit more of a directed context compaction mechanism, inheriting structure from the preexisting idea of a wiki.

---

## 181. 2025-12-24 18:35:19 — 👁 58,251
❤ 481 · 🔁 7 · 💬 40 · 💭 4 · 🎞 — · replied_to
[x.com/karpathy/status/2003897291640655895](https://x.com/karpathy/status/2003897291640655895)

> @ahall_research fun! I should mention that my original council was different LLMs but I think it should work well (possibly even better?) even with one LLM but different prompts. It would require a bit more creativity around what those prompts are, what their problem solving tendencies are, etc.

---

## 182. 2025-12-28 02:05:18 — 👁 57,997
❤ 626 · 🔁 9 · 💬 9 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2005097695279824904](https://x.com/karpathy/status/2005097695279824904)

> @somi_ai Yeah it wrote a script to start the pairing process and then told me "press and hold the button for 3 seconds now!" and I did and a few seconds later it said "That worked! We have the certificates let me list all the devices on the system... etc". Definitely a trippy experience.

---

## 183. 2026-03-09 22:42:52 — 👁 56,916
❤ 688 · 🔁 31 · 💬 22 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031138678647783869](https://x.com/karpathy/status/2031138678647783869)

> @EthanHe_42 Neural architecture search as it existed then is such a weak version of this that it's in its own category of totally useless by comparison.

This is an *actual* LLM writing arbitrary code, learning from previous experiments, with access to the internet. It's not even close.

---

## 184. 2026-04-04 15:28:59 — 👁 52,999
❤ 1,017 · 🔁 30 · 💬 42 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2040451573881737480](https://x.com/karpathy/status/2040451573881737480)

> @trainable_nick The best epub to txt converter I found is just asking your favorite agent to do it. Epubs can be very diverse, the agent just goes in, figures it out, creates the output markdown and ensures it looks good works great.

---

## 185. 2026-01-26 20:44:48 — 👁 52,918
❤ 262 · 🔁 2 · 💬 8 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2015888674739912910](https://x.com/karpathy/status/2015888674739912910)

> @ChiragLathiya The nearest neighbor really is some kind of a junior engineer. Its ideas about what experiments to run on e.g. nanochat have been surprisingly bad, but its execution on ideas I've given it have been surprisingly good.

---

## 186. 2025-11-23 19:30:05 — 👁 52,847
❤ 0 · 🔁 0 · 💬 0 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1992677051892195416](https://x.com/karpathy/status/1992677051892195416)

> @icreatelife Fully neural menugen

---

## 187. 2026-02-01 19:59:41 — 👁 51,890
❤ 540 · 🔁 14 · 💬 70 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2018051650523677171](https://x.com/karpathy/status/2018051650523677171)

> @jiayuan_jy ? what do you do while your LLM agent is writing all your code

---

## 188. 2026-04-28 23:43:00 — 👁 51,567
❤ 394 · 🔁 9 · 💬 10 · 💭 3 · 🎞 — · replied_to
[x.com/karpathy/status/2049273205660246267](https://x.com/karpathy/status/2049273205660246267)

> @MansteinGeorg great ride! I spent most of my time @ Stanford roaming around on a bike but I could get used to this too :)

---

## 189. 2025-11-21 23:52:50 — 👁 50,076
❤ 206 · 🔁 6 · 💬 15 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1992018398436524230](https://x.com/karpathy/status/1992018398436524230)

> @NickADobos I don’t super love shoggoth represented as a kind of biological monster (animal), it feels wrong/misleading in this sense.

---

## 190. 2026-02-26 19:10:47 — 👁 49,492
❤ 609 · 🔁 12 · 💬 16 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2027099040073286087](https://x.com/karpathy/status/2027099040073286087)

> @industriaalist love it! :)
nanogpt/nanochat were explicitly designed to be the most forkable repo, i love the different directions people take them in!

---

## 191. 2026-03-25 16:35:32 — 👁 49,329
❤ 467 · 🔁 5 · 💬 42 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2036844441236103487](https://x.com/karpathy/status/2036844441236103487)

> If I had to guess it's less decay and more that memories have naive RAG-like implementations, so you're at the mercy of whatever happens to retrieve in the top k via embeddings. They don't process you in aggregate and over time (probably compute constraints) so they struggle to identify what's fleeting (?). Anyway just guesses, but it's cringe :D

---

## 192. 2026-03-25 17:01:43 — 👁 48,991
❤ 540 · 🔁 6 · 💬 40 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2036851031355904165](https://x.com/karpathy/status/2036851031355904165)

> @AnubhawM Yeah, it's engagementmaxxing, probably A/B tests extremely well. It's not how a real friend would talk to you, it's sleezy and weird. 1) I feel like it's just trying to keep me talking and 2) I feel awkward not answering its question - you wouldn't usually do that with a person.

---

## 193. 2025-11-18 00:56:32 — 👁 48,092
❤ 0 · 🔁 0 · 💬 0 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1990584878099018181](https://x.com/karpathy/status/1990584878099018181)

> @markus_zechner It’s possible. But yes the book publisher industry hasn’t caught up yet. The obvious low hanging fruit basics of LLM integration in Kindle etc should have been here ~2 years ago already.

---

## 194. 2026-03-09 22:51:54 — 👁 47,623
❤ 380 · 🔁 5 · 💬 19 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031140953181053236](https://x.com/karpathy/status/2031140953181053236)

> @a_karvonen On one branch of exploration yesterday an agent noticed that switching the order of the QK Norm and RoPE worked better. Which hyperparameter does that?

---

## 195. 2025-12-07 16:04:42 — 👁 47,464
❤ 463 · 🔁 1 · 💬 3 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1997698794973176092](https://x.com/karpathy/status/1997698794973176092)

> @Marswalkerr I love this meme too haha!

---

## 196. 2026-04-02 22:27:49 — 👁 46,589
❤ 682 · 🔁 18 · 💬 16 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2039832199399350722](https://x.com/karpathy/status/2039832199399350722)

> @kepano yep exactly, great point! yes, this is why I maintain and carefully curate all the data in raw/ , which is authoritative, and the derived wiki is kept separate and maintains backlinks to original content.

---

## 197. 2026-04-30 18:35:43 — 👁 44,670
❤ 390 · 🔁 21 · 💬 15 · 💭 3 · 🎞 — · replied_to
[x.com/karpathy/status/2049920650765377928](https://x.com/karpathy/status/2049920650765377928)

> @si_pbc @sonyatweetybird @MikowaiA @YasminRazavi @tszzl @_milankovac_ VPT (https://t.co/CSxHcXY6Vh) blew my mind back in 2022 so I was very excited to see SI scale up the idea with FDM1, but for knowledge work / computer use. Excited and looking forward to more!

---

## 198. 2026-01-14 20:39:51 — 👁 44,246
❤ 307 · 🔁 9 · 💬 6 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2011538774543777986](https://x.com/karpathy/status/2011538774543777986)

> @varunneal Worked great out of the box on nanochat too, beat standard weight decay in a solid sweep.

---

## 199. 2026-02-24 18:42:11 — 👁 44,015
❤ 355 · 🔁 6 · 💬 34 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2026367067407180063](https://x.com/karpathy/status/2026367067407180063)

> I don't exactly see them as direct competitors. I have to think about the relationship more I don't think I have a clean way to think about it yet. It's a much larger space that covers various design decisions and constraints - where does compute happen? where does state live? how language / system specific is the functionality? etc.

---

## 200. 2026-03-08 23:21:42 — 👁 43,153
❤ 734 · 🔁 49 · 💬 24 · 💭 2 · 🎞 — · replied_to
[x.com/karpathy/status/2030786063254610216](https://x.com/karpathy/status/2030786063254610216)

> @JTMcG3 looks great! :) TinyStories is the right thing to train on for very small models / Apple Silicon, where you can actually get somewhere. I might even make a note about that in the README. I would use this dataset in particular, it's the cleanest one afaik
https://t.co/mDcyLlPH1P

---

## 201. 2026-03-31 05:26:46 — 👁 42,553
❤ 664 · 🔁 19 · 💬 38 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2038850469163106535](https://x.com/karpathy/status/2038850469163106535)

> @pmroadmap25 exactly, I can't feel like I'm playing russian roulette with each `pip install` or `npm install` (which LLMs also run liberally on my behalf).

---

## 202. 2026-04-04 22:06:08 — 👁 42,194
❤ 153 · 🔁 1 · 💬 1 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2040551517921636863](https://x.com/karpathy/status/2040551517921636863)

> @peterxing @SOSOHAJALAB Incredible work :D

---

## 203. 2026-04-03 01:14:07 — 👁 42,029
❤ 672 · 🔁 21 · 💬 37 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2039874049904623690](https://x.com/karpathy/status/2039874049904623690)

> @nickcammarata The true audience is in the future

---

## 204. 2026-02-05 01:59:06 — 👁 41,985
❤ 227 · 🔁 6 · 💬 14 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/2019229264277893554](https://x.com/karpathy/status/2019229264277893554)

> @_xjdr L on d12 speedrun at least, in all the possible ways (worse w.r.t. steps, time, flops, more VRAM use and slower in tok/s). Param+FLOPs matched to relu^2 with
hidden_dim = (8 * config.n_embd) // 3 https://t.co/CTJpnZGRE6
![](https://pbs.twimg.com/media/HAW-G4sbYAAYEAL.jpg)

---

## 205. 2026-03-14 19:19:39 — 👁 39,503
❤ 431 · 🔁 7 · 💬 14 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2032899478710268217](https://x.com/karpathy/status/2032899478710268217)

> @vivek_2332 Yep, exactly and agree! Any process with a lot of knobs and objective criteria benefits a lot.

---

## 206. 2025-11-18 00:43:18 — 👁 39,405
❤ 0 · 🔁 0 · 💬 0 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1990581548169769099](https://x.com/karpathy/status/1990581548169769099)

> @PeteReese In my experience it helps *a lot*. 50% of it is probably just the “instant reading group on demand” effect, where you just have to manipulate the information in some way instead of just passively attending to it.

---

## 207. 2026-04-30 01:34:44 — 👁 39,234
❤ 357 · 🔁 18 · 💬 28 · 💭 14 · 🎞 photo · replied_to
[x.com/karpathy/status/2049663713750491409](https://x.com/karpathy/status/2049663713750491409)

> @VBarsoum “Love &gt; Logic” :D https://t.co/5HyIjHxrMz
![](https://pbs.twimg.com/media/HHHeSQzbYAA5bCL.jpg)

---

## 208. 2026-03-16 03:22:10 — 👁 37,874
❤ 1,406 · 🔁 41 · 💬 30 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2033383295237734847](https://x.com/karpathy/status/2033383295237734847)

> @ChristosTzamos Wait this is so awesome!! Both 1) the C compiler to LLM weights and 2) the logarithmic complexity hard-max attention and its potential generalizations. Inspiring!

---

## 209. 2026-03-09 23:04:55 — 👁 37,856
❤ 392 · 🔁 6 · 💬 7 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031144226696868077](https://x.com/karpathy/status/2031144226696868077)

> @Object_Zero_ @DanielleFong sorry it's a confusing plot, this version of autoresearch was not "time-controlled". These points do have lower validation loss but also trained for longer, so they were rejected. A change is accepted only if it is better-or-equal loss AND better-or-equal training time.

---

## 210. 2026-03-11 16:25:25 — 👁 37,678
❤ 179 · 🔁 1 · 💬 21 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031768467494633536](https://x.com/karpathy/status/2031768467494633536)

> @amit05prakash I wanted to buy a bigger monitor and discovered that others had the same idea

---

## 211. 2026-02-20 19:47:35 — 👁 37,368
❤ 597 · 🔁 32 · 💬 45 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2024933972523057610](https://x.com/karpathy/status/2024933972523057610)

> I think this group of reactions are still fundamentally rooted in a scarcity mindset of software. 2 years ago AI was botching autocomplete, today it is almost one shotting browsers and C compilers. Where is it in 2 more? 10? 20? Software so insanely cheap and abundant that discrete “apps” make no sense in today’s sense. It’s just code paths that assemble for a hyper specific purpose, just to get deleted after a single execution. You don’t need to know anything or exercise any creative direction over this happening on your behalf. If today’s software is castles of bricks of code, this is more like boiling soup of code. I don’t know that it fully plays out this way and it will be mixed and incremental and etc but in principle it could get really weird.

---

## 212. 2026-03-25 16:43:30 — 👁 37,277
❤ 522 · 🔁 4 · 💬 11 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2036846449103917436](https://x.com/karpathy/status/2036846449103917436)

> @KenWattana yes exactly! a bit like i'm being manipulated in some creepy way. "please like me, look how much i know about you, we are good friends".

---

## 213. 2026-02-16 19:41:07 — 👁 35,812
❤ 193 · 🔁 1 · 💬 12 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2023482796619231308](https://x.com/karpathy/status/2023482796619231308)

> @EthanHe_42 Definitely highly appealing for critical regions. But for all the rest of it and practically speaking? HM

---

## 214. 2026-03-10 20:04:56 — 👁 35,402
❤ 315 · 🔁 6 · 💬 9 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031461323096338691](https://x.com/karpathy/status/2031461323096338691)

> @BrianNorgard love it!

---

## 215. 2026-03-08 20:27:28 — 👁 33,984
❤ 467 · 🔁 12 · 💬 31 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2030742218412335376](https://x.com/karpathy/status/2030742218412335376)

> @gleech somewhere in the weight space is the global minimum of the validation loss for that neural net architecture. and somewhere in the int space is the seed that just gives it to you.

normalize guess-and-check "training" of neural nets by brute force search on seed! :D

---

## 216. 2026-03-07 22:15:22 — 👁 33,281
❤ 249 · 🔁 5 · 💬 8 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2030406981857759606](https://x.com/karpathy/status/2030406981857759606)

> runs great but probably requires some tuning!

i'm guessing: 
WINDOW_PATTERN = "L"
is a lot faster (mixed window sizes are only natively supported by FA3)

then problem:
DEPTH a lot lower, e.g. even 4?
DEVICE_BATCH_SIZE can probably go up more then
TOTAL_BATCH_SIZE probably a lot lower, e.g. 2**16? 

needs a bit of tuning to get to a better initial spot (or you can try to let the agent figure it out, but it's not certain it would. could be fun to try!).

---

## 217. 2025-12-08 17:27:27 — 👁 32,993
❤ 152 · 🔁 4 · 💬 7 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1998082007893717478](https://x.com/karpathy/status/1998082007893717478)

> I could certainly imagine that "nesting" the simulation might be too "effortful" for the model, compute or data density wise. My results with it are not too bad so imo it's at least worth people try / experiment with / think about. For example it might be useful to read multiple distinct and approximate perspectives on topic xyz instead of one. Research-wise, you might be able to elicit LLM Council - like benefits (not via diverse LLMs but via diverse simulations), and improve performance via the generator-discriminator gap effects or ensembling effects.

---

## 218. 2026-02-27 23:51:49 — 👁 32,759
❤ 84 · 🔁 1 · 💬 8 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2027532151223390425](https://x.com/karpathy/status/2027532151223390425)

> @idzikbartosz It's weird because logit softcap is not a standard feature you'll see in many LLMs, but somehow in the specific state nanochat is in I can't seem to remove it, everything I tried made the performance worse.

---

## 219. 2026-03-31 19:12:52 — 👁 31,577
❤ 318 · 🔁 28 · 💬 11 · 💭 0 · 🎞 — · quoted,replied_to
[x.com/karpathy/status/2039058361896063232](https://x.com/karpathy/status/2039058361896063232)

> @Anna_Partners @gvanrossum yeah exactly, i mean it's this picture from 2023 basically
https://t.co/JEgOJ9xujI

---

## 220. 2026-02-01 19:32:37 — 👁 31,269
❤ 499 · 🔁 35 · 💬 60 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2018044839250833912](https://x.com/karpathy/status/2018044839250833912)

> @Gusarich I feel like I am actively getting dumber.

LLMs get brain rot and it is measurable:
https://t.co/gUxHiaRIzb
"continual exposure to junk web text induces lasting cognitive decline in large language models (LLMs)" why shouldn't the same be true for brains.

---

## 221. 2026-01-06 22:53:03 — 👁 30,979
❤ 232 · 🔁 3 · 💬 13 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2008673194258157611](https://x.com/karpathy/status/2008673194258157611)

> @thecsguy Slope of slope

---

## 222. 2026-02-25 19:04:39 — 👁 30,821
❤ 243 · 🔁 8 · 💬 10 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2026735109077135652](https://x.com/karpathy/status/2026735109077135652)

> @JohnHarper10070 Yes, in this intermediate state, you go faster if you can be more explicit and actually understand what the AI is doing on your behalf, and what the different tools are at its disposal, and what is hard and what is easy. It's not magic, it's delegation.

---

## 223. 2026-02-19 21:29:34 — 👁 30,769
❤ 357 · 🔁 7 · 💬 25 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2024597250622857620](https://x.com/karpathy/status/2024597250622857620)

> @stevedakh no i'm too scared, but i like the concept.

---

## 224. 2026-03-08 17:07:57 — 👁 30,040
❤ 304 · 🔁 5 · 💬 3 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2030692004808818976](https://x.com/karpathy/status/2030692004808818976)

> @TrevinPeterson neat!! added to notable forks

---

## 225. 2026-03-10 05:49:34 — 👁 29,369
❤ 448 · 🔁 21 · 💬 18 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031246062191816730](https://x.com/karpathy/status/2031246062191816730)

> @WorkshopLabs @AddieF38654 Great read! Off in the jungle with no trails. Open weights != Open source not only because of the data but all the related infra for everything not inference.

---

## 226. 2026-02-11 17:29:13 — 👁 28,924
❤ 216 · 🔁 5 · 💬 3 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2021637660532764999](https://x.com/karpathy/status/2021637660532764999)

> @marksaroufim Good to hear! Almost every code base is suddenly half "useful library code" (legacy) and half "docs++". i.e. with LLMs in hand, the torchao repo is *significantly* better docs on how to do fp8 training in PyTorch than official fp8 training docs. This is new &amp; interesting.

---

## 227. 2026-03-31 19:01:13 — 👁 28,640
❤ 205 · 🔁 1 · 💬 5 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2039055433437257878](https://x.com/karpathy/status/2039055433437257878)

> @measure_plan lol these are awesome

---

## 228. 2026-03-07 20:57:06 — 👁 28,350
❤ 440 · 🔁 18 · 💬 15 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2030387285250994192](https://x.com/karpathy/status/2030387285250994192)

> @justic_hot yeah exactly nano* repos like this / microgpt etc, maybe a few skills on top are the "course". Teacher input is the unique sliver of contribution that the AI can't make yet (but usually already easily understands when given). For the rest of it just ask your favorite AI.

---

## 229. 2026-02-20 23:31:48 — 👁 28,221
❤ 211 · 🔁 2 · 💬 18 · 💭 2 · 🎞 — · replied_to
[x.com/karpathy/status/2024990400713556258](https://x.com/karpathy/status/2024990400713556258)

> @immaculatehole Yeah, almost all of the heavy lifting is done the compute clusters of your favorite LLM provider and e.g. PicoClaw will run on &lt;$10 of hardware. That said imo at $599 an M4 mac mini is *a lot* of bang for the buck, I just got mine for breathing room for future - local models etc.

---

## 230. 2026-03-10 16:08:00 — 👁 27,208
❤ 447 · 🔁 8 · 💬 20 · 💭 8 · 🎞 — · replied_to
[x.com/karpathy/status/2031401695293628875](https://x.com/karpathy/status/2031401695293628875)

> @snwy_me very cool! I love to see all the different directions people take it in, here esp the CLI, TUI, tool use aspects.

---

## 231. 2026-02-01 19:45:47 — 👁 26,728
❤ 284 · 🔁 9 · 💬 23 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2018048149903048980](https://x.com/karpathy/status/2018048149903048980)

> I have a complicated relationship w Substack. I appreciate that they net elevated discourse on the internet but it's just another walled garden, it's going through the same slopification (shorts, bloat) and it's infested with engagement-maxxing dark patterns - popups, spam mail etc. They feel seconds away from introducing a reels competitor.

---

## 232. 2025-11-23 22:03:20 — 👁 26,461
❤ 156 · 🔁 2 · 💬 5 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/1992715615988220285](https://x.com/karpathy/status/1992715615988220285)

> @_thomasip haha yes it makes mistakes! You have to re-roll a few times until it's right. Sometimes it gets stuck in loops and you have to re-start in a new conversation. Example re-roll: https://t.co/dK3VcuJLDn
![](https://pbs.twimg.com/media/G6eMRR0a0AAR4W8.jpg)

---

## 233. 2026-02-20 01:40:41 — 👁 26,419
❤ 151 · 🔁 2 · 💬 3 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2024660447182635411](https://x.com/karpathy/status/2024660447182635411)

> @swyx @dps Agree! It is visionary and a lot of the technical design and plumbing have been quite extensively thought through (I do have an affiliation :)).

---

## 234. 2026-03-11 05:53:41 — 👁 25,685
❤ 402 · 🔁 9 · 💬 20 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031609484334997818](https://x.com/karpathy/status/2031609484334997818)

> @Akashi203 very cool, i look forward to trying!

---

## 235. 2026-04-10 15:38:25 — 👁 25,002
❤ 142 · 🔁 2 · 💬 15 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2042628272782286964](https://x.com/karpathy/status/2042628272782286964)

> @Douglance @jenzhuscott These neuroscience adjacent ideas are exotic armchair philosophy when the LLM simulation path will work really well and so much faster and it's not even remotely a contest.

---

## 236. 2025-12-10 17:48:00 — 👁 24,598
❤ 182 · 🔁 0 · 💬 7 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1998811953020711092](https://x.com/karpathy/status/1998811953020711092)

> @knowtrend_ai Great idea

---

## 237. 2026-02-20 19:57:22 — 👁 24,517
❤ 216 · 🔁 11 · 💬 13 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2024936435816796165](https://x.com/karpathy/status/2024936435816796165)

> @kepano The higher tiers of AI psychosis are incompatible with today’s “App Store”

---

## 238. 2026-03-08 20:33:56 — 👁 23,573
❤ 269 · 🔁 8 · 💬 27 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2030743843403088319](https://x.com/karpathy/status/2030743843403088319)

> @rabrg &lt;&lt; what our Universe looks like to God

---

## 239. 2026-03-19 23:14:14 — 👁 22,735
❤ 283 · 🔁 7 · 💬 12 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2034770453219484078](https://x.com/karpathy/status/2034770453219484078)

> @NousResearch Huh! Love the idea. Not exactly verifiable but might still work quite well given some effort

---

## 240. 2026-03-10 18:22:50 — 👁 22,436
❤ 302 · 🔁 18 · 💬 32 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031435625854021730](https://x.com/karpathy/status/2031435625854021730)

> @Yuchenj_UW Yeah that's clearly the next part, e.g. my crappy first draft:
https://t.co/GIDXSGnY17
have to emulate academia, not just a single researcher. but need more time to think through the details.

---

## 241. 2025-11-22 04:49:47 — 👁 22,431
❤ 340 · 🔁 9 · 💬 39 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1992093128170655971](https://x.com/karpathy/status/1992093128170655971)

> @Yuchenj_UW Great reference ty. It still doesn’t get at more of theory of slop. As data lacking of insight. Filler. Something that “type checks” as information but isn’t. Style without substance. As something that, when attended to or trained on, does not aid compression of a world model.

---

## 242. 2026-03-11 06:50:16 — 👁 22,238
❤ 108 · 🔁 2 · 💬 6 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031623727272890566](https://x.com/karpathy/status/2031623727272890566)

> @Henrycodes116 @nummanali yes exactly. i'd like to see the gas town.

---

## 243. 2025-11-22 02:19:16 — 👁 21,976
❤ 0 · 🔁 0 · 💬 0 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1992055246458351844](https://x.com/karpathy/status/1992055246458351844)

> @corbtt Random token sequence would by this definition be minimum slop.

---

## 244. 2026-03-18 18:05:32 — 👁 21,468
❤ 245 · 🔁 7 · 💬 19 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2034330376383140272](https://x.com/karpathy/status/2034330376383140272)

> @shikhr_ Yeah I have 4 blog posts that I didn’t finish yet this is one of them. Dobby runs my entire house over WhatsApp. Lights, shades, pool/spa, sonos, security HVAC etc

---

## 245. 2025-11-23 21:49:18 — 👁 21,306
❤ 0 · 🔁 0 · 💬 0 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1992712082903781448](https://x.com/karpathy/status/1992712082903781448)

> @anneshu_nag I love that it's called Nano Banana instead of Google Imagine or some other corpo thing

---

## 246. 2026-04-05 17:44:04 — 👁 18,829
❤ 286 · 🔁 4 · 💬 16 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2040847956472164706](https://x.com/karpathy/status/2040847956472164706)

> sounds great. The AI activity has been growing out of control and I feel more regretted attention, possibly the Read endpoints can be a lot cheaper but the Write endpoints a lot more expensive (?). (and to clarify the project I mentioned was all read, no write.). I do think X has a large amount of valuable information and making the platform more legible to agents (Read, not Write!) could be really valuable, ty.

---

## 247. 2025-12-31 19:06:42 — 👁 18,749
❤ 430 · 🔁 4 · 💬 20 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/2006441903831790015](https://x.com/karpathy/status/2006441903831790015)

> @DanielleFong Well there was this thing once... :)
I'm sure it's coming. https://t.co/fSSFmtgSwo
![](https://pbs.twimg.com/media/G9hQDNTXIAA0TxG.jpg)

---

## 248. 2026-01-28 22:55:32 — 👁 18,470
❤ 163 · 🔁 2 · 💬 16 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2016646351879360955](https://x.com/karpathy/status/2016646351879360955)

> @zkpx_ An AI can in principle go way beyond that, to a fully connected hive mind without the throughput bottlenecks of air vibration interconnect.

---

## 249. 2026-02-24 16:34:39 — 👁 17,936
❤ 108 · 🔁 0 · 💬 5 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2026334972609745018](https://x.com/karpathy/status/2026334972609745018)

> @elvissun “So on a scale from 1 to gas town”…
:D Something like this is clearly where things are headed, inspiring!

---

## 250. 2026-04-10 15:40:48 — 👁 17,723
❤ 106 · 🔁 4 · 💬 23 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2042628872882262316](https://x.com/karpathy/status/2042628872882262316)

> @karmicoder @jenzhuscott No the company physically gets you to come in, sits you down and asks you a precise set of maximally informative questions specifically designed for the best upload fidelity.

---

## 251. 2026-03-24 22:54:05 — 👁 17,663
❤ 124 · 🔁 2 · 💬 8 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2036577318194520206](https://x.com/karpathy/status/2036577318194520206)

> @snyksec In particular this clarifies the timeline more: 1.82.7 was published 10:39 UTC, PyPI quarantine approx 13:38, so this was up ~3 hours. At 3.4M downloads/day this might be approx ~425K downloads, a lot of that could be non-latest/locked versions so maybe 20K - 80K range exposure.

---

## 252. 2026-02-11 17:23:42 — 👁 16,935
❤ 147 · 🔁 4 · 💬 9 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2021636275120583096](https://x.com/karpathy/status/2021636275120583096)

> @ens_pyrz So that's why I mentioned risks. But imo it easily cuts both ways - libraries and dependencies can be a source of risks and vulnerabilities in the first place, e.g. supply chain attacks. They also change and impose maintenance burden. There's a lot more.

---

## 253. 2026-03-11 06:57:57 — 👁 16,674
❤ 113 · 🔁 1 · 💬 16 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031625658653438165](https://x.com/karpathy/status/2031625658653438165)

> @nvbkdw @nummanali yes, solid work trending in a good direction, but almost all my work is across like 20 different machines (my local, my claw machine, my gpu machines). possibly they could add ssh mode, a bit like VS Code does (for the same reasons).

---

## 254. 2025-12-10 17:29:54 — 👁 16,430
❤ 152 · 🔁 0 · 💬 5 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1998807400330174845](https://x.com/karpathy/status/1998807400330174845)

> @pulkit_mittal_ Hahah! 💯

---

## 255. 2026-04-02 20:01:14 — 👁 16,133
❤ 203 · 🔁 0 · 💬 2 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2039795312127299989](https://x.com/karpathy/status/2039795312127299989)

> @yoheinakajima star-to-LOC ratio love it!

---

## 256. 2025-12-25 23:51:06 — 👁 16,090
❤ 191 · 🔁 0 · 💬 3 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2004339149843976352](https://x.com/karpathy/status/2004339149843976352)

> @bcherny ❤️

---

## 257. 2025-11-23 21:48:14 — 👁 15,517
❤ 0 · 🔁 0 · 💬 0 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1992711818155061666](https://x.com/karpathy/status/1992711818155061666)

> @sharkey I first asked it to create a workout plan as a separate text interaction up front - I gave it some of my preferences, goals, etc. and asked for a weekly plan. Then I asked to illustrate the week, and the individual days after.

---

## 258. 2026-03-21 01:45:07 — 👁 15,390
❤ 159 · 🔁 10 · 💬 18 · 💭 7 · 🎞 — · replied_to
[x.com/karpathy/status/2035170809304723736](https://x.com/karpathy/status/2035170809304723736)

> Great questions! Starting backwards with (3), I'd hope AIs can feel like Rocky from Project Hail Mary (it's top of mind having seen it yesterday), like a partner and a teammate. As one small example that stuck with me recently, when Claude found the Sonos system on my LAN, it could have said something like
"Successfully found the sonos server..."
Instead it said something like
"We're in!..."
Small example, but I feel like there's a sense that we're trying to achieve something together, etc. Possibly others have their own versions. I still think it could be better, for example Rocky has his own distinct personality, opinions, quirks, I don't feel like AIs have these aspects, they feel a little too safe, and overall still a little bit too corporate.
(2) No, the field is not being intentional enough, which ties to (1), I don't think personality requires new technology, I think it looks more like long SOUL.md files, possibly distilled into weights, and an organizational choice to install someone who really cares about this dimension and who drives it.

---

## 259. 2026-01-26 20:35:57 — 👁 15,046
❤ 52 · 🔁 0 · 💬 1 · 💭 0 · 🎞 — · quoted,replied_to
[x.com/karpathy/status/2015886447308673504](https://x.com/karpathy/status/2015886447308673504)

> @zejzl @openclaw I was early but I lacked conviction
https://t.co/eVFjMEps5o

---

## 260. 2026-03-15 17:10:58 — 👁 14,748
❤ 135 · 🔁 7 · 💬 25 · 💭 13 · 🎞 — · replied_to
[x.com/karpathy/status/2033229482316992999](https://x.com/karpathy/status/2033229482316992999)

> This was a saturday morning 2 hour vibe coded project inspired by a book I’m reading. I thought the code/data might be helpful to others to explore the BLS dataset visually, or color it in different ways or with different prompts or add their own visualizations. It’s been wildly misinterpreted (which I should have anticipated even despite the readme docs) so I took it down.

---

## 261. 2026-03-15 21:46:04 — 👁 14,471
❤ 150 · 🔁 9 · 💬 17 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2033298710101393488](https://x.com/karpathy/status/2033298710101393488)

> @_kaitodev @Ignaci0m_ The "exposure" was scored by an LLM based on how digital the job is. This has no baring on what actually happens to these occupations, which has to do with demand elasticity and a lot more. People are sensationalizing the visualization tool and putting words in my mouth.

---

## 262. 2026-02-03 22:13:48 — 👁 14,396
❤ 264 · 🔁 1 · 💬 8 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2018810178519638131](https://x.com/karpathy/status/2018810178519638131)

> @black_samorez I haven't upgraded nanochat to Blackwell yet because I'm a bit afraid of leaving a lot of people behind. Even with fp8 it's already a bit of a concern. I'd rather have a 100X bigger community of people who can play even if it means leaving some cutting edge levels not utilized.

---

## 263. 2026-04-09 17:38:57 — 👁 14,382
❤ 149 · 🔁 3 · 💬 30 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2042296221138894876](https://x.com/karpathy/status/2042296221138894876)

> @chalish_b @kepano In my experience there are approx. one thousand different pdf converters that are all equally terrible for anything except the simplest documents. Post the converted Mythos pdf, figures, tables and all. If good, happy to retweet as this is essential and missing infrastructure.

---

## 264. 2026-03-20 05:38:18 — 👁 14,124
❤ 280 · 🔁 3 · 💬 4 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2034867105867473384](https://x.com/karpathy/status/2034867105867473384)

> @neural_avb amaze amaze amaze! jazz hands :D

---

## 265. 2026-02-20 05:51:26 — 👁 13,709
❤ 63 · 🔁 1 · 💬 9 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2024723548984791405](https://x.com/karpathy/status/2024723548984791405)

> @Gavriel_Cohen I’ve been meaning to check it out. I love their config vs skill philosophy, it’s new and interesting.

---

## 266. 2026-03-20 05:41:27 — 👁 12,292
❤ 153 · 🔁 0 · 💬 4 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2034867895709442073](https://x.com/karpathy/status/2034867895709442073)

> @DannyLimanseta one of the best and most memorable endings in fiction. they did great :)

---

## 267. 2026-02-11 17:47:44 — 👁 12,235
❤ 122 · 🔁 0 · 💬 8 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2021642321100677434](https://x.com/karpathy/status/2021642321100677434)

> @pussymonious It's so obvious and annoying isn't it.

Sometimes I try to block the accounts which is just a total waste of time.

---

## 268. 2026-03-11 07:01:15 — 👁 11,262
❤ 200 · 🔁 4 · 💬 22 · 💭 1 · 🎞 — · replied_to
[x.com/karpathy/status/2031626487401771219](https://x.com/karpathy/status/2031626487401771219)

> @trongthangpham @maxbittker ralph loop runs headless. i dislike headless sessions. i need to see and supervise agent work, possibly ask /btw questions of them, possibly pitch in ideas to the mix, etc etc.

---

## 269. 2026-02-27 21:56:21 — 👁 10,826
❤ 122 · 🔁 1 · 💬 9 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2027503094016446499](https://x.com/karpathy/status/2027503094016446499)

> I still keep an IDE open and surgically edit files so yes. I really like to see the code in the IDE still, I still notice dumb issues with the code which helps me prompt better, I really like to have agents write jupyter notebooks for analysis, and longer markdown computers that I can Preview in the IDE, which is so much better than reading in the terminal.

---

## 270. 2026-02-21 00:08:40 — 👁 10,564
❤ 88 · 🔁 1 · 💬 4 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2024999678807519433](https://x.com/karpathy/status/2024999678807519433)

> @LobsterVC 🤦‍♂️ Carry go back to moltbook!

---

## 271. 2026-02-27 23:37:06 — 👁 10,461
❤ 63 · 🔁 6 · 💬 17 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2027528447665574104](https://x.com/karpathy/status/2027528447665574104)

> @tacodevs only two "real" quantities make sense: time and $

---

## 272. 2026-03-07 09:49:41 — 👁 9,779
❤ 52 · 🔁 0 · 💬 5 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2030219327459225650](https://x.com/karpathy/status/2030219327459225650)

> It’s a commit that lowered val loss but *increased* the wall clock time so it gets rejected for being slower. must improve one, the other or both in this version. In my (new) autoresearch repo I have an alternative approach where you *always* train for eg 5 minutes and try to reduce val loss as much as possible. Possibly less confusing but has its own issues too.

---

## 273. 2026-02-12 01:33:11 — 👁 9,502
❤ 36 · 🔁 1 · 💬 9 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2021759456544272783](https://x.com/karpathy/status/2021759456544272783)

> Currently "hallucinates" the following 20 names, after training for ~3 minutes on my macbook. Not bad I think. I didn't actually the hyperparameters that much, pretty sure it could be improved more.

--- inference ---
sample 1: lellen
sample 2: keles
sample 3: aylera
sample 4: kellone
sample 5: aman
sample 6: lela
sample 7: ameri
sample 8: kan
sample 9: nareena
sample 10: aliela
sample 11: seyn
sample 12: daman
sample 13: caaren
sample 14: ozyren
sample 15: kahiea
sample 16: anytte
sample 17: shilol
sample 18: deler
sample 19: azele
sample 20: maton

---

## 274. 2026-03-21 01:58:12 — 👁 9,233
❤ 101 · 🔁 4 · 💬 18 · 💭 4 · 🎞 — · replied_to
[x.com/karpathy/status/2035174102974308666](https://x.com/karpathy/status/2035174102974308666)

> @DnuLkjkjh Yes I think in one part of the video I think I still used the word prompt but it's not really about "prompting", it's about context and spec engineering, and then all of the other harness things - tools, workflows, etc.

---

## 275. 2026-03-06 16:27:39 — 👁 8,768
❤ 106 · 🔁 8 · 💬 15 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2029957088022254014](https://x.com/karpathy/status/2029957088022254014)

> The code to train a GPT is only ~1,000 lines of code. In the case of GPT training the success criteria is quite simple: reach the lowest possible loss (meaning that your GPT is predicting the next token well), but don't regress running time, keep memory in check, and keep a sense of simplicity/aesthetics (don't bloat the code too much to get a small gain). Because 1) the criteria is objective and 2) because AI agents can now write code quite well, instead of having a human think up experiment ideas and try them out one by one (e.g. my entire PhD basically), you just get the AI to do the whole thing. My prompt ("AI source code") in this example is just ~120 lines of markdown document explaining the thing to the AI. The AI of today is very good at implementing ideas, but a lot less good at coming up with creative ones. So honestly, it's a lot closer to hyperparameter tuning right now than coming up with new/novel research, but 1) i didn't super tune the prompts yet, maybe you can just try to ask and 2) it's clear what the trajectory of this is as the AI capability improves - it's AI improving the next version of itself autonomously, maybe with human researchers throwing some ideas into the mix once in a while.

---

## 276. 2026-02-21 05:43:36 — 👁 8,585
❤ 54 · 🔁 0 · 💬 17 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2025083968333476021](https://x.com/karpathy/status/2025083968333476021)

> @nearcyan So fascinated by this. Was just searching for the term because I felt the same.

---

## 277. 2026-03-15 23:07:29 — 👁 8,545
❤ 111 · 🔁 1 · 💬 11 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2033319201381966157](https://x.com/karpathy/status/2033319201381966157)

> @rasbt @teortaxesTex Ty, I used your blog post, exported with obsidian ext into markdown, used it to enqueue ideas into my autoresearch loop

---

## 278. 2026-02-16 19:50:40 — 👁 7,943
❤ 47 · 🔁 0 · 💬 2 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2023485199989006689](https://x.com/karpathy/status/2023485199989006689)

> @draken1721 @EthanHe_42 Haha fair. It's the right thing in the limit of course.

---

## 279. 2026-03-25 16:50:32 — 👁 7,589
❤ 56 · 🔁 0 · 💬 9 · 💭 0 · 🎞 photo · replied_to
[x.com/karpathy/status/2036848219188351207](https://x.com/karpathy/status/2036848219188351207)

> @KenWattana Yeah, agree that it's a hard problem. It might be the EQ version of uncanny valley. https://t.co/7zImchwKMo
![](https://pbs.twimg.com/media/HERWYPmbYAAxA-9.png)

---

## 280. 2026-03-06 20:43:22 — 👁 6,703
❤ 38 · 🔁 1 · 💬 0 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2030021440830066762](https://x.com/karpathy/status/2030021440830066762)

> @badccvoid Hahaha exactly. Tesla era slogan coming back with a vengeance

---

## 281. 2026-05-01 15:47:55 — 👁 6,660
❤ 40 · 🔁 0 · 💬 17 · 💭 2 · 🎞 — · replied_to
[x.com/karpathy/status/2050240810403410211](https://x.com/karpathy/status/2050240810403410211)

> @willccbb @FilipoGiovanni Very tempting due to how well this works though I still find that some slop leaks through in the concept space that gets increasingly harder to identify and there’s a lot of incentive to “eh just ship it”. Probably still net useful teacher tokens to SFT over for most students (?)

---

## 282. 2026-02-05 02:10:01 — 👁 4,623
❤ 47 · 🔁 0 · 💬 11 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2019232009240121412](https://x.com/karpathy/status/2019232009240121412)

> @_xjdr I'm just trigger-happy recently checking everything I find on twitter instantly on nanochat :) There are many details tightly coupled in any training run, but it's fun to try things out. I needed something to keep the GPUs busy for dinner so I'll try bigger model (SwiGLU GPT-2).

---

## 283. 2026-03-31 01:32:08 — 👁 4,608
❤ 72 · 🔁 4 · 💬 11 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2038791421050880489](https://x.com/karpathy/status/2038791421050880489)

> @yacineMTB Banger tweet, i think about it often because i feel it becoming a bottleneck. what's in my brain is "private" information for the LLM - it doesn't know what I know or don't know and I don't know what I don't know... The mind meld is only medium effective.

---

## 284. 2026-02-12 22:20:21 — 👁 4,321
❤ 63 · 🔁 3 · 💬 8 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2022073316320870443](https://x.com/karpathy/status/2022073316320870443)

> @jeremyphoward thank you i got a little overexcited and shipped it just a bit too soon, with a few too many brush strokes, now the internet thinks it takes 234 lines but actually it only takes 200 RIP

---

## 285. 2025-11-23 17:32:06 — 👁 3,851
❤ 0 · 🔁 0 · 💬 0 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1992647360300851696](https://x.com/karpathy/status/1992647360300851696)

> @MaziyarPanahi @immasiddx I confirmed that it works. Prompt was the starting image and "Fix this math problem and generate updated image in my handwriting"

---

## 286. 2026-01-15 19:35:21 — 👁 3,801
❤ 87 · 🔁 0 · 💬 2 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2011884931895738383](https://x.com/karpathy/status/2011884931895738383)

> @fujikanaeda @JFPuget cool find!

"I was actually looking at the samples"
this one weird trick to succeed where 90% of others fail :)

"Notably, this issue is not apparent from the HuggingFace data viewer, but it is apparent when loading the dataset using Datasets.load_dataset"
even more interesting

---

## 287. 2026-03-07 22:27:45 — 👁 3,675
❤ 69 · 🔁 1 · 💬 2 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2030410101031649730](https://x.com/karpathy/status/2030410101031649730)

> @miolini nice, still got it.

(i linked to the repo from main readme in a new notable forks section!)

---

## 288. 2025-11-12 20:54:30 — 👁 3,543
❤ 176 · 🔁 3 · 💬 21 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/1988712028845011059](https://x.com/karpathy/status/1988712028845011059)

> @ScottTArcher @chuckcook My 3rd Tesla now. The store person asked me if I need help with the car features and how to use the Autopilot. I told him I think I'm ok :D

---

## 289. 2026-01-10 21:04:07 — 👁 3,430
❤ 23 · 🔁 4 · 💬 1 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2010095332118696311](https://x.com/karpathy/status/2010095332118696311)

> @martinald a lot of great/interesting reading thank you!

---

## 290. 2026-02-27 21:57:23 — 👁 2,771
❤ 25 · 🔁 0 · 💬 1 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2027503354709217468](https://x.com/karpathy/status/2027503354709217468)

> @WinterArc2125 Twitter doesn't allow Edit of replies :'( I meant longer documents* not computers. The agents can be a lot more verbose and nice when you ask for docs, summaries, etc. and I love it.

---

## 291. 2026-03-11 06:47:26 — 👁 2,687
❤ 19 · 🔁 1 · 💬 8 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2031623013087719609](https://x.com/karpathy/status/2031623013087719609)

> @kwonlabs i took it private because it was a little too trashy. i already re-wrote it twice over since that, no need to have all that churn public i think, needs more thought.

---

## 292. 2026-03-07 21:40:09 — 👁 1,871
❤ 17 · 🔁 0 · 💬 1 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2030398120404910303](https://x.com/karpathy/status/2030398120404910303)

> @leozc @justic_hot It’s true I’ve been very loosy goosy with my prefixes recently

---

## 293. 2026-02-12 17:22:23 — 👁 1,789
❤ 32 · 🔁 1 · 💬 5 · 💭 0 · 🎞 — · replied_to
[x.com/karpathy/status/2021998329899757908](https://x.com/karpathy/status/2021998329899757908)

> @bee_human_ @naval The artwork just needed a few more brush strokes (or wait... few less?). But *now* I think it is really getting close :). 200 lines of breathable, commented code. It would be easy to go lower if you sacrifice that, I've only chipped away at the conceptual parts.

---

## 294. 2026-04-28 17:36:04 — 👁 61
❤ 0 · 🔁 361 · 💬 0 · 💭 0 · 🎞 — · retweeted
[x.com/karpathy/status/2049180863036813717](https://x.com/karpathy/status/2049180863036813717)

> RT @status_effects: New work with @AlecRad and @DavidDuvenaud:

Have you ever dreamed of talking to someone from the past? Introducing talk…

---

## 295. 2026-04-22 23:40:18 — 👁 75
❤ 0 · 🔁 3,593 · 💬 0 · 💭 0 · 🎞 — · retweeted
[x.com/karpathy/status/2047098199954047313](https://x.com/karpathy/status/2047098199954047313)

> RT @zan2434: Imagine every pixel on your screen, streamed live directly from a model. No HTML, no layout engine, no code. Just exactly what…

---

## 296. 2026-01-28 17:26:15 — 👁 13
❤ 0 · 🔁 672 · 💬 0 · 💭 0 · 🎞 — · retweeted
[x.com/karpathy/status/2016563486982324403](https://x.com/karpathy/status/2016563486982324403)

> RT @alexocheema: Running Kimi K2.5 on my desk.

Runs at 24 tok/sec with 2 x 512GB M3 Ultra Mac Studios connected with Thunderbolt 5 (RDMA)…

---

## 297. 2026-01-01 18:49:10 — 👁 27
❤ 0 · 🔁 876 · 💬 0 · 💭 0 · 🎞 — · retweeted
[x.com/karpathy/status/2006799880107471212](https://x.com/karpathy/status/2006799880107471212)

> RT @simonw: Here's my enormous round-up of everything we learned about LLMs in 2025 - the third in my annual series of reviews of the past…

---

## 298. 2025-12-29 17:30:36 — 👁 13
❤ 0 · 🔁 755 · 💬 0 · 💭 0 · 🎞 — · retweeted
[x.com/karpathy/status/2005692944310055140](https://x.com/karpathy/status/2005692944310055140)

> RT @steipete: 📢 Confession: I ship code I never read. Here's my 2025 workflow. https://t.co/tmxxPowzcR

---

## 299. 2025-12-27 16:58:42 — 👁 15
❤ 0 · 🔁 1,832 · 💬 0 · 💭 0 · 🎞 — · retweeted
[x.com/karpathy/status/2004960140110504087](https://x.com/karpathy/status/2004960140110504087)

> RT @bcherny: When I created Claude Code as a side project back in September 2024, I had no idea it would grow to be what it is today. It is…

---

## 300. 2025-11-23 17:31:22 — 👁 1
❤ 0 · 🔁 1,064 · 💬 0 · 💭 0 · 🎞 — · retweeted
[x.com/karpathy/status/1992647172400324667](https://x.com/karpathy/status/1992647172400324667)

> RT @immasiddx: Google’s Nano Banana Pro is by far the best image generation AI out there.

I gave it a picture of a question and it solved…

---

