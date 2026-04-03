import React from 'react';
import './AdminActionBar.css';

interface AdminActionBarProps {
  children: React.ReactNode;
  compact?: boolean;
}

const AdminActionBar: React.FC<AdminActionBarProps> = ({ children, compact = false }) => (
  <div className={`admin-action-bar${compact ? ' admin-action-bar--compact' : ''}`}>
    {children}
  </div>
);

export default AdminActionBar;

