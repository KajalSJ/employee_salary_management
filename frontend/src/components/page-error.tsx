"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <TriangleAlert
        className="size-6 text-muted-foreground"
        aria-hidden="true"
      />
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        An unexpected error occurred while loading this page.
      </p>
      <Button variant="outline" className="mt-2" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
