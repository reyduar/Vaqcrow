import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  emptyDocumentsState,
  MAX_UPLOAD_BYTES,
  type DocumentsState,
  type PhotoState
} from "@/application/pyme-onboarding/document-upload";
import { FakeUpload } from "@/test/fake-upload";
import { DocumentUpload } from "./document-upload";

function file(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

function Harness({ upload }: { readonly upload: FakeUpload }) {
  const [documents, setDocuments] = useState<DocumentsState>(emptyDocumentsState);
  const [photos, setPhotos] = useState<readonly PhotoState[]>([]);
  return (
    <DocumentUpload
      upload={upload}
      documents={documents}
      photos={photos}
      onDocumentsChange={setDocuments}
      onPhotosChange={setPhotos}
    />
  );
}

function renderUpload(upload = new FakeUpload()) {
  render(<Harness upload={upload} />);
  return { upload };
}

async function chooseDocument(title: string, chosen: File) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(title), { target: { files: [chosen] } });
  });
}

async function addPhoto(chosen: File) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Agregar foto"), { target: { files: [chosen] } });
  });
}

function photoItems(): HTMLElement[] {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

describe("DocumentUpload documents", () => {
  it("uploads a chosen document on select, shows progress, then the file", async () => {
    const upload = new FakeUpload();
    const release = upload.holdNextUpload();
    renderUpload(upload);

    await chooseDocument("Constancia de CUIT", file("cuit.pdf", "application/pdf"));

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "42");
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
    expect(progress).toHaveAttribute("aria-label", "Subiendo cuit.pdf");
    expect(screen.getByText("Subiendo… 42 %")).toBeInTheDocument();

    await act(async () => {
      release();
    });

    expect(await screen.findByText("cuit.pdf")).toBeInTheDocument();
    expect(screen.getByText("1 KB")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(upload.uploads).toHaveLength(1);
    expect(upload.uploads[0]?.kind).toBe("cuit");
  });

  it("rejects a wrong type locally without calling the port", async () => {
    const { upload } = renderUpload();

    await chooseDocument("Declaraciones de ventas", file("notas.txt", "text/plain"));

    expect(screen.getByRole("alert")).toHaveTextContent("Formato no admitido. Usá PDF, JPG o PNG.");
    expect(upload.uploads).toHaveLength(0);
    expect(screen.getByLabelText("Declaraciones de ventas")).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("-error")
    );
  });

  it("rejects an oversize file locally without calling the port", async () => {
    const { upload } = renderUpload();

    await chooseDocument("Estatuto", file("grande.pdf", "application/pdf", MAX_UPLOAD_BYTES + 1));

    expect(screen.getByRole("alert")).toHaveTextContent("El archivo supera los 10 MB.");
    expect(upload.uploads).toHaveLength(0);
  });

  it("shows the failure and retries the same file from Reintentar", async () => {
    const upload = new FakeUpload();
    upload.failNext("unavailable");
    renderUpload(upload);

    await chooseDocument("Constancia de CUIT", file("cuit.pdf", "application/pdf"));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo subir el archivo. Probá de nuevo.");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    });

    expect(await screen.findByText("cuit.pdf")).toBeInTheDocument();
    expect(upload.uploads).toHaveLength(2);
    expect(upload.uploads[1]?.file.name).toBe("cuit.pdf");
  });

  it("removes an uploaded document and deletes the stored object", async () => {
    const { upload } = renderUpload();

    await chooseDocument("Constancia de CUIT", file("cuit.pdf", "application/pdf"));
    await screen.findByText("cuit.pdf");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    });

    await waitFor(() => expect(screen.queryByText("cuit.pdf")).not.toBeInTheDocument());
    expect(upload.removes).toEqual(["cuit/cuit.pdf"]);
    expect(screen.getAllByText("Sin archivo.")).toHaveLength(3);
  });
});

describe("DocumentUpload photos", () => {
  it("caps photos at four and disables the add control", async () => {
    renderUpload();

    for (let index = 0; index < 4; index += 1) {
      await addPhoto(file(`foto-${index}.jpg`, "image/jpeg"));
    }

    expect(photoItems()).toHaveLength(4);
    expect(screen.getByLabelText("Agregar foto")).toBeDisabled();
    expect(screen.getByText("Llegaste al máximo de 4 fotos.")).toBeInTheDocument();
  });

  it("reorders photos with the mover buttons and disables the ends", async () => {
    renderUpload();

    await addPhoto(file("a.jpg", "image/jpeg"));
    await addPhoto(file("b.jpg", "image/jpeg"));

    expect(photoItems()[0]).toHaveTextContent("a.jpg");
    expect(photoItems()[1]).toHaveTextContent("b.jpg");
    expect(screen.getByRole("button", { name: "Mover foto 1 a la izquierda" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mover foto 2 a la derecha" })).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mover foto 1 a la derecha" }));
    });

    expect(photoItems()[0]).toHaveTextContent("b.jpg");
    expect(photoItems()[1]).toHaveTextContent("a.jpg");
  });

  it("removes a photo and deletes the stored object", async () => {
    const { upload } = renderUpload();

    await addPhoto(file("local.jpg", "image/jpeg"));
    expect(photoItems()).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Quitar foto 1" }));
    });

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(upload.removes).toEqual(["photo/local.jpg"]);
  });
});
