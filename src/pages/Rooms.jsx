import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { homeServicesApi, transactionsApi } from '../mockApi/offlineApi';
import { format, parseISO } from 'date-fns';
import { supabaseSyncManager } from '../services/supabase';
import dataChangeEmitter from '../services/sync/DataChangeEmitter';
import useLocationTracker from '../hooks/useLocationTracker';
import PasundoLiveMap from '../components/PasundoLiveMap';

// Import new shared components and hooks
import { useCrudOperations } from '../hooks';
import {
  ConfirmDialog,
  PageHeader,
  FilterBar,
  CrudModal,
  PageLoading,
  EmptyState,
  ManageOrder
} from '../components/shared';
import PaxBadge from '../components/booking/PaxBadge';
import { roomValidation, validateWithToast } from '../validation/schemas';

const Rooms = ({ embedded = false, onDataChange, onOpenCreateRef, onManageOrderRef }) => {
  const { user, showToast, isTherapist, canEdit, getEffectiveBranchId } = useApp();

  // Filter state (kept separate as it's page-specific)
  const [filterStatus, setFilterStatus] = useState('show_all');
  const [upcomingBookings, setUpcomingBookings] = useState([]);

  // Timer state for countdown on occupied rooms
  const [currentTime, setCurrentTime] = useState(new Date());

  // Stop service modal state
  const [stopServiceModal, setStopServiceModal] = useState({ isOpen: false, room: null, isHomeService: false });
  const [stopReason, setStopReason] = useState('');
  const [isStoppingService, setIsStoppingService] = useState(false);

  // Service upgrade modal state. isHomeService discriminates whether we
  // patch a room row + linked transaction (false) or a homeServices row +
  // linked transaction (true). The dialog body itself is the same — only
  // the persistence target differs.
  const [upgradeModal, setUpgradeModal] = useState({ isOpen: false, room: null, isHomeService: false });
  const [availableServices, setAvailableServices] = useState([]);
  const [selectedUpgradeServices, setSelectedUpgradeServices] = useState([]);
  const [upgradeDuration, setUpgradeDuration] = useState(0);

  // Home services state
  const [homeServices, setHomeServices] = useState([]);

  // Per-card "pickup requested" feedback so the Pasundo button can show a
  // local pending state immediately, before the realtime echo lands. Keyed
  // by homeService._id. The persisted pickupRequestedAt on the row is the
  // source of truth; this is just a UI sugar.
  const [pickupRequesting, setPickupRequesting] = useState({});

  // Live location tracking for the therapist side. Active while a pasundo
  // is in flight on any non-advance home service — both 'pending' (pickup
  // requested before the service starts, e.g. ride to the address) and
  // 'occupied' (mid-service or post-service pickup back to the spa). One
  // GPS fix per tick is broadcast to every active row simultaneously.
  const therapistActivePickupIds = useMemo(() => {
    return (homeServices || [])
      .filter(s => !s.isAdvanceBooking && s.pickupRequestedAt && ['pending', 'occupied'].includes(s.status))
      .map(s => s._id);
  }, [homeServices]);

  useLocationTracker({
    active: therapistActivePickupIds.length > 0,
    onFix: useCallback(async ({ lat, lng }) => {
      const updatedAt = new Date().toISOString();
      await Promise.allSettled(
        therapistActivePickupIds.map(id =>
          homeServicesApi.updateHomeService(id, {
            therapistCurrentLat: lat,
            therapistCurrentLng: lng,
            therapistLocationUpdatedAt: updatedAt,
          })
        )
      );
    }, [therapistActivePickupIds]),
  });

  // Manage order modal state
  const [showManageOrder, setShowManageOrder] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Predefined stop reasons
  const stopReasons = [
    'Client request',
    'Emergency',
    'Client no-show',
    'Technical issue',
    'Health concern',
    'Schedule conflict',
    'Other'
  ];

  // Helper function to create transaction for pay-after advance booking services
  const createPayAfterTransaction = async (booking) => {
    if (!booking || booking.paymentTiming !== 'pay-after') {
      return null;
    }

    const receiptNumber = `RCP-${Date.now()}`;
    const now = new Date().toISOString();

    // Parse service names from booking
    const serviceNames = booking.serviceName ? booking.serviceName.split(' + ') : [];
    const servicePrice = booking.servicePrice || 0;

    // Build transaction matching POS structure
    const transaction = {
      businessId: user?.businessId,
      receiptNumber,
      date: now,
      items: serviceNames.map((name, index) => ({
        id: `service_${booking._id}_${index}`,
        name: name.trim(),
        type: 'service',
        price: index === 0 ? servicePrice : 0, // Put full price on first item
        quantity: 1,
        subtotal: index === 0 ? servicePrice : 0,
        itemsUsed: []
      })),
      subtotal: servicePrice,
      discount: 0,
      discountType: null,
      tax: 0,
      totalAmount: servicePrice,
      paymentMethod: 'Cash', // Assume cash for pay-after
      amountReceived: servicePrice,
      change: 0,
      cardTransactionId: null,
      gcashReference: null,
      employee: {
        id: booking.employeeId,
        name: booking.employeeName,
        position: 'Therapist',
        commission: 0
      },
      customer: {
        name: booking.clientName || booking.customerName,
        phone: booking.clientPhone || booking.customerPhone,
        email: booking.clientEmail || booking.customerEmail || null
      },
      bookingSource: 'advance-booking',
      status: 'completed',
      roomId: booking.roomId || null,
      roomName: booking.roomName || null,
      isHomeService: booking.isHomeService || false,
      homeServiceAddress: booking.clientAddress || booking.address || null,
      advanceBookingId: booking._id || booking.id
    };

    try {
      await transactionsApi.createTransaction(transaction);
      // Transaction created for pay-after booking
      return transaction;
    } catch (error) {
      return null;
    }
  };

  // Room types and amenities options
  const roomTypes = ['Treatment Room', 'VIP Suite', 'Couples Room', 'Massage Room', 'Facial Room'];
  const availableAmenities = ['Air Conditioning', 'Hot Stone', 'Jacuzzi', 'Music System', 'Aromatherapy', 'Private Shower', 'Locker', 'Massage Table'];

  // Initial form data for rooms
  const initialFormData = {
    name: '',
    type: '',
    capacity: '',
    amenities: [],
    status: 'available'
  };

  // Use the unified CRUD hook
  const {
    items: rooms,
    loading,
    showModal,
    modalMode,
    formData,
    isSubmitting,
    openCreate,
    openEdit,
    closeModal,
    handleInputChange,
    setFieldValue,
    handleSubmit,
    deleteConfirm,
    handleDelete,
    confirmDelete,
    cancelDelete,
    isDeleting,
    loadData: loadRooms
  } = useCrudOperations({
    entityName: 'room',
    api: {
      getAll: mockApi.rooms.getRooms,
      create: mockApi.rooms.createRoom,
      update: mockApi.rooms.updateRoom,
      delete: mockApi.rooms.deleteRoom
    },
    initialFormData,
    transformForEdit: (room) => ({
      name: room.name,
      type: room.type,
      capacity: room.capacity.toString(),
      amenities: room.amenities || [],
      status: room.status
    }),
    transformForSubmit: (data) => {
      const branchId = getEffectiveBranchId();
      // Default capacity to 1 when blank or non-positive — every room must
      // host at least one guest, and downstream UI assumes a sane minimum
      // (Phase 8.2 multi-pax surfaces capacity on the room card).
      const parsedCapacity = parseInt(data.capacity, 10);
      const capacity = Number.isFinite(parsedCapacity) && parsedCapacity > 0
        ? parsedCapacity
        : 1;
      return {
        name: data.name.trim(),
        type: data.type,
        capacity,
        amenities: data.amenities,
        status: data.status,
        ...(branchId && { branchId })
      };
    },
    validateForm: (data) => validateWithToast(roomValidation, data, showToast),
    onSuccess: (mode) => {
      if (onDataChange) onDataChange();
      loadUpcomingBookings();
      // After creating a room, switch to 'available' filter so user can see the new room
      if (mode === 'create') {
        setFilterStatus('available');
      }
    }
  });

  // Expose openCreate to parent via ref callback
  React.useEffect(() => {
    if (onOpenCreateRef) {
      onOpenCreateRef.current = openCreate;
    }
  }, [onOpenCreateRef, openCreate]);

  // Expose manage order to parent via ref callback
  React.useEffect(() => {
    if (onManageOrderRef) {
      onManageOrderRef.current = () => setShowManageOrder(true);
    }
  }, [onManageOrderRef]);

  // Load upcoming bookings (separate from CRUD operations)
  const loadUpcomingBookings = async () => {
    try {
      let bookings = await mockApi.advanceBooking.listAdvanceBookings();

      // Filter to only scheduled/confirmed with rooms (not home service)
      bookings = bookings.filter(b =>
        ['scheduled', 'confirmed'].includes(b.status) &&
        b.roomId &&
        !b.isHomeService
      );

      // Role-based filtering (if therapist, only show their bookings)
      if (isTherapist() && user?.employeeId) {
        bookings = bookings.filter(b => b.employeeId === user.employeeId);
      }

      setUpcomingBookings(bookings);
    } catch (error) {
      // Silent fail for upcoming bookings
    }
  };

  // Load active home services (both direct home services and advance booking home services)
  const loadHomeServices = async () => {
    try {
      // Load ALL home services and filter to "still active" client-side.
      // getActiveHomeServices() only returns status='in_progress', which
      // hides POS-created walk-ins (they land as status='scheduled' from
      // the repository default) — the rider page worked because it loads
      // them directly, but the Rooms page card never appeared.
      let services = await homeServicesApi.getHomeServices();
      services = services
        .filter(s => s.status === 'scheduled' || s.status === 'pending' || s.status === 'in_progress')
        .map(s => ({
          ...s,
          // Normalize statuses so the home-service card renders the same
          // UI/CSS as a room. 'scheduled' (repo default for POS rows) and
          // 'pending' both mean "not started yet"; 'in_progress' is the
          // home-service equivalent of a room's 'occupied' state and
          // unlocks the timer + Stop + Upgrade buttons.
          status:
            s.status === 'scheduled' ? 'pending'
              : s.status === 'in_progress' ? 'occupied'
              : s.status,
          // The repository writes startedAt when the therapist taps Start;
          // the timer logic and the room card both key off startTime. Map
          // startedAt → startTime so the same countdown component works for
          // both surfaces without forking the repository contract.
          startTime: s.startTime || s.startedAt || null,
        }));

      // Also load home service advance bookings (scheduled/confirmed/in-progress with isHomeService flag)
      let bookings = await mockApi.advanceBooking.listAdvanceBookings();
      const homeServiceBookings = bookings
        .filter(b =>
          b.isHomeService &&
          ['scheduled', 'confirmed', 'in-progress'].includes(b.status)
        )
        .map(b => ({
          // Transform booking to match home service card format
          _id: b._id || b.id,
          status: b.status === 'in-progress' ? 'occupied' : 'pending', // Map booking status to home service status
          employeeId: b.employeeId,
          employeeName: b.employeeName,
          customerName: b.clientName,
          customerPhone: b.clientPhone,
          customerEmail: b.clientEmail || null,
          address: b.clientAddress,
          serviceNames: b.serviceName ? b.serviceName.split(' + ') : [],
          serviceDuration: b.estimatedDuration || 60,
          transactionId: b.transactionId,
          startTime: b.actualStartTime || null, // Use actualStartTime for in-progress bookings
          createdAt: b.createdAt || new Date().toISOString(),
          scheduledDateTime: b.bookingDateTime, // Keep for display
          isAdvanceBooking: true, // Flag to identify advance booking home services
          paymentTiming: b.paymentTiming,
          paymentStatus: b.paymentStatus,
          branchId: b.branchId || null,
        }));

      // Merge both sources
      services = [...services, ...homeServiceBookings];

      // Strict branch scoping — mirrors the rooms-list filter at line 421.
      // When the user has picked a specific branch we only show home
      // services stamped with that branch; "All Branches" shows everything.
      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        services = services.filter(s => s.branchId === effectiveBranchId);
      }

      // Role-based filtering (if therapist, only show their home services)
      if (isTherapist() && user?.employeeId) {
        services = services.filter(s => s.employeeId === user.employeeId);
      }

      setHomeServices(services);
    } catch (error) {
      // Silent fail for home services
    }
  };

  // Load bookings and home services on mount and when user changes
  useEffect(() => {
    loadUpcomingBookings();
    loadHomeServices();
  }, [user]);

  // Update time every second for countdown timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Force a sync of currentTime + reload of room/service data when the tab
  // becomes visible again. Mobile browsers (especially when the phone goes
  // into power saving) suspend setInterval and may serve stale local data,
  // which causes the timer to "disappear" until the page is manually
  // refreshed. Resync on resume so therapists see the right state instantly.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      setCurrentTime(new Date());
      try { loadRooms?.(); } catch {}
      try { loadHomeServices(); } catch {}
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Cross-device live updates: when POS / another device starts or ends a
  // service, refresh both rooms and home services so the therapist's timer
  // appears (or stops) without a manual reload.
  useEffect(() => {
    let syncDebounce = null;
    const unsubscribeSync = supabaseSyncManager.subscribe((status) => {
      const watched = ['rooms', 'activeServices', 'homeServices', 'advanceBookings', 'transactions'];
      if (
        (status.type === 'realtime_update' && watched.includes(status.entityType)) ||
        status.type === 'pull_complete' || status.type === 'sync_complete'
      ) {
        clearTimeout(syncDebounce);
        syncDebounce = setTimeout(() => {
          try { loadRooms?.(); } catch {}
          try { loadHomeServices(); } catch {}
        }, 500);
      }
    });

    let dataDebounce = null;
    const unsubscribeData = dataChangeEmitter.subscribe((change) => {
      if (['rooms', 'activeServices', 'homeServices'].includes(change.entityType)) {
        clearTimeout(dataDebounce);
        dataDebounce = setTimeout(() => {
          try { loadRooms?.(); } catch {}
          try { loadHomeServices(); } catch {}
        }, 300);
      }
    });

    return () => {
      unsubscribeSync();
      unsubscribeData();
      clearTimeout(syncDebounce);
      clearTimeout(dataDebounce);
    };
  }, []);

  // Helper function to calculate remaining time for occupied rooms
  const getRemainingTime = (room) => {
    if (room.status !== 'occupied' || !room.startTime || !room.serviceDuration) {
      return null;
    }

    const startTime = new Date(room.startTime);
    const endTime = new Date(startTime.getTime() + room.serviceDuration * 60000);
    const remaining = Math.max(0, endTime - currentTime);

    return {
      minutes: Math.floor(remaining / 60000),
      seconds: Math.floor((remaining % 60000) / 1000),
      totalSeconds: Math.floor(remaining / 1000),
      isExpired: remaining <= 0,
      isCritical: remaining <= 5 * 60000 && remaining > 0 // 5 minutes or less
    };
  };

  // Helper function to calculate remaining time for home services
  const getHomeServiceRemainingTime = (service) => {
    if (service.status !== 'occupied' || !service.startTime || !service.serviceDuration) {
      return null;
    }

    const startTime = new Date(service.startTime);
    const endTime = new Date(startTime.getTime() + service.serviceDuration * 60000);
    const remaining = Math.max(0, endTime - currentTime);

    return {
      minutes: Math.floor(remaining / 60000),
      seconds: Math.floor((remaining % 60000) / 1000),
      totalSeconds: Math.floor(remaining / 1000),
      isExpired: remaining <= 0,
      isCritical: remaining <= 5 * 60000 && remaining > 0 // 5 minutes or less
    };
  };

  // Save reordered rooms
  const handleSaveOrder = async (reorderedItems) => {
    setSavingOrder(true);
    try {
      for (let i = 0; i < reorderedItems.length; i++) {
        await mockApi.rooms.updateRoom(reorderedItems[i]._id, { displayOrder: i });
      }
      showToast('Room order saved', 'success');
      setShowManageOrder(false);
      loadRooms();
    } catch (error) {
      showToast('Failed to save order', 'error');
    } finally {
      setSavingOrder(false);
    }
  };

  // Filter rooms based on status and role
  // By default, only show rooms with active services (pending/occupied)
  const filteredRooms = useMemo(() => {
    let filtered = rooms;

    // Branch filtering — strict match. Rooms are physical spaces tied to a
    // specific branch, so unbranched rooms only surface under "All Branches".
    const effectiveBranchId = getEffectiveBranchId();
    if (effectiveBranchId) {
      filtered = filtered.filter(r => r.branchId === effectiveBranchId);
    }

    // First filter: Only show rooms with active services by default (pending/occupied)
    // Unless explicitly filtering for available or maintenance
    if (filterStatus === 'show_all') {
      // Show all rooms (no filter)
    } else if (filterStatus === 'all') {
      // Active services: only pending and occupied rooms
      filtered = filtered.filter(r => r.status === 'pending' || r.status === 'occupied');
    } else {
      // Apply specific status filter
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    // For therapists: only show rooms assigned to them
    if (isTherapist() && user?.employeeId) {
      filtered = filtered.filter(r => r.assignedEmployeeId === user.employeeId);
    }

    // Sort by displayOrder
    filtered.sort((a, b) => (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999));

    return filtered;
  }, [rooms, filterStatus, isTherapist, user, getEffectiveBranchId]);

  // Handle amenity toggle (custom handler for checkbox array)
  const handleAmenityToggle = (amenity) => {
    setFieldValue('amenities',
      formData.amenities.includes(amenity)
        ? formData.amenities.filter(a => a !== amenity)
        : [...formData.amenities, amenity]
    );
  };

  // Handle room status change
  const handleStatusChange = async (room, newStatus) => {
    try {
      await mockApi.rooms.updateRoomStatus(room._id, newStatus);
      showToast(`Room status updated to ${newStatus}`, 'success');
      loadRooms();
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  // Handle therapist starting service (pending -> occupied)
  const handleStartServiceFromRoom = async (room) => {
    try {
      const startTime = new Date().toISOString();

      // Update room to occupied and set startTime to NOW
      await mockApi.rooms.updateRoomStatus(room._id, 'occupied', {
        startTime: startTime
      });

      showToast('Service started! Timer is now running.', 'success');
      loadRooms();
    } catch (error) {
      showToast('Failed to start service', 'error');
    }
  };

  // Open upgrade service modal for occupied rooms
  const openUpgradeModal = async (room) => {
    try {
      const products = await mockApi.products.getProducts();
      // Scope to the room's own branch — multi-branch tenants have the same
      // service name (e.g. "Signature Massage") seeded in every branch as
      // separate product rows, so a name-only match would otherwise hit all
      // of them at once.
      const services = products.filter(
        (p) =>
          p.type === 'service' &&
          p.active !== false &&
          (!room.branchId || !p.branchId || p.branchId === room.branchId),
      );
      setAvailableServices(services);
      // Start with NO services pre-selected. "Upgrade" replaces the receipt's
      // services with whatever the user picks here — pre-selecting the
      // existing one and then ticking another caused the price to be added on
      // top instead of swapped (199 → 350 ended up at 549 because Signature
      // Massage stayed selected). The current services are still shown above
      // the picker as context so the user knows what's running before they
      // confirm.
      setSelectedUpgradeServices([]);
      setUpgradeDuration(room.serviceDuration || 60);
      setUpgradeModal({ isOpen: true, room, isHomeService: false });
    } catch (error) {
      showToast('Failed to load services', 'error');
    }
  };

  // Handle service upgrade - update room (or home service) details without stopping timer
  const handleUpgradeService = async () => {
    const room = upgradeModal.room;
    const isHomeServiceUpgrade = upgradeModal.isHomeService;
    if (!room || selectedUpgradeServices.length === 0) return;

    try {
      const newServiceNames = selectedUpgradeServices.map(s => s.name);
      const newDuration = selectedUpgradeServices.reduce((sum, s) => sum + (s.duration || 60), 0);
      const newPrice = selectedUpgradeServices.reduce((sum, s) => sum + (s.price || 0), 0);

      // Update room OR home service with new service info, keep timer running.
      // Both surfaces store the same shape (serviceNames/serviceDuration/
      // servicePrice) so the only difference is which adapter we hit.
      if (isHomeServiceUpgrade) {
        await homeServicesApi.updateHomeService(room._id, {
          serviceNames: newServiceNames,
          serviceDuration: upgradeDuration || newDuration,
          servicePrice: newPrice,
          totalAmount: newPrice,
          ...branchClaimFields(room),
        });
      } else {
        await mockApi.rooms.updateRoom(room._id, {
          serviceNames: newServiceNames,
          serviceDuration: upgradeDuration || newDuration,
          servicePrice: newPrice
        });
      }

      // Update the linked transaction so Service History and Sales
      // reflect the upgraded service. room.transactionId stores the
      // human-readable receiptNumber (e.g. "RCP-…"), not the Dexie
      // primary key — getTransaction(id) would throw "not found" here,
      // which is the regression that silently dropped upgrades from
      // sales totals.
      let historyUpdateFailed = false;
      let historyFailReason = null;
      if (!room.transactionId) {
        historyUpdateFailed = true;
        historyFailReason = 'no receipt linked to room';
      } else {
        try {
          const txn = await mockApi.transactions.getTransactionByReceiptNumber(room.transactionId);
          if (txn) {
            // Preserve any non-service items (e.g. add-on products) that
            // were on the original receipt; only swap out the services.
            const nonServiceItems = (txn.items || []).filter((it) => it.type !== 'service');
            const previousServiceItems = (txn.items || []).filter((it) => it.type === 'service');
            const upgradedServiceItems = selectedUpgradeServices.map((s) => ({
              id: s._id || s.id,
              name: s.name,
              type: 'service',
              price: s.price || 0,
              quantity: 1,
              subtotal: s.price || 0,
              itemsUsed: [],
            }));
            const updatedItems = [...nonServiceItems, ...upgradedServiceItems];
            const nonServiceSubtotal = nonServiceItems.reduce(
              (sum, it) => sum + (Number(it.subtotal) || 0),
              0,
            );
            const newSubtotal = nonServiceSubtotal + newPrice;
            // Re-apply any prior discount/tax shape verbatim — we don't
            // try to recompute them here since the service upgrade shouldn't
            // silently change tax/discount math without the cashier's say-so.
            const updatedTotal = newSubtotal - (Number(txn.discount) || 0) + (Number(txn.tax) || 0);

            // Append an audit-trail entry so Service History can show the
            // "upgraded from X to Y" annotation. Each entry captures the
            // service-name swap and the price delta at the moment of upgrade.
            const previousServiceTotal = previousServiceItems.reduce(
              (sum, it) => sum + (Number(it.subtotal) || Number(it.price) || 0),
              0,
            );
            const upgradeEntry = {
              upgradedAt: new Date().toISOString(),
              upgradedBy: user?.name || null,
              fromServices: previousServiceItems.map((it) => it.name),
              toServices: newServiceNames,
              fromTotal: Number(txn.totalAmount ?? txn.total ?? txn.subtotal ?? 0),
              toTotal: updatedTotal,
            };
            const upgradeHistory = [...(txn.upgradeHistory || []), upgradeEntry];

            await mockApi.transactions.updateTransaction(txn._id, {
              items: updatedItems,
              subtotal: newSubtotal,
              totalAmount: updatedTotal,
              // Mirror the legacy `total` field too in case any downstream
              // consumer reads from it instead of totalAmount.
              total: updatedTotal,
              upgradeHistory,
            });
          } else {
            console.warn('[upgradeService] No transaction matched receipt', room.transactionId);
            historyUpdateFailed = true;
            historyFailReason = `receipt ${room.transactionId} not found`;
          }
        } catch (txErr) {
          console.warn('Could not update transaction:', txErr);
          historyUpdateFailed = true;
          historyFailReason = txErr?.message || 'update failed';
        }
      }

      setUpgradeModal({ isOpen: false, room: null, isHomeService: false });
      if (historyUpdateFailed) {
        // Service-history sync didn't propagate. Tell the user explicitly so
        // they don't think the new total reached reports/sales when it didn't.
        showToast(
          `${isHomeServiceUpgrade ? 'Home service' : 'Room'} upgraded, but service history not updated (${historyFailReason}).`,
          'warning',
        );
      } else {
        showToast(`Service upgraded to: ${newServiceNames.join(', ')}`, 'success');
      }
      if (isHomeServiceUpgrade) {
        loadHomeServices();
      } else {
        loadRooms();
      }
    } catch (error) {
      showToast('Failed to upgrade service', 'error');
    }
  };

  // Handle starting home service (pending -> occupied)
  const handleStartHomeService = async (service) => {
    try {
      const startTime = new Date().toISOString();

      // Handle advance booking home services differently
      if (service.isAdvanceBooking) {
        // Use advance booking API to start service
        await mockApi.advanceBooking.startServiceFromBooking(service._id);
      } else {
        // Regular home service. The repository's startService writes
        // status='in_progress' + startedAt; the rider page + this card
        // both read startTime, so stamp it explicitly via updateHomeService.
        // Two calls is cheap and keeps the audit field (startedAt/startedBy)
        // intact for HR-style auditing.
        await homeServicesApi.updateHomeServiceStatus(service._id, 'occupied', {
          startedBy: user?.name || user?.username || user?.email || 'therapist',
        });
        await homeServicesApi.updateHomeService(service._id, {
          startTime,
          ...branchClaimFields(service),
        });
      }


      showToast('Home service started! Timer is now running.', 'success');
      loadHomeServices();
    } catch (error) {
      showToast('Failed to start home service', 'error');
    }
  };

  // Branch-claim backstop. When a therapist (or any in-branch operator)
  // touches a home service that has no branchId — Start, Stop, Pasundo,
  // Upgrade — the SAME write that performs the action stamps the actor's
  // effective branch on the row. Rationale: the act of operating on the
  // record is authoritative attribution. After this, the row passes the
  // rider's strict per-branch filter normally; no bypass needed.
  // Returns the fields to merge into the update payload (empty when the
  // row already carries a branchId).
  const branchClaimFields = (service) => {
    if (service?.branchId) return {};
    const claim = getEffectiveBranchId();
    if (!claim) return {};
    return { branchId: claim };
  };

  // Pasundo — therapist requests a rider pickup at the home-service address.
  // Stamps the home service row with who asked and when, which posTriggers
  // turns into a broadcast notification to every Rider in the branch. The
  // button is single-shot per session (button shows "Pickup requested" once
  // the field is set) so therapists can't accidentally spam the riders.
  const handleRequestPickup = async (service) => {
    if (!service?._id) return;
    if (service.pickupRequestedAt) {
      showToast('Pickup already requested', 'info');
      return;
    }
    setPickupRequesting((prev) => ({ ...prev, [service._id]: true }));
    try {
      const requesterName = (user?.name
        || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
        || user?.username
        || user?.email
        || 'Therapist').trim();
      const claim = branchClaimFields(service);
      // Advance-booking home services live on advanceBookings table, not
      // homeServices — only stamp the rows that actually carry the field
      // and rely on the existing advance-booking flow for the rest.
      if (service.isAdvanceBooking) {
        await mockApi.advanceBooking.updateAdvanceBooking(service._id, {
          pickupRequestedAt: new Date().toISOString(),
          pickupRequestedBy: requesterName,
          pickupRequestedByRole: user?.role || 'Therapist',
          pickupRequestedByUserId: user?._id || user?.id || null,
          ...claim,
        });
      } else {
        await homeServicesApi.updateHomeService(service._id, {
          pickupRequestedAt: new Date().toISOString(),
          pickupRequestedBy: requesterName,
          pickupRequestedByRole: user?.role || 'Therapist',
          pickupRequestedByUserId: user?._id || user?.id || null,
          ...claim,
        });
      }
      showToast('Rider notified — pasundo on the way', 'success');
      loadHomeServices();
    } catch (error) {
      console.error('Failed to request pickup:', error);
      showToast('Failed to request pickup', 'error');
    } finally {
      setPickupRequesting((prev) => {
        const next = { ...prev };
        delete next[service._id];
        return next;
      });
    }
  };

  // Open the same upgrade modal a room uses, but flag it as targeting a
  // home service so the persist handler patches homeServices instead of
  // rooms. The body of the dialog is identical — pick services, adjust
  // duration, see total — so we just reuse it with a discriminator.
  const openHomeServiceUpgradeModal = async (service) => {
    try {
      const products = await mockApi.products.getProducts();
      const branchId = service.branchId;
      const services = products.filter(
        (p) =>
          p.type === 'service' &&
          p.active !== false &&
          (!branchId || !p.branchId || p.branchId === branchId),
      );
      setAvailableServices(services);
      setSelectedUpgradeServices([]);
      setUpgradeDuration(service.serviceDuration || 60);
      setUpgradeModal({ isOpen: true, room: service, isHomeService: true });
    } catch (error) {
      showToast('Failed to load services', 'error');
    }
  };

  // Auto-complete rooms when timer expires
  useEffect(() => {
    const checkExpiredRooms = async () => {
      for (const room of rooms) {
        if (room.status === 'occupied' && room.startTime && room.serviceDuration) {
          const remaining = getRemainingTime(room);
          if (remaining && remaining.isExpired) {
            try {
              const endTime = new Date().toISOString();


              // Handle pay-after advance booking room services
              if (room.advanceBookingId && room.paymentTiming === 'pay-after') {
                try {
                  const booking = await mockApi.advanceBooking.getAdvanceBooking(room.advanceBookingId);
                  await createPayAfterTransaction(booking);
                  await mockApi.advanceBooking.completeServiceFromBooking(room.advanceBookingId, {
                    paymentMethod: 'Cash'
                  });
                  showToast(`${room.name} service completed and payment recorded`, 'success');
                } catch (bookingError) {
                  console.error(`Failed to process pay-after booking for ${room.name}:`, bookingError);
                  showToast(`${room.name} service completed but payment recording failed. Please process manually.`, 'warning');
                }
              }

              await mockApi.rooms.updateRoomStatus(room._id, 'available');
              showToast(`${room.name} service completed - room now available`, 'info');
              loadRooms();
            } catch (error) {
              // Silent fail for auto-complete
            }
          }
        }
      }
    };

    // Check every 5 seconds for expired timers
    const interval = setInterval(checkExpiredRooms, 5000);
    return () => clearInterval(interval);
  }, [rooms, currentTime]);

  // Auto-complete home services when timer expires
  useEffect(() => {
    const checkExpiredHomeServices = async () => {
      for (const service of homeServices) {
        if (service.status === 'occupied' && service.startTime && service.serviceDuration) {
          const remaining = getHomeServiceRemainingTime(service);
          if (remaining && remaining.isExpired) {
            try {
              const endTime = new Date().toISOString();


              // Handle advance booking home services - create transaction for pay-after
              if (service.isAdvanceBooking) {
                // Get the full booking data
                try {
                  const booking = await mockApi.advanceBooking.getAdvanceBooking(service._id);

                  // Create transaction for pay-after bookings
                  if (booking.paymentTiming === 'pay-after') {
                    await createPayAfterTransaction(booking);
                    showToast(`Home service completed and payment recorded`, 'success');
                  }

                  // Complete the advance booking
                  await mockApi.advanceBooking.completeServiceFromBooking(service._id, {
                    paymentMethod: 'Cash'
                  });
                } catch (bookingError) {
                  // Silent fail for booking completion
                }
              } else {
                // Mark regular home service as completed (NOT delete).
                // Soft-deleting hides the row from every device's sync
                // (Dexie filter skips deleted rows) — the rider then has
                // no audit trail of a delivery they may have driven. The
                // status filter on the rider page already hides
                // 'completed' from the default view; "Show completed"
                // reveals it.
                await homeServicesApi.updateHomeServiceStatus(service._id, 'completed', {
                  completedBy: 'auto-timer',
                });
              }

              showToast(`Home service for ${service.customerName} completed`, 'info');
              loadHomeServices();
            } catch (error) {
              // Silent fail for auto-complete
            }
          }
        }
      }
    };

    // Check every 5 seconds for expired timers
    const interval = setInterval(checkExpiredHomeServices, 5000);
    return () => clearInterval(interval);
  }, [homeServices, currentTime]);

  // Handle starting a service from booking
  const handleStartService = async (booking) => {
    try {
      await mockApi.advanceBooking.startServiceFromBooking(booking._id || booking.id);
      const bookingTime = new Date(booking.bookingDateTime);
      const now = new Date();
      if (now < bookingTime) {
        showToast('Starting service earlier than scheduled (demo)', 'info');
      } else {
        showToast('Service started successfully', 'success');
      }
      loadRooms();
      loadUpcomingBookings();
    } catch (error) {
      showToast(error.message || 'Failed to start service', 'error');
    }
  };

  // Open stop service modal
  const openStopServiceModal = (room, isHomeService = false) => {
    setStopServiceModal({ isOpen: true, room, isHomeService });
    setStopReason('');
  };

  // Close stop service modal
  const closeStopServiceModal = () => {
    setStopServiceModal({ isOpen: false, room: null, isHomeService: false });
    setStopReason('');
  };

  // Cascade-cancel the POS transaction tied to a room or home service.
  // Rooms / home services store a receiptNumber in `transactionId`; we
  // resolve that back to the transaction's internal id, then call
  // cancelTransaction which sets status='cancelled', restores stock, and
  // stamps the actor name + role for Service History attribution. Silent
  // no-op when there's no linked transaction (pay-after that hasn't
  // produced one yet) so the cancel UX never fails on the void path.
  const cancelLinkedTransaction = async (receiptNumber, reason, actorDisplay, actorRole) => {
    if (!receiptNumber) return;
    try {
      const txn = await mockApi.transactions.getTransactionByReceiptNumber(receiptNumber);
      if (!txn || !txn._id) return;
      if (txn.status === 'cancelled' || txn.status === 'voided') return;
      await mockApi.transactions.cancelTransaction(txn._id, reason, actorDisplay, actorRole);
    } catch (err) {
      // Silent — Service History will still show the original transaction;
      // worst case the operator can void it manually from there.
      console.warn('[Rooms] cancelLinkedTransaction failed:', err);
    }
  };

  // Handle stopping service with reason
  const handleStopService = async () => {
    if (!stopReason) {
      showToast('Please select a reason', 'error');
      return;
    }

    const room = stopServiceModal.room;
    const isHomeService = stopServiceModal.isHomeService;
    if (!room) return;

    setIsStoppingService(true);
    // Resolve the actor (who's cancelling) once up front so we can stamp it
    // on the booking, home service, AND the underlying transaction. The
    // role suffix (e.g. "Maria Santos (Therapist)") is what lets Service
    // History distinguish a therapist cancellation from a manager override
    // when auditing. Fallback chain ends at email/username/'User' so we
    // never persist an empty cancelledBy that surfaces as "by Unknown" in
    // the badge.
    const joinedName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    const actorName = (user?.name
      || joinedName
      || user?.username
      || user?.email
      || 'User').trim();
    const actorRole = user?.role || 'User';
    const actorDisplay = `${actorName} (${actorRole})`;

    try {
      // Calculate actual duration
      const now = new Date();
      let actualDuration = 0;
      let status = 'cancelled';

      if (room.status === 'occupied' && room.startTime) {
        const startTime = new Date(room.startTime);
        actualDuration = Math.floor((now - startTime) / 60000); // minutes
        status = 'ended_early';
      }

      if (isHomeService) {
        // Handle advance booking home services vs regular home services
        if (room.isAdvanceBooking) {
          // If service was in progress (ended early), create transaction for pay-after and complete
          if (status === 'ended_early' && room.paymentTiming === 'pay-after') {
            try {
              const booking = await mockApi.advanceBooking.getAdvanceBooking(room._id);
              await createPayAfterTransaction(booking);
              await mockApi.advanceBooking.completeServiceFromBooking(room._id, {
                paymentMethod: 'Cash'
              });
              showToast(`Home service completed and payment recorded`, 'success');
            } catch (bookingError) {
              // Silent fail for pay-after completion
            }
          } else {
            // Cancel the advance booking (not started or pay-now)
            await mockApi.advanceBooking.updateAdvanceBooking(room._id, {
              status: 'cancelled',
              cancelReason: stopReason,
              cancelledAt: now.toISOString(),
              cancelledBy: actorName,
              cancelledByRole: actorRole,
            });
            await cancelLinkedTransaction(room.transactionId, stopReason, actorDisplay, actorRole);
            showToast(`Home service stopped: ${stopReason}`, 'info');
          }
        } else {
          // Mark the home service as cancelled (NOT delete). Soft-deleting
          // hides the row from every device's sync — the rider would see
          // a notification chime followed by an empty deliveries page
          // because the cancelled record is filtered out of pulls. Status
          // 'cancelled' preserves the audit trail; the rider page already
          // hides cancelled from default view via HIDDEN_STATUSES, so the
          // card disappears from the active list either way.
          await homeServicesApi.updateHomeServiceStatus(room._id, 'cancelled', {
            cancelledBy: actorName,
            reason: stopReason,
          });
          await cancelLinkedTransaction(room.transactionId, stopReason, actorDisplay, actorRole);
          showToast(`Home service stopped: ${stopReason}`, 'info');
        }
        loadHomeServices();
      } else {
        // Handle pay-after advance booking room services
        if (room.advanceBookingId && room.paymentTiming === 'pay-after' && status === 'ended_early') {
          try {
            const booking = await mockApi.advanceBooking.getAdvanceBooking(room.advanceBookingId);
            await createPayAfterTransaction(booking);
            await mockApi.advanceBooking.completeServiceFromBooking(room.advanceBookingId, {
              paymentMethod: 'Cash'
            });
            showToast(`Service completed and payment recorded`, 'success');
          } catch (bookingError) {
            // Silent fail for pay-after completion
          }
        } else if (room.advanceBookingId && status === 'cancelled') {
          // Cancel the advance booking if service was cancelled (not started)
          try {
            await mockApi.advanceBooking.updateAdvanceBooking(room.advanceBookingId, {
              status: 'cancelled',
              cancelReason: stopReason,
              cancelledAt: now.toISOString(),
              cancelledBy: actorName,
              cancelledByRole: actorRole,
            });
          } catch (bookingError) {
            // Silent fail for booking cancellation
          }
        }

        // Cascade-cancel the linked POS transaction for any cancellation
        // path (pre-paid walk-in, pay-now advance, etc.). cancelLinkedTransaction
        // looks up by receipt number and no-ops when no transaction exists
        // (e.g. pay-after that never produced one).
        if (status === 'cancelled') {
          await cancelLinkedTransaction(room.transactionId, stopReason, actorDisplay, actorRole);
        }

        // If cancelled (not ended early), undo the service rotation count
        if (status === 'cancelled' && room.assignedEmployeeId) {
          try {
            await mockApi.serviceRotation.undoService(room.assignedEmployeeId);
          } catch (err) {
            console.error('Failed to undo service rotation:', err);
          }
        }

        // Update room to available
        await mockApi.rooms.updateRoomStatus(room._id, 'available');
        showToast(`Service stopped: ${stopReason}`, 'info');
        loadRooms();
      }

      closeStopServiceModal();
    } catch (error) {
      showToast('Failed to stop service', 'error');
    } finally {
      setIsStoppingService(false);
    }
  };

  // Room icon helper
  const getRoomIcon = (type) => {
    const icons = {
      'Treatment Room': '🛏️',
      'VIP Suite': '✨',
      'Couples Room': '💑',
      'Massage Room': '💆',
      'Facial Room': '🧖'
    };
    return icons[type] || '🚪';
  };

  // Filter configuration for FilterBar
  const filterConfig = [
    {
      key: 'status',
      value: filterStatus,
      options: [
        { value: 'show_all', label: 'All Rooms' },
        { value: 'all', label: 'Active Services' },
        { value: 'available', label: 'Available Rooms' },
        { value: 'pending', label: 'Pending' },
        { value: 'occupied', label: 'Occupied' },
        { value: 'maintenance', label: 'Maintenance' }
      ]
    }
  ];

  // Loading state
  if (loading) {
    return <PageLoading message="Loading rooms..." />;
  }

  return (
    <div className="rooms-page">
      {/* Page Header */}
      {!embedded && (
        <PageHeader
          title="Rooms Management"
          description={isTherapist() ? 'View your assigned rooms and their availability' : 'Manage treatment rooms and their availability'}
          actions={canEdit() ? [
            { label: 'Manage Order', onClick: () => setShowManageOrder(true), variant: 'secondary' },
            { label: '+ Add Room', onClick: openCreate }
          ] : null}
          showAction={canEdit()}
        />
      )}


      {/* Filters */}
      <FilterBar
        showSearch={false}
        filters={filterConfig}
        onFilterChange={(key, value) => setFilterStatus(value)}
        resultCount={filteredRooms.length}
        resultLabel="rooms"
      />

      {/* Rooms Grid or Empty State */}
      {filteredRooms.length === 0 && homeServices.length === 0 ? (
        <EmptyState
          icon="🚪"
          title={filterStatus === 'all' ? 'No active services' : filterStatus === 'show_all' ? 'No rooms found' : 'No rooms found'}
          description={filterStatus === 'all' ? 'No rooms are currently occupied or pending. Services will appear here when assigned via POS.' : 'Try adjusting your filters'}
          action={canEdit() ? { label: 'Add Room', onClick: openCreate } : null}
        />
      ) : filteredRooms.length === 0 ? null : (
        <div className="rooms-grid">
          {filteredRooms.map(room => {
            // Check if this room is assigned to the current therapist
            const isMyRoom = isTherapist() && user?.employeeId && room.assignedEmployeeId === user.employeeId;

            return (
              <div key={room._id} className={`room-card ${room.status}`}>
                <div className="room-header">
                  <div className="room-icon">{getRoomIcon(room.type)}</div>
                  <span className={`room-status-badge ${room.status}`}>
                    {room.status === 'pending' ? 'PENDING' : room.status}
                  </span>
                </div>
                <h3 className="room-name">{room.name}</h3>
                <p className="room-type">{room.type}</p>

                {/* Show service details for pending/occupied rooms */}
                {(room.status === 'pending' || room.status === 'occupied') && (
                  <div className="room-customer-info">
                    <div className="customer-info-row">
                      <span>👤</span>
                      <span><strong>Therapist:</strong> {room.assignedEmployeeName || 'Not assigned'}</span>
                    </div>
                    <div className="customer-info-row">
                      <span>🧑</span>
                      <span>
                        <strong>Customer:</strong> {room.customerName || 'Walk-in'}
                        {/* Multi-pax (Phase 8.2): badge renders nothing for
                            single-pax records, so this is a no-op for
                            legacy rows. */}
                        <PaxBadge paxCount={room.paxCount} />
                      </span>
                    </div>
                    {room.paxCount > 1 && Array.isArray(room.guestNumbers) && room.guestNumbers.length > 0 && (
                      <div className="customer-info-row">
                        <span>👥</span>
                        <span>
                          <strong>Guests:</strong>{' '}
                          {(() => {
                            const nums = [...room.guestNumbers].sort((a, b) => a - b);
                            const min = nums[0];
                            const max = nums[nums.length - 1];
                            // Contiguous run → "1-3", otherwise list them.
                            const isRange = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
                            return isRange && nums.length > 1
                              ? `${min}-${max}`
                              : nums.join(', ');
                          })()}
                        </span>
                      </div>
                    )}
                    {room.customerPhone && (
                      <div className="customer-info-row">
                        <span>📞</span>
                        <span>{room.customerPhone}</span>
                      </div>
                    )}
                    {room.serviceNames && room.serviceNames.length > 0 && (
                      <div className="customer-info-row">
                        <span>💆</span>
                        <span>{room.serviceNames.join(', ')}</span>
                      </div>
                    )}
                    {room.serviceDuration && (
                      <div className="customer-info-row">
                        <span>⏱️</span>
                        <span>{room.serviceDuration} min</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="room-details">
                  <div className="room-detail-row">
                    <span className="room-detail-label">Capacity</span>
                    {/* Default to 1 when capacity is missing/0 — surfaces
                        the number for cashiers to self-judge, but Phase 8.2
                        intentionally does NOT enforce this at the room-mark
                        level (most spas have variable capacity). */}
                    <span className="room-detail-value">
                      {(() => {
                        const cap = Number(room.capacity) > 0 ? Number(room.capacity) : 1;
                        return `${cap} ${cap === 1 ? 'person' : 'people'}`;
                      })()}
                    </span>
                  </div>
                </div>

                {room.amenities && room.amenities.length > 0 && (
                  <div className="room-amenities">
                    {room.amenities.slice(0, 3).map(amenity => (
                      <span key={amenity} className="amenity-tag">{amenity}</span>
                    ))}
                    {room.amenities.length > 3 && (
                      <span className="amenity-tag">+{room.amenities.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Start Service button for pending rooms (therapist view) */}
                {room.status === 'pending' && (isMyRoom || !isTherapist()) && (
                  <div className="service-action-buttons">
                    <button
                      className="btn btn-primary start-service-btn"
                      onClick={() => handleStartServiceFromRoom(room)}
                    >
                      ▶️ Start Service
                    </button>
                    <button
                      className="btn btn-error stop-service-btn"
                      onClick={() => openStopServiceModal(room)}
                    >
                      ⏹️ Cancel
                    </button>
                  </div>
                )}

                {/* Action buttons for occupied rooms */}
                {room.status === 'occupied' && (isMyRoom || !isTherapist()) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'var(--spacing-sm)' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => openUpgradeModal(room)}
                      style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
                    >
                      ⬆️ Upgrade
                    </button>
                    <button
                      className="btn btn-error"
                      onClick={() => openStopServiceModal(room)}
                      style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
                    >
                      ⏹️ Stop
                    </button>
                  </div>
                )}

                {/* Countdown timer for occupied rooms */}
                {room.status === 'occupied' && (() => {
                  const timer = getRemainingTime(room);
                  if (!timer) return null;
                  return (
                    <div className={`room-timer ${timer.isCritical ? 'critical' : ''}`}>
                      {timer.isExpired ? (
                        <span>Time's up!</span>
                      ) : (
                        <span>
                          {timer.minutes}:{String(timer.seconds).padStart(2, '0')} remaining
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Status change buttons - only for admin/manager/receptionist */}
                {!isTherapist() && (
                  <div className="status-change-group">
                    {room.status !== 'available' && (
                      <button className="btn btn-success" onClick={() => handleStatusChange(room, 'available')}>
                        Available
                      </button>
                    )}
                    {room.status !== 'occupied' && room.status !== 'pending' && (
                      <button className="btn btn-error" onClick={() => handleStatusChange(room, 'occupied')}>
                        Occupied
                      </button>
                    )}
                    {room.status !== 'maintenance' && (
                      <button className="btn btn-warning" onClick={() => handleStatusChange(room, 'maintenance')}>
                        Maintenance
                      </button>
                    )}
                  </div>
                )}

                {canEdit() && (
                  <div className="room-actions">
                    <button className="btn btn-secondary" onClick={() => openEdit(room)}>Edit</button>
                    <button className="btn btn-error" onClick={() => handleDelete(room)}>Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Home Services Section */}
      {homeServices.length > 0 && (
        <div className="home-services-section">
          <h3>Home Services</h3>
          <div className="home-services-grid">
            {homeServices.map(service => {
              const isMyService = isTherapist() && user?.employeeId && service.employeeId === user.employeeId;
              const timeRemaining = getHomeServiceRemainingTime(service);

              return (
                <div key={service._id} className={`home-service-card ${service.status} ${service.isAdvanceBooking ? 'advance-booking' : ''}`}>
                  <div className="home-service-header">
                    <div className="home-service-icon">🏠</div>
                    <span className={`home-service-status-badge ${service.status}`}>
                      {service.status === 'pending' ? 'PENDING' : 'IN PROGRESS'}
                    </span>
                    {service.isAdvanceBooking && (
                      <span className="home-service-type-badge scheduled">SCHEDULED</span>
                    )}
                  </div>
                  <h3 className="home-service-title">Home Service</h3>

                  {/* Scheduled DateTime for advance bookings */}
                  {service.isAdvanceBooking && service.scheduledDateTime && (
                    <div className="home-service-scheduled">
                      <span className="schedule-icon">📅</span>
                      <span className="schedule-datetime">
                        {format(parseISO(service.scheduledDateTime), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  )}

                  {/* Therapist Info */}
                  <div className="home-service-therapist">
                    <span className="therapist-icon">👤</span>
                    <span className="therapist-name">{service.employeeName}</span>
                  </div>

                  {/* Customer & Service Info */}
                  <div className="home-service-info">
                    <div className="info-header">Service Details</div>
                    <div className="info-row">
                      <span>👤</span>
                      <span>{service.customerName}</span>
                    </div>
                    {service.customerPhone && (
                      <div className="info-row">
                        <span>📞</span>
                        <span>{service.customerPhone}</span>
                      </div>
                    )}
                    <div className="info-row">
                      <span>📍</span>
                      <span>{service.address}</span>
                    </div>
                    {service.serviceNames && service.serviceNames.length > 0 && (
                      <div className="info-row">
                        <span>💆</span>
                        <span>{service.serviceNames.join(', ')}</span>
                      </div>
                    )}
                    {service.serviceDuration && (
                      <div className="info-row">
                        <span>⏱️</span>
                        <span>{service.serviceDuration} min</span>
                      </div>
                    )}
                    {service.isAdvanceBooking && service.paymentStatus && (
                      <div className="info-row">
                        <span>💰</span>
                        <span className={`payment-status ${service.paymentStatus}`}>
                          {service.paymentStatus === 'paid' ? 'Paid' : 'Pay After Service'}
                        </span>
                      </div>
                    )}
                    {(service.totalAmount > 0 || service.servicePrice > 0) && (
                      <div className="info-row">
                        <span>💵</span>
                        <span>
                          <strong>Total:</strong> ₱{Number(service.totalAmount || service.servicePrice || 0).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {service.paxCount > 1 && (
                      <div className="info-row">
                        <span>👥</span>
                        <span><strong>Pax:</strong> {service.paxCount} guests</span>
                      </div>
                    )}
                    {service.pickupRequestedAt && !service.pickupAcknowledgedAt && (
                      <div className="info-row" style={{ color: '#92400e' }}>
                        <span>🚖</span>
                        <span>
                          <strong>Pickup requested</strong>
                          {service.pickupRequestedBy ? ` by ${service.pickupRequestedBy}` : ''}
                        </span>
                      </div>
                    )}
                    {service.pickupAcknowledgedAt && (
                      <div className="info-row" style={{ color: '#064e3b' }}>
                        <span>✅</span>
                        <span>
                          <strong>Rider on the way</strong>
                          {service.pickupAcknowledgedBy ? ` — ${service.pickupAcknowledgedBy}` : ''}
                        </span>
                      </div>
                    )}
                    {/* Live Grab-style map — only on home services with an
                        active pasundo. Each side (rider + therapist) publishes
                        its own GPS every ~15s; this map renders whichever
                        pins have arrived. */}
                    {service.pickupRequestedAt && ['pending', 'occupied'].includes(service.status) && !service.isAdvanceBooking && (
                      <PasundoLiveMap
                        rider={service.riderCurrentLat != null ? {
                          lat: service.riderCurrentLat,
                          lng: service.riderCurrentLng,
                          updatedAt: service.riderLocationUpdatedAt,
                          name: service.pickupAcknowledgedBy || 'Rider',
                        } : null}
                        therapist={service.therapistCurrentLat != null ? {
                          lat: service.therapistCurrentLat,
                          lng: service.therapistCurrentLng,
                          updatedAt: service.therapistLocationUpdatedAt,
                          name: 'You',
                        } : null}
                      />
                    )}
                  </div>

                  {/* Start Service button for pending home services */}
                  {service.status === 'pending' && (isMyService || !isTherapist()) && (
                    <div className="service-action-buttons">
                      <button
                        className="btn btn-primary start-service-btn"
                        onClick={() => handleStartHomeService(service)}
                      >
                        ▶️ Start Service
                      </button>
                      <button
                        className="btn btn-error stop-service-btn"
                        onClick={() => openStopServiceModal(service, true)}
                      >
                        ⏹️ Cancel
                      </button>
                    </div>
                  )}

                  {/* Pasundo button — therapist requests pickup from rider.
                      Visible to the assigned therapist (or non-therapist
                      operators viewing the card) on both pending AND
                      occupied home services, since the therapist may need
                      a ride before the service starts (just arrived at the
                      house for setup) or after (heading back to the spa). */}
                  {(isMyService || !isTherapist()) && !service.isAdvanceBooking && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleRequestPickup(service)}
                      disabled={!!service.pickupRequestedAt || !!pickupRequesting[service._id]}
                      style={{ width: '100%', marginTop: 'var(--spacing-sm)', fontSize: '0.85rem' }}
                    >
                      {service.pickupAcknowledgedAt
                        ? `✅ Rider OTW${service.pickupAcknowledgedBy ? ` — ${service.pickupAcknowledgedBy}` : ''}`
                        : service.pickupRequestedAt
                          ? '✅ Pickup requested'
                          : pickupRequesting[service._id]
                            ? 'Requesting…'
                            : '🚖 Pasundo (Request Pickup)'}
                    </button>
                  )}

                  {/* Action buttons for occupied home services — mirror
                      the room card layout (Upgrade + Stop) so a therapist
                      mid-service can swap to a longer service or end
                      early without leaving the page. */}
                  {service.status === 'occupied' && (isMyService || !isTherapist()) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'var(--spacing-sm)' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => openHomeServiceUpgradeModal(service)}
                        style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
                      >
                        ⬆️ Upgrade
                      </button>
                      <button
                        className="btn btn-error"
                        onClick={() => openStopServiceModal(service, true)}
                        style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
                      >
                        ⏹️ Stop
                      </button>
                    </div>
                  )}

                  {/* Countdown timer for occupied home services */}
                  {service.status === 'occupied' && timeRemaining && (
                    <div className={`room-timer ${timeRemaining.isCritical ? 'critical' : ''}`}>
                      {timeRemaining.isExpired ? (
                        <span>Time's up!</span>
                      ) : (
                        <span>
                          {timeRemaining.minutes}:{String(timeRemaining.seconds).padStart(2, '0')} remaining
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Advance Bookings */}
      {upcomingBookings.length > 0 && (
        <div className="upcoming-bookings-section">
          <h3>Upcoming Advance Bookings</h3>
          <div className="upcoming-bookings-grid">
            {upcomingBookings.map(booking => (
              <div key={booking._id || booking.id} className="upcoming-booking-card">
                <div className="booking-card-header">
                  <span className="room-badge">{booking.roomName}</span>
                  <span className={`status-badge ${booking.status}`}>
                    {booking.status}
                  </span>
                </div>
                <div className="booking-card-body">
                  <p className="client-name">👤 {booking.clientName}</p>
                  <p className="service-name">💆 {booking.serviceName}</p>
                  <p className="therapist-name">🧑‍⚕️ {booking.employeeName}</p>
                  <p className="booking-datetime">
                    📅 {format(parseISO(booking.bookingDateTime), 'MMM dd, yyyy')}
                    <br />
                    ⏰ {format(parseISO(booking.bookingDateTime), 'h:mm a')}
                  </p>
                  {booking.specialRequests && (
                    <p className="special-note">💬 {booking.specialRequests}</p>
                  )}
                </div>
                <div className="booking-card-footer">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleStartService(booking)}
                  >
                    Start Service
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Room Modal using CrudModal */}
      <CrudModal
        isOpen={showModal}
        onClose={closeModal}
        mode={modalMode}
        title={{ create: 'Add Room', edit: 'Edit Room' }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        className="room-modal"
      >
        <div className="form-group">
          <label>Room Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="e.g., Room 1, VIP Suite A"
            className="form-control"
            required
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Room Type *</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="form-control"
              required
            >
              <option value="">Select type...</option>
              {roomTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Capacity *</label>
            <input
              type="number"
              name="capacity"
              value={formData.capacity}
              onChange={handleInputChange}
              placeholder="1"
              className="form-control"
              min="1"
              required
            />
          </div>
        </div>
        <div className="form-group">
          <label>Status</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className="form-control"
          >
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <div className="form-group">
          <label>Amenities</label>
          <div className="amenities-selector">
            {availableAmenities.map(amenity => (
              <label key={amenity} className="amenity-checkbox">
                <input
                  type="checkbox"
                  checked={formData.amenities.includes(amenity)}
                  onChange={() => handleAmenityToggle(amenity)}
                />
                <span>{amenity}</span>
              </label>
            ))}
          </div>
        </div>
      </CrudModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Room"
        message={`Are you sure you want to delete "${deleteConfirm.item?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        isLoading={isDeleting}
      />

      {/* Stop Service Modal */}
      {stopServiceModal.isOpen && (
        <div className="modal-overlay" onClick={closeStopServiceModal}>
          <div className="modal stop-service-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{stopServiceModal.room?.status === 'pending' ? 'Cancel Service' : 'Stop Service'}</h3>
              <button className="modal-close" onClick={closeStopServiceModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="stop-service-info">
                {stopServiceModal.isHomeService ? (
                  <>
                    <p><strong>Type:</strong> Home Service</p>
                    <p><strong>Therapist:</strong> {stopServiceModal.room?.employeeName || 'N/A'}</p>
                    <p><strong>Customer:</strong> {stopServiceModal.room?.customerName || 'N/A'}</p>
                    <p><strong>Address:</strong> {stopServiceModal.room?.address || 'N/A'}</p>
                    <p><strong>Service:</strong> {stopServiceModal.room?.serviceNames?.join(', ') || 'N/A'}</p>
                  </>
                ) : (
                  <>
                    <p><strong>Room:</strong> {stopServiceModal.room?.name}</p>
                    <p><strong>Therapist:</strong> {stopServiceModal.room?.assignedEmployeeName || 'N/A'}</p>
                    <p><strong>Customer:</strong> {stopServiceModal.room?.customerName || 'N/A'}</p>
                    <p><strong>Service:</strong> {stopServiceModal.room?.serviceNames?.join(', ') || 'N/A'}</p>
                  </>
                )}
                {stopServiceModal.room?.status === 'occupied' && stopServiceModal.room?.startTime && (
                  <p><strong>Running for:</strong> {Math.floor((new Date() - new Date(stopServiceModal.room.startTime)) / 60000)} min</p>
                )}
              </div>
              <div className="form-group">
                <label>Reason for {stopServiceModal.room?.status === 'pending' ? 'cancellation' : 'stopping'} *</label>
                <select
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value)}
                  className="form-control"
                  required
                >
                  <option value="">Select a reason...</option>
                  {stopReasons.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeStopServiceModal}>
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={handleStopService}
                disabled={!stopReason || isStoppingService}
              >
                {isStoppingService ? 'Stopping...' : (stopServiceModal.room?.status === 'pending' ? 'Cancel Service' : 'Stop Service')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Order Modal */}
      <ManageOrder
        isOpen={showManageOrder}
        onClose={() => setShowManageOrder(false)}
        items={rooms.slice().sort((a, b) => (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999))}
        onSave={handleSaveOrder}
        title="Manage Room Order"
        renderLabel={(room) => room.name}
        renderSubLabel={(room) => `${room.type} - Capacity: ${room.capacity}`}
        saving={savingOrder}
      />

      {/* Upgrade Service Modal */}
      {upgradeModal.isOpen && (
        <div className="modal-overlay" onClick={() => setUpgradeModal({ isOpen: false, room: null, isHomeService: false })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>
                Upgrade Service - {upgradeModal.isHomeService
                  ? (upgradeModal.room?.customerName || 'Home Service')
                  : upgradeModal.room?.name}
              </h3>
              <button className="modal-close" onClick={() => setUpgradeModal({ isOpen: false, room: null, isHomeService: false })}>&times;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ marginBottom: '12px', color: '#666', fontSize: '0.9rem' }}>
                Pick the new service(s) — they will replace what's running. The timer keeps going.
              </p>

              {(upgradeModal.room?.serviceNames || []).length > 0 && (
                <div
                  style={{
                    marginBottom: '12px',
                    padding: '8px 12px',
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: '#78350f',
                  }}
                >
                  <strong>Currently:</strong>{' '}
                  {(upgradeModal.room.serviceNames || []).join(', ')}
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Select Services</label>
                {availableServices.map(service => {
                  const isSelected = selectedUpgradeServices.some(s => (s._id || s.id) === (service._id || service.id));
                  return (
                    <div
                      key={service._id || service.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedUpgradeServices(prev => prev.filter(s => (s._id || s.id) !== (service._id || service.id)));
                        } else {
                          setSelectedUpgradeServices(prev => [...prev, service]);
                        }
                      }}
                      style={{
                        padding: '10px 12px',
                        marginBottom: '6px',
                        border: isSelected ? '2px solid var(--primary-color, #8b1a2b)' : '1px solid #ddd',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: isSelected ? '#fef2f4' : '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <strong>{service.name}</strong>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{service.duration || 60} min</div>
                      </div>
                      <span style={{ fontWeight: 600 }}>₱{(service.price || 0).toFixed(0)}</span>
                    </div>
                  );
                })}
              </div>

              {selectedUpgradeServices.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                    Adjust Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={upgradeDuration}
                    onChange={e => setUpgradeDuration(parseInt(e.target.value) || 0)}
                    min={1}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px' }}
                  />
                </div>
              )}

              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Services:</span>
                  <span>{selectedUpgradeServices.map(s => s.name).join(', ') || 'None selected'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Duration:</span>
                  <span>{upgradeDuration} min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem' }}>
                  <span>Total:</span>
                  <span>₱{selectedUpgradeServices.reduce((sum, s) => sum + (s.price || 0), 0).toFixed(0)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setUpgradeModal({ isOpen: false, room: null, isHomeService: false })}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleUpgradeService}
                disabled={selectedUpgradeServices.length === 0}
              >
                Confirm Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rooms;
