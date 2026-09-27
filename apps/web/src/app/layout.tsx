import type { ReactNode } from "react";

import "./globals.css";

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
    <html lang="es" className="light" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
