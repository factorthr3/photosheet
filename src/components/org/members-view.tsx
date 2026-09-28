"use client";

import { Copy, Loader2, MailPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelInvitation,
  inviteMember,
  removeMember,
  updateMemberRole,
} from "@/app/o/[slug]/members/actions";
import { FormError } from "@/components/auth/form-error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
  ASSIGNABLE_ROLES,
  can,
  canAssignRole,
  isRole,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLES,
  type Role,
} from "@/lib/permissions";

interface MemberRow {
  id: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string; email: string; image: string | null };
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

function roleLabel(role: string) {
  return isRole(role) ? ROLE_LABELS[role] : role;
}

function InviteForm({ slug, viewerRole }: { slug: string; viewerRole: Role }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const options = (viewerRole === "owner" ? ROLES : ASSIGNABLE_ROLES).filter((r) =>
    canAssignRole(viewerRole, r),
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await inviteMember(slug, {
        email,
        role: role as (typeof ASSIGNABLE_ROLES)[number],
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite a colleague</CardTitle>
        <CardDescription>
          They&apos;ll get an email with a link to join. Invitations expire after 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2 sm:w-44">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options
                  .filter((r) => r !== "owner")
                  .map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <MailPlus />}
            Send invite
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          {ROLE_LABELS[role]}: {ROLE_DESCRIPTIONS[role].toLowerCase()}.
        </p>
        <div className="mt-3">
          <FormError message={error} />
        </div>
      </CardContent>
    </Card>
  );
}

function MemberRoleCell({
  slug,
  member,
  viewer,
}: {
  slug: string;
  member: MemberRow;
  viewer: { userId: string; role: Role };
}) {
  const [pending, startTransition] = useTransition();
  const editable =
    member.user.id !== viewer.userId &&
    isRole(member.role) &&
    canAssignRole(viewer.role, member.role);

  if (!editable) return <Badge variant="secondary">{roleLabel(member.role)}</Badge>;

  const options = ROLES.filter((r) => canAssignRole(viewer.role, r));
  return (
    <Select
      value={member.role}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const res = await updateMemberRole(slug, member.id, value);
          if (res.ok)
            toast.success(
              `${member.user.name || member.user.email} is now ${roleLabel(value).toLowerCase()}`,
            );
          else toast.error(res.error);
        })
      }
    >
      <SelectTrigger
        size="sm"
        className="w-32"
        aria-label={`Role for ${member.user.name || member.user.email}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RemoveMemberButton({ slug, member }: { slug: string; member: MemberRow }) {
  const [pending, startTransition] = useTransition();
  const who = member.user.name || member.user.email;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending} aria-label={`Remove ${who}`}>
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {who}?</AlertDialogTitle>
          <AlertDialogDescription>
            They&apos;ll immediately lose access to this organisation. Images they uploaded stay in
            the library.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              startTransition(async () => {
                const res = await removeMember(slug, member.id);
                if (res.ok) toast.success(`${who} removed`);
                else toast.error(res.error);
              })
            }
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InvitationRowView({ slug, invitation }: { slug: string; invitation: InvitationRow }) {
  const [pending, startTransition] = useTransition();
  return (
    <TableRow>
      <TableCell className="font-medium">{invitation.email}</TableCell>
      <TableCell>
        <Badge variant="outline">{roleLabel(invitation.role)}</Badge>
      </TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">
        Expires {formatDate(invitation.expiresAt)}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Copy invite link for ${invitation.email}`}
          onClick={async () => {
            await navigator.clipboard.writeText(
              `${window.location.origin}/invite/${invitation.id}`,
            );
            toast.success("Invite link copied");
          }}
        >
          <Copy />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={`Cancel invitation for ${invitation.email}`}
          onClick={() =>
            startTransition(async () => {
              const res = await cancelInvitation(slug, invitation.id);
              if (res.ok) toast.success("Invitation cancelled");
              else toast.error(res.error);
            })
          }
        >
          <X />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function MembersView({
  slug,
  viewer,
  members,
  invitations,
}: {
  slug: string;
  viewer: { userId: string; role: Role };
  members: MemberRow[];
  invitations: InvitationRow[];
}) {
  const canManage = can(viewer.role, "member:manage");

  return (
    <div className="grid gap-6 p-4 sm:p-6">
      {canManage && <InviteForm slug={slug} viewerRole={viewer.role} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {members.length} {members.length === 1 ? "member" : "members"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
                {canManage && (
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const removable =
                  canManage &&
                  m.user.id !== viewer.userId &&
                  (m.role !== "owner" || viewer.role === "owner");
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {m.user.image && <AvatarImage src={m.user.image} alt="" />}
                          <AvatarFallback className="text-xs">
                            {(m.user.name || m.user.email).slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {m.user.name || m.user.email}
                            {m.user.id === viewer.userId && (
                              <span className="ml-1 text-muted-foreground">(you)</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <MemberRoleCell slug={slug} member={m} viewer={viewer} />
                      ) : (
                        <Badge variant="secondary">{roleLabel(m.role)}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(m.joinedAt)}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {removable && <RemoveMemberButton slug={slug} member={m} />}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManage && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <Table>
              <TableBody>
                {invitations.map((inv) => (
                  <InvitationRowView key={inv.id} slug={slug} invitation={inv} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
