import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { embeddedSnmpLoopback } from './layers/protocol/snmp/EmbeddedSnmpLoopback';
import { networkMonitor } from './layers/sync/NetworkMonitor';
import { AppNavigator } from './presentation/navigation/AppNavigator';

/**
 * Root Application Entry Point for the Network Diagnostics Suite.
 * Initializes the reactive NetInfo connectivity monitor and mounts the 4-tab navigation shell.
 */
const App: React.FC = () => {
  useEffect(() => {
    embeddedSnmpLoopback.ensureStarted().catch(() => {});
    networkMonitor.start();
    return () => {
      networkMonitor.stop();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <AppNavigator />
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

export default App;

