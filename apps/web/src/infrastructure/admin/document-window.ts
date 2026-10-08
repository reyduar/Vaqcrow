import type { OpenDocumentWindow } from "@/application/ports/document-window-port";

/**
 * Shows a private document the admin downloaded through the authenticated
 * `GET /storage/uploads` (Feature #410 / D1, U3). The bytes never get a public
 * URL: they become a short-lived `blob:` object URL that is revoked after use.
 *
 * PDFs and images open in a new tab. The tab is opened synchronously, inside
 * the click, so popup blockers allow it; it is pointed at the object URL once
 * the bytes arrive. Anything else — or bytes whose served type is not one of
 * those, or a blocked tab — is downloaded instead of rendered.
 */

const INLINE_TYPES: ReadonlySet<string> = new Set(["application/pdf", "image/jpeg", "image/png"]);

/** Long enough for the new tab or the download to read the bytes. */
const REVOKE_AFTER_MS = 60_000;

function isInline(contentType: string): boolean {
  return INLINE_TYPES.has(contentType.split(";")[0]!.trim().toLowerCase());
}

function download(url: string, name: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export const openDocumentWindow: OpenDocumentWindow = ({ contentType }) => {
  const tab = isInline(contentType) ? window.open("", "_blank") : null;

  return {
    show(blob, name) {
      const url = URL.createObjectURL(blob);
      if (tab && isInline(blob.type)) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        tab?.close();
        download(url, name);
      }
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
    },
    cancel() {
      tab?.close();
    }
  };
};
