import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { BrowserSessionProvider } from "@/presentation/components/browser-session-provider";

import "./globals.css";

/**
 * Geist is the demo's single sans family and Geist Mono its monospaced one,
 * per `docs/design/demo-ui.md` §5.5: the template loads both from Google Fonts
 * and, by the source-of-truth decision, the template wins over the earlier
 * Inter recommendation. `next/font/google` self-hosts them at build time (no
 * request reaches Google from the browser, and no new dependency is added).
 *
 * Each font exposes a CSS variable that `globals.css` maps onto Tailwind's
 * `--font-sans` / `--font-mono`, so the body inherits Geist and every
 * `font-mono` value — hashes, ids, correlation ids — resolves to Geist Mono.
 * The system stack after each variable is the fallback if the webfont is
 * unavailable.
 */
const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap"
});

/**
 * Applies the persisted theme before the first paint.
 *
 * The server renders the light theme so the page stays statically prerendered,
 * and this script corrects it synchronously while the browser parses the head —
 * before anything is painted, so there is no flash and no hydration mismatch
 * (`suppressHydrationWarning` on `<html>` covers what the script changes).
 *
 * `Sistema` is resolved here rather than in a component, so no component has to
 * know whether the preference was explicit or inherited from the OS. It sets
 * the class and the attribute together because HeroUI documents both and its
 * stylesheet accepts either. The `try/catch` covers storage being unavailable;
 * the fallback is light.
 */
const THEME_BOOTSTRAP = `(function(){try{var p=localStorage.getItem("vaqcrow-theme")||"system";var dark=p==="dark"||(p==="system"&&typeof window.matchMedia==="function"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var t=dark?"dark":"light";var e=document.documentElement;e.setAttribute("data-theme",t);e.classList.toggle("dark",dark);e.classList.toggle("light",!dark);e.style.colorScheme=t}catch(e){}})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      className={`light ${geistSans.variable} ${geistMono.variable}`}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      {/*
        One session store for the whole app (per mount, never a module
        singleton), so the header on `/`, `/portfolio`, `/company` and the
        auth pages share the real session across client navigations.
      */}
      <body>
        <BrowserSessionProvider>{children}</BrowserSessionProvider>
      </body>
    </html>
  );
}
