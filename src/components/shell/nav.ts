import {
  Activity,
  Images,
  LayoutGrid,
  type LucideIcon,
  Settings,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import type { Capability } from "@/lib/permissions";

export interface NavItem {
  label: string;
  segment: string;
  icon: LucideIcon;
  capability: Capability;
}

/** Sidebar entries, filtered by the viewer's role. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Library", segment: "library", icon: Images, capability: "image:view" },
  { label: "Boards", segment: "boards", icon: LayoutGrid, capability: "board:view" },
  { label: "Shared links", segment: "shares", icon: Share2, capability: "share:create" },
  { label: "Trash", segment: "trash", icon: Trash2, capability: "image:delete:own" },
  { label: "Members", segment: "members", icon: Users, capability: "member:view" },
  { label: "Activity", segment: "activity", icon: Activity, capability: "audit:view" },
  { label: "Settings", segment: "settings", icon: Settings, capability: "preset:manage" },
];
