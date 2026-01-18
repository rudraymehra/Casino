"use client";

import * as React from 'react';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletStatusProvider } from '@/hooks/useWalletStatus';
import { NotificationProvider } from '@/components/NotificationSystem';
import WalletConnectionGuard from '@/components/WalletConnectionGuard';
import { ThemeProvider } from 'next-themes';
import { PushUniversalWalletProvider, PushUI } from '@pushchain/ui-kit';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const queryClient = new QueryClient();

// Create Material-UI theme
const muiTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#8B2398',
    },
    secondary: {
      main: '#31C4BE',
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
          background: 'linear-gradient(135deg, rgba(139, 35, 152, 0.1) 0%, rgba(49, 196, 190, 0.1) 100%)',
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
  console.log('🔧 Providers mounting with Push Universal Wallet...');

  // Push Universal Wallet configuration
  const walletConfig = {
    network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
    login: {
      email: true,
      google: true,
      wallet: {
        enabled: true,
      },
      appPreview: true,
    },
    modal: {
      loginLayout: PushUI.CONSTANTS.LOGIN.LAYOUT.SPLIT,
      connectedLayout: PushUI.CONSTANTS.CONNECTED.LAYOUT.HOVER,
      appPreview: true,
    },
  };

  // App metadata for Push Universal Wallet
  const appMetadata = {
    logoUrl: '/logos/logo-1.png',
    title: 'APT Casino Push Chain',
    description: 'Decentralized casino on Push Chain with provably fair games',
  };

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <PushUniversalWalletProvider config={walletConfig} app={appMetadata}>
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
        </PushUniversalWalletProvider>
      </QueryClientProvider>
    </Provider>
  );
}
