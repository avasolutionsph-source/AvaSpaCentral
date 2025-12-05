import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import AdvanceBookingCheckout from '../components/AdvanceBookingCheckout';
import { getTherapists } from '../utils/employeeFilters';
import { ConfirmDialog } from '../components/shared';

const POS = () => {
  const { showToast } = useApp();

  // State
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);

  // Checkout state
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerType, setCustomerType] = useState('walk-in'); // walk-in, existing, new
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [cardTransactionId, setCardTransactionId] = useState('');
  const [gcashReference, setGcashReference] = useState('');
  const [discountType, setDiscountType] = useState(null); // senior, pwd, promo, gc
  const [discountValue, setDiscountValue] = useState(0);
  const [bookingSource, setBookingSource] = useState('Walk-in');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Gift Certificate state
  const [showGCModal, setShowGCModal] = useState(false);
  const [gcCode, setGcCode] = useState('');
  const [gcValidation, setGcValidation] = useState(null);
  const [appliedGC, setAppliedGC] = useState(null);

  // Advance booking state
  const [isAdvanceBooking, setIsAdvanceBooking] = useState(false);
  const [advanceBookingData, setAdvanceBookingData] = useState(null);

  // Walk-in customer form state
  const [walkInCustomerData, setWalkInCustomerData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  // Customer search autocomplete state
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // Service rotation state
  const [rotationQueue, setRotationQueue] = useState([]);
  const [nextEmployee, setNextEmployee] = useState(null);
  const [showRotationQueue, setShowRotationQueue] = useState(true);

  // Clear cart confirmation state
  const [clearCartConfirm, setClearCartConfirm] = useState(false);

  // Scheduled employees for advance booking (based on selected date)
  const [scheduledEmployees, setScheduledEmployees] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);
        const [productsData, employeesData, customersData, roomsData] = await Promise.all([
          mockApi.products.getProducts({ active: true }),
          mockApi.employees.getEmployees({ status: 'active' }),
          mockApi.customers.getCustomers({ status: 'active' }),
          mockApi.rooms.getRooms()
        ]);

        if (!isMounted) return;

        setProducts(productsData);
        setEmployees(employeesData);
        setCustomers(customersData);
        setRooms(roomsData);

        // Extract unique categories
        const uniqueCategories = [...new Set(productsData.map(p => p.category))];
        setCategories(uniqueCategories);

        setLoading(false);
      } catch (error) {
        if (!isMounted) return;
        showToast('Failed to load POS data', 'error');
        setLoading(false);
      }
    };

    const loadQueue = async () => {
      try {
        const rotationData = await mockApi.serviceRotation.getRotationQueue();
        if (!isMounted) return;
        setRotationQueue(rotationData.queue);
        setNextEmployee(rotationData.nextEmployee);
      } catch (error) {
        console.error('Failed to load rotation queue:', error);
      }
    };

    loadData();
    loadQueue();

    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory, searchTerm]);

  const loadPOSData = async () => {
    try {
      setLoading(true);
      const [productsData, employeesData, customersData, roomsData] = await Promise.all([
        mockApi.products.getProducts({ active: true }),
        mockApi.employees.getEmployees({ status: 'active' }),
        mockApi.customers.getCustomers({ status: 'active' }),
        mockApi.rooms.getRooms()
      ]);

      setProducts(productsData);
      setEmployees(employeesData);
      setCustomers(customersData);
      setRooms(roomsData);

      // Extract unique categories
      const uniqueCategories = [...new Set(productsData.map(p => p.category))];
      setCategories(uniqueCategories);

      setLoading(false);
    } catch (error) {
      showToast('Failed to load POS data', 'error');
      setLoading(false);
    }
  };

  // Load service rotation queue
  const loadRotationQueue = async () => {
    try {
      const rotationData = await mockApi.serviceRotation.getRotationQueue();
      setRotationQueue(rotationData.queue);
      setNextEmployee(rotationData.nextEmployee);

      // Auto-select next employee if none selected
      if (!selectedEmployee && rotationData.nextEmployee) {
        setSelectedEmployee(rotationData.nextEmployee.employeeId);
      }
    } catch (error) {
      console.error('Failed to load rotation queue:', error);
    }
  };

  // Load scheduled employees when advance booking date changes
  useEffect(() => {
    const loadScheduledEmployees = async () => {
      if (isAdvanceBooking && advanceBookingData?.bookingDateTime) {
        try {
          const bookingDate = advanceBookingData.bookingDateTime.split('T')[0];
          const scheduleData = await mockApi.shiftSchedules.getScheduleForDate(bookingDate);
          setScheduledEmployees(scheduleData);
        } catch (error) {
          console.error('Failed to load scheduled employees:', error);
          setScheduledEmployees([]);
        }
      } else {
        setScheduledEmployees([]);
      }
    };

    loadScheduledEmployees();
  }, [isAdvanceBooking, advanceBookingData?.bookingDateTime]);

  // Select employee from rotation queue
  const selectFromRotation = (employeeId) => {
    setSelectedEmployee(employeeId);
    showToast('Employee selected from rotation queue', 'info');
  };

  // Skip current employee in rotation
  const skipInRotation = async (employeeId) => {
    try {
      await mockApi.serviceRotation.skipEmployee(employeeId);
      await loadRotationQueue();
      showToast('Employee skipped in rotation', 'info');
    } catch (error) {
      showToast('Failed to skip employee', 'error');
    }
  };

  const filterProducts = () => {
    let filtered = products;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  };

  const addToCart = (product) => {
    // Check if product is already in cart
    const existingIndex = cart.findIndex(item => item.id === product._id);

    if (existingIndex >= 0) {
      // Increase quantity
      const newCart = [...cart];
      const newQuantity = newCart[existingIndex].quantity + 1;

      // Check stock for products
      if (product.type === 'product' && newQuantity > product.stock) {
        showToast(`Only ${product.stock} units available in stock`, 'error');
        return;
      }

      newCart[existingIndex].quantity = newQuantity;
      newCart[existingIndex].subtotal = product.price * newQuantity;
      setCart(newCart);
      showToast(`${product.name} quantity increased`, 'info');
    } else {
      // Add new item
      if (product.type === 'product' && product.stock <= 0) {
        showToast('Item out of stock', 'error');
        return;
      }

      setCart([...cart, {
        id: product._id,
        name: product.name,
        type: product.type,
        price: product.price,
        quantity: 1,
        subtotal: product.price,
        commission: product.commission,
        duration: product.duration || null
      }]);
      showToast(`${product.name} added to cart`, 'success');
    }
  };

  const updateCartQuantity = (index, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(index);
      return;
    }

    const item = cart[index];
    const product = products.find(p => p._id === item.id);

    // Check stock
    if (product.type === 'product' && newQuantity > product.stock) {
      showToast(`Only ${product.stock} units available`, 'error');
      return;
    }

    const newCart = [...cart];
    newCart[index].quantity = newQuantity;
    newCart[index].subtotal = item.price * newQuantity;
    setCart(newCart);
  };

  const removeFromCart = (index) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
    showToast('Item removed from cart', 'info');
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    setClearCartConfirm(true);
  };

  const confirmClearCart = () => {
    setCart([]);
    setClearCartConfirm(false);
    showToast('Cart cleared', 'info');
  };

  const getCartSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const getDiscount = () => {
    const subtotal = getCartSubtotal();
    if (!discountType) return 0;

    if (discountType === 'senior' || discountType === 'pwd') {
      return subtotal * 0.2; // 20% discount
    }

    if (discountType === 'gc' && appliedGC) {
      // Gift certificate discount - use min of GC balance or cart subtotal
      return Math.min(appliedGC.balance, subtotal);
    }

    return discountValue;
  };

  const getTotal = () => {
    return getCartSubtotal() - getDiscount();
  };

  const getChange = () => {
    if (paymentMethod !== 'Cash') return 0;
    const received = parseFloat(amountReceived) || 0;
    return Math.max(0, received - getTotal());
  };

  const openCheckout = () => {
    if (cart.length === 0) {
      showToast('Cart is empty. Add items first.', 'error');
      return;
    }
    setShowCheckout(true);
  };

  const applyDiscount = (type) => {
    if (discountType) {
      showToast('Please clear existing discount first', 'error');
      return;
    }

    if (type === 'senior' || type === 'pwd') {
      setDiscountType(type);
      showToast(`${type === 'senior' ? 'Senior Citizen' : 'PWD'} discount applied (20%)`, 'success');
    }
  };

  const openGCModal = () => {
    if (discountType) {
      showToast('Please clear existing discount first', 'error');
      return;
    }
    setGcCode('');
    setGcValidation(null);
    setShowGCModal(true);
  };

  const validateGC = async () => {
    if (!gcCode.trim()) {
      showToast('Please enter a gift certificate code', 'error');
      return;
    }

    try {
      const result = await mockApi.giftCertificates.validateGiftCertificate(gcCode.trim());
      setGcValidation(result);

      if (result.valid) {
        showToast('Gift certificate is valid!', 'success');
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      setGcValidation({ valid: false, message: 'Invalid code' });
      showToast('Invalid gift certificate code', 'error');
    }
  };

  const applyGC = () => {
    if (!gcValidation || !gcValidation.valid) {
      showToast('Please validate the gift certificate first', 'error');
      return;
    }

    setDiscountType('gc');
    setAppliedGC(gcValidation.giftCertificate);
    setShowGCModal(false);

    const discount = Math.min(gcValidation.giftCertificate.balance, getCartSubtotal());
    showToast(`Gift certificate applied: ₱${discount.toLocaleString()} discount`, 'success');
  };

  const clearDiscounts = () => {
    setDiscountType(null);
    setDiscountValue(0);
    setAppliedGC(null);
    setGcValidation(null);
    showToast('Discounts cleared', 'info');
  };

  const validateCheckout = () => {
    const errors = [];

    if (!selectedEmployee) {
      errors.push('Please select an employee');
    }

    if (!paymentMethod) {
      errors.push('Please select a payment method');
    }

    // Only validate cash amount received for immediate payment scenarios
    if (paymentMethod === 'Cash') {
      // Skip validation for pay-after scenario (amount is read-only)
      if (!isAdvanceBooking || advanceBookingData?.paymentTiming !== 'pay-after') {
        const received = parseFloat(amountReceived) || 0;
        if (received < getTotal()) {
          errors.push('Amount received must be at least equal to total');
        }
      }
    }

    // Validate Card transaction ID is provided when paying by card
    if (paymentMethod === 'Card' && !cardTransactionId.trim()) {
      errors.push('Card transaction ID is required for card payments');
    }

    // Validate GCash reference number is provided when paying by GCash
    if (paymentMethod === 'GCash' && !gcashReference.trim()) {
      errors.push('GCash reference number is required');
    }

    if (errors.length > 0) {
      showToast(errors[0], 'error');
      return false;
    }

    return true;
  };

  const processCheckout = async () => {
    if (!validateCheckout()) return;

    setCheckoutLoading(true);

    try {
      const employee = employees.find(e => e._id === selectedEmployee);

      // If walk-in customer with provided info, save customer first
      let customerData = null;
      if (customerType === 'walk-in' && walkInCustomerData.name && walkInCustomerData.phone) {
        try {
          const newCustomer = await mockApi.customers.createCustomer({
            name: walkInCustomerData.name.trim(),
            phone: walkInCustomerData.phone.trim(),
            email: walkInCustomerData.email.trim() || null,
            address: walkInCustomerData.address.trim() || null,
            status: 'active'
          });
          customerData = newCustomer;
          showToast('Customer saved to database', 'success');
        } catch (error) {
          console.error('Failed to save customer:', error);
          // Continue with transaction even if customer save fails
        }
      }

      // If advance booking is enabled, create booking instead of transaction
      if (isAdvanceBooking && advanceBookingData) {
        // Basic validation - component handles detailed field validation with inline errors
        if (!advanceBookingData.bookingDateTime) {
          showToast('Please complete all required booking fields', 'error');
          setCheckoutLoading(false);
          return;
        }

        // Generate transaction ID
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const sequence = Math.floor(Math.random() * 9999) + 1;
        const transactionId = `txn_adv_${today}_${sequence.toString().padStart(4, '0')}`;

        // Get room details if applicable
        let roomName = null;
        if (advanceBookingData.roomId) {
          const room = rooms.find(r => r._id === advanceBookingData.roomId);
          roomName = room ? room.name : null;
        }

        // Build service name from cart items
        const serviceName = cart.map(item => item.name).join(' + ');

        // Calculate total duration (estimated from cart items)
        const estimatedDuration = cart.reduce((total, item) => {
          // Assume services take 60 minutes each by default
          return total + (item.type === 'service' ? 60 * item.quantity : 0);
        }, 0);

        // Use shared customer information
        let clientName, clientPhone, clientEmail, clientAddress;

        if (customerType === 'existing' && selectedCustomer) {
          clientName = selectedCustomer.name;
          clientPhone = selectedCustomer.phone;
          clientEmail = selectedCustomer.email || null;
          clientAddress = selectedCustomer.address || null;
        } else {
          // Walk-in customer
          clientName = customerData ? customerData.name : walkInCustomerData.name;
          clientPhone = customerData ? customerData.phone : walkInCustomerData.phone;
          clientEmail = customerData ? customerData.email : (walkInCustomerData.email || null);
          clientAddress = customerData ? customerData.address : (walkInCustomerData.address || null);
        }

        // Create advance booking
        const bookingData = {
          bookingDateTime: advanceBookingData.bookingDateTime,
          employeeId: employee._id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          serviceName: serviceName,
          estimatedDuration: estimatedDuration || 60,
          servicePrice: getTotal(),
          roomId: advanceBookingData.roomId || null,
          roomName: roomName,
          isHomeService: advanceBookingData.isHomeService,
          clientName: clientName,
          clientPhone: clientPhone,
          clientEmail: clientEmail,
          clientAddress: clientAddress,
          paymentMethod: paymentMethod,
          paymentTiming: advanceBookingData.paymentTiming,
          paymentStatus: advanceBookingData.paymentTiming === 'pay-now' ? 'paid' : 'pending',
          transactionId: transactionId,
          status: 'scheduled',
          specialRequests: advanceBookingData.specialRequests || null,
          clientNotes: advanceBookingData.clientNotes || null // Add client notes/preferences
        };

        await mockApi.advanceBooking.createAdvanceBooking(bookingData);
        showToast('Advance booking created successfully!', 'success');

      } else {
        // Regular checkout (immediate transaction)
        // Generate receipt number
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const sequence = Math.floor(Math.random() * 9999) + 1;
        const receiptNumber = `RCP-${today}-${sequence.toString().padStart(4, '0')}`;

        // Calculate commission
        const commissionAmount = cart.reduce((sum, item) => {
          const commission = item.commission.type === 'percentage'
            ? (item.subtotal * item.commission.value / 100)
            : item.commission.value;
          return sum + commission;
        }, 0);

        // Build transaction
        const transaction = {
          businessId: 'biz_001',
          receiptNumber,
          date: new Date().toISOString(),
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            type: item.type,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.subtotal
          })),
          subtotal: getCartSubtotal(),
          discount: getDiscount(),
          discountType: discountType,
          tax: 0,
          totalAmount: getTotal(),
          paymentMethod: paymentMethod,
          amountReceived: paymentMethod === 'Cash' ? parseFloat(amountReceived) : getTotal(),
          change: getChange(),
          cardTransactionId: cardTransactionId || null,
          gcashReference: gcashReference || null,
          employee: {
            id: employee._id,
            name: `${employee.firstName} ${employee.lastName}`,
            position: employee.position,
            commission: commissionAmount
          },
          customer: customerType === 'walk-in'
            ? (customerData
                ? {
                    id: customerData._id,
                    name: customerData.name,
                    phone: customerData.phone,
                    email: customerData.email
                  }
                : { name: 'Walk-in' })
            : selectedCustomer
              ? {
                  id: selectedCustomer._id,
                  name: selectedCustomer.name,
                  phone: selectedCustomer.phone,
                  email: selectedCustomer.email
                }
              : { name: 'Walk-in' },
          bookingSource: bookingSource,
          status: 'completed'
        };

        // Save transaction
        await mockApi.transactions.createTransaction(transaction);

        // If gift certificate was used, redeem it
        if (discountType === 'gc' && appliedGC) {
          try {
            const gcDiscount = getDiscount();
            await mockApi.giftCertificates.redeemGiftCertificate(appliedGC._id, gcDiscount);
          } catch (error) {
            console.error('Failed to redeem gift certificate:', error);
            // Continue anyway - transaction already saved
          }
        }

        showToast('Transaction completed successfully!', 'success');

        // Record service in rotation queue
        if (selectedEmployee) {
          await mockApi.serviceRotation.recordService(selectedEmployee);
        }
      }

      // Reset everything
      setCart([]);
      setShowCheckout(false);
      resetCheckoutForm();

      // Reload products (for updated stock) and rotation queue
      loadPOSData();
      loadRotationQueue();

    } catch (error) {
      showToast('Failed to process transaction', 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const resetCheckoutForm = () => {
    setSelectedEmployee(null);
    setSelectedCustomer(null);
    setCustomerType('walk-in');
    setIsAdvanceBooking(false);
    setAdvanceBookingData(null);
    setWalkInCustomerData({ name: '', phone: '', email: '', address: '' });
    setPaymentMethod('');
    setAmountReceived('');
    setCardTransactionId('');
    setGcashReference('');
    setDiscountType(null);
    setDiscountValue(0);
    setAppliedGC(null);
    setGcValidation(null);
    setGcCode('');
    setBookingSource('Walk-in');
    setCustomerSearch('');
    setShowCustomerSuggestions(false);
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading POS...</p>
      </div>
    );
  }

  return (
    <div className="pos-page">
      <div className="pos-container">
        {/* Left Panel - Products */}
        <div className="pos-products-panel">
          {/* Search Bar */}
          <div className="pos-search">
            <input
              type="text"
              placeholder="Search products and services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pos-search-input"
            />
          </div>

          {/* Category Filters */}
          <div className="pos-categories">
            <button
              className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </button>
            {categories.map(category => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="pos-products-grid">
            {filteredProducts.length === 0 ? (
              <div className="empty-state">
                <p>No products found</p>
              </div>
            ) : (
              filteredProducts.map(product => (
                <div
                  key={product._id}
                  className="product-card"
                  onClick={() => addToCart(product)}
                >
                  <div className="product-category-badge">{product.category}</div>
                  <h4 className="product-name">{product.name}</h4>
                  <p className="product-price">₱{product.price.toLocaleString()}</p>
                  {product.type === 'service' && product.duration && (
                    <p className="product-duration">{product.duration} min</p>
                  )}
                  {product.type === 'product' && (
                    <p className="product-stock">
                      Stock: {product.stock}
                      {product.stock <= product.lowStockAlert && (
                        <span className="low-stock-badge">Low</span>
                      )}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Cart */}
        <div className="pos-cart-panel">
          <div className="cart-header">
            <h3>Shopping Cart</h3>
            <span className="cart-count">{cart.length} items</span>
          </div>

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="empty-cart">
                <p>🛒</p>
                <p>Your cart is empty</p>
                <p className="empty-cart-subtitle">Add items to get started</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={index} className="cart-item">
                  <div className="cart-item-details">
                    <h4>{item.name}</h4>
                    <p className="cart-item-price">₱{item.price.toLocaleString()}</p>
                  </div>
                  <div className="cart-item-controls">
                    <button
                      className="qty-btn"
                      onClick={() => updateCartQuantity(index, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="qty-display">{item.quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => updateCartQuantity(index, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className="cart-item-total">
                    <p>₱{item.subtotal.toLocaleString()}</p>
                    <button
                      className="remove-btn"
                      onClick={() => removeFromCart(index)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <>
              <div className="cart-summary">
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>₱{getCartSubtotal().toLocaleString()}</span>
                </div>
                {discountType && (
                  <div className="summary-row discount">
                    <span>Discount ({
                      discountType === 'senior' ? 'Senior' :
                      discountType === 'pwd' ? 'PWD' :
                      discountType === 'gc' ? `GC ${appliedGC?.code}` :
                      'Promo'
                    }):</span>
                    <span>-₱{getDiscount().toLocaleString()}</span>
                  </div>
                )}
                <div className="summary-row total">
                  <span>Total:</span>
                  <span>₱{getTotal().toLocaleString()}</span>
                </div>
              </div>

              <div className="cart-actions">
                <button className="btn btn-secondary btn-block" onClick={clearCart}>
                  Clear Cart
                </button>
                <button className="btn btn-primary btn-block" onClick={openCheckout}>
                  Checkout
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
          <div className="modal checkout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Checkout</h2>
              <button className="modal-close" onClick={() => setShowCheckout(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Advance Booking Section - At the very top */}
              <AdvanceBookingCheckout
                enabled={isAdvanceBooking}
                onToggle={(enabled) => {
                  setIsAdvanceBooking(enabled);
                  // Initialize advanceBookingData with default values when enabling
                  if (enabled && !advanceBookingData) {
                    setAdvanceBookingData({
                      bookingDateTime: '',
                      paymentTiming: 'pay-now',
                      location: 'room',
                      roomId: '',
                      isHomeService: false,
                      specialRequests: '',
                      clientNotes: ''
                    });
                  }
                }}
                value={advanceBookingData}
                onChange={setAdvanceBookingData}
                employees={employees}
                rooms={rooms}
                customers={customers}
                // Shared customer state
                customerType={customerType}
                onCustomerTypeChange={setCustomerType}
                selectedCustomer={selectedCustomer}
                onCustomerSelect={setSelectedCustomer}
                walkInCustomerData={walkInCustomerData}
                onWalkInDataChange={setWalkInCustomerData}
              />

              {/* Employee Selection with Rotation Queue */}
              <div className="checkout-section">
                <div className="employee-section-header">
                  <h4>👤 Select Employee *</h4>
                  {rotationQueue.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setShowRotationQueue(!showRotationQueue)}
                    >
                      {showRotationQueue ? '📋 Hide Queue' : '📋 Show Queue'}
                    </button>
                  )}
                </div>

                {/* Service Rotation Queue */}
                {showRotationQueue && rotationQueue.length > 0 && (
                  <div className="rotation-queue-panel">
                    <div className="rotation-queue-header">
                      <span className="rotation-queue-title">🔄 Service Rotation Queue</span>
                      <span className="rotation-queue-count">{rotationQueue.length} clocked in</span>
                    </div>
                    <div className="rotation-queue-list">
                      {rotationQueue.map((emp, index) => (
                        <div
                          key={emp.employeeId}
                          className={`rotation-queue-item ${emp.isNext ? 'next-in-line' : ''} ${selectedEmployee === emp.employeeId ? 'selected' : ''}`}
                          onClick={() => selectFromRotation(emp.employeeId)}
                        >
                          <div className="rotation-queue-position">
                            {emp.isNext ? '➡️' : `#${index + 1}`}
                          </div>
                          <div className="rotation-queue-info">
                            <div className="rotation-queue-name">{emp.employeeName}</div>
                            <div className="rotation-queue-details">
                              <span className="rotation-clock-in">⏰ {emp.clockInTime}</span>
                              <span className="rotation-services">🎯 {emp.servicesCompleted} services</span>
                            </div>
                          </div>
                          {emp.isNext && (
                            <button
                              type="button"
                              className="rotation-skip-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                skipInRotation(emp.employeeId);
                              }}
                              title="Skip to next person"
                            >
                              ⏭️
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {nextEmployee && (
                      <div className="rotation-next-indicator">
                        <strong>Next to serve:</strong> {nextEmployee.employeeName}
                      </div>
                    )}
                  </div>
                )}

                {/* No employees clocked in warning */}
                {!isAdvanceBooking && rotationQueue.length === 0 && (
                  <div className="rotation-no-queue">
                    <span>⚠️</span>
                    <p>No employees clocked in today. Select manually below.</p>
                  </div>
                )}

                {/* Advance Booking: Show scheduled employees info */}
                {isAdvanceBooking && advanceBookingData?.bookingDateTime && (
                  <div className="rotation-info" style={{ marginBottom: '12px', padding: '8px 12px', background: '#F5F5F5', borderRadius: '6px', fontSize: '0.8125rem', color: '#666666' }}>
                    <span>📅</span>
                    <p style={{ margin: 0 }}>
                      {scheduledEmployees.length > 0
                        ? `${scheduledEmployees.length} therapist(s) scheduled for ${new Date(advanceBookingData.bookingDateTime).toLocaleDateString()}`
                        : 'No therapists scheduled for this date. Please select another date.'}
                    </p>
                  </div>
                )}

                {isAdvanceBooking && !advanceBookingData?.bookingDateTime && (
                  <div className="rotation-no-queue">
                    <span>ℹ️</span>
                    <p>Please select a booking date first to see available therapists.</p>
                  </div>
                )}

                {/* Standard Employee Dropdown - Therapists Only */}
                <select
                  value={selectedEmployee || ''}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="form-control"
                  required
                >
                  <option value="">Select therapist...</option>
                  {getTherapists(employees).map(emp => {
                    // For advance booking: check if therapist is scheduled for the selected date/time
                    if (isAdvanceBooking) {
                      const isScheduled = scheduledEmployees.some(s => s.employeeId === emp._id);
                      // Also check if the booking time falls within their shift
                      let isWithinShift = false;
                      if (isScheduled && advanceBookingData?.bookingDateTime) {
                        const scheduled = scheduledEmployees.find(s => s.employeeId === emp._id);
                        const bookingTime = advanceBookingData.bookingDateTime.split('T')[1]?.substring(0, 5);
                        if (scheduled && bookingTime) {
                          isWithinShift = bookingTime >= scheduled.startTime && bookingTime <= scheduled.endTime;
                        }
                      }
                      const canSelect = isScheduled && isWithinShift;
                      return (
                        <option
                          key={emp._id}
                          value={emp._id}
                          disabled={!canSelect}
                          style={!canSelect ? { color: '#999999' } : {}}
                        >
                          {emp.firstName} {emp.lastName} - {emp.position}
                          {canSelect
                            ? ` (Scheduled: ${scheduledEmployees.find(s => s.employeeId === emp._id)?.startTime} - ${scheduledEmployees.find(s => s.employeeId === emp._id)?.endTime})`
                            : isScheduled
                              ? ' (Outside shift hours)'
                              : ' (Not scheduled)'}
                        </option>
                      );
                    }

                    // For regular POS: check if therapist is clocked in
                    const inQueue = rotationQueue.find(q => q.employeeId === emp._id);
                    const isClockedIn = !!inQueue;
                    return (
                      <option
                        key={emp._id}
                        value={emp._id}
                        disabled={!isClockedIn}
                        style={!isClockedIn ? { color: '#999999' } : {}}
                      >
                        {emp.firstName} {emp.lastName} - {emp.position}
                        {isClockedIn ? ` (🟢 Clocked in - ${inQueue.servicesCompleted} services)` : ' (Not clocked in)'}
                      </option>
                    );
                  })}
                </select>
                {selectedEmployee && (
                  <p className="employee-commission">
                    Commission: {employees.find(e => e._id === selectedEmployee)?.commission.value}
                    {employees.find(e => e._id === selectedEmployee)?.commission.type === 'percentage' ? '%' : ' PHP'}
                  </p>
                )}
              </div>

              {/* Customer Selection - Hidden when advance booking is enabled */}
              {!isAdvanceBooking && (
                <div className="checkout-section">
                  <h4>👥 Customer</h4>
                  <div className="customer-type-selector">
                    <label>
                      <input
                        type="radio"
                        value="walk-in"
                        checked={customerType === 'walk-in'}
                        onChange={(e) => {
                          setCustomerType(e.target.value);
                          // Clear existing customer selection when switching to walk-in
                          setSelectedCustomer(null);
                          setCustomerSearch('');
                        }}
                      />
                      Walk-in
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="existing"
                        checked={customerType === 'existing'}
                        onChange={(e) => {
                          setCustomerType(e.target.value);
                          // Reset advance booking and walk-in data when switching to existing customer
                          setIsAdvanceBooking(false);
                          setAdvanceBookingData(null);
                          setWalkInCustomerData({ name: '', phone: '', email: '', address: '' });
                        }}
                      />
                      Existing Customer
                    </label>
                  </div>

                  {/* Walk-in Customer Information Form */}
                  {customerType === 'walk-in' && (
                    <div className="walk-in-customer-form" style={{
                      marginTop: 'var(--spacing-md)',
                      padding: 'var(--spacing-md)',
                      backgroundColor: 'var(--gray-50)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--gray-200)'
                    }}>
                      <p style={{ marginBottom: 'var(--spacing-sm)', fontSize: '0.9rem', color: 'var(--gray-600)' }}>
                        📝 Customer Information (Optional - will be saved to database)
                      </p>
                      <div className="form-group">
                        <label>Customer Name</label>
                        <input
                          type="text"
                          value={walkInCustomerData.name}
                          onChange={(e) => setWalkInCustomerData({ ...walkInCustomerData, name: e.target.value })}
                          placeholder="Enter customer name"
                          className="form-control"
                        />
                      </div>
                      <div className="form-group">
                        <label>Phone Number</label>
                        <input
                          type="tel"
                          value={walkInCustomerData.phone}
                          onChange={(e) => setWalkInCustomerData({ ...walkInCustomerData, phone: e.target.value })}
                          placeholder="Enter phone number"
                          className="form-control"
                        />
                      </div>
                      <div className="form-group">
                        <label>Email (Optional)</label>
                        <input
                          type="email"
                          value={walkInCustomerData.email}
                          onChange={(e) => setWalkInCustomerData({ ...walkInCustomerData, email: e.target.value })}
                          placeholder="Enter email address"
                          className="form-control"
                        />
                      </div>
                      <div className="form-group">
                        <label>Address (Optional)</label>
                        <textarea
                          value={walkInCustomerData.address}
                          onChange={(e) => setWalkInCustomerData({ ...walkInCustomerData, address: e.target.value })}
                          placeholder="Enter address"
                          className="form-control"
                          rows="2"
                        ></textarea>
                      </div>
                      {walkInCustomerData.name && walkInCustomerData.phone && (
                        <p style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.85rem', color: 'var(--success)', fontWeight: 500 }}>
                          ✓ Customer will be saved to database
                        </p>
                      )}
                    </div>
                  )}

                  {/* Existing Customer Selector - Autocomplete Search */}
                  {customerType === 'existing' && (
                    <div className="customer-autocomplete" style={{ marginTop: 'var(--spacing-md)', position: 'relative' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Type customer name or phone..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setShowCustomerSuggestions(true);
                          if (!e.target.value) {
                            setSelectedCustomer(null);
                          }
                        }}
                        onFocus={() => setShowCustomerSuggestions(true)}
                        onBlur={() => {
                          // Delay to allow click on suggestion
                          setTimeout(() => setShowCustomerSuggestions(false), 200);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          border: selectedCustomer ? '2px solid var(--success)' : '1px solid var(--gray-300)',
                          borderRadius: '8px',
                          fontSize: '0.95rem',
                          backgroundColor: selectedCustomer ? 'rgba(27, 94, 55, 0.05)' : 'var(--white)'
                        }}
                      />
                      {selectedCustomer && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setCustomerSearch('');
                          }}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            color: 'var(--gray-500)',
                            padding: '4px'
                          }}
                        >
                          ×
                        </button>
                      )}
                      {/* Customer Suggestions Dropdown */}
                      {showCustomerSuggestions && customerSearch && !selectedCustomer && (
                        <div
                          className="customer-suggestions"
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'var(--white)',
                            border: '1px solid var(--gray-300)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            maxHeight: '250px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            marginTop: '4px'
                          }}
                        >
                          {customers
                            .filter(c =>
                              c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                              c.phone?.includes(customerSearch)
                            )
                            .slice(0, 10)
                            .map(customer => (
                              <div
                                key={customer._id}
                                onClick={() => {
                                  setSelectedCustomer(customer);
                                  setCustomerSearch(`${customer.name} - ${customer.phone}`);
                                  setShowCustomerSuggestions(false);
                                }}
                                style={{
                                  padding: '12px 16px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--gray-100)',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'var(--gray-50)'}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                              >
                                <div style={{ fontWeight: 500, color: 'var(--gray-900)' }}>{customer.name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                                  📞 {customer.phone} {customer.email && `• ✉️ ${customer.email}`}
                                </div>
                              </div>
                            ))}
                          {customers.filter(c =>
                            c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                            c.phone?.includes(customerSearch)
                          ).length === 0 && (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--gray-500)' }}>
                              No customers found matching "{customerSearch}"
                            </div>
                          )}
                        </div>
                      )}
                      {selectedCustomer && (
                        <div style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.85rem', color: 'var(--success)', fontWeight: 500 }}>
                          ✓ Selected: {selectedCustomer.name}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Payment Method - Always show except when advance booking without payment timing set */}
              {(!isAdvanceBooking || (isAdvanceBooking && advanceBookingData?.paymentTiming)) && (
                <div className="checkout-section">
                  <h4>💳 Payment Method *</h4>
                  <div className="payment-methods">
                    <button
                      className={`payment-btn ${paymentMethod === 'Cash' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('Cash')}
                    >
                      Cash
                    </button>
                    <button
                      className={`payment-btn ${paymentMethod === 'Card' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('Card')}
                    >
                      Card
                    </button>
                    <button
                      className={`payment-btn ${paymentMethod === 'GCash' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('GCash')}
                    >
                      GCash
                    </button>
                  </div>

                  {paymentMethod === 'Cash' && (
                    <div className="payment-details">
                      {/* Show different labels based on payment timing */}
                      {isAdvanceBooking && advanceBookingData?.paymentTiming === 'pay-after' ? (
                        <>
                          <label>Amount to Pay (After Service):</label>
                          <input
                            type="number"
                            value={getTotal()}
                            readOnly
                            className="form-control"
                            style={{ backgroundColor: 'var(--gray-100)', cursor: 'not-allowed' }}
                          />
                          <p style={{ fontSize: '0.85rem', color: 'var(--info)', marginTop: 'var(--spacing-sm)' }}>
                            ℹ️ Payment will be collected after service completion
                          </p>
                        </>
                      ) : (
                        <>
                          <label>Amount Received:</label>
                          <input
                            type="number"
                            value={amountReceived}
                            onChange={(e) => setAmountReceived(e.target.value)}
                            placeholder="Enter amount"
                            className="form-control"
                          />
                          <div className="change-display">
                            <span>Change:</span>
                            <span className={getChange() < 0 ? 'negative' : 'positive'}>
                              ₱{getChange().toLocaleString()}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {paymentMethod === 'Card' && (
                    <div className="payment-details">
                      {/* Show different fields based on payment timing */}
                      {isAdvanceBooking && advanceBookingData?.paymentTiming === 'pay-after' ? (
                        <>
                          <label>Amount to Pay (After Service):</label>
                          <input
                            type="number"
                            value={getTotal()}
                            readOnly
                            className="form-control"
                            style={{ backgroundColor: 'var(--gray-100)', cursor: 'not-allowed' }}
                          />
                          <p style={{ fontSize: '0.85rem', color: 'var(--info)', marginTop: 'var(--spacing-sm)' }}>
                            ℹ️ Card payment will be collected after service completion
                          </p>
                        </>
                      ) : (
                        <>
                          <label>Card Transaction ID *</label>
                          <input
                            type="text"
                            value={cardTransactionId}
                            onChange={(e) => setCardTransactionId(e.target.value)}
                            placeholder="Enter transaction ID"
                            className="form-control"
                          />
                        </>
                      )}
                    </div>
                  )}

                  {paymentMethod === 'GCash' && (
                    <div className="payment-details">
                      {/* Show different fields based on payment timing */}
                      {isAdvanceBooking && advanceBookingData?.paymentTiming === 'pay-after' ? (
                        <>
                          <label>Amount to Pay (After Service):</label>
                          <input
                            type="number"
                            value={getTotal()}
                            readOnly
                            className="form-control"
                            style={{ backgroundColor: 'var(--gray-100)', cursor: 'not-allowed' }}
                          />
                          <p style={{ fontSize: '0.85rem', color: 'var(--info)', marginTop: 'var(--spacing-sm)' }}>
                            ℹ️ GCash payment will be collected after service completion
                          </p>
                        </>
                      ) : (
                        <>
                          <label>GCash Reference # *</label>
                          <input
                            type="text"
                            value={gcashReference}
                            onChange={(e) => setGcashReference(e.target.value)}
                            placeholder="Enter reference number"
                            className="form-control"
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Discounts - Always show except when advance booking without payment timing set */}
              {(!isAdvanceBooking || (isAdvanceBooking && advanceBookingData?.paymentTiming)) && (
                <div className="checkout-section">
                  <h4>🎟️ Discounts</h4>
                  <div className="discount-buttons">
                    <button
                      className="btn btn-sm"
                      onClick={() => applyDiscount('senior')}
                      disabled={discountType !== null}
                    >
                      Senior (20%)
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => applyDiscount('pwd')}
                      disabled={discountType !== null}
                    >
                      PWD (20%)
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={openGCModal}
                      disabled={discountType !== null}
                    >
                      🎁 Gift Certificate
                    </button>
                    {discountType && (
                      <button className="btn btn-secondary btn-sm" onClick={clearDiscounts}>
                        Clear Discounts
                      </button>
                    )}
                  </div>
                  {discountType && (
                    <p className="discount-applied">
                      ✓ {
                        discountType === 'senior' ? 'Senior Citizen' :
                        discountType === 'pwd' ? 'PWD' :
                        discountType === 'gc' ? `Gift Certificate (${appliedGC?.code})` :
                        'Discount'
                      } applied (-₱{getDiscount().toLocaleString()})
                    </p>
                  )}
                </div>
              )}

              {/* Booking Source - Hidden when advance booking is enabled */}
              {!isAdvanceBooking && (
                <div className="checkout-section">
                  <h4>📊 Booking Source</h4>
                  <select
                    value={bookingSource}
                    onChange={(e) => setBookingSource(e.target.value)}
                    className="form-control"
                  >
                    <option>Walk-in</option>
                    <option>Phone</option>
                    <option>Facebook</option>
                    <option>Instagram</option>
                    <option>Website</option>
                    <option>Referral</option>
                    <option>Other</option>
                  </select>
                </div>
              )}

              {/* Final Total */}
              <div className="checkout-section final-total">
                <h3>💰 Total to Pay</h3>
                <h2>₱{getTotal().toLocaleString()}</h2>
              </div>

              {/* Cart Summary - Moved to bottom */}
              <div className="checkout-section">
                <h4>📋 Cart Summary</h4>
                <div className="checkout-cart-summary">
                  {cart.map((item, index) => (
                    <div key={index} className="checkout-item">
                      <span>{item.name} x{item.quantity}</span>
                      <span>₱{item.subtotal.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="checkout-total">
                    <strong>Subtotal:</strong>
                    <strong>₱{getCartSubtotal().toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCheckout(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={processCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? (
                  <>
                    <span className="spinner-small"></span>
                    Processing...
                  </>
                ) : (
                  'Confirm Checkout'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Cart Confirmation Dialog */}
      <ConfirmDialog
        isOpen={clearCartConfirm}
        onClose={() => setClearCartConfirm(false)}
        onConfirm={confirmClearCart}
        title="Clear Cart"
        message="Are you sure you want to clear the cart? All items will be removed."
        confirmText="Clear"
        confirmVariant="warning"
      />

      {/* Gift Certificate Validation Modal */}
      {showGCModal && (
        <div className="modal-overlay" onClick={() => setShowGCModal(false)}>
          <div className="modal gc-validate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Apply Gift Certificate</h2>
              <button className="modal-close" onClick={() => setShowGCModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Gift Certificate Code *</label>
                <input
                  type="text"
                  value={gcCode}
                  onChange={(e) => setGcCode(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  className="form-control"
                  maxLength="12"
                  style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '2px' }}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={validateGC}
                style={{ width: '100%', marginTop: 'var(--spacing-md)' }}
              >
                Validate Code
              </button>

              {gcValidation && (
                <div className={`gc-validation-result ${gcValidation.valid ? 'valid' : 'invalid'}`}
                  style={{
                    marginTop: 'var(--spacing-lg)',
                    padding: 'var(--spacing-lg)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: gcValidation.valid ? 'var(--success-light)' : 'var(--error-light)',
                    border: `2px solid ${gcValidation.valid ? 'var(--success)' : 'var(--error)'}`,
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>
                    {gcValidation.valid ? '✓' : '✕'}
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>
                    {gcValidation.message}
                  </div>
                  {gcValidation.valid && gcValidation.giftCertificate && (
                    <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-xs) 0' }}>
                        <span>Code:</span>
                        <span style={{ fontWeight: 600 }}>{gcValidation.giftCertificate.code}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-xs) 0' }}>
                        <span>Balance:</span>
                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                          ₱{gcValidation.giftCertificate.balance.toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-xs) 0' }}>
                        <span>Original Amount:</span>
                        <span>₱{gcValidation.giftCertificate.amount.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-xs) 0' }}>
                        <span>Discount to Apply:</span>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          ₱{Math.min(gcValidation.giftCertificate.balance, getCartSubtotal()).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowGCModal(false)}>
                Cancel
              </button>
              {gcValidation && gcValidation.valid && (
                <button className="btn btn-primary" onClick={applyGC}>
                  Apply Gift Certificate
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
