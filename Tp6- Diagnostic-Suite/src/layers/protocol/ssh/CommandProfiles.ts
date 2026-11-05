import type { NetworkVendor, VendorCommandProfile } from '../../../core/types';

/**
 * Curated catalog of telecommunications diagnostic SSH commands grouped by hardware vendor:
 * - Cisco IOS / IOS-XE
 * - MikroTik RouterOS
 * - Huawei VRP (Versatile Routing Platform)
 * - Linux / OpenWrt (Edge routers, ONTs, Ubiquiti airOS/EdgeOS)
 */
export const VENDOR_COMMAND_PROFILES: Record<NetworkVendor, VendorCommandProfile> = {
  cisco: {
    vendor: 'cisco',
    displayName: 'Cisco IOS / IOS-XE',
    defaultPort: 22,
    commands: [
      {
        id: 'cisco-ip-int-brief',
        label: 'Interface Status Summary',
        command: 'show ip interface brief',
        description: 'Lists IPv4 addresses, Layer 1 status, and Layer 2 protocol state of all interfaces.',
      },
      {
        id: 'cisco-version',
        label: 'System Version & Uptime',
        command: 'show version',
        description: 'Displays IOS release, hardware chassis, serial number, and system uptime.',
      },
      {
        id: 'cisco-cdp-neighbors',
        label: 'CDP Adjacent Neighbors',
        command: 'show cdp neighbors detail',
        description: 'Discovers directly connected Cisco devices at Layer 2 with management IPs.',
      },
      {
        id: 'cisco-ip-route',
        label: 'Routing Table',
        command: 'show ip route summary',
        description: 'Displays active RIB route counts by routing protocol (OSPF, BGP, Static, Connected).',
      },
      {
        id: 'cisco-cpu-proc',
        label: 'CPU Load & Processes',
        command: 'show processes cpu sorted | exclude 0.00',
        description: 'Shows 5-second, 1-minute, and 5-minute CPU load and top active processes.',
      },
    ],
  },
  mikrotik: {
    vendor: 'mikrotik',
    displayName: 'MikroTik RouterOS',
    defaultPort: 22,
    commands: [
      {
        id: 'mt-system-resource',
        label: 'System Resources & Uptime',
        command: '/system resource print without-paging',
        description: 'Displays RouterBOARD model, CPU load, free memory, architecture, and uptime.',
      },
      {
        id: 'mt-interfaces',
        label: 'Interfaces & Error Counters',
        command: '/interface print stats without-paging',
        description: 'Shows TX/RX bytes, packets, drops, and physical link errors on all interfaces.',
      },
      {
        id: 'mt-ip-addresses',
        label: 'IPv4 Address Assignments',
        command: '/ip address print without-paging',
        description: 'Lists assigned IPv4 prefixes and bound interfaces.',
      },
      {
        id: 'mt-ip-neighbors',
        label: 'MNDP / LLDP Neighbors',
        command: '/ip neighbor print detail without-paging',
        description: 'Lists discovered adjacent Layer 2 network equipment.',
      },
      {
        id: 'mt-routes',
        label: 'Active Routing Table',
        command: '/ip route print detail where active=yes',
        description: 'Lists active forwarding routes and gateway reachability states.',
      },
    ],
  },
  huawei: {
    vendor: 'huawei',
    displayName: 'Huawei VRP (NetEngine / Quidway / SmartAX)',
    defaultPort: 22,
    commands: [
      {
        id: 'hw-ip-int-brief',
        label: 'IP Interface Brief',
        command: 'display ip interface brief',
        description: 'Shows physical and protocol status of all Layer 3 interfaces.',
      },
      {
        id: 'hw-version',
        label: 'VRP Version & Board Uptime',
        command: 'display version',
        description: 'Displays Huawei VRP software release, patch state, and chassis uptime.',
      },
      {
        id: 'hw-optical-transceiver',
        label: 'Optical SFP/PON Diagnostics',
        command: 'display transceiver diagnosis interface',
        description: 'Reads optical TX/RX power (dBm), bias current, and temperature of optical modules.',
      },
      {
        id: 'hw-lldp-neighbor',
        label: 'LLDP Neighbors',
        command: 'display lldp neighbor brief',
        description: 'Displays IEEE 802.1AB Link Layer Discovery Protocol adjacent nodes.',
      },
      {
        id: 'hw-health',
        label: 'Device CPU & Memory Health',
        command: 'display health',
        description: 'Reports control-plane CPU usage, memory utilization, and power/fan status.',
      },
    ],
  },
  linux: {
    vendor: 'linux',
    displayName: 'Linux / OpenWrt / EdgeOS',
    defaultPort: 22,
    commands: [
      {
        id: 'lnx-ip-addr',
        label: 'Network Interfaces & Statistics',
        command: 'ip -s addr show',
        description: 'Displays netlink interfaces, IPv4/IPv6 addresses, and RX/TX byte/error counters.',
      },
      {
        id: 'lnx-uptime-load',
        label: 'System Uptime & Memory',
        command: 'uptime && free -m && uname -a',
        description: 'Prints system uptime, load averages, RAM usage in MiB, and kernel version.',
      },
      {
        id: 'lnx-routes-arp',
        label: 'Routing & ARP Neighbor Cache',
        command: 'ip route show && ip neigh show',
        description: 'Shows kernel IPv4 routing table and resolved ARP neighbor entries.',
      },
      {
        id: 'lnx-wireless',
        label: 'Wireless Radio & Signal Status',
        command: 'iwinfo 2>/dev/null || iw dev 2>/dev/null || cat /proc/net/wireless',
        description: 'Queries 802.11 radio interfaces, noise floor, and RSSI on OpenWrt/airOS CPEs.',
      },
      {
        id: 'lnx-dmesg-net',
        label: 'Recent Kernel Network Events',
        command: 'dmesg | tail -n 30',
        description: 'Retrieves the last 30 kernel ring buffer lines for link flap diagnostics.',
      },
    ],
  },
};

export function getVendorProfile(vendor: NetworkVendor): VendorCommandProfile {
  return VENDOR_COMMAND_PROFILES[vendor];
}

export function inferVendorFromDescription(text: string): NetworkVendor {
  const normalized = text.toLowerCase();
  if (normalized.includes('cisco') || normalized.includes('ios')) {
    return 'cisco';
  }
  if (normalized.includes('mikrotik') || normalized.includes('routeros')) {
    return 'mikrotik';
  }
  if (normalized.includes('huawei') || normalized.includes('vrp') || normalized.includes('smartax')) {
    return 'huawei';
  }
  return 'linux';
}
