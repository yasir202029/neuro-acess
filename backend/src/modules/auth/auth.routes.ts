import { Router } from 'express';
import { MfaChallengeType, MfaMethod } from '@prisma/client';
import { z } from 'zod';
import { audit } from '../../middleware/audit.js';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/http.js';
import { AuthService } from './auth.service.js';

const router = Router();
const service = new AuthService();
const password = z.string().min(12).max(128).regex(/[A-Z]/, 'Password must contain an uppercase letter').regex(/[a-z]/, 'Password must contain a lowercase letter').regex(/[0-9]/, 'Password must contain a number');
const meta = (req: { ip?: string; get(name: string): string | undefined }) => ({ ipAddress: req.ip, userAgent: req.get('user-agent'), deviceId: req.get('x-device-id') });

router.post('/register', asyncHandler(async (req, res) => { const body = z.object({ email: z.string().email(), password, firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), phone: z.string().max(30).optional() }).parse(req.body); res.status(201).json(await service.register(body, meta(req))); }));
router.post('/login', asyncHandler(async (req, res) => { const body = z.object({ email: z.string().email(), password: z.string().min(1), mfaCode: z.string().regex(/^\d{6}$/).optional(), mfaMethod: z.nativeEnum(MfaMethod).optional() }).parse(req.body); res.json(await service.login(body.email, body.password, body.mfaCode, body.mfaMethod, meta(req))); }));
router.post('/refresh', asyncHandler(async (req, res) => { const body = z.object({ refreshToken: z.string().min(1) }).parse(req.body); res.json(await service.refresh(body.refreshToken, meta(req))); }));
router.post('/logout', asyncHandler(async (req, res) => { const body = z.object({ refreshToken: z.string().min(1) }).parse(req.body); res.json(await service.logout(body.refreshToken)); }));
router.post('/logout-all', requireAuth, audit('AUTH_SESSIONS_REVOKED', 'User'), asyncHandler(async (req, res) => { res.json(await service.logoutAll(req.user!.id)); }));

router.post('/verification/request', asyncHandler(async (req, res) => { const body = z.object({ email: z.string().email() }).parse(req.body); res.json(await service.requestVerification(body.email)); }));
router.post('/verification/confirm', asyncHandler(async (req, res) => { const body = z.object({ token: z.string().min(32) }).parse(req.body); res.json(await service.verifyEmail(body.token)); }));
router.post('/password-reset/request', asyncHandler(async (req, res) => { const body = z.object({ email: z.string().email() }).parse(req.body); res.json(await service.requestPasswordReset(body.email)); }));
router.post('/password-reset/confirm', asyncHandler(async (req, res) => { const body = z.object({ token: z.string().min(32), password }).parse(req.body); res.json(await service.resetPassword(body.token, body.password)); }));

router.post('/mfa/totp/setup', requireAuth, asyncHandler(async (req, res) => { res.json(await service.beginTotp(req.user!.id)); }));
router.post('/mfa/totp/confirm', requireAuth, audit('MFA_TOTP_ENABLED', 'User'), asyncHandler(async (req, res) => { const body = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(req.body); res.json(await service.confirmTotp(req.user!.id, body.code)); }));
router.post('/mfa/email/request', requireAuth, asyncHandler(async (req, res) => { const body = z.object({ purpose: z.nativeEnum(MfaChallengeType).default(MfaChallengeType.EMAIL_ENROLLMENT) }).parse(req.body); res.json(await service.requestEmailMfa(req.user!.id, body.purpose, meta(req))); }));
router.post('/mfa/email/confirm', requireAuth, audit('MFA_EMAIL_ENABLED', 'User'), asyncHandler(async (req, res) => { const body = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(req.body); res.json(await service.confirmEmailMfa(req.user!.id, body.code, meta(req))); }));

router.get('/sessions', requireAuth, asyncHandler(async (req, res) => { res.json(await service.listSessions(req.user!.id)); }));
router.delete('/sessions/:sessionId', requireAuth, audit('AUTH_SESSION_REVOKED', 'UserSession'), asyncHandler(async (req, res) => { res.json(await service.revokeSession(req.user!.id, String(req.params.sessionId))); }));
router.get('/login-history', requireAuth, asyncHandler(async (req, res) => { res.json(await service.loginHistory(req.user!.id)); }));
router.get('/security-alerts', requireAuth, asyncHandler(async (req, res) => { res.json(await service.securityAlerts(req.user!.id)); }));

export default router;
