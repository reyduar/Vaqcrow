import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDocumentWindow } from "./document-window";

describe("openDocumentWindow", () => {
  const createObjectURL = vi.fn(() => "blob:http://localhost/abc");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it("pre-opens a tab for a PDF or image, points it at the object URL and revokes it afterwards", () => {
    const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);

    const pending = openDocumentWindow({ contentType: "application/pdf" });
    expect(open).toHaveBeenCalledWith("", "_blank");

    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    pending.show(blob, "constancia.pdf");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe("blob:http://localhost/abc");
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/abc");
  });

  it("downloads any other content type instead of rendering it", () => {
    const open = vi.spyOn(window, "open");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const pending = openDocumentWindow({ contentType: "application/octet-stream" });
    expect(open).not.toHaveBeenCalled();
    pending.show(new Blob(["x"], { type: "application/octet-stream" }), "archivo.bin");

    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("archivo.bin");
    expect(anchor.isConnected).toBe(false);
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("downloads when the served bytes do not match an inline type, closing the pre-opened tab", () => {
    const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    openDocumentWindow({ contentType: "image/png" }).show(new Blob(["<html>"], { type: "text/html" }), "x.png");

    expect(tab.close).toHaveBeenCalledTimes(1);
    expect(tab.location.href).toBe("");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("falls back to a download when the browser blocked the tab", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    openDocumentWindow({ contentType: "image/jpeg" }).show(new Blob(["x"], { type: "image/jpeg" }), "local.jpg");

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("closes the pre-opened tab on cancel without creating an object URL", () => {
    const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);

    openDocumentWindow({ contentType: "application/pdf" }).cancel();

    expect(tab.close).toHaveBeenCalledTimes(1);
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
