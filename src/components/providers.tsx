"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * next-themes injects an inline <script> that sets the theme class before paint. It only needs to
 * run from the server HTML; when React renders the root on the client (e.g. after a `notFound()`
 * deep in the tree) React 19 warns about client-rendered scripts. Marking the client copy as a
 * data block (`text/plain`) keeps it inert and silences the warning; next-themes already
 * suppresses the hydration mismatch on this element.
 */
const themeScriptProps = {
  type: typeof window === "undefined" ? "text/javascript" : "text/plain",
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={themeScriptProps}
    >
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  );
}
