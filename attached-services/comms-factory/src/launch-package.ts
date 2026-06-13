/**
 * Maps the workflow's approved copy (final_by_channel + candidates) onto the
 * emit package consumed by the REST emit path. Pure + deterministic: the
 * caller passes `today` so tests and replays are stable.
 * Web mapping verified against the LIVE FEATURES_COPY schema 2026-06-12:
 * {title, description?} — subheading has no slot (homepage card concept) and
 * the ' / ' marker is a feature-card-alt line-break convention → stripped
 * (precedent: renderStructured, generator.ts:134).
 */
import { extractChangelogTitle, markChangelogPublished } from "./emit-platform-pr.js";
import { freshenDates, type DateChange } from "./freshen.js";

export interface FinalChannelEntry {
  text: string;
  candidate_id?: string | null;
  edited?: boolean;
  pick?: boolean;
}
export type FinalByChannel = Record<string, FinalChannelEntry | null | undefined>;

export interface WebCardStructured { kind: "web-card"; subheading: string; title: string; caption: string }
export interface CandidateLike { id?: unknown; channel?: unknown; structured?: unknown }

/** Like LaunchPackage but changelogMd is optional — web-only PRs are legal. */
export interface EmitPackage {
  changelogSlug: string;
  changelogMd?: string;
  roadmapTick?: { nodeName: string; parentName?: string };
  featureCard?: { dataTsEntry: string };
}

export interface BuildLaunchPackageOptions {
  today: string; // YYYY-MM-DD
  typefullyUrl?: string;
  roadmapTick?: { nodeName: string; parentName?: string };
}

export interface BuiltLaunchPackage { pkg: EmitPackage; dateChanges: DateChange[]; notes: string[] }

export function slugify(value: string): string {
  return (
    value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "release"
  );
}

// Base-0 indentation on purpose: appendFeatureCopyEntry's indentBlock prefixes
// EVERY line with the array element indent (2 spaces in the live data.ts), so a
// pre-indented template would come out doubly indented in the platform PR diff.
// The trailing comma is tolerated (normalizeFeatureEntry strips it before parsing).
export function featureCardEntry(structured: WebCardStructured): string {
  const title = structured.title.replace(/\s*\/\s*/g, " ").trim();
  const description = structured.caption.trim();
  return `{\n  title: ${JSON.stringify(title)},\n  description: ${JSON.stringify(description)},\n},`;
}

export function normalizeBlogFrontmatter(
  markdown: string,
  opts: { title: string; today: string; typefullyUrl?: string },
): { text: string; dateChanges: DateChange[]; notes: string[] } {
  const notes: string[] = [];
  let text = markdown;
  if (!/^---\r?\n/.test(text)) {
    text = `---\ntitle: ${JSON.stringify(opts.title)}\ndate: ${opts.today}\npublished: true\ncategory: changelogs\n---\n\n${text}`;
    notes.push("frontmatter synthesized (none present)");
  } else {
    const end = text.indexOf("\n---", 3);
    if (end === -1) {
      throw new Error("normalizeBlogFrontmatter: unterminated frontmatter (no closing '---')");
    }
    let fm = text.slice(0, end);
    if (!/^title:/m.test(fm)) { fm += `\ntitle: ${JSON.stringify(opts.title)}`; notes.push("title added"); }
    if (!/^date:/m.test(fm)) { fm += `\ndate: ${opts.today}`; notes.push("date added"); }
    if (!/^category:/m.test(fm)) { fm += `\ncategory: changelogs`; notes.push("category: changelogs added"); }
    text = fm + text.slice(end);
  }
  const frontmatterEnd = (value: string): number => value.indexOf("\n---", 3);
  text = markChangelogPublished(text); // existing exported helper — sets/inserts published: true
  if (opts.typefullyUrl) {
    const end = frontmatterEnd(text);
    if (end === -1) {
      throw new Error("normalizeBlogFrontmatter: unterminated frontmatter (no closing '---')");
    }
    let fm = text.slice(0, end);
    if (/^typefullyUrl:/m.test(fm)) fm = fm.replace(/^typefullyUrl:.*$/m, `typefullyUrl: ${opts.typefullyUrl}`);
    else fm += `\ntypefullyUrl: ${opts.typefullyUrl}`;
    text = fm + text.slice(end);
    notes.push("typefullyUrl injected");
  }
  const freshened = freshenDates(text, opts.today);
  return { text: freshened.text, dateChanges: freshened.changes, notes };
}

export function buildLaunchPackage(
  card: Record<string, unknown>,
  finalByChannel: FinalByChannel,
  candidates: CandidateLike[],
  opts: BuildLaunchPackageOptions,
): BuiltLaunchPackage {
  const notes: string[] = [];
  const cardTitle = String(card.title ?? card.headline ?? "release").trim() || "release";
  const slug = typeof card.slug === "string" && card.slug.trim() ? slugify(card.slug) : slugify(cardTitle);
  const pkg: EmitPackage = { changelogSlug: slug };
  let dateChanges: DateChange[] = [];

  const blog = finalByChannel.blog;
  if (blog?.text?.trim()) {
    const title = extractChangelogTitle(blog.text, cardTitle);
    const normalized = normalizeBlogFrontmatter(blog.text, {
      title,
      today: opts.today,
      ...(opts.typefullyUrl ? { typefullyUrl: opts.typefullyUrl } : {}),
    });
    pkg.changelogMd = normalized.text;
    dateChanges = normalized.dateChanges;
    notes.push(...normalized.notes);
  }

  const web = finalByChannel.web;
  if (web?.text?.trim()) {
    const candidate = candidates.find((c) => c.id === web.candidate_id);
    const structured = candidate?.structured as WebCardStructured | undefined;
    if (structured?.kind === "web-card") {
      pkg.featureCard = { dataTsEntry: featureCardEntry(structured) };
    } else {
      notes.push("web approved but no structured web-card candidate found — feature card omitted");
    }
  }

  if (opts.roadmapTick) pkg.roadmapTick = opts.roadmapTick; // caller-supplied only — never guessed
  return { pkg, dateChanges, notes };
}
