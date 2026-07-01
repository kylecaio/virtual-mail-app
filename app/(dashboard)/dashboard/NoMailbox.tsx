export default function NoMailbox({ email }: { email: string | null }) {
  return (
    <div className="rounded-theme border border-border bg-surface p-8 text-center">
      <h1 className="font-serif text-xl font-semibold text-ink">No mailbox linked yet</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-inkMuted">
        Your account{email ? ` (${email})` : ""} isn&apos;t linked to a Virtual Mail box yet. Once BIG Oakland
        activates your mailbox, your incoming mail will appear here. Contact us at{" "}
        <span className="font-medium text-ink">mail@bigoakland.com</span> or (510) 555-0100 if you think this is a mistake.
      </p>
    </div>
  );
}
