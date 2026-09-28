import { describe, expect, it } from "vitest";
import { escapeHtml, invitationEmail, shareEmail } from "./email-templates";

describe("email templates", () => {
  it("escapes user-controlled values in HTML", () => {
    const e = shareEmail({
      senderName: "<script>x</script>",
      orgName: "Acme & Co",
      targetName: 'Board "One"',
      message: "<b>hi</b>",
      url: "https://app.example/s/abc",
    });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.html).toContain("Acme &amp; Co");
    expect(e.html).toContain("&lt;b&gt;hi&lt;/b&gt;");
  });

  it("shows the last valid day for an expiring share", () => {
    const e = shareEmail({
      senderName: "Eddie",
      orgName: "Acme",
      targetName: "Spring",
      url: "https://x/s/y",
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    });
    expect(e.text).toContain("works until 31 December 2026");
  });

  it("uses the right article for roles", () => {
    expect(
      invitationEmail({ orgName: "A", inviterName: "B", role: "editor", url: "u" }).html,
    ).toContain("an editor");
    expect(
      invitationEmail({ orgName: "A", inviterName: "B", role: "viewer", url: "u" }).html,
    ).toContain("a viewer");
  });

  it("escapeHtml handles quotes", () => {
    expect(escapeHtml(`"'`)).toBe("&quot;&#39;");
  });
});
