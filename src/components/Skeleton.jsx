/**
 * Skeleton Loading Components
 *
 * Provides better UX than spinners by showing the shape of content
 * that will appear. Users perceive skeleton loading as faster.
 */

import React from 'react';

// Base skeleton with shimmer animation
export const Skeleton = ({ width, height, borderRadius = '4px', className = '' }) => (
  <div
    className={`skeleton ${className}`}
    style={{
      width: width || '100%',
      height: height || '20px',
      borderRadius,
    }}
  />
);

// Card skeleton for dashboard KPI cards
export const SkeletonCard = () => (
  <div className="skeleton-card">
    <Skeleton width="60%" height="16px" />
    <Skeleton width="40%" height="32px" style={{ marginTop: '12px' }} />
    <Skeleton width="80%" height="14px" style={{ marginTop: '8px' }} />
  </div>
);

// Table row skeleton
export const SkeletonTableRow = ({ columns = 5 }) => (
  <tr className="skeleton-row">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i}>
        <Skeleton width={i === 0 ? '80%' : '60%'} height="16px" />
      </td>
    ))}
  </tr>
);

// Table skeleton with header and rows
export const SkeletonTable = ({ rows = 5, columns = 5 }) => (
  <div className="skeleton-table">
    <div className="skeleton-table-header">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} width="80px" height="14px" />
      ))}
    </div>
    <div className="skeleton-table-body">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} width={j === 0 ? '120px' : '80px'} height="16px" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// Chart skeleton
export const SkeletonChart = ({ height = '300px' }) => (
  <div className="skeleton-chart" style={{ height }}>
    <div className="skeleton-chart-bars">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="skeleton-bar"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
    <Skeleton width="100%" height="1px" style={{ marginTop: 'auto' }} />
  </div>
);

// Dashboard skeleton layout
export const DashboardSkeleton = () => (
  <div className="dashboard-skeleton">
    {/* KPI Cards */}
    <div className="skeleton-kpi-grid">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>

    {/* Charts Row */}
    <div className="skeleton-charts-row">
      <div className="skeleton-chart-container">
        <Skeleton width="150px" height="20px" style={{ marginBottom: '16px' }} />
        <SkeletonChart height="250px" />
      </div>
      <div className="skeleton-chart-container">
        <Skeleton width="150px" height="20px" style={{ marginBottom: '16px' }} />
        <SkeletonChart height="250px" />
      </div>
    </div>

    {/* Recent Activity */}
    <div className="skeleton-section">
      <Skeleton width="180px" height="20px" style={{ marginBottom: '16px' }} />
      <SkeletonTable rows={5} columns={4} />
    </div>
  </div>
);

// List skeleton (for products, employees, etc.)
export const ListSkeleton = ({ rows = 8 }) => (
  <div className="list-skeleton">
    {/* Search/Filter bar */}
    <div className="skeleton-filters">
      <Skeleton width="300px" height="40px" borderRadius="8px" />
      <Skeleton width="120px" height="40px" borderRadius="8px" />
    </div>

    {/* List items */}
    <div className="skeleton-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-list-item">
          <Skeleton width="48px" height="48px" borderRadius="50%" />
          <div className="skeleton-list-content">
            <Skeleton width="200px" height="18px" />
            <Skeleton width="150px" height="14px" style={{ marginTop: '6px' }} />
          </div>
          <Skeleton width="80px" height="32px" borderRadius="6px" />
        </div>
      ))}
    </div>
  </div>
);

// POS skeleton
export const POSSkeleton = () => (
  <div className="pos-skeleton">
    {/* Products grid */}
    <div className="skeleton-products-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton-product-card">
          <Skeleton height="80px" borderRadius="8px" />
          <Skeleton width="80%" height="16px" style={{ marginTop: '8px' }} />
          <Skeleton width="50%" height="20px" style={{ marginTop: '4px' }} />
        </div>
      ))}
    </div>

    {/* Cart */}
    <div className="skeleton-cart">
      <Skeleton width="100%" height="50px" borderRadius="8px" />
      <div className="skeleton-cart-items">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-cart-item">
            <Skeleton width="60%" height="16px" />
            <Skeleton width="30%" height="16px" />
          </div>
        ))}
      </div>
      <Skeleton width="100%" height="48px" borderRadius="8px" style={{ marginTop: 'auto' }} />
    </div>
  </div>
);

export default Skeleton;
