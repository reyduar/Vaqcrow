"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * The Markdown renderer of the Blog article body (Feature #498, WU3).
 *
 * Security first (S6): `react-markdown` maps the Markdown AST to React elements
 * and, with **no `rehype-raw`**, never turns raw HTML into DOM — a `<script>` in
 * the body is inert text, never an element. The default URL transform is kept,
 * so a link or image URL with a dangerous protocol is stripped before it
 * reaches the DOM. The body is untrusted repository content: it is rendered,
 * never executed. External links open in a new tab with `rel="noreferrer
 * noopener"`.
 *
 * Every element is mapped to the guide reading typography (`guide-section`'s
 * line-heights and weights). Heading levels are shifted one down so an
 * article's own `<h1>` is the page title and the body never introduces a second
 * one.
 */

const H = "m-0 mt-8 mb-1 font-bold tracking-[-0.02em] text-balance text-text-primary first:mt-0";

/** The body wrapper also resets the inline-code pill inside a fenced block. */
const BODY_CLASS =
  "flex max-w-[72ch] flex-col gap-4 [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0";

/**
 * `react-markdown` passes its internal hast `node` to every component override
 * (`passNode` is on). It must never reach the DOM, so it is stripped here
 * before the remaining props are spread.
 */
function withDomProps<P extends { node?: unknown }>(props: P): Omit<P, "node"> {
  const domProps = { ...props } as P & { node?: unknown };
  delete domProps.node;
  return domProps as Omit<P, "node">;
}

const COMPONENTS: Components = {
  h1: (props) => <h2 className={`${H} text-[clamp(26px,3.2vw,30px)] leading-[1.2]`} {...withDomProps(props)} />,
  h2: (props) => <h3 className={`${H} text-[22px] leading-[1.25]`} {...withDomProps(props)} />,
  h3: (props) => <h4 className={`${H} text-[19px] leading-[1.3]`} {...withDomProps(props)} />,
  h4: (props) => <h5 className={`${H} text-[17px] leading-[1.35]`} {...withDomProps(props)} />,
  h5: (props) => <h6 className={`${H} text-[16px] leading-[1.4]`} {...withDomProps(props)} />,
  h6: (props) => <h6 className={`${H} text-[15px] leading-[1.4]`} {...withDomProps(props)} />,
  p: (props) => <p className="m-0 text-[17px] leading-[1.65] text-pretty text-text-secondary" {...withDomProps(props)} />,
  ul: (props) => (
    <ul
      className="m-0 flex list-disc flex-col gap-2 pl-5 text-[17px] leading-[1.6] text-text-secondary"
      {...withDomProps(props)}
    />
  ),
  ol: (props) => (
    <ol
      className="m-0 flex list-decimal flex-col gap-2 pl-5 text-[17px] leading-[1.6] text-text-secondary"
      {...withDomProps(props)}
    />
  ),
  li: (props) => <li className="pl-1" {...withDomProps(props)} />,
  a: (props) => {
    const external = typeof props.href === "string" && /^https?:\/\//i.test(props.href);
    return (
      <a
        className="font-medium text-brand-accent-text underline underline-offset-2 hover:no-underline"
        {...withDomProps(props)}
        {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      />
    );
  },
  code: (props) => (
    <code
      className="rounded bg-page-surface px-1.5 py-0.5 font-mono text-[0.92em] text-text-primary"
      {...withDomProps(props)}
    />
  ),
  pre: (props) => (
    <pre
      className="m-0 overflow-x-auto rounded-card border border-border bg-page-surface p-4 font-mono text-sm leading-[1.6] text-text-primary"
      {...withDomProps(props)}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="m-0 border-l-2 border-control pl-4 text-[17px] leading-[1.6] text-pretty text-text-secondary italic"
      {...withDomProps(props)}
    />
  ),
  table: (props) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[15px]" {...withDomProps(props)} />
    </div>
  ),
  th: (props) => (
    <th
      className="border-b border-border py-2 pr-4 font-semibold text-text-primary"
      {...withDomProps(props)}
    />
  ),
  td: (props) => (
    <td className="border-b border-border py-2 pr-4 align-top text-text-secondary" {...withDomProps(props)} />
  ),
  img: (props) => {
    // The Markdown source points at arbitrary (untrusted) hosts, so `next/image`
    // is not usable without a remote-pattern allowlist; a plain <img> is the
    // honest choice for repo-authored content.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        loading="lazy"
        className="max-w-full rounded-card border border-border"
        {...withDomProps(props)}
        alt={props.alt ?? ""}
      />
    );
  },
  hr: (props) => <hr className="my-2 border-t border-border" {...withDomProps(props)} />,
  strong: (props) => <strong className="font-[650] text-text-primary" {...withDomProps(props)} />,
  em: (props) => <em {...withDomProps(props)} />
};

export interface MarkdownBodyProps {
  /** The article's Markdown body with the front matter already stripped. */
  readonly markdown: string;
}

export function MarkdownBody({ markdown }: MarkdownBodyProps) {
  return (
    <div data-blog-body="" className={BODY_CLASS}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
