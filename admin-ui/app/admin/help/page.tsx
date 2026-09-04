import { Suspense } from "react";
import { HelpSupportView } from "@/components/help/help-support-view";

export default function HelpPage() {
  // HelpSupportView reads the module/article from the query string, which Next
  // requires a Suspense boundary for during prerendering.
  return (
    <Suspense
      fallback={
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted">
          Loading...
        </div>
      }
    >
      <HelpSupportView />
    </Suspense>
  );
}
