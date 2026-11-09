import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import notifee, {
  AndroidImportance,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';
import BackgroundFetch from 'react-native-background-fetch';
import { MapScreen } from './src/screens/MapScreen';
import { ValidationScreen } from './src/screens/ValidationScreen';
import { dataProvider } from './src/services/DataProvider';
import { OrbitalEngine, PassWindow } from './src/engine/OrbitalEngine';

const PASS_CHANNEL_ID = 'satellite-pass-alerts';

/**
 * Notification & Background Refresh Layer (RF-06, RF-09)
 * Schedules Notifee timestamp triggers N minutes before AOS and configures
 * periodic react-native-background-fetch tasks to refresh expired TTL caches (12-24h).
 */
export async function ensureNotificationChannel(): Promise<string> {
  await notifee.requestPermission();
  return notifee.createChannel({
    id: PASS_CHANNEL_ID,
    name: 'Alertas de Pases Satelitales (AOS)',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });
}

export async function schedulePassNotification(
  pass: PassWindow,
  leadMinutes = 5
): Promise<void> {
  const channelId = await ensureNotificationChannel();
  const now = Date.now();
  const triggerTimestamp = pass.aosTime - leadMinutes * 60 * 1000;

  if (triggerTimestamp <= now + 5000) {
    // Pass is starting immediately or within lead time: display instant notification
    await notifee.displayNotification({
      title: `Pase inminente: ${pass.satelliteName}`,
      body: `AOS a las ${new Date(pass.aosTime).toLocaleTimeString()} | Elev. Max: ${pass.maxElevationDeg.toFixed(1)}° (Az ${pass.aosAzimuthDeg.toFixed(0)}°)`,
      android: { channelId, pressAction: { id: 'default' } },
    });
    Alert.alert(
      'Notificacion Disparada',
      `El pase de ${pass.satelliteName} comienza en menos de ${leadMinutes} min. Se emitio alerta inmediata.`
    );
    return;
  }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: triggerTimestamp,
  };

  await notifee.createTriggerNotification(
    {
      id: `pass-${pass.noradId}-${pass.aosTime}`,
      title: `Pase Visible en ${leadMinutes} min: ${pass.satelliteName}`,
      body: `AOS ${new Date(pass.aosTime).toLocaleTimeString()} • Elevación Máx ${pass.maxElevationDeg.toFixed(1)}° • Duración ${Math.round(pass.durationSec / 60)} min`,
      android: {
        channelId,
        pressAction: { id: 'default' },
      },
    },
    trigger
  );

  Alert.alert(
    'Recordatorio Programado',
    `Se notificara ${leadMinutes} min antes del AOS de ${pass.satelliteName} (${new Date(triggerTimestamp).toLocaleTimeString()}).`
  );
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'map' | 'validation'>('map');
  const [selectedNoradForValidation, setSelectedNoradForValidation] =
    useState<number>(25544);

  /**
   * Configure react-native-background-fetch for periodic orbital cache refresh (RF-09)
   * and automatic pass recalculation.
   */
  const initBackgroundFetch = useCallback(async () => {
    try {
      await BackgroundFetch.configure(
        {
          minimumFetchInterval: 60, // Run check every 60 minutes; respects 12-24h TTL inside DataProvider
          stopOnTerminate: false,
          startOnBoot: true,
          enableHeadless: true,
          requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
        },
        async (taskId: string) => {
          try {
            // 1. Refresh any cached orbital records older than TTL (12-24h)
            await dataProvider.refreshExpiredCache();

            // 2. Recalculate next ISS visible pass and ensure notification is scheduled
            const issMeta = await dataProvider.getOrbitalData(25544, false);
            const passes = OrbitalEngine.predictVisibilityWindows(
              issMeta.record,
              { latitude: -32.4845, longitude: -58.2322, altitudeKm: 0.025 },
              15,
              12,
              1
            );
            if (passes.length > 0) {
              const nextPass = passes[0];
              const triggerTime = nextPass.aosTime - 5 * 60 * 1000;
              if (triggerTime > Date.now() + 60000) {
                const channelId = await ensureNotificationChannel();
                await notifee.createTriggerNotification(
                  {
                    id: `bg-pass-${nextPass.noradId}`,
                    title: `Proximo pase ISS en 5 min`,
                    body: `Elevacion maxima ${nextPass.maxElevationDeg.toFixed(1)}°`,
                    android: { channelId },
                  },
                  { type: TriggerType.TIMESTAMP, timestamp: triggerTime }
                );
              }
            }
          } finally {
            BackgroundFetch.finish(taskId);
          }
        },
        (taskId: string) => {
          BackgroundFetch.finish(taskId);
        }
      );
    } catch {
      // BackgroundFetch may be unsupported on some simulators
    }
  }, []);

  useEffect(() => {
    ensureNotificationChannel().catch(() => {});
    initBackgroundFetch();
  }, [initBackgroundFetch]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Main Content Area */}
      <View style={styles.body}>
        {activeTab === 'map' ? (
          <MapScreen
            onSchedulePassNotification={schedulePassNotification}
            onSelectSatelliteForValidation={noradId =>
              setSelectedNoradForValidation(noradId)
            }
          />
        ) : (
          <ValidationScreen initialNoradId={selectedNoradForValidation} />
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[
            styles.navTab,
            activeTab === 'map' && styles.navTabActive,
          ]}
          onPress={() => setActiveTab('map')}
        >
          <Text
            style={[
              styles.navTabText,
              activeTab === 'map' && styles.navTabTextActive,
            ]}
          >
            Tracker & Sky Chart (SGP4)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navTab,
            activeTab === 'validation' && styles.navTabActive,
          ]}
          onPress={() => setActiveTab('validation')}
        >
          <Text
            style={[
              styles.navTabText,
              activeTab === 'validation' && styles.navTabTextActive,
            ]}
          >
            Validacion Cruzada (RF-15)
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  body: { flex: 1 },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
  },
  navTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  navTabActive: {
    backgroundColor: '#0284C7',
  },
  navTabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  navTabTextActive: {
    color: '#FFFFFF',
  },
});

export default App;

