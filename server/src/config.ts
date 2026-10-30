import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Determine server project root (where server/package.json and server/child_spam_alert_demo_data.xlsx reside)
const serverRoot = process.cwd().endsWith('server')
  ? process.cwd()
  : path.resolve(process.cwd(), 'server');

// Load .env from server directory and workspace root
dotenv.config({ path: path.resolve(serverRoot, '.env') });
dotenv.config({ path: path.resolve(serverRoot, '..', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const excelFileName = 'child_spam_alert_demo_data.xlsx';

function resolveExcelPath(): string {
  // If EXCEL_PATH is set in environment, check if it resolves relative to serverRoot
  if (process.env.EXCEL_PATH) {
    const fromServer = path.isAbsolute(process.env.EXCEL_PATH)
      ? process.env.EXCEL_PATH
      : path.resolve(serverRoot, process.env.EXCEL_PATH);
    if (fs.existsSync(fromServer)) {
      return fromServer;
    }
  }

  // Primary: alongside server/package.json
  const serverPath = path.resolve(serverRoot, excelFileName);
  if (fs.existsSync(serverPath)) {
    return serverPath;
  }

  // Fallback: parent directory if not found in server
  const parentPath = path.resolve(serverRoot, '..', excelFileName);
  if (fs.existsSync(parentPath)) {
    return parentPath;
  }

  return serverPath;
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  serverRoot,
  excelPath: resolveExcelPath(),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || '"SafeFamily Telecom Alert" <noreply@telecom-security.net>',
    isConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  },
  simulationStepDelayMs: parseInt(process.env.SIMULATION_STEP_DELAY_MS || '200', 10),
};
