import React from 'react';

interface VersionInfoProps {
  className?: string;
}

const VersionInfo: React.FC<VersionInfoProps> = ({ className = '' }) => {
  const version = process.env.APP_VERSION || '0.1.0';
  
  return (
    <span className={className}>
      v{version}
    </span>
  );
};

export default VersionInfo; 