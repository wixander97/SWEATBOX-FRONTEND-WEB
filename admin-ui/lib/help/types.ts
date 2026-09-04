/**
 * One source of truth for in-app help.
 *
 * A `HelpGuide` carries both shapes the help system renders: `steps` drive the
 * floating assistant's walkthrough, `articles` drive the Help & Support page.
 * They are deliberately kept in the same object so a guide can never be updated
 * in one place and go stale in the other.
 */

/** One step of a guided walkthrough. */
export type HelpStep = {
  /** Short imperative heading, e.g. "Add a new class". */
  title: string;
  /** One or two sentences describing what to do. */
  body: string;
  /**
   * CSS selector for the element this step talks about.
   *
   * Optional and best-effort: the selector is resolved when the step is shown
   * and the spotlight is simply skipped when nothing matches, so a guide never
   * breaks when a control is hidden by role, filtered out, or renamed.
   */
  target?: string;
};

/** A how-to article shown on the Help & Support page. */
export type HelpArticle = {
  /** URL-safe id, unique within its guide. */
  slug: string;
  title: string;
  /** One-line answer to "what is this article for?". */
  summary: string;
  /** The procedure, one instruction per entry. */
  steps: string[];
  /** Extra search terms that do not appear in the title or steps. */
  keywords?: string[];
};

/** A question worth answering on the Help & Support page. */
export type HelpFaq = {
  question: string;
  answer: string;
  /** Article this question is answered by, as `"<guideId>/<articleSlug>"`. */
  articleRef?: string;
};

/** Everything the help system knows about one module. */
export type HelpGuide = {
  /** Stable key used in URLs and lookups, e.g. "class-schedule". */
  id: string;
  /** Module name as it appears in the UI, e.g. "Class Schedule". */
  module: string;
  /** Walkthrough title, e.g. "Class Schedule Guide". */
  title: string;
  /** Route the module lives at, used for context detection and deep links. */
  path: string;
  /** Font Awesome icon name, matching the sidebar entry where there is one. */
  icon: string;
  /** One sentence on what the module is for. */
  summary: string;
  steps: HelpStep[];
  articles: HelpArticle[];
  faq?: HelpFaq[];
};

/** A search hit across guides and articles. */
export type HelpSearchResult = {
  guide: HelpGuide;
  /** Present when the hit is an article rather than the module itself. */
  article?: HelpArticle;
  /** Higher is a better match. */
  score: number;
};
