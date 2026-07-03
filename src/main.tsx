import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { LabsProvider } from './state/LabsContext';
import { RoleProvider } from './state/RoleContext';
import { NotificationProvider } from './state/NotificationContext';
import { ThemeProvider } from './state/ThemeContext';
import { AuthProvider } from './state/AuthContext';
import { AuditProvider } from './state/AuditContext';
import { LayoutProvider } from './state/LayoutContext';
import { ToastProvider } from './state/ToastContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LayoutProvider>
          <ToastProvider>
            <AuditProvider>
              <AuthProvider>
                <RoleProvider>
                  <NotificationProvider>
                    <LabsProvider>
                      <App />
                    </LabsProvider>
                  </NotificationProvider>
                </RoleProvider>
              </AuthProvider>
            </AuditProvider>
          </ToastProvider>
        </LayoutProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
