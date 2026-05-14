/**
 * QRPaymentModal — shared QR-payment modal for POS and Online Booking.
 *
 * Hands off live status to usePaymentIntent (Realtime + polling) and renders
 * one of four states: loading, awaiting_payment (QR + countdown), succeeded,
 * or terminal-non-success (expired/failed/cancelled). Calls onSuccess once
 * when the intent flips to 'succeeded' and onClose when the user dismisses.
 *
 * Pass fullScreen=true for the public Booking page so the QR fills the
 * viewport on mobile; the embedded POS modal uses the default size.
 */
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { usePaymentIntent } from '../hooks/usePaymentIntent';

const TERMINAL_NON_SUCCESS = ['expired', 'failed', 'cancelled'];

function formatPesos(amount) {
  return Number(amount ?? 0).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  });
}

function formatCountdown(seconds) {
  if (seconds == null) return '';
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function QRPaymentModal({
  intentId,
  onSuccess,
  onClose,
  fullScreen = false,
}) {
  const { intent, loading, error } = usePaymentIntent(intentId);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const successFiredRef = useRef(false);

  useEffect(() => {
    if (!intent?.nextpay_qr_string) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(intent.nextpay_qr_string, { width: 320, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [intent?.nextpay_qr_string]);

  useEffect(() => {
    if (!intent?.expires_at) {
      setSecondsLeft(null);
      return undefined;
    }
    const tick = () => {
      const ms = new Date(intent.expires_at).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [intent?.expires_at]);

  // Fire onSuccess exactly once when the intent flips to 'succeeded'
  useEffect(() => {
    if (intent?.status === 'succeeded' && !successFiredRef.current) {
      successFiredRef.current = true;
      onSuccess?.(intent);
    }
  }, [intent?.status, intent, onSuccess]);

  const wrapperClass = fullScreen ? 'qr-modal qr-modal--full' : 'qr-modal';

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className={wrapperClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-modal-title"
      >
        {loading && <p>Loading payment…</p>}
        {!loading && error && (
          <>
            <h2 id="qr-modal-title">Payment error</h2>
            <p>{error.message ?? 'Something went wrong.'}</p>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </>
        )}
        {!loading && !error && intent && renderBody({
          intent,
          qrDataUrl,
          secondsLeft,
          onClose,
        })}
      </div>
    </div>
  );
}

function renderBody({ intent, qrDataUrl, secondsLeft, onClose }) {
  if (TERMINAL_NON_SUCCESS.includes(intent.status)) {
    return (
      <>
        <h2 id="qr-modal-title">Payment {intent.status}</h2>
        <p>The QR code has {intent.status}. Please try again.</p>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </>
    );
  }

  if (intent.status === 'succeeded') {
    return (
      <>
        <h2 id="qr-modal-title">Payment received ✓</h2>
        <p>Amount: {formatPesos(intent.amount)}</p>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </>
    );
  }

  return (
    <>
      <h2 id="qr-modal-title">Scan to pay</h2>
      <p>Amount: {formatPesos(intent.amount)}</p>
      {qrDataUrl ? (
        <img src={qrDataUrl} alt="QRPh code" width={320} height={320} />
      ) : (
        <p>Generating QR…</p>
      )}
      {secondsLeft !== null && <p>Expires in {formatCountdown(secondsLeft)}</p>}
      <p>Open your bank or e-wallet app and scan the QR code above.</p>
      <button type="button" onClick={onClose}>
        Cancel
      </button>
    </>
  );
}
