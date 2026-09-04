/**
 * Lookup and search over the help content.
 *
 * Everything the floating assistant and the Help & Support page need is derived
 * here, so both read the same `helpGuides` array and cannot drift apart.
 */
import { helpGuides } from "./guides";
import type { HelpArticle, HelpGuide, HelpSearchResult } from "./types";

export { helpGuides };
export type { HelpArticle, HelpGuide, HelpSearchResult };

/** Route of the Help & Support page. */
export const HELP_PATH = "/admin/help";

/** Guides in the order they should be listed, longest path first for matching. */
const guidesByPathDepth = [...helpGuides].sort(
  (a, b) => b.path.length - a.path.length
);

/**
 * The guide for a pathname, or null when the page has none.
 *
 * Matches on the longest path first so a nested route resolves to its own guide
 * before falling back to a parent. Returning null rather than a default is what
 * lets the panel show its "coming soon" state instead of the wrong guide.
 */
export function guideForPath(pathname: string | null | undefined): HelpGuide | null {
  if (!pathname) return null;
  return (
    guidesByPathDepth.find(
      (g) => pathname === g.path || pathname.startsWith(`${g.path}/`)
    ) ?? null
  );
}

/** A guide by its id. */
export function guideById(id: string | null | undefined): HelpGuide | null {
  if (!id) return null;
  return helpGuides.find((g) => g.id === id) ?? null;
}

/** One article, addressed as `"<guideId>/<articleSlug>"`. */
export function articleByRef(
  ref: string | null | undefined
): { guide: HelpGuide; article: HelpArticle } | null {
  if (!ref) return null;
  const [guideId, slug] = ref.split("/");
  const guide = guideById(guideId);
  const article = guide?.articles.find((a) => a.slug === slug);
  return guide && article ? { guide, article } : null;
}

/**
 * Other articles in the same module.
 *
 * Related content is scoped to the module on purpose: a cross-module "you may
 * also like" would need relevance data the registry does not have, and showing
 * a wrong link is worse than showing none.
 */
export function relatedArticles(
  guide: HelpGuide,
  current: HelpArticle,
  limit = 4
): HelpArticle[] {
  return guide.articles.filter((a) => a.slug !== current.slug).slice(0, limit);
}

/** Every FAQ entry across all modules, tagged with the guide it belongs to. */
export function allFaqs(): { guide: HelpGuide; question: string; answer: string; articleRef?: string }[] {
  return helpGuides.flatMap((guide) =>
    (guide.faq ?? []).map((f) => ({ guide, ...f }))
  );
}

/** Lowercased haystack for one article. */
function articleHaystack(guide: HelpGuide, article: HelpArticle): string {
  return [
    guide.module,
    article.title,
    article.summary,
    ...article.steps,
    ...(article.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

/** Lowercased haystack for a module itself. */
function guideHaystack(guide: HelpGuide): string {
  return [guide.module, guide.title, guide.summary, ...guide.steps.map((s) => s.title)]
    .join(" ")
    .toLowerCase();
}

/**
 * Search modules and articles.
 *
 * Scores every term independently and requires at least one to hit, so a
 * natural question ("how do I create a class?") still finds the article that
 * only shares the words that carry meaning.
 */
export function searchHelp(query: string, limit = 20): HelpSearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  if (terms.length === 0) return [];

  const results: HelpSearchResult[] = [];

  for (const guide of helpGuides) {
    const moduleHay = guideHaystack(guide);
    const moduleName = guide.module.toLowerCase();
    let moduleScore = 0;
    for (const term of terms) {
      // Ranked above an article title hit: someone typing a module name wants
      // the module, not whichever article happens to mention it.
      if (moduleName === term) moduleScore += 20;
      else if (moduleName.includes(term)) moduleScore += 14;
      else if (moduleHay.includes(term)) moduleScore += 3;
    }
    if (moduleScore > 0) results.push({ guide, score: moduleScore });

    for (const article of guide.articles) {
      const hay = articleHaystack(guide, article);
      const title = article.title.toLowerCase();
      const keywords = (article.keywords ?? []).join(" ").toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (title.includes(term)) score += 10;
        else if (keywords.includes(term)) score += 6;
        else if (hay.includes(term)) score += 2;
      }
      if (score > 0) results.push({ guide, article, score });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Words that carry no signal in a help query. */
const STOP_WORDS = new Set([
  "how", "do", "does", "did", "the", "and", "for", "you", "your", "can", "with",
  "what", "when", "where", "why", "who", "which", "this", "that", "there",
  "from", "into", "onto", "are", "was", "were", "have", "has", "had", "get",
  "want", "need", "please", "help", "about", "any", "all", "not",
]);
