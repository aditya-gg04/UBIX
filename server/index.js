/**
 * UBIX Server Entry Point
 */
import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from './db/database.js';
import ingestionRoutes from './routes/ingestion.js';
import resolutionRoutes from './routes/resolution.js';
import reviewRoutes from './routes/review.js';
import activityRoutes from './routes/activity.js';
import queryRoutes from './routes/query.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files
app.use(express.static(join(__dirname, '..', 'public')));

// API routes
app.use('/api', ingestionRoutes);
app.use('/api', resolutionRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/query', queryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});

// Initialize database and start server
try {
  getDatabase();
  console.log('✅ Database initialized');
} catch (err) {
  console.error('❌ Database error:', err.message);
}

app.listen(PORT, () => {
  console.log(`\n🚀 UBIX Platform running at http://localhost:${PORT}\n`);
});

export default app;
