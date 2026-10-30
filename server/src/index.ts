import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { excelService } from './excelService.js';
import { emailService } from './emailService.js';
import { apiRouter } from './routes/api.js';

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoints (for Render / monitoring)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mobileum-safefamily-backend', time: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mobileum-safefamily-backend', time: new Date().toISOString() });
});

// API Router
app.use('/api', apiRouter);

// Serve static frontend if client dist exists with an index.html
const possibleDistPaths = [
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'dist'),
];
const clientDist = possibleDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html')));
if (clientDist) {
  console.log(`[Startup] Serving compiled client UI from: ${clientDist}`);
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // Standalone API mode (e.g. Render backend with Vercel frontend)
  app.get('/', (_req, res) => {
    res.json({
      service: 'Mobileum SafeFamily Backend API',
      status: 'online',
      message: 'Backend is running and ready for frontend connections.',
      endpoints: {
        health: '/health',
        api: '/api',
        subscribers: '/api/subscribers',
        smtpStatus: '/api/smtp-status',
      },
    });
  });
}

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

async function startServer() {
  try {
    // 1. Initialize Excel database
    console.log('[Startup] Initializing Excel database...');
    await excelService.initialize();
    console.log(`[Startup] Excel database active at: ${excelService.getFilePath()}`);

    // 2. Check SMTP status
    const smtpStatus = emailService.getSmtpStatus();
    if (smtpStatus.configured) {
      console.log(`[Startup] SMTP is configured (${smtpStatus.host}:${smtpStatus.port}, user: ${smtpStatus.user})`);
    } else {
      console.log('[Startup] SMTP is not configured in .env. Simulator will run in safe demo mode (displaying "EMAIL NOT CONFIGURED").');
    }

    // 3. Listen
    app.listen(config.port, () => {
      console.log(`=======================================================`);
      console.log(`🚀 SafeFamily Child Spam Alert System Backend Running!`);
      console.log(`📡 Port: ${config.port}`);
      console.log(`📊 Excel Workbook: ${excelService.getFilePath()}`);
      console.log(`🌐 API Endpoint: http://localhost:${config.port}/api`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('[Startup Error] Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
