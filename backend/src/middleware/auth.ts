import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
    };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET!) as {
            id: string;
            email: string;
            type?: string;
            iat: number
        };

        // Ensure this is an access token, not a refresh token
        if (verified.type === 'refresh') {
            return res.status(403).json({ error: 'Invalid token type' });
        }

        req.user = { id: verified.id, email: verified.email };
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
