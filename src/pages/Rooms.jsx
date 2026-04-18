import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { homeServicesApi, transactionsApi } from '../mockApi/offlineApi';
import { format, parseISO } from 'date-fns';

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

  // Service upgrade modal state
  const [upgradeModal, setUpgradeModal] = useState({ isOpen: false, room: null });
  const [availableServices, setAvailableServices] = useState([]);
  const [selectedUpgradeServices, setSelectedUpgradeServices] = useState([]);
  const [upgradeDuration, setUpgradeDuration] = useState(0);

  // Home services state
  const [homeServices, setHomeServices] = useState([]);

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
      return {
        name: data.name.trim(),
        type: data.type,
        capacity: parseInt(data.capacity),
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
      // Load direct home services (from regular checkout)
      let services = await homeServicesApi.getActiveHomeServices();

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
          paymentStatus: b.paymentStatus
        }));

      // Merge both sources
      services = [...services, ...homeServiceBookings];

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

    // Branch filtering
    const effectiveBranchId = getEffectiveBranchId();
    if (effectiveBranchId) {
      filtered = filtered.filter(r => !r.branchId || r.branchId === effectiveBranchId);
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

      // Log service start event
      await mockApi.activityLogs.createLog({
        type: 'service',
        action: 'Service Started',
        description: `${room.serviceNames?.join(', ') || 'Service'} started in ${room.name}`,
        user: {
          firstName: user?.firstName || user?.name?.split(' ')[0] || 'Unknown',
          lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
          role: user?.role || 'therapist'
        },
        ipAddress: 'localhost',
        details: {
          roomId: room._id,
          roomName: room.name,
          therapistId: room.assignedEmployeeId,
          therapistName: room.assignedEmployeeName,
          customerName: room.customerName,
          customerPhone: room.customerPhone,
          serviceNames: room.serviceNames,
          plannedDuration: room.serviceDuration,
          startTime: startTime,
          status: 'started',
          transactionId: room.transactionId
        },
        severity: 'info'
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
      const services = products.filter(p => p.type === 'service' && p.active !== false);
      setAvailableServices(services);
      // Pre-select current services
      const currentNames = room.serviceNames || [];
      const preSelected = services.filter(s => currentNames.includes(s.name));
      setSelectedUpgradeServices(preSelected);
      setUpgradeDuration(room.serviceDuration || 60);
      setUpgradeModal({ isOpen: true, room });
    } catch (error) {
      showToast('Failed to load services', 'error');
    }
  };

  // Handle service upgrade - update room service details without stopping timer
  const handleUpgradeService = async () => {
    const room = upgradeModal.room;
    if (!room || selectedUpgradeServices.length === 0) return;

    try {
      const newServiceNames = selectedUpgradeServices.map(s => s.name);
      const newDuration = selectedUpgradeServices.reduce((sum, s) => sum + (s.duration || 60), 0);
      const newPrice = selectedUpgradeServices.reduce((sum, s) => sum + (s.price || 0), 0);

      // Update room with new service info, keep timer running (don't change startTime)
      await mockApi.rooms.updateRoom(room._id, {
        serviceNames: newServiceNames,
        serviceDuration: upgradeDuration || newDuration,
        servicePrice: newPrice
      });

      // Update the linked transaction if exists
      if (room.transactionId) {
        try {
          const txn = await mockApi.transactions.getTransaction(room.transactionId);
          if (txn) {
            const updatedItems = selectedUpgradeServices.map(s => ({
              id: s._id || s.id,
              name: s.name,
              type: 'service',
              price: s.price || 0,
              quantity: 1,
              subtotal: s.price || 0,
              itemsUsed: []
            }));
            await mockApi.transactions.updateTransaction(room.transactionId, {
              items: updatedItems,
              total: newPrice,
              subtotal: newPrice
            });
          }
        } catch (txErr) {
          console.warn('Could not update transaction:', txErr);
        }
      }

      await mockApi.activityLogs.createLog({
        type: 'service',
        action: 'Service Upgraded',
        description: `Service upgraded in ${room.name}: ${newServiceNames.join(', ')}`,
        user: {
          firstName: user?.firstName || 'Unknown',
          lastName: user?.lastName || '',
          role: user?.role || 'staff'
        },
        ipAddress: 'localhost',
        details: {
          roomId: room._id,
          roomName: room.name,
          previousServices: room.serviceNames,
          newServices: newServiceNames,
          previousDuration: room.serviceDuration,
          newDuration: upgradeDuration || newDuration,
          newPrice
        },
        severity: 'info'
      });

      setUpgradeModal({ isOpen: false, room: null });
      showToast(`Service upgraded to: ${newServiceNames.join(', ')}`, 'success');
      loadRooms();
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
        // Regular home service
        await homeServicesApi.updateHomeServiceStatus(service._id, 'occupied', {
          startTime: startTime
        });
      }

      // Log home service start event
      await mockApi.activityLogs.createLog({
        type: 'service',
        action: 'Home Service Started',
        description: `Home service started for ${service.customerName} at ${service.address}`,
        user: {
          firstName: user?.firstName || user?.name?.split(' ')[0] || 'Unknown',
          lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
          role: user?.role || 'therapist'
        },
        ipAddress: 'localhost',
        details: {
          homeServiceId: service._id,
          therapistId: service.employeeId,
          therapistName: service.employeeName,
          customerName: service.customerName,
          customerPhone: service.customerPhone,
          address: service.address,
          serviceNames: service.serviceNames,
          plannedDuration: service.serviceDuration,
          startTime: startTime,
          status: 'started',
          transactionId: service.transactionId,
          isAdvanceBooking: service.isAdvanceBooking || false
        },
        severity: 'info'
      });

      showToast('Home service started! Timer is now running.', 'success');
      loadHomeServices();
    } catch (error) {
      showToast('Failed to start home service', 'error');
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

              // Log service completion event
              await mockApi.activityLogs.createLog({
                type: 'service',
                action: 'Service Completed',
                description: `${room.serviceNames?.join(', ') || 'Service'} completed in ${room.name}`,
                user: {
                  firstName: 'System',
                  lastName: '',
                  role: 'System'
                },
                ipAddress: 'localhost',
                details: {
                  roomId: room._id,
                  roomName: room.name,
                  therapistId: room.assignedEmployeeId,
                  therapistName: room.assignedEmployeeName,
                  customerName: room.customerName,
                  customerPhone: room.customerPhone,
                  serviceNames: room.serviceNames,
                  plannedDuration: room.serviceDuration,
                  actualDuration: room.serviceDuration,
                  startTime: room.startTime,
                  endTime: endTime,
                  status: 'completed',
                  transactionId: room.transactionId
                },
                severity: 'info'
              });

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

              // Log home service completion event
              await mockApi.activityLogs.createLog({
                type: 'service',
                action: 'Home Service Completed',
                description: `Home service completed for ${service.customerName} at ${service.address}`,
                user: {
                  firstName: 'System',
                  lastName: '',
                  role: 'System'
                },
                ipAddress: 'localhost',
                details: {
                  homeServiceId: service._id,
                  therapistId: service.employeeId,
                  therapistName: service.employeeName,
                  customerName: service.customerName,
                  customerPhone: service.customerPhone,
                  address: service.address,
                  serviceNames: service.serviceNames,
                  plannedDuration: service.serviceDuration,
                  actualDuration: service.serviceDuration,
                  startTime: service.startTime,
                  endTime: endTime,
                  status: 'completed',
                  transactionId: service.transactionId
                },
                severity: 'info'
              });

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
                // Delete regular home service card on completion
                await homeServicesApi.deleteHomeService(service._id);
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
        // Handle home service stop
        await mockApi.activityLogs.createLog({
          type: 'service',
          action: status === 'ended_early' ? 'Home Service Ended Early' : 'Home Service Cancelled',
          description: `Home service for ${room.customerName} ${status === 'ended_early' ? 'ended early' : 'cancelled'}: ${stopReason}`,
          user: {
            firstName: user?.firstName || user?.name?.split(' ')[0] || 'Unknown',
            lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
            role: user?.role || 'therapist'
          },
          ipAddress: 'localhost',
          details: {
            homeServiceId: room._id,
            therapistId: room.employeeId,
            therapistName: room.employeeName,
            customerName: room.customerName,
            customerPhone: room.customerPhone,
            address: room.address,
            serviceNames: room.serviceNames,
            plannedDuration: room.serviceDuration,
            actualDuration: actualDuration,
            startTime: room.startTime,
            endTime: now.toISOString(),
            status: status,
            reason: stopReason,
            transactionId: room.transactionId,
            isAdvanceBooking: room.isAdvanceBooking || false
          },
          severity: 'warning'
        });

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
              cancelledAt: now.toISOString()
            });
            showToast(`Home service stopped: ${stopReason}`, 'info');
          }
        } else {
          // Delete regular home service card
          await homeServicesApi.deleteHomeService(room._id);
          showToast(`Home service stopped: ${stopReason}`, 'info');
        }
        loadHomeServices();
      } else {
        // Handle room service stop
        await mockApi.activityLogs.createLog({
          type: 'service',
          action: status === 'ended_early' ? 'Service Ended Early' : 'Service Cancelled',
          description: `${room.serviceNames?.join(', ') || 'Service'} ${status === 'ended_early' ? 'ended early' : 'cancelled'}: ${stopReason}`,
          user: {
            firstName: user?.firstName || user?.name?.split(' ')[0] || 'Unknown',
            lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
            role: user?.role || 'therapist'
          },
          ipAddress: 'localhost',
          details: {
            roomId: room._id,
            roomName: room.name,
            therapistId: room.assignedEmployeeId,
            therapistName: room.assignedEmployeeName,
            customerName: room.customerName,
            customerPhone: room.customerPhone,
            serviceNames: room.serviceNames,
            plannedDuration: room.serviceDuration,
            actualDuration: actualDuration,
            startTime: room.startTime,
            endTime: now.toISOString(),
            status: status,
            reason: stopReason,
            transactionId: room.transactionId
          },
          severity: 'warning'
        });

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
              cancelledAt: now.toISOString()
            });
          } catch (bookingError) {
            // Silent fail for booking cancellation
          }
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
                      <span><strong>Customer:</strong> {room.customerName || 'Walk-in'}</span>
                    </div>
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
                    <span className="room-detail-value">{room.capacity} {room.capacity === 1 ? 'person' : 'people'}</span>
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

                  {/* Stop Service button for occupied home services */}
                  {service.status === 'occupied' && (isMyService || !isTherapist()) && (
                    <button
                      className="btn btn-error stop-service-btn"
                      onClick={() => openStopServiceModal(service, true)}
                      style={{ marginTop: 'var(--spacing-sm)' }}
                    >
                      ⏹️ Stop Service
                    </button>
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
        <div className="modal-overlay" onClick={() => setUpgradeModal({ isOpen: false, room: null })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Upgrade Service - {upgradeModal.room?.name}</h3>
              <button className="modal-close" onClick={() => setUpgradeModal({ isOpen: false, room: null })}>&times;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ marginBottom: '12px', color: '#666', fontSize: '0.9rem' }}>
                Select the new service(s). The timer will keep running.
              </p>

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
              <button className="btn" onClick={() => setUpgradeModal({ isOpen: false, room: null })}>Cancel</button>
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
