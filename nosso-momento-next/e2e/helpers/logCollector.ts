import type { Page, Request, Response } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export type LogSeverity = 'critical' | 'warning' | 'info' | 'allowed';

export interface LogEntry {
  severity: LogSeverity;
  type: 'console' | 'pageerror' | 'requestfailed' | 'http';
  message: string;
  url?: string;
  status?: number;
  method?: string;
  page: string;
  timestamp: string;
}

const DEV_ALLOWLIST: Array<(entry: Omit<LogEntry, 'severity' | 'timestamp' | 'page'>) => boolean> = [
  (e) => e.type === 'http' && e.status === 401 && (e.url?.includes('/api/auth/session') ?? false),
  (e) =>
    e.type === 'console' &&
    e.message.includes('enableIndexedDbPersistence() will be deprecated'),
  (e) =>
    e.type === 'console' &&
    e.message.includes('has either width or height modified, but not the other'),
  (e) =>
    e.type === 'console' &&
    e.message.includes('Failed to load resource') &&
    e.message.includes('401'),
  (e) =>
    e.type === 'console' &&
    e.message.includes('[Meta Pixel]'),
  (e) =>
    e.type === 'requestfailed' &&
    e.message === 'net::ERR_ABORTED' &&
    !!e.url &&
    (e.url.includes('google-analytics.com') ||
      e.url.includes('facebook.com') ||
      e.url.includes('firestore.googleapis.com') ||
      e.url.includes('identitytoolkit.googleapis.com') ||
      e.url.includes('gstatic.com/recaptcha')),
];

function classifyEntry(
  raw: Omit<LogEntry, 'severity' | 'timestamp' | 'page'>
): LogSeverity {
  if (DEV_ALLOWLIST.some((fn) => fn(raw))) return 'allowed';

  if (raw.type === 'pageerror') return 'critical';
  if (raw.type === 'requestfailed') return 'warning';

  if (raw.type === 'http' && raw.status !== undefined) {
    if (raw.status >= 500) return 'critical';
    if (raw.status >= 400) return 'warning';
  }

  if (raw.type === 'console') {
    if (raw.message.includes('permission-denied')) return 'critical';
    if (raw.message.includes('missing_app_check')) return 'critical';
    if (raw.message.includes('Erro ao enviar resposta')) return 'critical';
    if (raw.message.toLowerCase().includes('error')) return 'warning';
    return 'warning';
  }

  return 'info';
}

export class LogCollector {
  private entries: LogEntry[] = [];

  attach(page: Page, pageLabel: string): void {
    page.on('console', (msg) => {
      const type = msg.type();
      if (type !== 'error' && type !== 'warning') return;
      const raw = {
        type: 'console' as const,
        message: msg.text(),
        url: page.url(),
      };
      this.push(pageLabel, { ...raw, severity: classifyEntry(raw) });
    });

    page.on('pageerror', (err) => {
      const raw = {
        type: 'pageerror' as const,
        message: err.message,
        url: page.url(),
      };
      this.push(pageLabel, { ...raw, severity: classifyEntry(raw) });
    });

    page.on('requestfailed', (request: Request) => {
      const failure = request.failure();
      const raw = {
        type: 'requestfailed' as const,
        message: failure?.errorText ?? 'request failed',
        url: request.url(),
        method: request.method(),
      };
      this.push(pageLabel, { ...raw, severity: classifyEntry(raw) });
    });

    page.on('response', (response: Response) => {
      const status = response.status();
      if (status < 400) return;
      const raw = {
        type: 'http' as const,
        message: `${status} ${response.statusText()}`,
        url: response.url(),
        status,
        method: response.request().method(),
      };
      this.push(pageLabel, { ...raw, severity: classifyEntry(raw) });
    });
  }

  private push(pageLabel: string, entry: Omit<LogEntry, 'timestamp' | 'page'>): void {
    this.entries.push({
      ...entry,
      page: pageLabel,
      timestamp: new Date().toISOString(),
    });
  }

  getAll(): LogEntry[] {
    return [...this.entries];
  }

  getCritical(): LogEntry[] {
    return this.entries.filter((e) => e.severity === 'critical');
  }

  getWarnings(): LogEntry[] {
    return this.entries.filter((e) => e.severity === 'warning');
  }

  getAllowed(): LogEntry[] {
    return this.entries.filter((e) => e.severity === 'allowed');
  }

  toReport(summary: Record<string, unknown>) {
    return {
      generatedAt: new Date().toISOString(),
      summary,
      totals: {
        all: this.entries.length,
        critical: this.getCritical().length,
        warnings: this.getWarnings().length,
        allowed: this.getAllowed().length,
      },
      critical: this.getCritical(),
      warnings: this.getWarnings(),
      allowed: this.getAllowed(),
      all: this.entries,
    };
  }

  saveReport(filePath: string, summary: Record<string, unknown>): string {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(this.toReport(summary), null, 2), 'utf-8');
    return filePath;
  }

  saveMarkdown(filePath: string, summary: Record<string, unknown>): string {
    const report = this.toReport(summary);
    const lines = [
      '# Relatório E2E — Jornada Novo Usuário',
      '',
      `Gerado em: ${report.generatedAt}`,
      '',
      '## Resumo',
      '',
      ...Object.entries(summary).map(([k, v]) => `- **${k}**: ${String(v)}`),
      '',
      '## Totais',
      '',
      `- Críticos: ${report.totals.critical}`,
      `- Avisos: ${report.totals.warnings}`,
      `- Permitidos (dev): ${report.totals.allowed}`,
      '',
    ];

    if (report.critical.length > 0) {
      lines.push('## Erros críticos', '');
      for (const e of report.critical) {
        lines.push(`- [${e.page}] ${e.type}: ${e.message}${e.url ? ` (${e.url})` : ''}`);
      }
      lines.push('');
    }

    if (report.warnings.length > 0) {
      lines.push('## Avisos', '');
      for (const e of report.warnings) {
        lines.push(`- [${e.page}] ${e.type}: ${e.message}${e.url ? ` (${e.url})` : ''}`);
      }
      lines.push('');
    }

    if (report.allowed.length > 0) {
      lines.push('## Esperados em dev (allowlist)', '');
      for (const e of report.allowed) {
        lines.push(`- [${e.page}] ${e.type}: ${e.message}`);
      }
      lines.push('');
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    return filePath;
  }
}
