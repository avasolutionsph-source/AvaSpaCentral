import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const ProtectedRoute = ({ children, page }) => {
  const { user, hasPermission, getFirstPage } = useApp();

  // If user is not logged in, redirect to branch select (never auto-redirect to login)
  if (!user) {
    return <Navigate to="/select-branch" replace />;
  }

  // If user doesn't have permission for this page, redirect to their first allowed page
  if (page && !hasPermission(page)) {
    return <Navigate to={getFirstPage()} replace />;
  }

  // User has permission, render the page
  return children;
};

export default ProtectedRoute;
