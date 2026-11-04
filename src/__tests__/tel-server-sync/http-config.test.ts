import { describe, expect, it } from 'vitest';
import { loadTelGenerationConfig, loadTelServerSyncConfig, parseTelSyncTargets } from '@/tel-server-sync/config';
import { encodeFormData, parseServerCommResponse } from '@/tel-server-sync/http';

describe('tel-server-sync config and HTTP helpers', () => {
  it('parses comma-separated target host and location pairs from env', () => {
    expect(parseTelSyncTargets('46.249.36.71|/asterisk/receive_telnrs.php,46.249.36.55|/asterisk/receive_telnrs.php')).toEqual([
      { host: '46.249.36.71', location: '/asterisk/receive_telnrs.php' },
      { host: '46.249.36.55', location: '/asterisk/receive_telnrs.php' },
    ]);
  });

  it('loads all TelSync and SMS values from environment variables', () => {
    const config = loadTelServerSyncConfig({
      TEL_SYNC_ON: 'true',
      TEL_SYNC_TIJD_VOORUIT: '604800',
      TEL_SYNC_TARGETS: 'pbx.example.test|/asterisk/receive_telnrs.php',
      SMS_GATEWAY_HOST: 'sms.example.test',
      SMS_GATEWAY_PAGE: '/api/outbound.php',
      SMS_GATEWAY_AUTH: 'user:pass',
      SMS_SENDER: 'doktersd',
      TEL_SYNC_COMPLETION_SMS_TO: '+31624235212',
      TEL_SYNC_COMPLETION_SMS_BODY: 'Doktersdienst telefoonnummers overgezet (jippie!)',
    });

    expect(config.telSync.syncOn).toBe(true);
    expect(config.telSync.tijdVooruit).toBe(604800);
    expect(config.sms.gatewayAuth).toBe('user:pass');
  });

  it('loads only tijdVooruit for PBX telrecord generation from env', () => {
    expect(
      loadTelGenerationConfig({
        TEL_SYNC_TIJD_VOORUIT: '604800',
      }),
    ).toEqual({ tijdVooruit: 604800 });
  });

  it('requires TEL_SYNC_TIJD_VOORUIT for PBX telrecord generation', () => {
    expect(() => loadTelGenerationConfig({})).toThrow(/TEL_SYNC_TIJD_VOORUIT/);
  });

  it('encodes and parses form responses with PHP-compatible plus decoding', () => {
    expect(encodeFormData({ text: 'a b', nr: '31880026406' })).toBe('text=a%20b&nr=31880026406');
    expect(parseServerCommResponse('result=1&message=OK+done')).toEqual({
      result: '1',
      message: 'OK done',
    });
  });
});
