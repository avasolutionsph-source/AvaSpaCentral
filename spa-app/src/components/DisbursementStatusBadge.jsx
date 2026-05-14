/**
 * DisbursementStatusBadge — small pill showing the current state of a
 * disbursement row. Colours follow the existing app's status-tag palette.
 */

const STYLES = {
  pending:    { bg: '#f1f5f9', fg: '#475569', label: 'Pending' },
  submitted:  { bg: '#dbeafe', fg: '#1d4ed8', label: 'In flight' },
  succeeded:  { bg: '#dcfce7', fg: '#166534', label: 'Paid ✓' },
  failed:     { bg: '#fee2e2', fg: '#991b1b', label: 'Failed' },
  cancelled:  { bg: '#fef9c3', fg: '#854d0e', label: 'Cancelled' },
};

export default function DisbursementStatusBadge({ status, failureReason, compact = false }) {
  const s = STYLES[status] ?? { bg: '#f1f5f9', fg: '#475569', label: status ?? 'unknown' };
  return (
    <span
      title={failureReason || s.label}
      style={{
        display: 'inline-block',
        padding: compact ? '2px 8px' : '4px 10px',
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        fontSize: compact ? '0.72rem' : '0.78rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}
