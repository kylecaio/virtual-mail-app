// Shared mail-piece status badge + status groupings for the customer portal.

type Style = { bg: string; color: string };

const STYLES: Record<string, Style> = {
  "Received": { bg: "#E8EEF8", color: "#2C4A7C" },
  "Scanned": { bg: "#E3F2E7", color: "#1E5B33" },
  "Scan Requested": { bg: "#FBF0D9", color: "#8A5A12" },
  "Forward Requested": { bg: "#FBF0D9", color: "#8A5A12" },
  "Shred Requested": { bg: "#FBF0D9", color: "#8A5A12" },
  "Recycle Requested": { bg: "#FBF0D9", color: "#8A5A12" },
  "Pickup Scheduled": { bg: "#FBF0D9", color: "#8A5A12" },
  "Forwarded": { bg: "#E3F2E7", color: "#1E5B33" },
  "Shredded": { bg: "#EDEBE4", color: "#5E6575" },
  "Recycled": { bg: "#EDEBE4", color: "#5E6575" },
  "Picked Up": { bg: "#E3F2E7", color: "#1E5B33" },
  "Address Correction": { bg: "#F9E3DE", color: "#8A2118" },
  "Return to Sender": { bg: "#F9E3DE", color: "#8A2118" },
  "Pending Verification": { bg: "#EDEBE4", color: "#5E6575" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? { bg: "#EDEBE4", color: "#5E6575" };
  return (
    <span className="inline-block rounded-theme px-2 py-0.5 text-xs font-medium" style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

// A customer can request an action on these.
export const INBOX_STATUSES = ["Received", "Scanned"];
// Requested but not yet fulfilled by staff.
export const IN_PROGRESS_STATUSES = [
  "Scan Requested", "Forward Requested", "Shred Requested", "Recycle Requested", "Pickup Scheduled",
];
// Terminal / closed for the customer.
export const ARCHIVE_STATUSES = [
  "Forwarded", "Shredded", "Recycled", "Picked Up", "Address Correction", "Return to Sender",
];
