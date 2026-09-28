"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { NAV_ITEMS } from "@/components/shell/nav";
import { OrgSwitcher, type OrgSummary } from "@/components/shell/org-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { can, type Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface ShellProps {
  org: { name: string; slug: string };
  role: Role;
  user: { name: string; email: string; image?: string | null };
  orgs: OrgSummary[];
  /** Segments that exist so far (hides nav entries for features not yet built). */
  enabledSegments: string[];
  children: React.ReactNode;
}

function SidebarContent({
  org,
  role,
  user,
  orgs,
  enabledSegments,
  onNavigate,
}: Omit<ShellProps, "children"> & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (i) => enabledSegments.includes(i.segment) && can(role, i.capability),
  );

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <OrgSwitcher current={org} orgs={orgs} />
      <nav aria-label="Main" className="grid gap-1">
        {items.map((item) => {
          const href = `/o/${org.slug}/${item.segment}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={item.segment}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                active && "bg-accent text-foreground",
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <UserMenu user={user} />
      </div>
    </div>
  );
}

export function AppShell({ children, ...props }: ShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-svh flex-1">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r bg-sidebar md:block">
        <SidebarContent {...props} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent {...props} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Logo />
        </header>
        <main id="main" className="flex min-w-0 flex-1 flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
