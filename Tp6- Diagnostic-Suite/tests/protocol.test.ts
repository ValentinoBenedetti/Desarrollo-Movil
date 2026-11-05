import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { LabSnmpUdpAgent } from '../backend-stub/src/snmpAgent.ts';
import {
  ASN1_TAGS,
  DEFAULT_DIAGNOSTIC_OIDS,
  MIB2_OIDS,
} from '../src/core/constants/oids.ts';
import { BerDecoder } from '../src/layers/protocol/snmp/BerDecoder.ts';
import { BerEncoder } from '../src/layers/protocol/snmp/BerEncoder.ts';
import { SnmpPduBuilder } from '../src/layers/protocol/snmp/SnmpPduBuilder.ts';
import { ReportTemplate } from '../src/layers/reporting/ReportTemplate.ts';

async function runProtocolVerificationSuite(): Promise<void> {
  console.log('=== [1/4] Verifying ASN.1 / BER Definite Length & Primitive Types ===');

  // Short & long form BER length round-trip
  const shortLen = BerEncoder.encodeLength(42);
  assert.deepEqual(Array.from(shortLen), [42]);
  assert.deepEqual(BerDecoder.readLength(shortLen, 0), {
    length: 42,
    lengthBytesConsumed: 1,
  });

  const longLen = BerEncoder.encodeLength(300);
  assert.deepEqual(Array.from(longLen), [0x82, 0x01, 0x2c]);
  assert.deepEqual(BerDecoder.readLength(longLen, 0), {
    length: 300,
    lengthBytesConsumed: 3,
  });

  // Two's complement INTEGER (0, 128 requiring 0x00 pad, negative, 31-bit RequestID)
  for (const sampleInt of [0, 1, 127, 128, 255, 65535, 1948572103, -1, -128, -32768]) {
    const encodedInt = BerEncoder.encodeInteger(sampleInt);
    const tlv = BerDecoder.decodeTlv(encodedInt);
    assert.equal(tlv.tag, ASN1_TAGS.INTEGER);
    const decodedInt = BerDecoder.decodeInteger(tlv.rawBytes);
    assert.equal(decodedInt, sampleInt, `Failed INTEGER round-trip for ${sampleInt}`);
  }

  console.log('=== [2/4] Verifying MIB-II OID Base-128 VLQ Encoding & Decoding ===');

  const testOids = [
    ...DEFAULT_DIAGNOSTIC_OIDS,
    '1.3.6.1.4.1.9.9.109.1.1.1.1.5', // Cisco enterprise OID
    '1.3.6.1.4.1.14988.1.1.1.1.1.4', // MikroTik enterprise OID (14988 > 128 multi-octet VLQ)
    '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.5', // Huawei enterprise OID (2011 > 128 multi-octet VLQ)
  ];

  for (const oid of testOids) {
    const encodedOid = BerEncoder.encodeOid(oid);
    const node = BerDecoder.decodeTlv(encodedOid);
    assert.equal(node.tag, ASN1_TAGS.OBJECT_IDENTIFIER);
    const decodedOid = BerDecoder.decodeOid(node.rawBytes);
    assert.equal(decodedOid, oid, `OID mismatch for ${oid}`);
  }

  // Verify exact byte representation of sysDescr.0 (1.3.6.1.2.1.1.1.0)
  // 1.3 -> 43 (0x2B), followed by 6, 1, 2, 1, 1, 1, 0 -> length 8
  const sysDescrBytes = BerEncoder.encodeOid(MIB2_OIDS.SYS_DESCR);
  assert.deepEqual(
    Array.from(sysDescrBytes),
    [0x06, 0x08, 0x2b, 0x06, 0x01, 0x02, 0x01, 0x01, 0x01, 0x00],
  );

  console.log('=== [3/4] Verifying SNMP v1/v2c GetRequest & GetResponse PDUs ===');

  const reqId = 148291042;
  const getReqDatagram = SnmpPduBuilder.buildGetRequest({
    version: '2c',
    community: 'public',
    requestId: reqId,
    oids: DEFAULT_DIAGNOSTIC_OIDS,
  });

  const decodedReq = BerDecoder.decodeSnmpMessage(getReqDatagram, 0);
  assert.equal(decodedReq.version, '2c');
  assert.equal(decodedReq.community, 'public');
  assert.equal(decodedReq.pduType, ASN1_TAGS.GET_REQUEST_PDU);
  assert.equal(decodedReq.requestId, reqId);
  assert.equal(decodedReq.varBinds.length, 5);
  for (let i = 0; i < DEFAULT_DIAGNOSTIC_OIDS.length; i++) {
    assert.equal(decodedReq.varBinds[i].oid, DEFAULT_DIAGNOSTIC_OIDS[i]);
    assert.equal(decodedReq.varBinds[i].typeName, 'NULL');
  }

  const getRespDatagram = SnmpPduBuilder.buildGetResponse({
    version: '2c',
    community: 'public',
    requestId: reqId,
    varBinds: [
      {
        oid: MIB2_OIDS.SYS_DESCR,
        tag: ASN1_TAGS.OCTET_STRING,
        value: 'RouterOS CCR2004-16G-2S+ v7.15.3 (stable)',
      },
      {
        oid: MIB2_OIDS.SYS_UP_TIME,
        tag: ASN1_TAGS.TIME_TICKS,
        value: 12960050, // 1d 12h 0m 0.50s
      },
      {
        oid: MIB2_OIDS.SYS_NAME,
        tag: ASN1_TAGS.OCTET_STRING,
        value: 'bng-core-cdelu-01.fcyt.net',
      },
      {
        oid: MIB2_OIDS.IF_IN_OCTETS_1,
        tag: ASN1_TAGS.COUNTER_32,
        value: 3849201920, // High unsigned 32-bit value (> 2^31)
      },
      {
        oid: MIB2_OIDS.IF_OUT_OCTETS_1,
        tag: ASN1_TAGS.COUNTER_32,
        value: 1928374650,
      },
    ],
  });

  const decodedResp = BerDecoder.decodeSnmpMessage(getRespDatagram, 14);
  assert.equal(decodedResp.pduType, ASN1_TAGS.GET_RESPONSE_PDU);
  assert.equal(decodedResp.requestId, reqId);
  assert.equal(decodedResp.errorStatus, 0);
  assert.equal(decodedResp.roundTripTimeMs, 14);
  assert.equal(
    decodedResp.varBinds[0].value,
    'RouterOS CCR2004-16G-2S+ v7.15.3 (stable)',
  );
  assert.equal(decodedResp.varBinds[1].value, 12960050);
  assert.equal(
    decodedResp.varBinds[1].formattedValue,
    '1d 12h 0m 0.50s (12960050 ticks)',
  );
  assert.equal(decodedResp.varBinds[2].value, 'bng-core-cdelu-01.fcyt.net');
  assert.equal(decodedResp.varBinds[3].value, 3849201920);
  assert.equal(decodedResp.varBinds[4].value, 1928374650);

  console.log('=== [4/4] Verifying Corporate HTML Report Template Generation ===');

  const html = ReportTemplate.buildHtml({
    reportId: 'RPT-TEST-001',
    generatedAtUtc: '2026-11-04T20:00:00.000Z',
    deviceId: 'dev-01',
    deviceIp: '192.168.88.1',
    deviceMac: '4C:5E:0C:11:22:33',
    deviceHostname: 'bng-core-cdelu-01.fcyt.net',
    serialNumber: 'HE081234567',
    equipmentModel: 'MikroTik CCR2004-16G-2S+',
    siteName: 'Nodo Fibra Concepción del Uruguay Centro',
    technicianId: 'TECH-01',
    notes: 'Optical signal verified at -17.2 dBm',
    coordinates: {
      latitude: -32.484512,
      longitude: -58.232145,
      altitude: 24.5,
      accuracyMeters: 3.2,
      timestampUtc: '2026-11-04T19:59:50.000Z',
    },
    photoUri: 'file:///storage/emulated/0/Documents/evidence_1.jpg',
    snmpSummary: {
      targetIp: '192.168.88.1',
      version: '2c',
      sysDescr: 'RouterOS CCR2004-16G-2S+ v7.15.3',
      sysName: 'bng-core-cdelu-01.fcyt.net',
      sysUpTimeTicks: 12960050,
      sysUpTimeFormatted: '1d 12h 0m 0.50s (12960050 ticks)',
      ifInOctets1: 3849201920,
      ifOutOctets1: 1928374650,
      roundTripTimeMs: 14,
      queriedAtIso: '2026-11-04T19:58:00.000Z',
      rawVarBinds: decodedResp.varBinds,
    },
    sshOutput: '/system resource print\nuptime: 1d12h\ncpu-load: 3%',
  });

  assert.ok(html.includes('RPT-TEST-001'));
  assert.ok(html.includes('bng-core-cdelu-01.fcyt.net'));
  assert.ok(html.includes('3,849,201,920 octets'));

  console.log('=== [5/5] Verifying Live UDP Socket SNMP Agent Round-Trip ===');
  const agent = new LabSnmpUdpAgent();
  const handle = await agent.start(0, 0); // Ephemeral UDP port for self-test
  try {
    const clientSocket = dgram.createSocket('udp4');
    const liveReqId = 77889911;
    const outboundPdu = SnmpPduBuilder.buildGetRequest({
      version: '2c',
      community: 'public',
      requestId: liveReqId,
      oids: DEFAULT_DIAGNOSTIC_OIDS,
    });

    const liveDecoded = await new Promise<ReturnType<typeof BerDecoder.decodeSnmpMessage>>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          clientSocket.close();
          reject(new Error('Live UDP SNMP test timed out'));
        }, 2000);

        clientSocket.on('message', msg => {
          clearTimeout(timeout);
          clientSocket.close();
          resolve(
            BerDecoder.decodeSnmpMessage(
              new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength),
              3,
            ),
          );
        });

        clientSocket.send(
          Buffer.from(outboundPdu.buffer, outboundPdu.byteOffset, outboundPdu.byteLength),
          handle.port,
          '127.0.0.1',
        );
      },
    );

    assert.equal(liveDecoded.pduType, ASN1_TAGS.GET_RESPONSE_PDU);
    assert.equal(liveDecoded.requestId, liveReqId);
    assert.equal(liveDecoded.varBinds.length, 5);
    assert.ok(String(liveDecoded.varBinds[0].value).includes('MikroTik RouterOS'));
    assert.ok(Number(liveDecoded.varBinds[3].value) > 0);
  } finally {
    await handle.close();
  }

  console.log('ALL ASN.1/BER, SNMPv1/v2c, LIVE UDP AGENT, AND REPORT TEMPLATE TESTS PASSED.');
}

runProtocolVerificationSuite();

