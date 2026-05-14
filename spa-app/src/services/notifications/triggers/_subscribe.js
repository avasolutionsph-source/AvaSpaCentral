// Shared subscription helper for notification triggers.
//
// Notification triggers care about *every* write to a watched entity, no
// matter where it originated. There are two distinct sources:
//
//   1. dataChangeEmitter — fires when this device performs a local write
//      (BaseRepository.create/update/delete). Local-only.
//
//   2. supabaseSyncManager realtime_update — fires when a write made on
//      a *different* device propagates here via Supabase realtime. The
//      realtime handler writes to Dexie directly with db.put(), bypassing
//      BaseRepository, so dataChangeEmitter never sees these. Without an
//      explicit subscription, cross-device assignments / payments / status
//      changes silently never trigger their notification chime.
//
// triggerSubscribe wires both sources to a single callback that receives a
// normalized change shape, so individual trigger files don't have to know
// the topology.
import dataChangeEmitter from '../../sync/DataChangeEmitter';
import { supabaseSyncManager } from '../../supabase';

export function triggerSubscribe(callback) {
  const unsubLocal = dataChangeEmitter.subscribe((change) => {
    callback(change);
  });

  // Map Supabase realtime event types to the local operation names that
  // BaseRepository emits, so trigger code can filter on a single
  // convention (e.g. 'create'/'update'/'delete') regardless of source.
  const SUPABASE_TO_LOCAL_OP = { INSERT: 'create', UPDATE: 'update', DELETE: 'delete' };

  let unsubRemote = () => {};
  try {
    unsubRemote = supabaseSyncManager.subscribe((status) => {
      if (!status || status.type !== 'realtime_update') return;
      callback({
        entityType: status.entityType,
        operation: SUPABASE_TO_LOCAL_OP[status.eventType] || 'update',
        entityId: status.record?.id || status.record?._id || null,
        origin: 'remote',
      });
    });
  } catch (err) {
    // supabaseSyncManager may not be initialized in test environments
    // or local-only mode. Local-write triggers still work; cross-device
    // ones won't, but that's the same as before this helper existed.
    console.warn('[notif triggers] remote subscription unavailable:', err?.message || err);
  }

  return () => {
    if (unsubLocal) unsubLocal();
    if (unsubRemote) unsubRemote();
  };
}
