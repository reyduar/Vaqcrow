"use client";

import { useMemo, useState } from "react";
import {
  HELP_CATEGORIES,
  HELP_COPY,
  HELP_FAQS,
  faqsInCategory,
  helpCategoryCount,
  helpResultLabel,
  type HelpCategoryId
} from "@/application/help/faq";
import { EmptyState } from "../empty-state";
import { HelpFaqItem } from "./help-faq-item";
import { HELP_ICONS, type HelpIconName } from "./help-icons";

/**
 * The interactive centre of `/help` (Feature #394 / WU4), faithful to
 * `Vaqcrow Ayuda.dc.html` `:104-135`. The search box, the four category cards
 * and the FAQ list all read one `query`/`category` pair, so they live in a
 * single client island; the hero heading, the contact block and the footer stay
 * server-rendered around it. Every visible string comes from `application/
 * help/faq.ts` — nothing here retypes copy the data owns.
 *
 * The template's login gate (`:91-102`) is intentionally absent: the owner made
 * help public, so there is no auth read anywhere in this island.
 */
export function HelpExplorer() {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<HelpCategoryId | null>(null);
  // The template opens the first FAQ by default (`open ?? 0`) and keeps a single
  // row open (`toggle: () => setState({ open: on ? -1 : i })`); we track the id
  // so the open row survives filtering by identity, not by list position.
  const [openId, setOpenId] = useState<string | null>(HELP_FAQS[0]?.id ?? null);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      HELP_FAQS.filter((faq) => {
        const inCategory = categoryId === null || faq.category === categoryId;
        const matches =
          normalizedQuery === "" || `${faq.question} ${faq.answer}`.toLowerCase().includes(normalizedQuery);
        return inCategory && matches;
      }),
    [categoryId, normalizedQuery]
  );

  const categoryLabel = categoryId ? HELP_CATEGORIES.find((category) => category.id === categoryId)?.label : undefined;
  const resultLabel = helpResultLabel(filtered.length, categoryLabel);
  const hasFilter = categoryId !== null || normalizedQuery !== "";
  // Template `:201`: the empty state only shows once a query is typed.
  const isEmpty = filtered.length === 0 && normalizedQuery !== "";

  const SearchIcon = HELP_ICONS["search-outline"];
  const UpcomingIcon = HELP_ICONS["sparkles-outline"];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-center gap-4 pt-4 text-center">
        <h1 className="m-0 text-[clamp(38px,5vw,56px)] leading-[1.05] font-bold tracking-[-0.035em]">
          {HELP_COPY.hero.title}
        </h1>
        <p className="m-0 max-w-[56ch] text-[17px] leading-[1.55] text-pretty text-text-secondary">
          {HELP_COPY.hero.subtitle}
        </p>
        <label className="mt-2 flex h-[54px] w-full max-w-[560px] items-center gap-2.5 rounded-[12px] border border-control bg-canvas px-4">
          <SearchIcon aria-hidden="true" focusable="false" className="text-[20px] text-text-secondary" />
          <span className="sr-only">{HELP_COPY.search.label}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={HELP_COPY.search.placeholder}
            className="min-w-0 flex-1 border-none bg-transparent text-base text-text-primary outline-none"
          />
        </label>
      </div>

      <div role="group" aria-label="Categorías" className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {HELP_CATEGORIES.map((category) => {
          const CategoryIcon = HELP_ICONS[category.icon as HelpIconName];
          const isActive = categoryId === category.id;
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setCategoryId(isActive ? null : category.id)}
              className={`flex flex-col items-start gap-2.5 rounded-card p-[22px] text-left transition-colors hover:border-control ${
                isActive
                  ? "border-2 border-brand-accent-text bg-brand-accent-tint"
                  : "border border-border bg-raised"
              }`}
            >
              <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-brand-accent-tint text-brand-accent-text">
                <CategoryIcon aria-hidden="true" focusable="false" className="text-[22px]" />
              </span>
              <span className="text-[17px] font-bold">{category.label}</span>
              <span className="text-sm leading-[1.5] text-text-secondary">{category.description}</span>
              <span className="text-[13px] font-semibold text-brand-accent-text">
                {helpCategoryCount(faqsInCategory(category.id).length)}
              </span>
            </button>
          );
        })}
      </div>

      <section aria-labelledby={HELP_COPY.faqHeadingId} className="flex flex-wrap items-start gap-x-12 gap-y-8">
        <div className="flex flex-[1_1_260px] flex-col gap-3.5">
          <h2
            id={HELP_COPY.faqHeadingId}
            className="m-0 text-[30px] leading-[1.2] font-bold tracking-[-0.02em]"
          >
            {HELP_COPY.faqHeading}
          </h2>
          <p aria-live="polite" className="m-0 text-[15px] text-text-secondary">
            {resultLabel}
          </p>
          {hasFilter ? (
            <button
              type="button"
              onClick={() => {
                setCategoryId(null);
                setQuery("");
              }}
              className="self-start h-10 rounded-control border border-control bg-transparent px-3.5 text-sm font-semibold text-text-primary transition-colors hover:bg-page-surface"
            >
              {HELP_COPY.clearFilter}
            </button>
          ) : null}
          <div className="flex gap-2.5 rounded-card border border-dashed border-control p-4 text-sm leading-[1.5]">
            <UpcomingIcon
              aria-hidden="true"
              focusable="false"
              className="mt-px shrink-0 text-[19px] text-brand-accent-text"
            />
            <span>{HELP_COPY.upcoming}</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-2.5">
          {isEmpty ? (
            <EmptyState
              title={HELP_COPY.emptyState.title(query.trim())}
              body={HELP_COPY.emptyState.body}
              className="rounded-card border border-dashed border-control"
            />
          ) : null}
          {filtered.map((faq) => (
            <HelpFaqItem
              key={faq.id}
              faq={faq}
              open={openId === faq.id}
              onToggle={() => setOpenId(openId === faq.id ? null : faq.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
