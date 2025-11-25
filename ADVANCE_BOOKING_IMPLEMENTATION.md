# Advance Booking Feature - Implementation Guide

## ✅ Completed
1. ✅ Type definitions created (`src/types/advanceBooking.js`)
2. ✅ Mock API created (`src/mockApi/advanceBookingApi.js`)
3. ✅ AdvanceBookingCheckout component created (`src/components/AdvanceBookingCheckout.jsx`)
4. ✅ Mock API integrated into main mockApi.js

## 🔄 Remaining Implementation Steps

### 1. POS Page Integration (`src/pages/POS.jsx`)

**Add imports:**
```javascript
import AdvanceBookingCheckout from '../components/AdvanceBookingCheckout';
import mockApi from '../mockApi/mockApi';
```

**Add state variables (around line 20):**
```javascript
const [isAdvanceBooking, setIsAdvanceBooking] = useState(false);
const [advanceBookingData, setAdvanceBookingData] = useState(null);
const [rooms, setRooms] = useState([]);
```

**Load rooms on mount (in useEffect):**
```javascript
useEffect(() => {
  const loadRooms = async () => {
    try {
      const roomsData = await mockApi.rooms.getRooms();
      setRooms(roomsData);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  };
  loadRooms();
}, []);
```

**In the handleCompleteSale function (around line 150-200), modify to handle advance bookings:**
```javascript
const handleCompleteSale = async () => {
  if (!validateCheckout()) return;

  try {
    setProcessing(true);

    // Check if this is an advance booking
    if (isAdvanceBooking && advanceBookingData) {
      // Validate advance booking data
      if (!advanceBookingData.bookingDateTime) {
        showToast('Please select booking date and time', 'error');
        setProcessing(false);
        return;
      }

      if (!advanceBookingData.clientName) {
        showToast('Please enter client name', 'error');
        setProcessing(false);
        return;
      }

      const bookingDateTime = new Date(advanceBookingData.bookingDateTime);
      if (bookingDateTime <= new Date()) {
        showToast('Booking date/time must be in the future', 'error');
        setProcessing(false);
        return;
      }

      if (!selectedEmployee) {
        showToast('Please select a therapist for the advance booking', 'error');
        setProcessing(false);
        return;
      }

      // Create transaction ID
      const transactionId = `txn_adv_${Date.now()}`;

      // Determine payment status
      const paymentStatus = advanceBookingData.paymentTiming === 'pay-now' ? 'paid' : 'pending';

      // Get service details from cart
      const serviceName = cart.map(item => item.name).join(', ');
      const servicePrice = totalAfterDiscount;
      const estimatedDuration = cart.reduce((sum, item) => sum + (item.duration || 60), 0);

      // Find room details if applicable
      let roomName = null;
      if (!advanceBookingData.isHomeService && advanceBookingData.roomId) {
        const room = rooms.find(r => r._id === advanceBookingData.roomId);
        roomName = room ? room.name : null;
      }

      // Create advance booking
      const bookingInput = {
        bookingDateTime: advanceBookingData.bookingDateTime,
        employeeId: selectedEmployee._id,
        employeeName: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
        serviceName,
        estimatedDuration,
        servicePrice,
        roomId: advanceBookingData.isHomeService ? null : advanceBookingData.roomId,
        roomName,
        isHomeService: advanceBookingData.isHomeService,
        clientName: advanceBookingData.clientName,
        clientPhone: advanceBookingData.clientPhone || null,
        clientEmail: advanceBookingData.clientEmail || null,
        clientAddress: advanceBookingData.isHomeService ? advanceBookingData.clientAddress : null,
        paymentMethod: checkoutData.paymentMethod,
        paymentTiming: advanceBookingData.paymentTiming,
        paymentStatus,
        transactionId,
        specialRequests: advanceBookingData.specialRequests || null
      };

      const booking = await mockApi.advanceBooking.createAdvanceBooking(bookingInput);

      // Show success message
      const bookingDate = new Date(booking.bookingDateTime).toLocaleString();
      if (advanceBookingData.paymentTiming === 'pay-now') {
        showToast(`Advance booking created for ${bookingDate}. Payment collected (demo).`, 'success');
      } else {
        showToast(`Advance booking created for ${bookingDate}. Payment will be collected after service.`, 'success');
      }

      // Clear cart and close modal
      setCart([]);
      setSelectedCustomer(null);
      setSelectedEmployee(null);
      setDiscountPercent(0);
      setShowCheckoutModal(false);
      setIsAdvanceBooking(false);
      setAdvanceBookingData(null);
      setProcessing(false);
      return;
    }

    // ... existing immediate POS logic continues here ...
  } catch (error) {
    showToast(error.message || 'Failed to complete sale', 'error');
    setProcessing(false);
  }
};
```

**In the checkout modal JSX (around line 500-600), add the AdvanceBookingCheckout component BEFORE the payment method section:**
```jsx
{/* Advance Booking Section */}
<AdvanceBookingCheckout
  enabled={isAdvanceBooking}
  onToggle={setIsAdvanceBooking}
  value={advanceBookingData}
  onChange={setAdvanceBookingData}
  employees={employees}
  rooms={rooms}
/>
```

---

### 2. Appointments Page - Add Advance Bookings Tab (`src/pages/Appointments.jsx`)

**Add imports:**
```javascript
import { format, parseISO } from 'date-fns';
```

**Add state:**
```javascript
const [activeTab, setActiveTab] = useState('appointments'); // 'appointments' | 'advance-bookings'
const [advanceBookings, setAdvanceBookings] = useState([]);
const [bookingFilter, setBookingFilter] = useState({
  date: '',
  status: 'active' // 'active' | 'all' | 'completed' | 'cancelled'
});
```

**Add load function:**
```javascript
const loadAdvanceBookings = async () => {
  try {
    let bookings = await mockApi.advanceBooking.listAdvanceBookings();

    // Apply filters
    if (bookingFilter.date) {
      bookings = await mockApi.advanceBooking.listAdvanceBookingsByDate(bookingFilter.date);
    }

    // Filter by status
    if (bookingFilter.status === 'active') {
      bookings = bookings.filter(b =>
        !['completed', 'cancelled'].includes(b.status)
      );
    } else if (bookingFilter.status !== 'all') {
      bookings = bookings.filter(b => b.status === bookingFilter.status);
    }

    // Role-based filtering (if therapist, only show their bookings)
    if (isTherapist() && user?.employeeId) {
      bookings = bookings.filter(b => b.employeeId === user.employeeId);
    }

    setAdvanceBookings(bookings);
  } catch (error) {
    showToast('Failed to load advance bookings', 'error');
  }
};
```

**Call in useEffect:**
```javascript
useEffect(() => {
  if (activeTab === 'advance-bookings') {
    loadAdvanceBookings();
  }
}, [activeTab, bookingFilter, user]);
```

**Add tab switcher in JSX (after page header):**
```jsx
<div className="tabs">
  <button
    className={`tab ${activeTab === 'appointments' ? 'active' : ''}`}
    onClick={() => setActiveTab('appointments')}
  >
    Regular Appointments
  </button>
  <button
    className={`tab ${activeTab === 'advance-bookings' ? 'active' : ''}`}
    onClick={() => setActiveTab('advance-bookings')}
  >
    Advance Bookings
  </button>
</div>
```

**Add advance bookings view:**
```jsx
{activeTab === 'advance-bookings' && (
  <div className="advance-bookings-section">
    {/* Filters */}
    <div className="filters-row">
      <input
        type="date"
        value={bookingFilter.date}
        onChange={(e) => setBookingFilter({ ...bookingFilter, date: e.target.value })}
        placeholder="Filter by date"
      />
      <select
        value={bookingFilter.status}
        onChange={(e) => setBookingFilter({ ...bookingFilter, status: e.target.value })}
      >
        <option value="active">Active Bookings</option>
        <option value="all">All Bookings</option>
        <option value="scheduled">Scheduled</option>
        <option value="confirmed">Confirmed</option>
        <option value="in-progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>

    {/* Bookings Grid */}
    <div className="bookings-grid">
      {advanceBookings.map(booking => (
        <div key={booking.id} className="booking-card">
          <div className="booking-header">
            <span className={`status-badge ${booking.status}`}>
              {booking.status}
            </span>
            <span className="booking-date">
              {format(parseISO(booking.bookingDateTime), 'MMM dd, yyyy HH:mm')}
            </span>
          </div>
          <div className="booking-body">
            <h4>{booking.clientName}</h4>
            <p className="service-name">{booking.serviceName}</p>
            <p className="therapist">👤 {booking.employeeName}</p>
            <p className="location">
              {booking.isHomeService ? '🏠 Home Service' : `🚪 ${booking.roomName}`}
            </p>
            {booking.isHomeService && booking.clientAddress && (
              <p className="address">📍 {booking.clientAddress}</p>
            )}
            {booking.specialRequests && (
              <p className="special-requests">💬 {booking.specialRequests}</p>
            )}
            <div className="payment-info">
              <span className={`payment-badge ${booking.paymentStatus}`}>
                {booking.paymentStatus === 'paid' ? '✓ Paid' : 'Payment Pending'}
              </span>
              <span className="amount">₱{booking.servicePrice.toFixed(2)}</span>
            </div>
          </div>
          <div className="booking-actions">
            {booking.status === 'scheduled' && (
              <button
                className="btn btn-sm btn-success"
                onClick={async () => {
                  try {
                    await mockApi.advanceBooking.updateAdvanceBooking(booking.id, { status: 'confirmed' });
                    showToast('Booking confirmed', 'success');
                    loadAdvanceBookings();
                  } catch (error) {
                    showToast('Failed to confirm booking', 'error');
                  }
                }}
              >
                Confirm
              </button>
            )}
            {['scheduled', 'confirmed'].includes(booking.status) && (
              <>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={async () => {
                    try {
                      await mockApi.advanceBooking.startServiceFromBooking(booking.id);
                      showToast('Service started', 'success');
                      loadAdvanceBookings();
                    } catch (error) {
                      showToast('Failed to start service', 'error');
                    }
                  }}
                >
                  Start Service
                </button>
                <button
                  className="btn btn-sm btn-error"
                  onClick={async () => {
                    const reason = prompt('Cancellation reason (optional):');
                    try {
                      await mockApi.advanceBooking.cancelAdvanceBooking(booking.id, reason || '');
                      showToast('Booking cancelled', 'success');
                      loadAdvanceBookings();
                    } catch (error) {
                      showToast('Failed to cancel booking', 'error');
                    }
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

---

### 3. Rooms Page - Show Upcoming Bookings (`src/pages/Rooms.jsx`)

**Add state:**
```javascript
const [upcomingBookings, setUpcomingBookings] = useState([]);
```

**Load bookings:**
```javascript
useEffect(() => {
  const loadUpcomingBookings = async () => {
    try {
      let bookings = await mockApi.advanceBooking.listAdvanceBookings();
      // Filter to only scheduled/confirmed with rooms
      bookings = bookings.filter(b =>
        ['scheduled', 'confirmed'].includes(b.status) &&
        b.roomId &&
        !b.isHomeService
      );

      // Role-based filtering
      if (isTherapist() && user?.employeeId) {
        bookings = bookings.filter(b => b.employeeId === user.employeeId);
      }

      setUpcomingBookings(bookings);
    } catch (error) {
      console.error('Failed to load upcoming bookings:', error);
    }
  };

  loadUpcomingBookings();
}, []);
```

**Add to JSX (after current rooms display):**
```jsx
{/* Upcoming Advance Bookings */}
{upcomingBookings.length > 0 && (
  <div className="upcoming-bookings-section">
    <h3>Upcoming Advance Bookings</h3>
    <div className="bookings-grid">
      {upcomingBookings.map(booking => (
        <div key={booking.id} className="booking-card">
          <div className="booking-header">
            <span className="room-badge">{booking.roomName}</span>
            <span className={`status-badge ${booking.status}`}>{booking.status}</span>
          </div>
          <div className="booking-info">
            <p className="client-name">{booking.clientName}</p>
            <p className="service">{booking.serviceName}</p>
            <p className="therapist">👤 {booking.employeeName}</p>
            <p className="datetime">
              📅 {format(parseISO(booking.bookingDateTime), 'MMM dd, yyyy HH:mm')}
            </p>
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={async () => {
              try {
                await mockApi.advanceBooking.startServiceFromBooking(booking.id);
                showToast('Service started', 'success');
                loadRooms();
                loadUpcomingBookings();
              } catch (error) {
                showToast('Failed to start service', 'error');
              }
            }}
          >
            Start Service
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

---

### 4. Dashboard KPIs (`src/pages/Dashboard.jsx`)

**Add state:**
```javascript
const [pendingRevenue, setPendingRevenue] = useState(0);
const [todaysBookings, setTodaysBookings] = useState(0);
```

**Load in useEffect:**
```javascript
useEffect(() => {
  const loadAdvanceBookingKPIs = async () => {
    try {
      const pending = await mockApi.advanceBooking.getPendingRevenue();
      setPendingRevenue(pending.total);

      const todayCount = await mockApi.advanceBooking.getTodaysBookingsCount();
      setTodaysBookings(todayCount);
    } catch (error) {
      console.error('Failed to load advance booking KPIs:', error);
    }
  };

  loadAdvanceBookingKPIs();
}, []);
```

**Add KPI cards:**
```jsx
<div className="dashboard-stat-card pending">
  <div className="dashboard-stat-icon">⏳</div>
  <div className="dashboard-stat-value">
    ₱{pendingRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
  </div>
  <div className="dashboard-stat-label">Pending Revenue</div>
  <div className="dashboard-stat-desc">From pay-after bookings</div>
</div>

<div className="dashboard-stat-card bookings">
  <div className="dashboard-stat-icon">📅</div>
  <div className="dashboard-stat-value">{todaysBookings}</div>
  <div className="dashboard-stat-label">Today's Bookings</div>
  <div className="dashboard-stat-desc">Scheduled appointments</div>
</div>
```

---

### 5. CSS Styling

**Add to `src/App.css` or create `src/styles/advanceBooking.css`:**

```css
/* Advance Booking Checkout Component */
.advance-booking-section {
  margin: var(--spacing-lg) 0;
  padding: var(--spacing-md);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
}

.advance-booking-section.active {
  border-color: var(--primary-500);
  background: var(--primary-50);
}

.advance-booking-form {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--gray-200);
}

.form-section {
  margin-bottom: var(--spacing-lg);
}

.form-section h4 {
  margin-bottom: var(--spacing-sm);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--gray-700);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.payment-timing-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.radio-option {
  display: flex;
  align-items: flex-start;
  padding: var(--spacing-md);
  border: 2px solid var(--gray-200);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.radio-option:hover {
  border-color: var(--primary-400);
  background: var(--primary-50);
}

.radio-option input[type="radio"] {
  margin-right: var(--spacing-sm);
  margin-top: 2px;
}

.radio-option input[type="radio"]:checked ~ .radio-content {
  color: var(--primary-700);
}

.radio-content {
  display: flex;
  flex-direction: column;
}

.radio-title {
  font-weight: 600;
  font-size: 1rem;
}

.radio-desc {
  font-size: 0.85rem;
  color: var(--gray-600);
  margin-top: 2px;
}

/* Advance Bookings Page */
.tabs {
  display: flex;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-lg);
  border-bottom: 2px solid var(--gray-200);
}

.tab {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  color: var(--primary-600);
}

.tab.active {
  color: var(--primary-600);
  border-bottom-color: var(--primary-600);
}

.bookings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}

.booking-card {
  padding: var(--spacing-md);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s;
}

.booking-card:hover {
  box-shadow: var(--shadow-md);
}

.booking-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.booking-body h4 {
  margin-bottom: var(--spacing-xs);
  font-size: 1.1rem;
}

.booking-body p {
  margin: var(--spacing-xs) 0;
  font-size: 0.9rem;
  color: var(--gray-700);
}

.booking-actions {
  display: flex;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--gray-200);
}

.payment-badge {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 600;
}

.payment-badge.paid {
  background: var(--success-100);
  color: var(--success-700);
}

.payment-badge.pending {
  background: var(--warning-100);
  color: var(--warning-700);
}

/* Upcoming Bookings in Rooms */
.upcoming-bookings-section {
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-xl);
  border-top: 2px solid var(--gray-200);
}

.upcoming-bookings-section h3 {
  margin-bottom: var(--spacing-md);
  font-size: 1.2rem;
}
```

---

## Testing Checklist

- [ ] POS: Create advance booking with "Pay Now"
- [ ] POS: Create advance booking with "Pay After"
- [ ] POS: Create home service booking
- [ ] POS: Create room booking
- [ ] POS: Validate future date requirement
- [ ] Appointments: View advance bookings
- [ ] Appointments: Confirm booking
- [ ] Appointments: Start service from booking
- [ ] Appointments: Cancel booking
- [ ] Appointments: Filter by date
- [ ] Rooms: View upcoming bookings
- [ ] Rooms: Start service from room
- [ ] Dashboard: See pending revenue
- [ ] Dashboard: See today's bookings count
- [ ] Therapist role: Only see own bookings
- [ ] Complete service with pay-after payment

---

## Notes

1. All data persists only in memory during the session
2. Refresh will reset all advance booking data
3. No real payment processing - all simulated
4. Date/time validation is frontend-only
5. Role-based filtering uses current user context
