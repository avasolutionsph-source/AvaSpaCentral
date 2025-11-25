📊 AI Insights Feature - Complete Documentation
📌 Feature Overview
What is this feature for? The AI Insights module provides mock AI-powered analytics and predictions for the spa business. It analyzes historical data (services, inventory usage, revenue) and generates insights, usage patterns, inventory predictions, and revenue forecasts to help business owners make data-driven decisions. Where is it located?
File Location: src/pages/AIInsights.tsx
Route: /ai-insights
Navigation: Sidebar menu → "AI Insights" (accessible to Owner and Manager roles only)
🎯 Page Layout Structure
Top Section
Page Header
Title: "AI Insights" (h1, 3xl font, bold, gray-900)
Subtitle: Description of the AI analysis capabilities
Action Buttons Row
Positioned at top-right
Contains 3 buttons horizontally aligned
Stats Cards Section
Grid layout: 4 columns on desktop, 2 on tablet, 1 on mobile
Each card shows a metric with icon and value
Cards have white background with shadow
Main Content Area
Split into multiple card sections:
Product Usage Analysis Card (Full width)
Inventory Predictions Card (Full width)
Revenue Prediction Card (Full width with chart)
Two-Column Section:
Left: Customer Insights Card
Right: Service Performance Card
🔘 Complete List of Buttons/Clickable Elements
1. Action Buttons (Top Right)
Button Name	Visual Appearance	Icon	Type
Recalculate Insights	Gold background, white text	RefreshCw (rotating when loading)	btn-gold
Filter by Date Range	Secondary style, gray background	Filter icon	btn-secondary
Export Report	Secondary style, gray background	Download icon	btn-secondary
2. Date Range Filter Inputs
Element	Type	Location
Start Date Input	date input field	Inside date filter section
End Date Input	date input field	Inside date filter section
Apply Filter Button	Primary button	Below date inputs
Clear Filter Button	Secondary button	Below date inputs
3. Quick Filter Buttons
Button	Purpose	Style
Last 7 Days	Sets date range to last week	Pill button, maroon when active
Last 30 Days	Sets date range to last month	Pill button, maroon when active
Last 90 Days	Sets date range to last 3 months	Pill button, maroon when active
📋 Stats Cards Details
Card 1: Total Services Analyzed
Icon: Brain (purple)
Value: Count of total services analyzed (from mock data: 100)
Label: "Total Services Analyzed"
Data Source: Calculated from transactions with services
Card 2: Inventory Items Tracked
Icon: Package (blue)
Value: Count of inventory items (from mock data: 8)
Label: "Inventory Items Tracked"
Data Source: inventory.length
Card 3: Predictions Generated
Icon: TrendingUp (green)
Value: Number of predictions (mock: 12)
Label: "Predictions Generated"
Data Source: Count of low stock items + revenue predictions
Card 4: Accuracy Rate
Icon: Target (orange)
Value: Percentage accuracy (mock: 94%)
Label: "Accuracy Rate"
Data Source: Mock value for demo purposes
📊 Content Cards Breakdown
1. Product Usage Analysis Card
Layout:
Full-width card with white background
Title: "Product Usage Analysis" with Brain icon
Subtitle: Analysis period display
Content Display:
Text-based insights showing:
├── "In the last 100 massage services (135 hours)..."
├── "you consumed 2 gallons of massage oil and 3 gallons of alcohol."
├── "Estimated usage:"
├── "• ~30 ml oil per massage hour"
└── "• ~40 ml alcohol per massage hour"
Data Calculation:
Services analyzed: Count from transactions
Total hours: Sum of service durations
Oil consumed: Calculated as (services × 2 / 100) gallons
Alcohol consumed: Calculated as (services × 3 / 100) gallons
Usage rates: Derived from consumption / hours
2. Inventory Predictions Card
Layout:
Full-width card
Title: "Inventory Predictions" with AlertTriangle icon
Grid of prediction items (2 columns on desktop)
Each Prediction Item Shows:
├── Item Name (bold, large font)
├── Current Stock: X units
├── Daily Usage Rate: Y units/day
├── Days Until Empty: Z days
├── Suggested Reorder Quantity: N units
└── Priority Badge (High/Medium based on days remaining)
Priority Color Coding:
High Priority (< 14 days): Red badge
Medium Priority (14-30 days): Orange badge
Low Priority (> 30 days): Not shown
Items Displayed: Filters inventory where quantity <= reorderLevel Calculations:
Daily usage rate = Total consumed in period / days in period
Days until empty = Current stock / daily usage rate
Suggested reorder = reorderLevel × 2 (to build buffer)
3. Revenue Prediction Card
Layout:
Full-width card
Title: "Revenue Prediction" with TrendingUp icon
Chart occupies main area
Summary stats below chart
Chart Details:
Type: Line Chart (using Recharts)
X-Axis: Next 7 days (formatted as "Mon, Tue, Wed...")
Y-Axis: Revenue in pesos (auto-scaled)
Data Lines:
Predicted Revenue (blue line)
Trend Line (dotted gray line)
Height: 300px
Responsive: Yes
Below Chart Display:
"Projected Revenue for Next Week: ₱45,230"
"Based on 7-day average trend and booking patterns"
Prediction Algorithm (Mock):
Takes average of last 7 days revenue
Applies +5% growth factor
Generates 7 data points for next week
Adds slight variance (±10%) for realism
4. Customer Insights Card
Layout:
Half-width card (left side)
Title: "Customer Insights" with Users icon
Vertical list layout
Content Sections: A. Top 3 Customers by Spending
1. [Customer Name] - ₱XX,XXX.XX
   └── Medal icon (gold/silver/bronze)
2. [Customer Name] - ₱XX,XXX.XX
3. [Customer Name] - ₱XX,XXX.XX
B. Average Customer Lifetime Value
Large number display: ₱X,XXX.XX
Icon: DollarSign (green)
C. Customer Retention Rate
Percentage display: XX%
Icon: UserCheck (blue)
Color-coded:
Green if ≥ 80%
Yellow if 60-79%
Red if < 60%
Data Source:
Sorted customers array by totalSpent
Average calculated from all customers' totalSpent
Retention: (Customers with visits this month / total active customers) × 100
5. Service Performance Card
Layout:
Half-width card (right side)
Title: "Service Performance" with Star icon
Table format
Table Structure:
Column	Content	Width
Service Name	Name of service	40%
Revenue	Total revenue from service	25%
Bookings	Number of bookings	20%
Performance	Badge indicator	15%
Performance Badges:
Excellent (Revenue > ₱5,000): Green badge with CheckCircle icon
Good (Revenue ₱2,000-₱5,000): Blue badge with TrendingUp icon
Average (Revenue < ₱2,000): Gray badge with Minus icon
Mock Rating Display: Each row shows:
⭐ Star icons (filled based on rating)
Rating number (4.5-5.0 out of 5.0)
Data Source:
Aggregates transactions by service
Calculates total revenue per service
Counts bookings per service
Sorts by revenue (descending)
Shows top 5 services
🔘 Button Behaviors & Functions
1. Recalculate Insights Button
What It Does: Simulates re-running AI analysis on current data Function Called:
const handleRecalculate = () => {
  setIsCalculating(true);
  setTimeout(() => {
    setIsCalculating(false);
    alert('Insights recalculated successfully!');
  }, 2000);
}
User Sees:
Button icon starts rotating (RefreshCw with animate-spin)
Button text changes to "Calculating..."
Button becomes disabled (opacity-50)
After 2 seconds: Alert popup "Insights recalculated successfully!"
Page data refreshes (re-renders with same data)
Button returns to normal state
Data Modified:
None (frontend only, recalculates from existing mock data)
Validation:
None required
2. Filter by Date Range Button
What It Does: Opens date range selector dropdown Function Called:
setShowDateFilter(!showDateFilter)
User Sees:
Click: Dropdown panel slides down
Panel contains:
Start Date input field
End Date input field
Quick filter buttons (7/30/90 days)
Apply Filter button
Clear Filter button
Click outside: Panel closes
Data Modified:
Local state showDateFilter toggles
Navigation:
Stays on same page
3. Apply Filter Button (inside date dropdown)
What It Does: Filters displayed data by selected date range Function Called:
const handleApplyFilter = () => {
  const filtered = transactions.filter(t => 
    new Date(t.date) >= startDate && 
    new Date(t.date) <= endDate
  );
  setFilteredData(filtered);
  setShowDateFilter(false);
}
User Sees:
All cards recalculate with filtered data
Dropdown closes
Filter badge appears showing active date range
Chart updates to show only filtered period
If no data in range: "No data for selected period" message
Data Modified:
filteredTransactions state updated
All calculations re-run with filtered data
Validation:
Start date must be before end date
Shows alert if validation fails
4. Clear Filter Button
What It Does: Removes date filter and shows all data Function Called:
const handleClearFilter = () => {
  setStartDate('');
  setEndDate('');
  setFilteredData(transactions);
  setShowDateFilter(false);
}
User Sees:
All data restored to original
Dropdown closes
Filter badge disappears
All cards show full dataset
Data Modified:
Clears date state
Resets filtered data to full dataset
5. Quick Filter Buttons (7/30/90 Days)
What It Does: Instantly applies preset date range Function Called:
const applyQuickFilter = (days: number) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  setStartDate(startDate.toISOString().split('T')[0]);
  setEndDate(endDate.toISOString().split('T')[0]);
  handleApplyFilter();
}
User Sees:
Button becomes highlighted (maroon background)
Date inputs auto-fill with calculated range
Data instantly filters
Dropdown stays open (user can adjust if needed)
Data Modified:
Same as Apply Filter above
6. Export Report Button
What It Does: Simulates exporting insights to file Function Called:
const handleExport = () => {
  alert('Export functionality: Generates PDF/Excel report with all insights');
  // In production: would trigger actual file download
}
User Sees:
Alert popup with message
In production: File download would initiate
Data Included in Export (Mock):
All stats card values
Product usage analysis text
Inventory predictions table
Revenue forecast chart image
Customer insights
Service performance table
🔄 Complete User Workflows
Workflow 1: View AI Insights (Default)
1. User clicks "AI Insights" in sidebar
   ↓
2. Page loads with all data
   ↓
3. Stats cards display at top (4 metrics)
   ↓
4. Product usage analysis shows text insights
   ↓
5. Inventory predictions show items running low
   ↓
6. Revenue chart displays next 7 days forecast
   ↓
7. Customer insights show top customers
   ↓
8. Service performance table shows top 5 services
Workflow 2: Recalculate Insights
1. User clicks "Recalculate Insights" button
   ↓
2. Button shows spinning icon and "Calculating..." text
   ↓
3. Button disables (can't click again)
   ↓
4. Wait 2 seconds (simulates processing)
   ↓
5. Alert appears: "Insights recalculated successfully!"
   ↓
6. User clicks OK on alert
   ↓
7. All cards refresh with recalculated data
   ↓
8. Button returns to normal state
Workflow 3: Filter by Custom Date Range
1. User clicks "Filter by Date Range" button
   ↓
2. Dropdown panel slides down
   ↓
3. User enters Start Date in date picker
   ↓
4. User enters End Date in date picker
   ↓
5. User clicks "Apply Filter" button
   ↓
6. System validates: Start < End
   ↓
   If invalid → Alert: "Start date must be before end date"
   If valid → Continue
   ↓
7. All data filters to show only selected range
   ↓
8. Stats cards recalculate
   ↓
9. Chart shows only filtered period
   ↓
10. Predictions adjust to filtered data
    ↓
11. Dropdown closes
    ↓
12. Active filter badge appears showing date range
Workflow 4: Use Quick Filter
1. User clicks "Filter by Date Range" button
   ↓
2. Dropdown opens
   ↓
3. User clicks "Last 30 Days" quick filter button
   ↓
4. Date inputs auto-fill:
   - Start Date: 30 days ago
   - End Date: Today
   ↓
5. Data instantly filters (same as Apply Filter)
   ↓
6. "Last 30 Days" button becomes highlighted
   ↓
7. User can adjust dates manually if needed
   ↓
8. Or click "Apply Filter" to close dropdown
Workflow 5: Export Report
1. User clicks "Export Report" button
   ↓
2. Alert popup appears with message
   ↓
3. User clicks OK
   ↓
4. (In production: PDF/Excel file downloads)
   ↓
5. User returns to viewing insights
Workflow 6: Clear Active Filter
1. User has active date filter applied
   ↓
2. User clicks "Filter by Date Range" button
   ↓
3. User clicks "Clear Filter" button
   ↓
4. Date inputs clear
   ↓
5. All data restores to full dataset
   ↓
6. Stats cards recalculate with all data
   ↓
7. Filter badge disappears
   ↓
8. Dropdown closes
📊 Data Structure & Calculations
Input Data Sources:
From AppContext:
transactions - All POS transactions
inventory - All inventory items
customers - All customers
services - Service catalog
appointments - All bookings
Derived Data:
interface AIInsight {
  serviceCount: number;
  totalHours: number;
  oilConsumed: number;
  alcoholConsumed: number;
  oilPerHour: number;
  alcoholPerHour: number;
  predictions: InventoryPrediction[];
  revenueforecast: RevenueForecast[];
  topCustomers: Customer[];
  avgLifetimeValue: number;
  retentionRate: number;
  topServices: ServicePerformance[];
}
Key Calculations:
1. Product Usage:
const serviceCount = 100; // from transactions
const totalHours = 135; // sum of service durations
const oilConsumed = (serviceCount * 2) / 100; // 2 gallons per 100 services
const alcoholConsumed = (serviceCount * 3) / 100; // 3 gallons per 100 services
const oilPerHour = (oilConsumed * 3785) / totalHours; // Convert gallons to ml
const alcoholPerHour = (alcoholConsumed * 3785) / totalHours;
2. Inventory Predictions:
const lowStockItems = inventory.filter(i => i.quantity <= i.reorderLevel);

lowStockItems.map(item => {
  const dailyUsage = item.quantity / 30; // Assume 30 days usage
  const daysUntilEmpty = item.quantity / dailyUsage;
  const suggestedReorder = item.reorderLevel * 2;
  const priority = daysUntilEmpty < 14 ? 'high' : 'medium';
  
  return { item, dailyUsage, daysUntilEmpty, suggestedReorder, priority };
});
3. Revenue Forecast:
const last7DaysAvg = transactions
  .filter(t => isLastNDays(t.date, 7))
  .reduce((sum, t) => sum + t.total, 0) / 7;

const forecast = Array.from({ length: 7 }, (_, i) => {
  const date = addDays(new Date(), i + 1);
  const predicted = last7DaysAvg * 1.05; // 5% growth factor
  const variance = predicted * (Math.random() * 0.2 - 0.1); // ±10% variance
  
  return {
    date: format(date, 'EEE'),
    predicted: predicted + variance,
    trend: last7DaysAvg
  };
});
4. Customer Metrics:
const topCustomers = customers
  .sort((a, b) => b.totalSpent - a.totalSpent)
  .slice(0, 3);

const avgLifetimeValue = customers.reduce((sum, c) => sum + c.totalSpent, 0) / customers.length;

const activeThisMonth = customers.filter(c => 
  isThisMonth(c.lastVisit)
).length;
const retentionRate = (activeThisMonth / customers.length) * 100;
5. Service Performance:
const serviceStats = services.map(service => {
  const serviceTxns = transactions.filter(t => 
    t.items.some(item => item.id === service.id)
  );
  
  const revenue = serviceTxns.reduce((sum, t) => 
    sum + t.items
      .filter(item => item.id === service.id)
      .reduce((s, item) => s + item.price * item.quantity, 0),
    0
  );
  
  const bookings = serviceTxns.length;
  const rating = 4.5 + (Math.random() * 0.5); // Mock rating 4.5-5.0
  
  const performance = revenue > 5000 ? 'excellent' : 
                     revenue > 2000 ? 'good' : 'average';
  
  return { service, revenue, bookings, rating, performance };
})
.sort((a, b) => b.revenue - a.revenue)
.slice(0, 5);
🎨 UI Component Details
Loading States:
Recalculate button shows spinner and "Calculating..." text
Disabled state (opacity-50, cursor-not-allowed)
Duration: 2 seconds
Error States:
Alert popups for validation errors
Red text for error messages
Example: "Start date must be before end date"
Success States:
Alert popup: "Insights recalculated successfully!"
Green checkmarks for successful operations
Data updates immediately visible
Empty States:
If no predictions: "All inventory levels are healthy"
If no filtered data: "No data available for selected period"
If no customers: "No customer data available"
🔐 Access Control
Who Can Access:
Owner: Full access
Manager: Full access
Receptionist: No access (menu item hidden)
Therapist: No access (menu item hidden)
Permission Check:
// In Sidebar.tsx
allowedRoles: ['Owner', 'Manager']
📱 Responsive Behavior
Desktop (≥1024px):
4-column stats grid
2-column customer/service section
Full-width chart (600px height)
Tablet (768px - 1023px):
2-column stats grid
1-column customer/service section
Full-width chart (400px height)
Mobile (<768px):
1-column stats grid
1-column customer/service section
Full-width chart (300px height)
Date filter dropdown full-width
🔄 State Management
Local State:
const [isCalculating, setIsCalculating] = useState(false);
const [showDateFilter, setShowDateFilter] = useState(false);
const [startDate, setStartDate] = useState('');
const [endDate, setEndDate] = useState('');
const [filteredData, setFilteredData] = useState(transactions);
Global State (from AppContext):
transactions
inventory
customers
services
activityLogs
setActivityLogs
This is the complete documentation for the AI Insights feature with every button, behavior, calculation, and workflow documented.