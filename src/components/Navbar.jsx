"use client";

import React, { useState } from 'react';
import { AppBar, Toolbar, Container, Box, Typography } from '@mui/material';
import NetworkSwitcher from './NetworkSwitcher';
import { lineraWalletService } from '@/services/LineraWalletService';

const Navbar = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState(null);

  // Listen for wallet changes
  React.useEffect(() => {
    const checkConnection = () => {
      setIsConnected(lineraWalletService.isConnected());
      setAddress(lineraWalletService.userAddress);
    };

    checkConnection();

    const unsubscribe = lineraWalletService.addListener((event, data) => {
      if (event === 'connected') {
        setIsConnected(true);
        setAddress(data?.address);
      } else if (event === 'disconnected') {
        setIsConnected(false);
        setAddress(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      <AppBar position="fixed" sx={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)' }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" component="div" sx={{ color: 'white', fontWeight: 'bold' }}>
                Linera Casino
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <NetworkSwitcher />
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
    </>
  );
};

export default Navbar;
