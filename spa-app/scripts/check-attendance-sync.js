/**
 * Attendance Sync Diagnostic Script
 *
 * I-paste ito sa browser console (F12 > Console) sa daetmassage.com
 * Para i-check kung gumagana ang cross-device sync ng attendance
 */

(async () => {
  const LINE = '─'.repeat(60);
  const results = { passed: 0, failed: 0, warnings: 0 };

  function pass(msg) { console.log(`✅ PASS: ${msg}`); results.passed++; }
  function fail(msg) { console.error(`❌ FAIL: ${msg}`); results.failed++; }
  function warn(msg) { console.warn(`⚠️  WARN: ${msg}`); results.warnings++; }
  function info(msg) { console.log(`ℹ️  ${msg}`); }

  console.log(LINE);
  console.log('🔍 ATTENDANCE SYNC DIAGNOSTIC');
  console.log(LINE);

  // ============================================================
  // 1. CHECK SUPABASE CONNECTION
  // ============================================================
  console.log('\n📡 1. SUPABASE CONNECTION');
  console.log(LINE);

  const supabaseUrl = import.meta?.env?.VITE_SUPABASE_URL;
  const supabaseKey = import.meta?.env?.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl) {
    pass(`Supabase URL configured: ${supabaseUrl}`);
  } else {
    fail('VITE_SUPABASE_URL not set — sync will NOT work');
  }

  if (supabaseKey) {
    pass(`Supabase Anon Key configured (${supabaseKey.substring(0, 20)}...)`);
  } else {
    fail('VITE_SUPABASE_ANON_KEY not set — sync will NOT work');
  }

  // Try to get supabase client
  let supabase = null;
  try {
    const mod = await import('/src/services/supabase/supabaseClient.ts');
    supabase = mod.supabase || mod.default;
    if (supabase) {
      pass('Supabase client initialized');
    } else {
      fail('Supabase client is null');
    }
  } catch (e) {
    fail(`Cannot import supabase client: ${e.message}`);
  }

  // ============================================================
  // 2. CHECK AUTH & BUSINESS CONTEXT
  // ============================================================
  console.log('\n👤 2. AUTH & BUSINESS CONTEXT');
  console.log(LINE);

  let authUser = null;
  try {
    const authMod = await import('/src/services/supabase/authService.ts');
    const authService = authMod.default || authMod.authService;
    authUser = authService?.currentUser;

    if (authUser) {
      info(`Logged in as: ${authUser.name || authUser.email || 'Unknown'}`);
      info(`Role: ${authUser.role || 'Unknown'}`);
      if (authUser.businessId) {
        pass(`Business ID: ${authUser.businessId}`);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(authUser.businessId)) {
          pass('Business ID is valid UUID');
        } else {
          fail(`Business ID is NOT a valid UUID: "${authUser.businessId}" — sync will skip all records`);
        }
      } else {
        fail('No businessId on auth user — sync cannot push/pull data');
      }
    } else {
      fail('No authenticated user — sync disabled');
    }
  } catch (e) {
    fail(`Cannot check auth: ${e.message}`);
  }

  // ============================================================
  // 3. CHECK SUPABASE ATTENDANCE TABLE SCHEMA
  // ============================================================
  console.log('\n🗄️  3. SUPABASE ATTENDANCE TABLE SCHEMA');
  console.log(LINE);

  const requiredColumns = [
    'id', 'business_id', 'employee_id', 'date', 'clock_in', 'clock_out',
    'status', 'created_at', 'updated_at'
  ];
  const missingLocalFields = [
    'clock_in_photo', 'clock_out_photo', 'clock_in_gps', 'clock_out_gps',
    'is_out_of_range', 'branch_id'
  ];

  if (supabase) {
    try {
      // Query one row to check columns
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          fail('Attendance table does NOT EXIST in Supabase — run supabase-schema.sql first');
        } else if (error.code === 'PGRST301' || error.message?.includes('permission')) {
          fail(`RLS blocking access: ${error.message}`);
        } else {
          fail(`Supabase query error: ${error.message} (code: ${error.code})`);
        }
      } else {
        pass('Attendance table exists and is accessible');
        info(`Records in Supabase: ${data?.length || 0} (showing max 1)`);

        if (data && data.length > 0) {
          const columns = Object.keys(data[0]);
          info(`Columns found: ${columns.join(', ')}`);

          // Check required columns
          for (const col of requiredColumns) {
            if (columns.includes(col)) {
              pass(`Column "${col}" exists`);
            } else {
              fail(`Column "${col}" MISSING`);
            }
          }

          // Check if clock_in is stored as time string or timestamp
          const sample = data[0];
          if (sample.clock_in) {
            const isTimeString = /^\d{2}:\d{2}$/.test(sample.clock_in);
            const isTimestamp = sample.clock_in.includes('T') || sample.clock_in.includes('+');
            info(`clock_in value: "${sample.clock_in}"`);
            if (isTimestamp) {
              fail('clock_in is TIMESTAMPTZ format — app sends "HH:mm" string, TYPE MISMATCH');
            } else if (isTimeString) {
              pass('clock_in is TEXT/HH:mm format — matches app format');
            }
          }

          // Check missing fields needed by app
          for (const col of missingLocalFields) {
            if (columns.includes(col)) {
              pass(`Column "${col}" exists`);
            } else {
              warn(`Column "${col}" MISSING — app uses this field but it won't sync`);
            }
          }
        } else {
          warn('No attendance records in Supabase yet — cannot verify column types');
          info('Will check column types via information_schema...');

          // Try information_schema
          const { data: colData, error: colErr } = await supabase
            .rpc('get_table_columns', { table_name_param: 'attendance' })
            .catch(() => ({ data: null, error: { message: 'RPC not available' } }));

          if (!colData) {
            // Alternative: try a raw query
            const { data: rawData, error: rawErr } = await supabase
              .from('attendance')
              .select()
              .limit(0);

            if (!rawErr) {
              info('Table accessible but empty — insert a test clock-in to verify sync');
            }
          }
        }
      }
    } catch (e) {
      fail(`Schema check error: ${e.message}`);
    }

    // Check clock_in column type directly
    try {
      const { data: typeData, error: typeErr } = await supabase
        .from('information_schema.columns' )
        .select('column_name, data_type, udt_name')
        .eq('table_name', 'attendance')
        .in('column_name', ['clock_in', 'clock_out']);

      // This may fail due to RLS, that's ok
    } catch (e) {
      // Ignore - not all setups allow information_schema access
    }
  }

  // ============================================================
  // 4. CHECK LOCAL DEXIE DATA
  // ============================================================
  console.log('\n💾 4. LOCAL DEXIE ATTENDANCE DATA');
  console.log(LINE);

  let localRecords = [];
  try {
    const dbMod = await import('/src/db/index.ts');
    const db = dbMod.db || dbMod.default;

    localRecords = await db.attendance.toArray();
    info(`Total local attendance records: ${localRecords.length}`);

    if (localRecords.length > 0) {
      // Check today's records
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const todayRecords = localRecords.filter(r => r.date === todayStr);
      info(`Today's records (${todayStr}): ${todayRecords.length}`);

      // Show today's details
      todayRecords.forEach(r => {
        const emp = r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : `employeeId: ${r.employeeId}`;
        info(`  → ${emp} | status: ${r.status} | in: ${r.clockIn || '-'} | out: ${r.clockOut || '-'} | sync: ${r._syncStatus || 'unknown'}`);
      });

      // Check sync status distribution
      const syncStatusCounts = {};
      localRecords.forEach(r => {
        const status = r._syncStatus || 'no_status';
        syncStatusCounts[status] = (syncStatusCounts[status] || 0) + 1;
      });
      info('Sync status breakdown:');
      Object.entries(syncStatusCounts).forEach(([status, count]) => {
        const icon = status === 'synced' ? '✅' : status === 'pending' ? '🔄' : status === 'failed' ? '❌' : '❓';
        info(`  ${icon} ${status}: ${count}`);
      });

      // Check for records with null employee
      const nullEmployeeRecords = localRecords.filter(r => r.employee === null || r.employee === undefined);
      if (nullEmployeeRecords.length > 0) {
        warn(`${nullEmployeeRecords.length} records have NULL employee — these won't show time in/out in the table`);
        nullEmployeeRecords.slice(0, 3).forEach(r => {
          info(`  → Record ${r._id} | employeeId: ${r.employeeId} | date: ${r.date}`);
        });
      } else {
        pass('All records have valid employee data');
      }

      // Check for non-UUID IDs (old mock data)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const nonUuidRecords = localRecords.filter(r => r._id && !uuidRegex.test(r._id));
      if (nonUuidRecords.length > 0) {
        warn(`${nonUuidRecords.length} records have non-UUID IDs — these will be SKIPPED during sync`);
        nonUuidRecords.slice(0, 3).forEach(r => {
          info(`  → ID: ${r._id} | date: ${r.date}`);
        });
      } else {
        pass('All record IDs are valid UUIDs');
      }

      // Check for records without branchId
      const noBranch = localRecords.filter(r => !r.branchId);
      if (noBranch.length > 0) {
        warn(`${noBranch.length} records have no branchId — may cause filtering issues for branch owners`);
      }

      // Check pending sync items
      const pending = localRecords.filter(r => r._syncStatus === 'pending');
      if (pending.length > 0) {
        warn(`${pending.length} attendance records PENDING sync — not yet pushed to Supabase`);
      }
    } else {
      warn('No local attendance records found');
    }
  } catch (e) {
    fail(`Cannot read local DB: ${e.message}`);
  }

  // ============================================================
  // 5. CHECK SYNC QUEUE
  // ============================================================
  console.log('\n📤 5. SYNC QUEUE');
  console.log(LINE);

  try {
    const dbMod = await import('/src/db/index.ts');
    const db = dbMod.db || dbMod.default;

    const syncQueue = await db.syncQueue.toArray();
    const attendanceQueue = syncQueue.filter(q => q.entityType === 'attendance');

    info(`Total sync queue items: ${syncQueue.length}`);
    info(`Attendance sync queue items: ${attendanceQueue.length}`);

    if (attendanceQueue.length > 0) {
      const statusCounts = {};
      attendanceQueue.forEach(q => {
        statusCounts[q.status] = (statusCounts[q.status] || 0) + 1;
      });
      Object.entries(statusCounts).forEach(([status, count]) => {
        if (status === 'failed') {
          fail(`${count} attendance sync items FAILED`);
        } else if (status === 'pending') {
          warn(`${count} attendance sync items pending`);
        } else {
          info(`  ${status}: ${count}`);
        }
      });

      // Show failed items details
      const failed = attendanceQueue.filter(q => q.status === 'failed');
      failed.slice(0, 5).forEach(q => {
        info(`  Failed: ${q.operation} | entity: ${q.entityId} | error: ${q.lastError || 'unknown'}`);
      });
    } else {
      pass('No attendance items stuck in sync queue');
    }
  } catch (e) {
    warn(`Cannot check sync queue: ${e.message}`);
  }

  // ============================================================
  // 6. CHECK SYNC MANAGER STATUS
  // ============================================================
  console.log('\n🔄 6. SYNC MANAGER STATUS');
  console.log(LINE);

  if (window.supabaseSyncManager) {
    pass('SupabaseSyncManager is active (window.supabaseSyncManager available)');

    try {
      const status = window.supabaseSyncManager.getStatus?.();
      if (status) {
        info(`Sync status: ${JSON.stringify(status, null, 2)}`);
      }
    } catch (e) {
      warn(`Cannot get sync status: ${e.message}`);
    }
  } else {
    fail('SupabaseSyncManager NOT active — cross-device sync is OFF');
    info('Check if SupabaseSyncManager.init() is being called on app startup');
  }

  // ============================================================
  // 7. CHECK REALTIME SUBSCRIPTIONS
  // ============================================================
  console.log('\n📢 7. REALTIME SUBSCRIPTIONS');
  console.log(LINE);

  if (supabase) {
    try {
      const channels = supabase.getChannels?.() || [];
      const attendanceChannel = channels.find(c => c.topic?.includes('attendance'));

      info(`Active realtime channels: ${channels.length}`);
      channels.forEach(c => {
        info(`  → ${c.topic} (state: ${c.state})`);
      });

      if (attendanceChannel) {
        pass(`Attendance realtime subscription active (state: ${attendanceChannel.state})`);
      } else {
        fail('No realtime subscription for attendance — changes from other devices will NOT appear');
      }
    } catch (e) {
      warn(`Cannot check realtime: ${e.message}`);
    }
  }

  // ============================================================
  // 8. CROSS-DEVICE COMPARISON
  // ============================================================
  console.log('\n🔀 8. LOCAL vs SUPABASE COMPARISON');
  console.log(LINE);

  if (supabase && localRecords.length > 0) {
    try {
      const { data: remoteRecords, error } = await supabase
        .from('attendance')
        .select('id, employee_id, date, clock_in, clock_out, status')
        .order('date', { ascending: false })
        .limit(50);

      if (error) {
        fail(`Cannot fetch remote records: ${error.message}`);
      } else {
        info(`Remote attendance records (last 50): ${remoteRecords?.length || 0}`);

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const localToday = localRecords.filter(r => r.date === todayStr);
        const remoteToday = (remoteRecords || []).filter(r => r.date === todayStr);

        info(`Today's records — Local: ${localToday.length} | Supabase: ${remoteToday.length}`);

        if (localToday.length > 0 && remoteToday.length === 0) {
          fail('Local has today\'s records but Supabase has NONE — sync is NOT working');
        } else if (localToday.length === 0 && remoteToday.length > 0) {
          warn('Supabase has records but local doesn\'t — pull may not be working');
        } else if (localToday.length === remoteToday.length) {
          pass(`Record counts match for today: ${localToday.length}`);
        } else {
          warn(`Record count mismatch — Local: ${localToday.length}, Remote: ${remoteToday.length}`);
        }

        // Check for records that exist locally but not remotely
        const remoteIds = new Set((remoteRecords || []).map(r => r.id));
        const notSynced = localRecords.filter(r => r._id && !remoteIds.has(r._id)).length;
        if (notSynced > 0) {
          warn(`${notSynced} local records not found in Supabase (may be older than last 50 or not synced)`);
        }
      }
    } catch (e) {
      fail(`Comparison error: ${e.message}`);
    }
  }

  // ============================================================
  // 9. TABLE_COLUMNS CHECK
  // ============================================================
  console.log('\n📋 9. FIELD MAPPING CHECK');
  console.log(LINE);

  // Check if fields sent by clockIn() will survive the _toSupabaseFormat filter
  const fieldsFromClockIn = ['employeeId', 'date', 'clockIn', 'clockInPhoto', 'clockInGps', 'branchId', 'status', 'isOutOfRange'];
  const knownSupabaseColumns = [
    'id', 'business_id', 'employee_id', 'date', 'clock_in', 'clock_out',
    'status', 'hours_worked', 'overtime_hours', 'late_minutes', 'notes',
    'clock_in_location', 'clock_out_location', 'clock_in_gps', 'clock_out_gps',
    'sync_status', 'created_at', 'updated_at'
  ];

  const fieldMap = {
    employeeId: 'employee_id',
    date: 'date',
    clockIn: 'clock_in',
    clockOut: 'clock_out',
    clockInPhoto: 'clock_in_photo',
    clockOutPhoto: 'clock_out_photo',
    clockInGps: 'clock_in_gps',
    clockOutGps: 'clock_out_gps',
    branchId: 'branch_id',
    status: 'status',
    isOutOfRange: 'is_out_of_range',
  };

  info('Fields sent by clockIn() → Supabase column:');
  for (const field of fieldsFromClockIn) {
    const snakeField = fieldMap[field] || field;
    const inColumns = knownSupabaseColumns.includes(snakeField);
    if (inColumns) {
      pass(`  ${field} → ${snakeField} (in TABLE_COLUMNS)`);
    } else {
      fail(`  ${field} → ${snakeField} (NOT in TABLE_COLUMNS — will be STRIPPED during sync)`);
    }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + LINE);
  console.log('📊 SUMMARY');
  console.log(LINE);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  console.log(LINE);

  if (results.failed > 0) {
    console.log('\n🔧 SUGGESTED FIXES:');
    console.log('1. Run this SQL in Supabase SQL Editor to add missing columns:');
    console.log(`
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS clock_in_photo TEXT,
  ADD COLUMN IF NOT EXISTS clock_out_photo TEXT,
  ADD COLUMN IF NOT EXISTS clock_in_gps JSONB,
  ADD COLUMN IF NOT EXISTS clock_out_gps JSONB,
  ADD COLUMN IF NOT EXISTS is_out_of_range BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS branch_id UUID;

-- If clock_in/clock_out are TIMESTAMPTZ, change to TEXT:
ALTER TABLE attendance
  ALTER COLUMN clock_in TYPE TEXT USING clock_in::TEXT,
  ALTER COLUMN clock_out TYPE TEXT USING clock_out::TEXT;
    `);
    console.log('2. Update TABLE_COLUMNS in SupabaseSyncManager.js');
    console.log('3. Update FIELD_NAME_MAP for new camelCase → snake_case mappings');
  } else {
    console.log('\n🎉 All checks passed! Cross-device sync should be working.');
  }

  return { passed: results.passed, failed: results.failed, warnings: results.warnings };
})();
