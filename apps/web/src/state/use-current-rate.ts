"use client";

import { useEffect, useState } from "react";
import type { RatePort, XlmArsRate } from "@/application/ports/rate-port";

/**
 * Reads the current FX rate once per mount (#572), for the simulated ARS
 * equivalent of the wallet balance. Any failure leaves it `null`, which hides
 * the label: the rate is an aside, so it never blocks or errors the page.
 */
export function useCurrentRate(port: RatePort): XlmArsRate | null {
  const [rate, setRate] = useState<XlmArsRate | null>(null);

  useEffect(() => {
    let active = true;
    void port
      .getCurrent()
      .then((result) => {
        if (active && result.ok) setRate(result.rate);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [port]);

  return rate;
}
