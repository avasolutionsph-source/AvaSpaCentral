🔧 ADD NEW FEATURE TO EXISTING DEMO ERP – AI INSIGHTS PAGE

You already built a SPA DEMO ERP for the “Daet Massage and Spa Management System” using:

React SPA with routing

Sidebar + header layout

Mock data / mock API

Modern minimalist design (same design as Dashboard, POS, etc.)

Now, extend the existing project and add ONE new page/feature:

📊 AI Insights Page
File: src/pages/AIInsights.tsx
Route: /ai-insights
Sidebar Item: “AI Insights”
Access: Owner & Manager only (hide from other roles)

GENERAL REQUIREMENTS

Do NOT change or remove any existing pages or features.

Reuse the same design system as the other pages:

Same card style, spacing, typography, button styles, icons

Same global layout (sidebar, header, content area)

Use existing AppContext / global state if already defined:

transactions, inventory, customers, services, activityLogs, setActivityLogs

Use mock data + calculations only (no real AI, no backend).

WHAT TO IMPLEMENT

Routing & Navigation

Add route: /ai-insights → renders AIInsights page.

In the sidebar:

Add menu item "AI Insights".

Only show it if the current user’s role is Owner or Manager.

Example logic in Sidebar:
allowedRoles = ['Owner', 'Manager']

Clicking the menu opens the AI Insights page.

Page File

Create src/pages/AIInsights.tsx with:

Default exported React component: AIInsights.

Pull data from context: transactions, inventory, customers, services.

Local state:

const [isCalculating, setIsCalculating] = useState(false);
const [showDateFilter, setShowDateFilter] = useState(false);
const [startDate, setStartDate] = useState('');
const [endDate, setEndDate] = useState('');
const [filteredData, setFilteredData] = useState(transactions);


All UI built with the same card & grid components / classes used in other pages.

Layout (Match Existing Design)

Inside AIInsights:

Top Section

Title: AI Insights (h1, big, bold)

Subtitle: short description of AI-powered mock analytics.

Right-aligned action buttons row:

Recalculate Insights (gold, primary)

Filter by Date Range (secondary gray)

Export Report (secondary gray)

Stats Cards Section

Grid responsive layout:

Desktop: 4 columns

Tablet: 2 columns

Mobile: 1 column

Each card: white, shadow, icon + label + value.

Cards:

Total Services Analyzed (Brain icon, value: 100 mock)

Inventory Items Tracked (Package icon, value: inventory.length or 8 mock)

Predictions Generated (TrendingUp icon, value: 12 mock)

Accuracy Rate (Target icon, value: 94%)

Main Content Cards

Product Usage Analysis (full width)

Inventory Predictions (full width)

Revenue Prediction (full width with line chart)

Two-column row:

Left: Customer Insights

Right: Service Performance

Behavior & Buttons

Implement these exactly:

a) Recalculate Insights

Button: “Recalculate Insights”

Behavior:

const handleRecalculate = () => {
  setIsCalculating(true);
  setTimeout(() => {
    setIsCalculating(false);
    alert('Insights recalculated successfully!');
  }, 2000);
};


While isCalculating:

Icon rotates

Text: “Calculating…”

Button disabled

b) Filter by Date Range

“Filter by Date Range” button toggles a dropdown/panel:

Two <input type="date"> for start & end dates.

Three quick filter buttons: Last 7 Days, Last 30 Days, Last 90 Days.

Apply Filter (primary)

Clear Filter (secondary)

Apply Filter:

Validates: startDate < endDate.

Filters transactions into filteredData.

Recalculates all stats using filteredData.

Closes panel & shows an “active filter” badge somewhere near header or stats.

Clear Filter:

Clears dates.

Resets filteredData back to all transactions.

Hides filter badge.

Quick filter buttons:

Compute start & end date relative to today.

Fill date inputs automatically.

Run same filtering logic.

Active quick filter pill is shown in maroon.

c) Export Report

“Export Report”:

const handleExport = () => {
  alert('Export functionality: Generates PDF/Excel report with all insights');
};


No real file generation needed (demo only).

Card Details (Use Calculations from Spec)

Use the calculations exactly as described in my AI Insights specification:

Product Usage Analysis

Mock serviceCount = 100, totalHours = 135.

Oil consumed, alcohol consumed in gallons.

Convert to ml per hour and display them in human-readable sentences.

Inventory Predictions

lowStockItems = inventory.filter(i => i.quantity <= i.reorderLevel).

For each item:

dailyUsage ≈ item.quantity / 30 (mock)

daysUntilEmpty = item.quantity / dailyUsage

suggestedReorder = item.reorderLevel * 2

priority = 'high' if < 14, 'medium' otherwise.

Display as a 2-column grid (on desktop) with badges for priority.

Revenue Prediction

Use Recharts line chart (or consistent chart library).

Generate mock forecast for next 7 days based on last 7 days average:

+5% growth factor

±10% random variance

Show “Projected Revenue for Next Week: ₱45,230” (mock) below chart.

Customer Insights

Use top 3 customers by totalSpent.

Show:

Name + amount, with medals 🥇🥈🥉 style icons.

Show Average Lifetime Value (numeric).

Show Retention Rate with color-coded percentage.

Service Performance

From services + transactions, compute:

Revenue per service

Number of bookings

Performance badge: Excellent / Good / Average based on revenue thresholds

Mock rating between 4.5 and 5.0 (stars + number).

Show top 5 services sorted by revenue.

Access Control

In Sidebar / route guards:

If currentUser.role is not 'Owner' or 'Manager', do NOT show “AI Insights” and redirect away if they manually type /ai-insights.

After implementing, the app should behave like this:

Owners/Managers see “AI Insights” in sidebar.

Clicking it opens a well-designed analytics page with cards, chart, filters, and interactive buttons.

All logic is frontend-only, using mock data & calculations, consistent with the current demo’s styles and components.

I will now provide you the full AI Insights feature documentation (everything about buttons, calculations, and workflows). Use that as the strict spec when building AIInsights.tsx.