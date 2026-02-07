import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import transactionRoutes from './routes/transactions';
import priceRoutes from './routes/price';
import analyticsRoutes from './routes/analytics';
import categoryRoutes from './routes/categories';

dotenv.config();

import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const execAsync = promisify(exec);

// Strict Env Validation
const requiredEnv = ['JWT_SECRET', 'DATABASE_URL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const missingEnv = requiredEnv.filter(env => !process.env[env]);

if (missingEnv.length > 0) {
    console.error(`CRITICAL: Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.set('trust proxy', 1); // Trust first proxy (CapRover/Nginx)
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Restrict to frontend domain if set
    credentials: true
}));
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Serve static files from the React frontend app
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../public')));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/price', priceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/categories', categoryRoutes);
import userDataRoutes from './routes/user_data';
app.use('/api/user', userDataRoutes);

app.get('/api/health', (req, res) => {
    res.send('FinTrack Backend is running');
});

// Anything that doesn't match the above, send back index.html
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    });
}

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Global Error Handler:', err.stack || err);
    res.status(500).json({ error: 'Something went wrong!' });
});

async function deploySchema() {
    console.log('Deploying database schema...');
    try {
        // Run prisma db push without --accept-data-loss to ensure safety
        const { stdout, stderr } = await execAsync('npx prisma db push');
        if (stdout) console.log(`Prisma Output: ${stdout}`);
        if (stderr) console.error(`Prisma Warning/Error: ${stderr}`);
        console.log('Database schema deployed successfully.');
    } catch (error) {
        console.error('Failed to deploy database schema:', error);
        console.error('IMPORTANT: Please run "npx prisma db push" manually to ensure your database is up to date.');
        // We do not exit the process, allowing the app to start even if DB push fails (e.g. if DB is unreachable temporarily)
        // However, if schema is out of sync, runtime errors might occur.
    }
}

import { initCronJobs } from './services/cron';

deploySchema().then(() => {
    initCronJobs();
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});
