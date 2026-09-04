"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  allFaqs,
  articleByRef,
  guideById,
  helpGuides,
  relatedArticles,
  searchHelp,
} from "@/lib/help/registry";
import type { HelpArticle, HelpGuide } from "@/lib/help/registry";

/**
 * Optional support channels.
 *
 * Read from configuration rather than hard-coded: this build ships no support
 * address, and inventing one would send staff to a mailbox nobody reads. When
 * neither is set the section explains who to ask instead.
 */
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";
const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL ?? "";

export function HelpSupportView() {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState("");

  const moduleId = params.get("module");
  const articleSlug = params.get("article");

  const activeGuide = guideById(moduleId);
  const activeArticle =
    activeGuide && articleSlug
      ? (activeGuide.articles.find((a) => a.slug === articleSlug) ?? null)
      : null;

  const results = useMemo(() => searchHelp(query), [query]);
  const searching = query.trim().length > 1;

  function go(next: { module?: string; article?: string } | null) {
    if (!next) {
      router.push("/admin/help");
      return;
    }
    const sp = new URLSearchParams();
    if (next.module) sp.set("module", next.module);
    if (next.article) sp.set("article", next.article);
    router.push(`/admin/help?${sp.toString()}`);
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* ---------------------------------------------------------- Search */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-8 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold font-display uppercase text-fg text-center">
          How can we help?
        </h2>
        <p className="text-sm text-muted text-center mt-1 mb-5">
          Search the guides for every module in the portal and the POS.
        </p>
        <div className="relative max-w-xl mx-auto">
          <i
            className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles..."
            aria-label="Search help articles"
            className="w-full bg-sidebar border border-border text-fg rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-sweat"
          />
        </div>

        {searching && (
          <div className="max-w-xl mx-auto mt-4">
            {results.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">
                No help articles match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {results.map((r) => (
                  <li key={`${r.guide.id}-${r.article?.slug ?? "module"}`}>
                    <button
                      type="button"
                      onClick={() =>
                        go({ module: r.guide.id, article: r.article?.slug })
                      }
                      className="w-full text-left px-4 py-3 bg-sidebar hover:bg-fg/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
                    >
                      <p className="text-[11px] uppercase tracking-wider text-muted font-bold">
                        {r.guide.module}
                      </p>
                      <p className="text-sm text-fg font-semibold">
                        {r.article ? r.article.title : `${r.guide.module} overview`}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {r.article ? r.article.summary : r.guide.summary}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {activeArticle && activeGuide ? (
        <ArticleDetail
          guide={activeGuide}
          article={activeArticle}
          onOpenArticle={(slug) => go({ module: activeGuide.id, article: slug })}
          onBackToModule={() => go({ module: activeGuide.id })}
        />
      ) : activeGuide ? (
        <ModuleDetail
          guide={activeGuide}
          onOpenArticle={(slug) => go({ module: activeGuide.id, article: slug })}
          onBack={() => go(null)}
        />
      ) : (
        <>
          <ModuleGrid onOpen={(id) => go({ module: id })} />
          <FaqSection onOpenArticle={(ref) => {
            const found = articleByRef(ref);
            if (found) go({ module: found.guide.id, article: found.article.slug });
          }} />
          <SupportSection />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------- Browse by module */

function ModuleGrid({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <section className="mb-8">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-3">
        Browse by module
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {helpGuides.map((guide) => (
          <button
            key={guide.id}
            type="button"
            onClick={() => onOpen(guide.id)}
            className="text-left bg-card border border-border rounded-xl p-4 hover:border-sweat transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-9 h-9 rounded-lg bg-sweat/10 grid place-items-center text-accent-ink shrink-0">
                <i className={`fas ${guide.icon}`} aria-hidden />
              </span>
              <p className="text-sm font-bold text-fg truncate">{guide.module}</p>
            </div>
            <p className="text-xs text-muted line-clamp-2 mb-2">{guide.summary}</p>
            <span className="text-[11px] font-bold text-accent-ink">
              Learn more →
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Module detail */

function ModuleDetail({
  guide,
  onOpenArticle,
  onBack,
}: {
  guide: HelpGuide;
  onOpenArticle: (slug: string) => void;
  onBack: () => void;
}) {
  return (
    <section>
      <Breadcrumb onBack={onBack} trail={[guide.module]} />

      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 mb-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 rounded-lg bg-sweat/10 grid place-items-center text-accent-ink shrink-0">
            <i className={`fas ${guide.icon} text-lg`} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold font-display uppercase text-fg">
              {guide.module}
            </h2>
            <p className="text-xs text-muted">{guide.articles.length} articles</p>
          </div>
        </div>
        <p className="text-sm text-muted leading-relaxed">{guide.summary}</p>
        <Link
          href={guide.path}
          className="inline-flex items-center gap-2 mt-4 bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:brightness-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
        >
          <i className={`fas ${guide.icon}`} aria-hidden />
          Go to {guide.module}
        </Link>
      </div>

      <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-2">
        Getting started
      </h3>
      <ul className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden mb-6">
        {guide.articles.map((article) => (
          <li key={article.slug}>
            <button
              type="button"
              onClick={() => onOpenArticle(article.slug)}
              className="w-full text-left px-4 py-3 hover:bg-fg/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
            >
              <p className="text-sm text-fg font-semibold">{article.title}</p>
              <p className="text-xs text-muted">{article.summary}</p>
            </button>
          </li>
        ))}
      </ul>

      {guide.faq && guide.faq.length > 0 && (
        <>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-2">
            Common questions
          </h3>
          <div className="space-y-2 mb-6">
            {guide.faq.map((f) => (
              <FaqItem key={f.question} question={f.question} answer={f.answer} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* --------------------------------------------------------- Article detail */

function ArticleDetail({
  guide,
  article,
  onOpenArticle,
  onBackToModule,
}: {
  guide: HelpGuide;
  article: HelpArticle;
  onOpenArticle: (slug: string) => void;
  onBackToModule: () => void;
}) {
  const related = relatedArticles(guide, article);

  return (
    <section>
      <Breadcrumb onBack={onBackToModule} trail={[guide.module, article.title]} />

      <article className="bg-card border border-border rounded-xl p-5 sm:p-6 mb-4">
        <h2 className="text-lg sm:text-xl font-bold font-display uppercase text-fg">
          {article.title}
        </h2>
        <p className="text-sm text-muted mt-1 mb-5">{article.summary}</p>

        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
          Follow these steps
        </h3>
        <ol className="space-y-2.5">
          {article.steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-sweat/15 text-accent-ink grid place-items-center text-[11px] font-bold">
                {i + 1}
              </span>
              <span className="text-sm text-fg-soft leading-relaxed pt-0.5">{s}</span>
            </li>
          ))}
        </ol>

        <Link
          href={guide.path}
          className="inline-flex items-center gap-2 mt-6 bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:brightness-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
        >
          <i className={`fas ${guide.icon}`} aria-hidden />
          Go to {guide.module}
        </Link>
      </article>

      {related.length > 0 && (
        <>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-2">
            Related articles
          </h3>
          <ul className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {related.map((a) => (
              <li key={a.slug}>
                <button
                  type="button"
                  onClick={() => onOpenArticle(a.slug)}
                  className="w-full text-left px-4 py-3 hover:bg-fg/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
                >
                  <p className="text-sm text-fg font-semibold">{a.title}</p>
                  <p className="text-xs text-muted">{a.summary}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------- FAQ */

function FaqSection({ onOpenArticle }: { onOpenArticle: (ref: string) => void }) {
  const faqs = allFaqs();
  if (faqs.length === 0) return null;

  return (
    <section className="mb-8">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-3">
        Frequently asked questions
      </h3>
      <div className="space-y-2">
        {faqs.map((f) => (
          <FaqItem
            key={f.question}
            question={f.question}
            answer={f.answer}
            moduleLabel={f.guide.module}
            onOpenArticle={f.articleRef ? () => onOpenArticle(f.articleRef!) : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function FaqItem({
  question,
  answer,
  moduleLabel,
  onOpenArticle,
}: {
  question: string;
  answer: string;
  moduleLabel?: string;
  onOpenArticle?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-fg/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
      >
        <span className="text-sm text-fg font-semibold">{question}</span>
        <i
          className={`fas fa-chevron-${open ? "up" : "down"} text-muted text-xs shrink-0`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="px-4 pb-3 -mt-1">
          {moduleLabel && (
            <p className="text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
              {moduleLabel}
            </p>
          )}
          <p className="text-sm text-muted leading-relaxed">{answer}</p>
          {onOpenArticle && (
            <button
              type="button"
              onClick={onOpenArticle}
              className="mt-2 text-[11px] font-bold text-accent-ink hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat rounded"
            >
              Read the full article →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Support */

function SupportSection() {
  const hasChannel = Boolean(SUPPORT_EMAIL || SUPPORT_URL);

  return (
    <section className="bg-card border border-border rounded-xl p-5 sm:p-6 text-center">
      <i className="fas fa-life-ring text-2xl text-accent-ink mb-3 block" aria-hidden />
      <h3 className="text-base font-bold font-display uppercase text-fg">
        Still need help?
      </h3>
      {hasChannel ? (
        <>
          <p className="text-sm text-muted mt-1 mb-4">
            Reach the support team with the details of what you were doing.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {SUPPORT_URL && (
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:brightness-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
              >
                Contact Support
              </a>
            )}
            {SUPPORT_EMAIL && (
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="bg-sidebar border border-border text-fg px-4 py-2 rounded-lg text-sm font-bold hover:bg-fg/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
              >
                {SUPPORT_EMAIL}
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted mt-1 max-w-md mx-auto">
          No support channel is configured for this installation. Contact your
          system administrator, and include the module, what you were doing and
          any invoice or member code shown in the error.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- Breadcrumb */

function Breadcrumb({ onBack, trail }: { onBack: () => void; trail: string[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted mb-3 flex-wrap">
      <button
        type="button"
        onClick={onBack}
        className="hover:text-fg transition font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat rounded"
      >
        <i className="fas fa-arrow-left mr-1.5" aria-hidden />
        Help &amp; Support
      </button>
      {trail.map((t) => (
        <span key={t} className="flex items-center gap-2 min-w-0">
          <span aria-hidden>›</span>
          <span className="text-fg-soft truncate">{t}</span>
        </span>
      ))}
    </nav>
  );
}
