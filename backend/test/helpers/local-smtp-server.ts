import net from 'node:net';

export interface CapturedSmtpMessage {
  mailFrom: string;
  rcptTo: string[];
  rawData: string;
  decodedBody: string;
}

function decodeQuotedPrintable(input: string): string {
  // Remove soft line breaks (=\r\n or =\n) then decode =XX UTF-8 byte sequences
  const unwrapped = input.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < unwrapped.length; i += 1) {
    const ch = unwrapped[i]!;
    if (
      ch === '=' &&
      i + 2 < unwrapped.length &&
      /^[0-9A-Fa-f]{2}$/.test(unwrapped.slice(i + 1, i + 3))
    ) {
      bytes.push(Number.parseInt(unwrapped.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      const encoded = Buffer.from(ch, 'utf8');
      for (const b of encoded) {
        bytes.push(b);
      }
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

export class LocalSmtpTestServer {
  private server: net.Server | null = null;
  private readonly messages: CapturedSmtpMessage[] = [];
  private simulateFailure = false;
  public host = '127.0.0.1';
  public port = 0;

  setSimulateFailure(fail: boolean): void {
    this.simulateFailure = fail;
  }

  clearMessages(): void {
    this.messages.length = 0;
  }

  getMessages(): CapturedSmtpMessage[] {
    return [...this.messages];
  }

  getLatestMessageFor(recipientEmail: string): CapturedSmtpMessage | undefined {
    const normalized = recipientEmail.trim().toLowerCase();
    for (let i = this.messages.length - 1; i >= 0; i -= 1) {
      const msg = this.messages[i]!;
      if (msg.rcptTo.some((r) => r.toLowerCase().includes(normalized))) {
        return msg;
      }
    }
    return undefined;
  }

  extractResetTokenFromMessage(msg: CapturedSmtpMessage): string | null {
    const match =
      /\/reset-password\?token=([0-9a-fA-F]{64})/.exec(msg.decodedBody) ??
      /\/reset-password\?token=([0-9a-fA-F]{64})/.exec(msg.rawData);
    return match?.[1] ?? null;
  }

  extractVerificationCodeFromMessage(msg: CapturedSmtpMessage): string | null {
    const match =
      /là:\s*(\d{6})/.exec(msg.decodedBody) ??
      /là:\s*(\d{6})/.exec(msg.rawData) ??
      /font-size:\s*28px[^>]*>(\d{6})</.exec(msg.decodedBody);
    return match?.[1] ?? null;
  }

  async start(): Promise<{ host: string; port: number }> {
    if (this.server) {
      return { host: this.host, port: this.port };
    }

    this.server = net.createServer((socket) => {
      socket.setEncoding('utf8');
      let buffer = '';
      let inDataMode = false;
      let mailFrom = '';
      let rcptTo: string[] = [];
      let dataLines: string[] = [];

      const sendLine = (line: string) => {
        if (!socket.destroyed) {
          socket.write(`${line}\r\n`);
        }
      };

      sendLine('220 localhost ESMTP WebEduTestSmtpReady');

      socket.on('data', (chunk: string) => {
        buffer += chunk;

        while (true) {
          const newlineIdx = buffer.indexOf('\n');
          if (newlineIdx === -1) {
            break;
          }
          const rawLine = buffer.slice(0, newlineIdx).replace(/\r$/, '');
          buffer = buffer.slice(newlineIdx + 1);

          if (inDataMode) {
            if (rawLine === '.') {
              inDataMode = false;
              if (this.simulateFailure) {
                sendLine('451 4.3.0 Simulated local SMTP failure');
              } else {
                const rawData = dataLines.join('\r\n');
                this.messages.push({
                  mailFrom,
                  rcptTo: [...rcptTo],
                  rawData,
                  decodedBody: decodeQuotedPrintable(rawData),
                });
                sendLine('250 2.0.0 OK Message accepted');
              }
              dataLines = [];
            } else {
              // Dot-unstuffing per RFC 5321
              dataLines.push(rawLine.startsWith('..') ? rawLine.slice(1) : rawLine);
            }
            continue;
          }

          const upper = rawLine.toUpperCase();
          if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
            sendLine('250-localhost Hello');
            sendLine('250 8BITMIME');
          } else if (upper.startsWith('MAIL FROM:')) {
            if (this.simulateFailure) {
              sendLine('451 4.3.0 Simulated SMTP transport failure');
              continue;
            }
            mailFrom = rawLine.slice(10).trim();
            rcptTo = [];
            dataLines = [];
            sendLine('250 2.1.0 Sender OK');
          } else if (upper.startsWith('RCPT TO:')) {
            rcptTo.push(rawLine.slice(8).trim());
            sendLine('250 2.1.5 Recipient OK');
          } else if (upper === 'DATA') {
            if (this.simulateFailure) {
              sendLine('451 4.3.0 Simulated SMTP DATA failure');
              continue;
            }
            inDataMode = true;
            sendLine('354 Start mail input; end with <CRLF>.<CRLF>');
          } else if (upper === 'RSET') {
            mailFrom = '';
            rcptTo = [];
            dataLines = [];
            inDataMode = false;
            sendLine('250 2.0.0 Reset OK');
          } else if (upper === 'NOOP') {
            sendLine('250 2.0.0 OK');
          } else if (upper === 'QUIT') {
            sendLine('221 2.0.0 Bye');
            socket.end();
          } else {
            sendLine('250 2.0.0 OK');
          }
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, this.host, () => {
        const addr = this.server!.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }
        resolve();
      });
    });

    return { host: this.host, port: this.port };
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    const srv = this.server;
    this.server = null;
    await new Promise<void>((resolve) => {
      srv.close(() => resolve());
    });
  }
}
