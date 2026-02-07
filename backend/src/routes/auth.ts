import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { UAParser } from 'ua-parser-js';
import rateLimit from 'express-rate-limit';
import { getHtmlEmail } from '../lib/email';
import { prisma } from '../lib/prisma';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET!; // Validated in index.ts
const REFRESH_SECRET = process.env.JWT_SECRET! + '_refresh'; // Derived refresh secret
const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '7d'; // Long-lived refresh token

// Utility to hash tokens before storing in database
const hashToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

// Helper for production-safe error responses
const safeError = (error: unknown): { error: string } => {
    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
        return { error: `Server error: ${error.message}` };
    }
    return { error: 'Server error' };
};

// Strict Rate Limiter for Auth Routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: 'Too many login/register attempts from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});

// Email Transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Register
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
    });

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                verificationToken,
                verificationTokenExpiry,
                isVerified: false
            },
    });

        // Send Verification Email

        const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/verify?token=${verificationToken}`;

        const emailHtml = getHtmlEmail(
            'Verify your email address',
            `Hi ${name},<br><br>Thanks for getting started with FinTrack! We need to verify your email address to complete your registration.`,
            'Verify Email Address',
            verificationLink
        );

        const info = await transporter.sendMail({
            from: `"FinTrack" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Verify your email address',
            html: emailHtml,
    });


        res.status(201).json({
            message: 'User created. Please check your email to verify your account.',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
    });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json(safeError(error));
    }
});

// Login
router.post('/login', authLimiter, async (req, res) => {
    console.log('[LOGIN] Request received');
    try {
        const { email, password } = req.body;

        // Check user
        const user = await prisma.user.findUnique({
            where: { email },
    });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.isVerified) {
            return res.status(403).json({ error: 'Please verify your email first.' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Create access token (short-lived)
        const accessToken = jwt.sign(
            { id: user.id, email: user.email, type: 'access' },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        // Create refresh token (long-lived)
        const refreshToken = jwt.sign(
            { id: user.id, email: user.email, type: 'refresh' },
            REFRESH_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRY }
        );

        // Create Session
        const userAgent = req.headers['user-agent'] || '';
        const parser = new UAParser(userAgent);
        const result = parser.getResult();

        let deviceName = '';

        // 1. Try to get device model (e.g. "Apple iPhone", "Samsung SM-G991B")
        if (result.device.vendor && result.device.model) {
            deviceName = `${result.device.vendor} ${result.device.model}`;
        } else if (result.device.model) {
            deviceName = result.device.model;
        }

        // 2. Add OS (e.g. "Windows", "iOS", "Android") - remove version for simplicity if preferred, or keep major version
        if (result.os.name) {
            const osName = result.os.name; // e.g. "Windows", "Mac OS", "Android"
            deviceName = deviceName ? `${deviceName} - ${osName}` : osName;
        }

        // 3. Add Browser (e.g. "Chrome", "Safari", "Firefox")
        if (result.browser.name) {
            const browserName = result.browser.name;
            deviceName = deviceName ? `${deviceName} - ${browserName}` : browserName;
        }

        // Fallback
        if (!deviceName) {
            deviceName = 'Unknown Device';
        }

        const ip = req.ip || req.socket.remoteAddress || 'Unknown IP';

        // Store hashed refresh token in database (not the actual token)
        const hashedRefreshToken = hashToken(refreshToken);
        await prisma.session.create({
            data: {
                userId: user.id,
                token: hashedRefreshToken,
                device: deviceName,
                ip: String(ip)
            }
    });

        res.json({
            accessToken,
            refreshToken,
            expiresIn: 900, // 15 minutes in seconds
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
    });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Resend Verification Email
router.post('/resend-verification', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.user.update({
            where: { id: user.id },
            data: { verificationToken, verificationTokenExpiry }
    });

        const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/verify?token=${verificationToken}`;

        const emailHtml = getHtmlEmail(
            'Verify your email address',
            `Hi ${user.name},<br><br>You requested a new verification link. Click below to verify your email:<br><br>This link expires in 24 hours.`,
            'Verify Email Address',
            verificationLink
        );

        await transporter.sendMail({
            from: `"FinTrack" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Verify your email address',
            html: emailHtml,
    });

        res.json({ message: 'Verification email sent' });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Verify Email
router.get('/verify', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).send('Invalid token');
        }

        const user = await prisma.user.findFirst({
            where: { verificationToken: token },
    });

        if (!user) {
            return res.status(400).send('Invalid or expired verification link');
        }

        if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
            return res.status(400).send('Verification link has expired. Please request a new one.');
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verificationToken: null,
                verificationTokenExpiry: null,
            },
    });

        // Return a simple success page
        res.send(`
            <html>
                <head>
                    <title>Email Verified</title>
                    <style>
                        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f4f4f4; }
                        .container { text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        h1 { color: #10b981; }
                        p { color: #4b5563; margin-bottom: 20px; }
                        a { background-color: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Email Verified!</h1>
                        <p>Your email has been successfully verified. You can now log in to FinTrack.</p>
                        <a href="${process.env.FRONTEND_URL || '/'}">Go to Login</a>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).send('Server error');
    }
});

// Get User
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user?.id },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
            },
    });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update User
router.put('/me', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const user = await prisma.user.update({
            where: { id: req.user?.id },
            data: { name },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
            },
    });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout (Current Session) - requires refresh token to identify session
router.post('/logout', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
        const hashedToken = hashToken(refreshToken);
        await prisma.session.deleteMany({
            where: { token: hashedToken }
    });
        }

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Active Sessions
router.get('/sessions', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { currentRefreshToken } = req.query;

        const sessions = await prisma.session.findMany({
            where: { userId: req.user!.id },
            orderBy: { lastActive: 'desc' },
            select: {
                id: true,
                device: true,
                ip: true,
                lastActive: true,
                createdAt: true,
                token: true // For comparison only
            }
    });

        // Mark current session by comparing hashed refresh token
        const currentHashedToken = currentRefreshToken ? hashToken(currentRefreshToken as string) : null;

        const sessionsWithCurrent = sessions.map(s => ({
            id: s.id,
            device: s.device,
            ip: s.ip,
            lastActive: s.lastActive,
            createdAt: s.createdAt,
            isCurrent: currentHashedToken ? s.token === currentHashedToken : false
        }));

        res.json(sessionsWithCurrent);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Revoke All Other Sessions
router.delete('/sessions/others', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { password } = req.body;
        const userId = req.user!.id;
        const authHeader = req.headers['authorization'];
        const currentToken = authHeader && authHeader.split(' ')[1];

        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }

        // Verify password
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        if (currentToken) {
        await prisma.session.deleteMany({
                where: {
                    userId,
                    token: { not: currentToken }
                }
    });
        }

        res.json({ message: 'All other sessions revoked' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Revoke Session
router.delete('/sessions/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const sessionId = req.params.id;
        const userId = req.user!.id;

        // Ensure session belongs to user
        const session = await prisma.session.findFirst({
            where: { id: sessionId, userId }
    });

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        await prisma.session.delete({
            where: { id: sessionId }
    });

        res.json({ message: 'Session revoked' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete Account
router.delete('/delete-account', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id;

        // Manually delete transactions first to avoid FK constraint issues with Accounts
        await prisma.transaction.deleteMany({
            where: { userId },
    });

        // Delete user (Cascade will handle Sessions, Accounts, Snapshots)
        await prisma.user.delete({
            where: { id: userId },
    });

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Reset User Data
router.post('/reset-data', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id;

        // Use transaction to ensure all or nothing
        await prisma.$transaction(async (tx) => {
            // 1. Delete all transactions (cascades to splits)
            await tx.transaction.deleteMany({
                where: { userId },
    });

            // 2. Delete all accounts
            await tx.account.deleteMany({
                where: { userId },
    });

            // 3. Delete all categories (optional, but cleaner for full reset)
            await tx.category.deleteMany({
                where: { userId },
    });

            // 4. Delete snapshots
            await tx.netWorthSnapshot.deleteMany({
                where: { userId }
    });
    });

        res.json({ message: 'All data reset successfully' });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Forgot Password
router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        // For security, don't reveal if user exists
        if (!user) {
            return res.json({ message: 'If an account exists with this email, you will receive a reset link.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpiry }
    });

        const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

        const emailHtml = getHtmlEmail(
            'Password Reset Request',
            `Hi ${user.name},<br><br>You requested to reset your password. Click the button below to set a new password:<br><br>This link will expire in 1 hour.`,
            'Reset Password',
            resetLink
        );

        await transporter.sendMail({
            from: `"FinTrack" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Password Reset Request',
            html: emailHtml,
    });

        res.json({ message: 'If an account exists with this email, you will receive a reset link.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Reset Password
router.post('/reset-password', authLimiter, async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password are required' });
        }

        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: { gt: new Date() }
            }
    });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
    });

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Refresh Token - Get new access token using refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
            }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { id: string; email: string; type: string };
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
            }

        if (decoded.type !== 'refresh') {
            return res.status(401).json({ error: 'Invalid token type' });
            }

        // Check if session exists in database
        const hashedToken = hashToken(refreshToken);
        const session = await prisma.session.findUnique({
            where: { token: hashedToken }
    });

        if (!session) {
            return res.status(401).json({ error: 'Session expired or revoked' });
            }

        // Check if user still exists
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true }
    });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
            }

        // Update session last active
        await prisma.session.update({
            where: { id: session.id },
            data: { lastActive: new Date() }
    });

        // Generate new access token
        const accessToken = jwt.sign(
            { id: user.id, email: user.email, type: 'access' },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
            );

        res.json({
            accessToken,
            expiresIn: 900 // 15 minutes in seconds
    });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: 'Server error' });
        }
    });

export default router;
