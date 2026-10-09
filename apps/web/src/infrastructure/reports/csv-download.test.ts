import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadCsv, printReport, sanitizeFilename } from "./csv-download";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("downloadCsv", () => {
  it("creates an object URL, clicks a temporary anchor and revokes the URL", () => {
    const createObjectURL = vi.fn(() => "blob:report");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clicks: { download: string; href: string }[] = [];
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicks.push({ download: this.download, href: this.href });
      });

    downloadCsv("informe-2026-04_2026-09.csv", "a,b\r\n");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clicks).toEqual([{ download: "informe-2026-04_2026-09.csv", href: "blob:report" }]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
    expect(click).toHaveBeenCalledTimes(1);
    // The temporary anchor never leaks into the document.
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("sanitizes the filename before it reaches the anchor", () => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    downloadCsv("../../etc/passwd.csv", "x");

    expect(downloads).toEqual(["..-..-etc-passwd.csv"]);
  });

  it("does nothing when there is no document (SSR guard)", () => {
    const createObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    vi.stubGlobal("document", undefined);

    expect(() => downloadCsv("informe.csv", "a,b")).not.toThrow();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe("sanitizeFilename", () => {
  it("strips path separators and control characters", () => {
    expect(sanitizeFilename("a/b\\c:d*e?f\"g<h>i|j.csv")).toBe("a-b-c-d-e-f-g-h-i-j.csv");
  });

  it("falls back to a safe name when nothing is left", () => {
    expect(sanitizeFilename("   ")).toBe("informe.csv");
  });
});

describe("printReport", () => {
  it("asks the browser to print", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});

    printReport();

    expect(print).toHaveBeenCalledTimes(1);
  });
});
