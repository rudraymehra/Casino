"use client";

import * as React from 'react';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletStatusProvider } from '@/hooks/useWalletStatus';
import { NotificationProvider } from '@/components/NotificationSystem';
import WalletConnectionGuard from '@/components/WalletConnectionGuard';
import { ThemeProvider } from 'next-themes';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const queryClient = new QueryClient();

// Create Material-UI theme with Linera branding
const muiTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#10B981', // Linera emerald green
    },
    secondary: {
      main: '#14B8A6', // Teal
    },
    background: {
      default: 'rgba(10, 0, 8, 0.98)',
      paper: 'rgba(10, 0, 8, 0.98)',
    },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.9)',
    },
  },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(10, 0, 8, 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(10, 0, 8, 0.98) 0%, rgba(26, 0, 21, 0.98) 100%)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          color: '#FFFFFF',
          borderBottom: '1px solid rgba(148, 163, 184, 0.3)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(20, 184, 166, 0.1) 100%)',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          color: '#FFFFFF',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          color: '#FFFFFF',
        },
      },
    },
  },
});

export default function Providers({ children }) {
  const [mounted, setMounted] = React.useState(false);
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);

  React.useEffect(() => {
    // Set mounted immediately
    setMounted(true);

    // Fallback timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setLoadingTimeout(true);
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  // But show content after timeout to prevent infinite loading
  if (!mounted && !loadingTimeout) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0A0008 0%, #1A0015 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>Loading...</div>
      </div>
    );
  }

  // Debug logging
  console.log('Providers mounting with Linera Wallet...');

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <WalletStatusProvider>
            <WalletConnectionGuard>
              <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
                <MuiThemeProvider theme={muiTheme}>
                  <CssBaseline />
                  {children}
                </MuiThemeProvider>
              </ThemeProvider>
            </WalletConnectionGuard>
          </WalletStatusProvider>
        </NotificationProvider>
      </QueryClientProvider>
    </Provider>
  );
}
