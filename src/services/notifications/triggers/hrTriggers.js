// src/services/notifications/triggers/hrTriggers.js
import dataChangeEmitter from '../../sync/DataChangeEmitter';
import NotificationService from '../NotificationService';
import mockApi from '../../../mockApi';

const HR_ENTITIES = ['otRequests', 'leaveRequests', 'cashAdvanceRequests', 'incidentReports', 'payrollRequests'];

const labelByEntity = {
  otRequests: 'OT request',
  leaveRequests: 'Leave request',
  cashAdvanceRequests: 'Cash advance',
  incidentReports: 'Incident report',
  payrollRequests: 'Payroll request',
};

const seenStatusFor = new Map(); // `${entity}:${id}` -> last seen status
let employeeCache = null;

async function findRecord(entity, id) {
  // Different HR repos have different list/getById exposure. Use a cheap
  // fall-through pattern: if mockApi.<entity>.getById exists, use it; else
  // list-and-filter.
  const ns = mockApi[entity] || mockApi[entity?.replace('Requests', '')];
  if (!ns) return null;
  if (typeof ns.getById === 'function') return ns.getById(id);
  if (typeof ns.getRequests === 'function') {
    const all = await ns.getRequests();
    return all.find(r => r._id === id || r.id === id);
  }
  if (typeof ns.getAll === 'function') {
    const all = await ns.getAll();
    return all.find(r => r._id === id || r.id === id);
  }
  return null;
}

async function findEmployee(empId) {
  if (!empId) return null;
  if (!employeeCache) employeeCache = await mockApi.employees.getEmployees();
  return employeeCache.find(e => e._id === empId) || null;
}

export function startHRTriggers() {
  return dataChangeEmitter.subscribe(async (change) => {
    if (!HR_ENTITIES.includes(change.entityType)) return;
    if (!change.entityId) return;

    const r = await findRecord(change.entityType, change.entityId);
    if (!r) return;

    const label = labelByEntity[change.entityType] || 'Request';

    if (change.operation === 'create') {
      await NotificationService.notify({
        type: NotificationService.TYPES.HR_REQUEST_NEW,
        targetRole: ['Manager', 'Owner', 'Branch Owner'],
        title: `New ${label}`,
        message: r.reason || r.purpose || r.title || 'Awaiting approval',
        action: '/hr-hub',
        soundClass: 'oneshot',
        payload: { entity: change.entityType, requestId: r._id || r.id },
        branchId: r.branchId,
      });
    }

    if (change.operation === 'update' && (r.status === 'approved' || r.status === 'rejected')) {
      const key = `${change.entityType}:${r._id || r.id}`;
      const lastStatus = seenStatusFor.get(key);
      if (lastStatus === r.status) return; // already fired for this transition
      seenStatusFor.set(key, r.status);

      const empId = r.employeeId;
      if (!empId) return;
      const emp = await findEmployee(empId);
      if (!emp) return;
      await NotificationService.notify({
        type: NotificationService.TYPES.HR_REQUEST_STATUS,
        targetUserId: emp.userId || emp._id,
        title: `${label} ${r.status}`,
        message: r.notes || r.responseMessage || `Your ${label.toLowerCase()} was ${r.status}.`,
        action: '/my-portal?tab=requests',
        soundClass: 'oneshot',
        payload: { entity: change.entityType, requestId: r._id || r.id, status: r.status },
        branchId: r.branchId,
      });
    }
  });
}
