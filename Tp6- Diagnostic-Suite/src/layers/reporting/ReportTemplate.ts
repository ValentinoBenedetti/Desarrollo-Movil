import type { GeoCoordinates, InstallationOrderInput } from '../../core/types';

export interface ReportTemplateInput extends InstallationOrderInput {
  reportId: string;
  generatedAtUtc: string;
}

/**
 * Generates a self-contained corporate HTML5/CSS3 installation dossier
 * with embedded base64 photographic evidence, GPS telemetry, and SNMP/SSH diagnostics.
 */
export class ReportTemplate {
  public static formatCoordinates(coords: GeoCoordinates): string {
    const latDir = coords.latitude >= 0 ? 'N' : 'S';
    const lonDir = coords.longitude >= 0 ? 'E' : 'W';
    const altPart = coords.altitude !== null ? ` | Alt: ${coords.altitude}m` : '';
    return `${Math.abs(coords.latitude).toFixed(6)}° ${latDir}, ${Math.abs(coords.longitude).toFixed(6)}° ${lonDir} (±${coords.accuracyMeters}m${altPart})`;
  }

  public static buildHtml(data: ReportTemplateInput): string {
    const formattedCoords = ReportTemplate.formatCoordinates(data.coordinates);
    const snmpRows = data.snmpSummary
      ? `
        <tr>
          <td><strong>sysName.0 (1.3.6.1.2.1.1.5.0)</strong></td>
          <td>${ReportTemplate.escapeHtml(data.snmpSummary.sysName)}</td>
        </tr>
        <tr>
          <td><strong>sysDescr.0 (1.3.6.1.2.1.1.1.0)</strong></td>
          <td>${ReportTemplate.escapeHtml(data.snmpSummary.sysDescr)}</td>
        </tr>
        <tr>
          <td><strong>sysUpTime.0 (1.3.6.1.2.1.1.3.0)</strong></td>
          <td>${ReportTemplate.escapeHtml(data.snmpSummary.sysUpTimeFormatted)}</td>
        </tr>
        <tr>
          <td><strong>ifInOctets.1 (1.3.6.1.2.1.2.2.1.10.1)</strong></td>
          <td>${data.snmpSummary.ifInOctets1.toLocaleString('en-US')} octets</td>
        </tr>
        <tr>
          <td><strong>ifOutOctets.1 (1.3.6.1.2.1.2.2.1.16.1)</strong></td>
          <td>${data.snmpSummary.ifOutOctets1.toLocaleString('en-US')} octets</td>
        </tr>
        <tr>
          <td><strong>SNMP Round-Trip Latency</strong></td>
          <td>${data.snmpSummary.roundTripTimeMs} ms (SNMP v${data.snmpSummary.version})</td>
        </tr>
      `
      : `
        <tr>
          <td colspan="2">No SNMP snapshot attached to this installation order.</td>
        </tr>
      `;

    const sshSection = data.sshOutput
      ? `<pre class="ssh-box">${ReportTemplate.escapeHtml(data.sshOutput)}</pre>`
      : `<p class="muted">No SSH command transcript recorded for this session.</p>`;

    const imageSource = data.photoBase64
      ? data.photoBase64.startsWith('data:image')
        ? data.photoBase64
        : `data:image/jpeg;base64,${data.photoBase64}`
      : data.photoUri;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Field Installation Report - ${ReportTemplate.escapeHtml(data.reportId)}</title>
  <style>
    * { box-sizing: border-box; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    body { margin: 0; padding: 24px; color: #0f172a; background-color: #ffffff; font-size: 12px; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #0284c7;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
    .subtitle { font-size: 11px; color: #475569; margin-top: 4px; }
    .meta-badge {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      text-align: right;
      font-size: 10px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #0369a1;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 18px;
      margin-bottom: 10px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: left;
      vertical-align: top;
    }
    th { background-color: #f8fafc; font-weight: 700; color: #334155; width: 32%; }
    .ssh-box {
      background-color: #0f172a;
      color: #38bdf8;
      padding: 10px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      font-size: 10px;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .evidence-container {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px;
      background-color: #f8fafc;
      text-align: center;
    }
    .evidence-img {
      max-width: 100%;
      max-height: 280px;
      border-radius: 4px;
      border: 1px solid #94a3b8;
    }
    .caption {
      font-size: 10px;
      color: #475569;
      margin-top: 6px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      font-size: 10px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">NETWORK DIAGNOSTICS SUITE</h1>
      <div class="subtitle">Telecommunications Infrastructure Field Installation & Commissioning Certificate</div>
    </div>
    <div class="meta-badge">
      <div><strong>REPORT ID:</strong> ${ReportTemplate.escapeHtml(data.reportId)}</div>
      <div><strong>GENERATED (UTC):</strong> ${ReportTemplate.escapeHtml(data.generatedAtUtc)}</div>
      <div><strong>TECHNICIAN:</strong> ${ReportTemplate.escapeHtml(data.technicianId)}</div>
    </div>
  </div>

  <div class="section-title">1. Site & Equipment Identification</div>
  <table>
    <tr>
      <th>Installation Site</th>
      <td>${ReportTemplate.escapeHtml(data.siteName)}</td>
      <th>Serial Number (QR/Barcode)</th>
      <td>${ReportTemplate.escapeHtml(data.serialNumber)}</td>
    </tr>
    <tr>
      <th>Management IPv4</th>
      <td>${ReportTemplate.escapeHtml(data.deviceIp)}</td>
      <th>Equipment Model</th>
      <td>${ReportTemplate.escapeHtml(data.equipmentModel)}</td>
    </tr>
    <tr>
      <th>Hardware MAC Address</th>
      <td>${ReportTemplate.escapeHtml(data.deviceMac)}</td>
      <th>Resolved Hostname</th>
      <td>${ReportTemplate.escapeHtml(data.deviceHostname)}</td>
    </tr>
  </table>

  <div class="section-title">2. High-Precision Georeference (GPS)</div>
  <table>
    <tr>
      <th>Formatted Coordinates</th>
      <td colspan="3">${ReportTemplate.escapeHtml(formattedCoords)}</td>
    </tr>
    <tr>
      <th>Latitude / Longitude</th>
      <td>${data.coordinates.latitude}, ${data.coordinates.longitude}</td>
      <th>Horizontal Accuracy / Fix UTC</th>
      <td>±${data.coordinates.accuracyMeters} m @ ${ReportTemplate.escapeHtml(data.coordinates.timestampUtc)}</td>
    </tr>
  </table>

  <div class="section-title">3. SNMP MIB-II Baseline Telemetry (UDP/161)</div>
  <table>
    ${snmpRows}
  </table>

  <div class="section-title">4. SSH Diagnostic Output & Technician Notes</div>
  <table>
    <tr>
      <th>Field Engineering Notes</th>
      <td>${ReportTemplate.escapeHtml(data.notes || 'Commissioned within nominal optical and Ethernet thresholds.')}</td>
    </tr>
  </table>
  ${sshSection}

  <div class="section-title">5. Georeferenced Photographic Evidence</div>
  <div class="evidence-container">
    ${
      imageSource
        ? `<img class="evidence-img" src="${imageSource}" alt="Field Installation Evidence" />`
        : `<p>No photographic image attached</p>`
    }
    <div class="caption">
      Geotagged Capture: ${ReportTemplate.escapeHtml(formattedCoords)} | Timestamp: ${ReportTemplate.escapeHtml(data.coordinates.timestampUtc)}
    </div>
  </div>

  <div class="footer">
    <span>Generated Offline-First by Network Diagnostics Suite v1.0.0</span>
    <span>FCyT - UADER | Mobile Application Development</span>
  </div>
</body>
</html>`;
  }

  private static escapeHtml(raw: string): string {
    return String(raw)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
