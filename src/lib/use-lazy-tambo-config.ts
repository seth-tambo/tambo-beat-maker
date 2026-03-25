"use client";

import { useEffect, useState } from "react";
import type { ContextHelpers, TamboComponent, TamboTool } from "@tambo-ai/react";

interface TamboConfig {
  components: TamboComponent[];
  tools: TamboTool[];
  contextHelpers?: ContextHelpers;
}

export function useLazyTamboConfig(
  options?: { includeContextHelpers?: boolean },
): TamboConfig | null {
  const includeContextHelpers = options?.includeContextHelpers ?? false;
  const [config, setConfig] = useState<TamboConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    void import("@/lib/tambo")
      .then(({ components, tools, contextHelpers }) => {
        if (cancelled) return;
        setConfig({
          components,
          tools,
          ...(includeContextHelpers ? { contextHelpers } : {}),
        });
      })
      .catch((error: unknown) => {
        console.error("Failed to load Tambo config:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [includeContextHelpers]);

  return config;
}
