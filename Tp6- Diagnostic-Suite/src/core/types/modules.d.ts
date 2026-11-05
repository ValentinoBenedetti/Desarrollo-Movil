declare module 'react-native-udp' {
  import { Buffer } from 'buffer';

  export interface UdpSocket {
    bind(port?: number, address?: string | (() => void), callback?: () => void): void;
    send(
      buffer: Buffer | Uint8Array,
      offset: number,
      length: number,
      port: number,
      address: string,
      callback?: (error?: Error | null) => void,
    ): void;
    close(callback?: () => void): void;
    on(event: 'message', listener: (msg: Buffer, rinfo: { address: string; port: number }) => void): void;
    on(event: 'error', listener: (err: Error) => void): void;
  }

  export function createSocket(options: { type: 'udp4' | 'udp6' } | 'udp4' | 'udp6'): UdpSocket;

  const dgram: {
    createSocket: typeof createSocket;
  };
  export default dgram;
}

declare module 'react-native-ssh-sftp' {
  export default class SSHClient {
    public static connectWithPassword(
      host: string,
      port: number,
      username: string,
      password: string,
      callback: (error: string | null, client: SSHClient) => void,
    ): void;

    public static connectWithKey(
      host: string,
      port: number,
      username: string,
      privateKey: string,
      passphrase: string,
      callback: (error: string | null, client: SSHClient) => void,
    ): void;

    public execute(
      command: string,
      callback: (error: string | null, output: string) => void,
    ): void;

    public disconnect(): void;
  }
}

declare module 'react-native-html-to-pdf' {
  export interface Options {
    html: string;
    fileName?: string;
    directory?: string;
    base64?: boolean;
    width?: number;
    height?: number;
  }

  export interface PdfResult {
    filePath?: string;
    base64?: string;
    numberOfPages?: number;
  }

  const RNHTMLtoPDF: {
    convert(options: Options): Promise<PdfResult>;
  };

  export default RNHTMLtoPDF;
}

declare module 'react-native-zeroconf' {
  export interface Service {
    name: string;
    host: string;
    port: number;
    addresses?: string[];
    txt?: Record<string, string>;
  }

  export default class Zeroconf {
    public scan(type?: string, protocol?: string, domain?: string): void;
    public stop(): void;
    public removeDeviceListeners(): void;
    public on(event: 'resolved', callback: (service: Service) => void): void;
    public on(event: 'error', callback: (err: Error) => void): void;
  }
}


