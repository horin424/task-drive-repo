import React from 'react';

interface MaintenanceNoticeProps {
  message: string;
}

const MaintenanceNotice: React.FC<MaintenanceNoticeProps> = ({ message }) => {
  return (
    <div className="maintenance-notice" style={{
      marginTop: '1rem',
      padding: '1.5rem',
      backgroundColor: 'var(--background-accent, #f9fafb)',
      borderRadius: '0.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: '1px solid #f59e0b',
      color: 'var(--text-primary, #111827)',
      textAlign: 'center'
    }}>
      <h2 style={{ 
        color: '#f59e0b', 
        marginTop: 0,
        fontWeight: 'bold'
      }}>
        メンテナンスのお知らせ
      </h2>
      <p style={{ fontSize: '1.1rem' }}>{message}</p>
    </div>
  );
};

export default MaintenanceNotice; 