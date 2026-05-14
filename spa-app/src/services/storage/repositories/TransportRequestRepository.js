import BaseRepository from '../BaseRepository';

class TransportRequestRepository extends BaseRepository {
  constructor() {
    super('transportRequests', { trackSync: true });
  }

  async create(data) {
    const requestedAt = data.requestedAt || new Date().toISOString();
    return super.create({
      ...data,
      status: data.status || 'pending',
      requestedAt,
    });
  }

  async acknowledge(id, { byName, byUserId } = {}) {
    return this.update(id, {
      status: 'acknowledged',
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: byName,
      acknowledgedByUserId: byUserId,
    });
  }

  async complete(id, { byName, byUserId } = {}) {
    return this.update(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      completedBy: byName,
      completedByUserId: byUserId,
    });
  }

  async cancel(id, { byName, reason } = {}) {
    return this.update(id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: byName,
      cancellationReason: reason,
    });
  }
}

export default new TransportRequestRepository();
