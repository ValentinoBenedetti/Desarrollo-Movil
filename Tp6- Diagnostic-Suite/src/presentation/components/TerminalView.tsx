import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  NetworkVendor,
  SshDiagnosticCommand,
  SshExecutionResult,
} from '../../core/types';
import { VENDOR_COMMAND_PROFILES } from '../../layers/protocol/ssh/CommandProfiles';

export interface TerminalViewProps {
  selectedVendor: NetworkVendor;
  onSelectVendor: (vendor: NetworkVendor) => void;
  onExecuteCommand: (command: SshDiagnosticCommand) => void;
  onExecuteFullSuite: () => void;
  isExecuting: boolean;
  transcript: SshExecutionResult[];
}

const VENDORS: NetworkVendor[] = ['cisco', 'mikrotik', 'huawei', 'linux'];

export const TerminalView: React.FC<TerminalViewProps> = ({
  selectedVendor,
  onSelectVendor,
  onExecuteCommand,
  onExecuteFullSuite,
  isExecuting,
  transcript,
}) => {
  const activeProfile = VENDOR_COMMAND_PROFILES[selectedVendor];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>SSH Vendor Profile Selector</Text>
      <View style={styles.vendorTabs}>
        {VENDORS.map(vendor => {
          const isSelected = vendor === selectedVendor;
          return (
            <TouchableOpacity
              key={vendor}
              style={[styles.vendorTab, isSelected && styles.vendorTabActive]}
              onPress={() => onSelectVendor(vendor)}>
              <Text
                style={[
                  styles.vendorTabText,
                  isSelected && styles.vendorTabTextActive,
                ]}>
                {vendor.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.profileSubtitle}>
        {activeProfile.displayName} (Default TCP/{activeProfile.defaultPort})
      </Text>

      <View style={styles.commandsList}>
        {activeProfile.commands.map(cmd => (
          <TouchableOpacity
            key={cmd.id}
            style={styles.commandButton}
            disabled={isExecuting}
            onPress={() => onExecuteCommand(cmd)}>
            <View style={styles.commandHeader}>
              <Text style={styles.commandLabel}>{cmd.label}</Text>
              <Text style={styles.runTag}>EXEC</Text>
            </View>
            <Text style={styles.commandCode}>$ {cmd.command}</Text>
            <Text style={styles.commandDesc}>{cmd.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.suiteButton}
        disabled={isExecuting}
        onPress={onExecuteFullSuite}>
        {isExecuting ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.suiteButtonText}>
            Execute Full {activeProfile.displayName} Diagnostic Suite
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.terminalBox}>
        <View style={styles.terminalHeader}>
          <Text style={styles.terminalHeaderTitle}>SSHv2 SESSION TRANSCRIPT</Text>
          <Text style={styles.terminalCount}>{transcript.length} commands</Text>
        </View>
        <ScrollView style={styles.terminalScroll} nestedScrollEnabled>
          {transcript.length === 0 ? (
            <Text style={styles.emptyPrompt}>
              root@field-console:~# Ready. Select a predefined vendor command above.
            </Text>
          ) : (
            transcript.map((item, idx) => (
              <View key={`${item.executedAtIso}-${idx}`} style={styles.entryBlock}>
                <Text style={styles.promptLine}>
                  [{item.vendor.toUpperCase()}@{item.host}:{item.port}]# {item.command}{' '}
                  ({item.durationMs}ms)
                </Text>
                <Text style={styles.stdoutText}>{item.stdout}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  vendorTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  vendorTab: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  vendorTabActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  vendorTabText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  vendorTabTextActive: {
    color: '#ffffff',
  },
  profileSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 10,
  },
  commandsList: {
    gap: 8,
    marginBottom: 10,
  },
  commandButton: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  commandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commandLabel: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  runTag: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
  },
  commandCode: {
    color: '#7dd3fc',
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 4,
  },
  commandDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  suiteButton: {
    backgroundColor: '#0369a1',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  suiteButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  terminalBox: {
    backgroundColor: '#020617',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  terminalHeader: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  terminalHeaderTitle: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
  terminalCount: {
    color: '#38bdf8',
    fontSize: 10,
  },
  terminalScroll: {
    maxHeight: 240,
    padding: 10,
  },
  emptyPrompt: {
    color: '#475569',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  entryBlock: {
    marginBottom: 12,
  },
  promptLine: {
    color: '#22c55e',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
  },
  stdoutText: {
    color: '#e2e8f0',
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 4,
  },
});

