"use client";

import {
  Check,
  Copy,
  Eye,
  Globe,
  Loader2,
  Lock,
  Mail,
  Share2,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { canonicalParams, describeParams } from "@/lib/image/render-params";
import type { PresetDto } from "@/lib/presets";
import type { ShareDto } from "@/lib/shares-dto";
import { cn } from "@/lib/utils";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

function addDays(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function stateBadge(s: ShareDto) {
  if (s.state === "revoked") return <Badge variant="secondary">Revoked</Badge>;
  if (s.state === "expired") return <Badge variant="secondary">Expired</Badge>;
  return <Badge className="bg-emerald-600 text-white">Active</Badge>;
}

function EmailForm({ slug, share, onDone }: { slug: string; share: ShareDto; onDone: () => void }) {
  const [to, setTo] = useState("");
  const [message, setMessage] = useState(share.message ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid gap-2 rounded-md border bg-muted/40 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
          const recipients = to.split(/[\s,;]+/).filter(Boolean);
          const { sent } = await api<{ sent: number }>(`/api/o/${slug}/shares/${share.id}/email`, {
            method: "POST",
            body: JSON.stringify({ to: recipients, message: message || undefined }),
          });
          toast.success(`Link emailed to ${sent} ${sent === 1 ? "person" : "people"}`);
          onDone();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setPending(false);
        }
      }}
    >
      <Label htmlFor={`to-${share.id}`}>Recipients</Label>
      <Input
        id={`to-${share.id}`}
        required
        placeholder="alex@press.com, sam@agency.com"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <Label htmlFor={`msg-${share.id}`}>Message (optional)</Label>
      <Textarea
        id={`msg-${share.id}`}
        rows={3}
        maxLength={2000}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Mail />} Send
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ShareRow({
  slug,
  share,
  onChange,
}: {
  slug: string;
  share: ShareDto;
  onChange: (s: ShareDto) => void;
}) {
  const [emailing, setEmailing] = useState(false);
  const active = share.state === "active";
  return (
    <li className="grid gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {stateBadge(share)}
        {share.hasPassword && (
          <Badge variant="outline" className="gap-1">
            <Lock className="size-3" /> Password
          </Badge>
        )}
        {!share.allowDownload && <Badge variant="outline">View only</Badge>}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <Eye className="size-3.5" aria-hidden="true" /> {share.views} views · {share.downloads}{" "}
          downloads
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={share.url}
          aria-label="Share link"
          className="h-8 font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />
        {active && <CopyButton text={share.url} label="Copy" />}
      </div>
      <p className="text-xs text-muted-foreground">
        Created {formatDate(share.createdAt)}
        {share.createdBy && ` by ${share.createdBy}`}
        {share.expiresAt &&
          ` · ${share.state === "expired" ? "expired" : "expires"} ${formatDate(new Date(new Date(share.expiresAt).getTime() - 1))}`}
      </p>
      {active && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEmailing((e) => !e)}>
            <Mail /> Email link
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={async () => {
              try {
                const { share: s } = await api<{ share: ShareDto }>(
                  `/api/o/${slug}/shares/${share.id}/revoke`,
                  { method: "POST" },
                );
                onChange(s);
                toast.success("Link revoked");
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <Trash2 /> Revoke
          </Button>
        </div>
      )}
      {emailing && <EmailForm slug={slug} share={share} onDone={() => setEmailing(false)} />}
    </li>
  );
}

function CreateLinkForm({
  slug,
  targetType,
  targetId,
  presets,
  onCreated,
}: {
  slug: string;
  targetType: "image" | "board";
  targetId: string;
  presets: PresetDto[];
  onCreated: (s: ShareDto) => void;
}) {
  const [expiry, setExpiry] = useState("30");
  const [customDate, setCustomDate] = useState(addDays(30));
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [allowDownload, setAllowDownload] = useState(true);
  const [allowOriginal, setAllowOriginal] = useState(false);
  const [presetIds, setPresetIds] = useState<string[]>(() => presets.slice(0, 2).map((p) => p.id));
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const expiresOn =
        expiry === "never" ? null : expiry === "custom" ? customDate : addDays(Number(expiry));
      const { share } = await api<{ share: ShareDto }>(`/api/o/${slug}/shares`, {
        method: "POST",
        body: JSON.stringify({
          targetType,
          targetId,
          expiresOn,
          password: usePassword ? password : null,
          allowDownload,
          allowOriginal,
          allowedPresetIds: presetIds,
          message: message || null,
        }),
      });
      await navigator.clipboard.writeText(share.url).catch(() => {});
      toast.success("Link created and copied");
      onCreated(share);
      setPassword("");
      setUsePassword(false);
      setMessage("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={create} className="grid gap-4 rounded-lg border p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="share-expiry">Expires</Label>
          <Select value={expiry} onValueChange={setExpiry}>
            <SelectTrigger id="share-expiry" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">In 7 days</SelectItem>
              <SelectItem value="30">In 30 days</SelectItem>
              <SelectItem value="90">In 90 days</SelectItem>
              <SelectItem value="custom">On a date…</SelectItem>
              <SelectItem value="never">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {expiry === "custom" && (
          <div className="grid gap-2">
            <Label htmlFor="share-date">Last day</Label>
            <Input
              id="share-date"
              type="date"
              min={addDays(0)}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <label className="flex items-center justify-between text-sm">
          Require a password
          <Switch checked={usePassword} onCheckedChange={setUsePassword} />
        </label>
        {usePassword && (
          <Input
            type="text"
            aria-label="Link password"
            minLength={4}
            required
            placeholder="At least 4 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
        )}
      </div>

      <div className="grid gap-2">
        <label className="flex items-center justify-between text-sm">
          Allow downloads
          <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
        </label>
        {allowDownload && (
          <fieldset className="grid gap-1.5 rounded-md bg-muted/40 p-3">
            <legend className="sr-only">Sizes recipients can download</legend>
            <p className="mb-1 text-xs text-muted-foreground">Sizes recipients can download</p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={allowOriginal} onCheckedChange={(c) => setAllowOriginal(!!c)} />
              Original files
            </label>
            {presets.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={presetIds.includes(p.id)}
                  onCheckedChange={(c) =>
                    setPresetIds((ids) => (c ? [...ids, p.id] : ids.filter((x) => x !== p.id)))
                  }
                />
                {p.name}
                <span className="text-xs text-muted-foreground">
                  {describeParams(canonicalParams(p))}
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="share-message">Note shown on the page (optional)</Label>
        <Textarea
          id="share-message"
          rows={2}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Hi! Here are the approved images for the launch."
        />
      </div>

      <FormError message={error} />
      <Button
        type="submit"
        disabled={pending || (allowDownload && !allowOriginal && presetIds.length === 0)}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Globe />}
        Create link
      </Button>
    </form>
  );
}

interface PeopleState {
  visibility: "ORG" | "PRIVATE";
  createdById: string | null;
  members: { userId: string; name: string; email: string }[];
  candidates: { userId: string; name: string; email: string; role: string }[];
}

function PeopleTab({
  slug,
  boardId,
  canChangeVisibility,
}: {
  slug: string;
  boardId: string;
  canChangeVisibility: boolean;
}) {
  const [state, setState] = useState<PeopleState | null>(null);
  const [adding, setAdding] = useState("");
  const base = `/api/o/${slug}/boards/${boardId}`;

  useEffect(() => {
    let cancelled = false;
    api<PeopleState>(`${base}/members`).then(
      (next) => !cancelled && setState(next),
      () => !cancelled && toast.error("Couldn't load people"),
    );
    return () => {
      cancelled = true;
    };
  }, [base]);

  if (!state)
    return (
      <Loader2
        className="mx-auto my-6 size-5 animate-spin text-muted-foreground"
        aria-label="Loading"
      />
    );
  const available = state.candidates.filter(
    (c) => !state.members.some((m) => m.userId === c.userId),
  );

  return (
    <div className="grid gap-5">
      <RadioGroup
        value={state.visibility}
        disabled={!canChangeVisibility}
        onValueChange={async (v) => {
          try {
            await api(`${base}`, { method: "PATCH", body: JSON.stringify({ visibility: v }) });
            setState((s) => (s ? { ...s, visibility: v as PeopleState["visibility"] } : s));
            toast.success(
              v === "PRIVATE"
                ? "Only people you choose can see this board"
                : "Everyone in the organisation can see this board",
            );
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
        aria-label="Who can see this board"
      >
        <Label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-primary">
          <RadioGroupItem value="ORG" className="mt-0.5" />
          <span>
            <span className="block font-medium">Everyone in the organisation</span>
            <span className="text-xs text-muted-foreground">
              Adding people below just notifies them.
            </span>
          </span>
        </Label>
        <Label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-primary">
          <RadioGroupItem value="PRIVATE" className="mt-0.5" />
          <span>
            <span className="block font-medium">Only people I choose</span>
            <span className="text-xs text-muted-foreground">You, admins and the people below.</span>
          </span>
        </Label>
      </RadioGroup>
      {!canChangeVisibility && (
        <p className="text-xs text-muted-foreground">
          Only the board&apos;s creator or an admin can change this.
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="add-person">Share with a colleague</Label>
        <div className="flex gap-2">
          <Select value={adding} onValueChange={setAdding}>
            <SelectTrigger id="add-person" className="flex-1">
              <SelectValue placeholder="Choose a person…" />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0 && (
                <div className="p-2 text-sm text-muted-foreground">
                  Everyone already has access.
                </div>
              )}
              {available.map((c) => (
                <SelectItem key={c.userId} value={c.userId}>
                  {c.name || c.email} <span className="text-muted-foreground">({c.email})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!adding}
            onClick={async () => {
              try {
                const res = await api<{ members: PeopleState["members"] }>(`${base}/members`, {
                  method: "POST",
                  body: JSON.stringify({ userIds: [adding] }),
                });
                setState((s) => (s ? { ...s, members: res.members } : s));
                setAdding("");
                toast.success("Shared — they've been emailed a link");
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <UserPlus /> Share
          </Button>
        </div>
      </div>

      <ul className="grid gap-1" aria-label="People with access">
        {state.members.map((m) => (
          <li
            key={m.userId}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
          >
            <Users className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">
              {m.name || m.email} <span className="text-muted-foreground">{m.email}</span>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${m.name || m.email}`}
              onClick={async () => {
                const res = await api<{ members: PeopleState["members"] }>(`${base}/members`, {
                  method: "DELETE",
                  body: JSON.stringify({ userId: m.userId }),
                });
                setState((s) => (s ? { ...s, members: res.members } : s));
              }}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Share an image or board: public links (and internal people, for boards). */
export function ShareButton({
  slug,
  targetType,
  targetId,
  targetName,
  canChangeVisibility = false,
  variant = "default",
}: {
  slug: string;
  targetType: "image" | "board";
  targetId: string;
  targetName: string;
  canChangeVisibility?: boolean;
  variant?: "default" | "lightbox";
}) {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<ShareDto[] | null>(null);
  const [presets, setPresets] = useState<PresetDto[] | null>(null);

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      api<{ shares: ShareDto[] }>(
        `/api/o/${slug}/shares?targetType=${targetType}&targetId=${targetId}`,
      ),
      api<{ presets: PresetDto[] }>(`/api/o/${slug}/presets`),
    ]).then(([s, p]) => {
      setShares(s.shares);
      setPresets(p.presets);
    });
  }, [open, slug, targetType, targetId]);

  const linksTab = (
    <div className="grid gap-4">
      {presets ? (
        <CreateLinkForm
          slug={slug}
          targetType={targetType}
          targetId={targetId}
          presets={presets}
          onCreated={(s) => setShares((all) => [s, ...(all ?? [])])}
        />
      ) : (
        <Loader2
          className="mx-auto my-6 size-5 animate-spin text-muted-foreground"
          aria-label="Loading"
        />
      )}
      {shares && shares.length > 0 && (
        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Links</h3>
          <ul className="grid gap-2">
            {shares.map((s) => (
              <ShareRow
                key={s.id}
                slug={slug}
                share={s}
                onChange={(u) =>
                  setShares((all) => all?.map((x) => (x.id === u.id ? u : x)) ?? null)
                }
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <>
      {variant === "lightbox" ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Share"
          className="text-white hover:bg-white/15 hover:text-white"
          onClick={() => setOpen(true)}
        >
          <Share2 />
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Share2 /> Share
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share “{targetName}”</DialogTitle>
            <DialogDescription>
              {targetType === "board"
                ? "Send a public link to anyone, or share with colleagues inside PhotoSheet."
                : "Anyone with the link can view this image — no login needed."}
            </DialogDescription>
          </DialogHeader>
          {targetType === "board" ? (
            <Tabs defaultValue="link">
              <TabsList className={cn("mb-3 grid w-full grid-cols-2")}>
                <TabsTrigger value="link">
                  <Globe /> Public link
                </TabsTrigger>
                <TabsTrigger value="people">
                  <Users /> People
                </TabsTrigger>
              </TabsList>
              <TabsContent value="link">{linksTab}</TabsContent>
              <TabsContent value="people">
                <PeopleTab
                  slug={slug}
                  boardId={targetId}
                  canChangeVisibility={canChangeVisibility}
                />
              </TabsContent>
            </Tabs>
          ) : (
            linksTab
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
