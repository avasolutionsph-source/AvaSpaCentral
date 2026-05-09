/**
 * notify-push Edge Function
 *
 * Frontend → Edge Function → Web Push services → user devices.
 *
 * Receives a notification payload (the same shape the local
 * NotificationService.notify() consumes), resolves the audience
 * via the public.users table, looks up matching push_subscriptions,
 * and fans out a Web Push message to every endpoint using VAPID.
 *
 * Subscriptions that come back as 404/410 are dropped on the spot —
 * the browser already invalidated them and re-registering is a
 * frontend concern.
 *
 * Auth: requires a logged-in caller (the producer device) — we don't
 * gate by role because every role is allowed to fire its own subset
 * of notifications. The Authorization header is forwarded by
 * supabase.functions.invoke().
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// deno-lint-ignore no-explicit-any
import webpush from 'npm:web-push@3.6.7';
import { corsHeaders } from '../_shared/cors.ts';

interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  action?: string | null;
  soundClass?: 'loop' | 'oneshot' | 'silent' | null;
  targetUserId?: string | null;
  targetRole?: string | string[] | null;
  branchId?: string | null;
  businessId?: string | null;
}

interface NotifyPushBody {
  notification: NotificationPayload;
}

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@daetspa.example';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  // deno-lint-ignore no-explicit-any
  (webpush as any).setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[notify-push] VAPID keys not configured');
    return jsonResponse({ error: 'server_misconfigured', detail: 'VAPID keys missing' }, 500);
  }

  try {
    const body = (await req.json()) as NotifyPushBody;
    const n = body?.notification;
    if (!n || (!n.targetUserId && !n.targetRole)) {
      return jsonResponse({ error: 'targetUserId or targetRole required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Resolve recipient user ids.
    let userIds: string[] = [];
    if (n.targetUserId) {
      // Some producers (e.g. POS room-assignment trigger) only have the
      // employee row id and pass it as targetUserId when the linked
      // employee.userId isn't populated. Try users.id first, then fall
      // back to users.employee_id so the push lands on the right account
      // either way.
      const { data: byUserId, error: byUserIdErr } = await supabase
        .from('users')
        .select('id')
        .eq('id', n.targetUserId);
      if (byUserIdErr) {
        return jsonResponse({ error: 'recipient_lookup_failed', detail: byUserIdErr.message }, 500);
      }
      if (byUserId && byUserId.length > 0) {
        userIds = byUserId.map((u: { id: string }) => u.id);
      } else {
        const { data: byEmpId, error: byEmpIdErr } = await supabase
          .from('users')
          .select('id')
          .eq('employee_id', n.targetUserId);
        if (byEmpIdErr) {
          return jsonResponse({ error: 'recipient_lookup_failed', detail: byEmpIdErr.message }, 500);
        }
        userIds = (byEmpId ?? []).map((u: { id: string }) => u.id);
      }
    } else if (n.targetRole) {
      const roles = Array.isArray(n.targetRole) ? n.targetRole : [n.targetRole];
      let q = supabase.from('users').select('id').in('role', roles);
      // Branch is the tightest scope when present, else fall back to business.
      if (n.branchId) {
        q = q.eq('branch_id', n.branchId);
      } else if (n.businessId) {
        q = q.eq('business_id', n.businessId);
      }
      const { data, error } = await q;
      if (error) {
        return jsonResponse({ error: 'recipients_lookup_failed', detail: error.message }, 500);
      }
      userIds = (data ?? []).map((u: { id: string }) => u.id);
    }

    if (userIds.length === 0) {
      return jsonResponse({ ok: true, sent: 0, recipients: 0 });
    }

    // 2. Load every active subscription for those users.
    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds);

    if (subsErr) {
      return jsonResponse({ error: 'subscriptions_lookup_failed', detail: subsErr.message }, 500);
    }
    if (!subs || subs.length === 0) {
      return jsonResponse({ ok: true, sent: 0, recipients: userIds.length, subscriptions: 0 });
    }

    // 3. Send the same payload to every endpoint.
    const pushPayload = JSON.stringify({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      action: n.action ?? '/',
      soundClass: n.soundClass ?? 'oneshot',
    });

    // Loop-class alerts (new service assigned, drawer alert, rotation
    // turn) need to keep ringing until the recipient actually reacts.
    // A single push only triggers ONE OS-level chime + vibrate, then
    // the device goes silent — easy to miss when the phone is in a
    // pocket or face-down. Fire the same push 3× spaced 3 s apart for
    // loop class so the recipient gets ~9 s of repeated buzzes from
    // the OS even when the app is fully closed. Each push shares the
    // same notification tag, so renotify:true on the SW side replays
    // the chime/vibrate without stacking visible banners.
    //
    // Oneshot pings (payment received, info status) fire once. The
    // user has the in-app toast as their primary cue; a single push
    // is sufficient.
    const isLoop = (n.soundClass ?? 'oneshot') === 'loop';
    const burstCount = isLoop ? 3 : 1;
    const burstSpacingMs = 3000;

    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];

    const sendOne = async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        // deno-lint-ignore no-explicit-any
        await (webpush as any).sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          pushPayload,
          { TTL: 60 * 60 * 24 }, // 24h delivery window
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        // deno-lint-ignore no-explicit-any
        const status = (err as any)?.statusCode;
        if (status === 404 || status === 410) {
          if (!expiredIds.includes(s.id)) expiredIds.push(s.id);
        } else {
          console.error('[notify-push] send failed', status, (err as Error)?.message);
        }
      }
    };

    for (let i = 0; i < burstCount; i += 1) {
      await Promise.all(subs.map(sendOne));
      if (i < burstCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, burstSpacingMs));
      }
    }

    // 4. Garbage-collect expired subscriptions.
    if (expiredIds.length > 0) {
      const { error: delErr } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredIds);
      if (delErr) {
        console.warn('[notify-push] failed to delete expired subs', delErr.message);
      }
    }

    return jsonResponse({
      ok: true,
      sent,
      failed,
      expired: expiredIds.length,
      recipients: userIds.length,
      subscriptions: subs.length,
    });
  } catch (err) {
    console.error('[notify-push] unexpected error', err);
    return jsonResponse({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
