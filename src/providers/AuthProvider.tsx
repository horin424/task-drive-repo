"use client";
import React from 'react';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from '../lib/msal';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  );
};

export default AuthProvider;
