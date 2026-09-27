import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Slider } from "./slider";

describe("Slider", () => {
  it("renders a labelled slider with a visible, formatted current value", () => {
    render(
      <Slider
        label="Monto objetivo"
        defaultValue={30}
        minValue={0}
        maxValue={100}
        formatValue={(value) => `${value} XLM`}
      />
    );

    expect(screen.getByText("Monto objetivo")).toBeInTheDocument();
    expect(screen.getByText("30 XLM")).toBeInTheDocument();
  });

  it("moves the thumb with the keyboard and reports the new value", () => {
    const onChange = vi.fn();
    render(
      <Slider
        label="Monto objetivo"
        defaultValue={30}
        minValue={0}
        maxValue={100}
        step={5}
        onChange={onChange}
      />
    );

    const thumb = screen.getByRole("slider", { name: "Monto objetivo" });
    thumb.focus();
    fireEvent.keyDown(thumb, { key: "ArrowRight" });

    expect(onChange).toHaveBeenLastCalledWith(35);
  });

  it("renders two independently labelled thumbs for a range value", () => {
    render(
      <Slider
        label="Rango de monto"
        defaultValue={[20, 80]}
        minValue={0}
        maxValue={100}
        rangeThumbLabels={["mínimo", "máximo"]}
      />
    );

    // React Aria's slider thumb combines the thumb's own `aria-label` with the
    // group's <Label> via a self-referencing `aria-labelledby` (a documented
    // accessible-naming technique for otherwise unlabelable native inputs),
    // so the computed name carries both texts — confirmed empirically below.
    expect(screen.getByRole("slider", { name: "Rango de monto (mínimo) Rango de monto" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Rango de monto (máximo) Rango de monto" })).toBeInTheDocument();
  });

  it("never fires onChange while disabled", () => {
    const onChange = vi.fn();
    render(
      <Slider label="Monto objetivo" defaultValue={30} minValue={0} maxValue={100} isDisabled onChange={onChange} />
    );

    const thumb = screen.getByRole("slider", { name: "Monto objetivo" });
    fireEvent.keyDown(thumb, { key: "ArrowRight" });

    expect(onChange).not.toHaveBeenCalled();
  });
});
