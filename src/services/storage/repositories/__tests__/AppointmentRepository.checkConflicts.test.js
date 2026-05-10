import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../../../db';
import AppointmentRepository from '../AppointmentRepository';

describe('checkConflicts (multi-pax)', () => {
  beforeEach(async () => {
    await db.appointments.clear();
    await db.appointments.add({
      _id: 'a1', employeeId: 'e1', roomId: 'r1',
      scheduledDateTime: '2026-05-11T10:00:00', duration: 60, status: 'confirmed',
    });
  });

  it('flags conflict when ANY of the requested therapists overlap', async () => {
    const conflicts = await AppointmentRepository.checkConflicts({
      employeeIds: ['e2', 'e1'], roomIds: ['r2'],
      scheduledDateTime: '2026-05-11T10:30:00', duration: 60,
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe('therapist:e1');
  });

  it('flags conflict when ANY requested room overlaps', async () => {
    const conflicts = await AppointmentRepository.checkConflicts({
      employeeIds: ['e2'], roomIds: ['r1', 'r2'],
      scheduledDateTime: '2026-05-11T10:30:00', duration: 60,
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toBe('room:r1');
  });

  it('passes through legacy single-resource signature unchanged', async () => {
    const conflicts = await AppointmentRepository.checkConflicts(
      'e1', 'r3', '2026-05-11T10:30:00', 60
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]._id).toBe('a1');
  });

  it('returns empty when no overlap', async () => {
    const conflicts = await AppointmentRepository.checkConflicts({
      employeeIds: ['e1'], roomIds: ['r1'],
      scheduledDateTime: '2026-05-11T12:00:00', duration: 60,
    });
    expect(conflicts).toHaveLength(0);
  });

  it('respects excludeId so editing your own appointment does not self-conflict', async () => {
    const conflicts = await AppointmentRepository.checkConflicts({
      employeeIds: ['e1'], roomIds: ['r1'],
      scheduledDateTime: '2026-05-11T10:30:00', duration: 60,
      excludeId: 'a1',
    });
    expect(conflicts).toHaveLength(0);
  });

  it('ignores cancelled appointments', async () => {
    await db.appointments.update('a1', { status: 'cancelled' });
    const conflicts = await AppointmentRepository.checkConflicts({
      employeeIds: ['e1'], roomIds: ['r1'],
      scheduledDateTime: '2026-05-11T10:30:00', duration: 60,
    });
    expect(conflicts).toHaveLength(0);
  });
});
