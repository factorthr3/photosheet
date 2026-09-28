/** Usage rights. Stored as a key for the presets below, or free text for a custom licence. */
export const LICENCE_PRESETS = {
  internal: "Internal only",
  press: "Press use",
  editorial: "Editorial only",
  social: "Social media",
  unlimited: "Unlimited",
} as const;

export type LicencePreset = keyof typeof LICENCE_PRESETS;

export function licenceLabel(licence: string | null | undefined): string | null {
  if (!licence) return null;
  return (LICENCE_PRESETS as Record<string, string>)[licence] ?? licence;
}

export type LicenceState = "expired" | "expiring" | "restricted" | "ok" | "none";

const EXPIRING_WINDOW_MS = 30 * 86_400_000;

/**
 * - expired: past its expiry date — must not be used
 * - expiring: expires within 30 days
 * - restricted: any licence other than Unlimited
 */
export function licenceState(
  licence: string | null | undefined,
  expiresAt: string | Date | null | undefined,
  now: Date = new Date(),
): LicenceState {
  if (expiresAt) {
    const t = new Date(expiresAt).getTime();
    if (t <= now.getTime()) return "expired";
    if (t - now.getTime() <= EXPIRING_WINDOW_MS) return "expiring";
  }
  if (!licence) return "none";
  return licence === "unlimited" ? "ok" : "restricted";
}
