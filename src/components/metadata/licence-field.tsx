"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LICENCE_PRESETS } from "@/lib/images/licence";

const CUSTOM = "__custom";
const NONE = "__none";

/** Licence preset/custom text + optional expiry date. Values are the stored forms. */
export function LicenceField({
  licence,
  expires,
  onLicence,
  onExpires,
  idPrefix,
}: {
  licence: string;
  expires: string;
  onLicence: (v: string) => void;
  onExpires: (v: string) => void;
  idPrefix: string;
}) {
  const isPreset = licence === "" || licence in LICENCE_PRESETS;
  const selectValue = licence === "" ? NONE : isPreset ? licence : CUSTOM;

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-licence`}>Usage rights</Label>
        <Select
          value={selectValue}
          onValueChange={(v) =>
            onLicence(v === NONE ? "" : v === CUSTOM ? (isPreset ? "Custom licence" : licence) : v)
          }
        >
          <SelectTrigger id={`${idPrefix}-licence`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not set</SelectItem>
            {Object.entries(LICENCE_PRESETS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>Custom…</SelectItem>
          </SelectContent>
        </Select>
        {selectValue === CUSTOM && (
          <Input
            aria-label="Custom licence"
            maxLength={200}
            value={licence}
            onChange={(e) => onLicence(e.target.value)}
            placeholder="e.g. Client X, UK print only"
          />
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-expires`}>Licence expires</Label>
        <Input
          id={`${idPrefix}-expires`}
          type="date"
          value={expires}
          onChange={(e) => onExpires(e.target.value)}
          aria-describedby={`${idPrefix}-expires-hint`}
        />
        <p id={`${idPrefix}-expires-hint`} className="text-xs text-muted-foreground">
          Leave empty if it never expires. The image is flagged from this date.
        </p>
      </div>
    </div>
  );
}
