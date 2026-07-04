import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors({ 
  origin: 'http://localhost:5173', 
  credentials: true 
}));
app.use(express.json({ strict: false }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.log('[error] JSON parse error:', err.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next();
});

const JWT_SECRET = 'this-is-a-test-secret-for-local-development-123';

// Mock CSRF token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: 'mock-csrf-token-' + Date.now() });
});

// Mock auth verify (authenticated user)
app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.accessToken;
  
  if (!token) {
    return res.status(200).json({ valid: false });
  }

  try {
    jwt.verify(token, JWT_SECRET);
    return res.json({
      valid: true,
      user: {
        id: 'mock-user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
      },
    });
  } catch {
    return res.status(200).json({ valid: false });
  }
});

// Mock auth refresh
app.post('/api/auth/refresh', (req, res) => {
  const mockToken = jwt.sign(
    { sub: 'mock-user-1', email: 'test@example.com', role: 'ADMIN', sid: 'mock-session', type: 'access' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ success: true, accessToken: mockToken });
});

// Mock OTP endpoints for login flow
app.post('/api/auth/request-otp', (req, res) => {
  console.log('[auth] POST /api/auth/request-otp');
  res.json({ success: true, message: 'OTP sent' });
});

app.post('/api/auth/verify-otp', (req, res) => {
  console.log('[auth] POST /api/auth/verify-otp');
  const mockToken = jwt.sign(
    { sub: 'mock-user-1', email: 'test@example.com', role: 'ADMIN', sid: 'mock-session', type: 'access' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ 
    success: true, 
    accessToken: mockToken,
    refreshToken: 'mock-refresh-token',
    user: {
      id: 'mock-user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ADMIN',
    }
  });
});

// Mock metrics endpoint
app.get('/api/metrics', (req, res) => {
  console.log('[metrics] GET /api/metrics');
  console.log('[metrics] Query params:', req.query);
  console.log('[metrics] Headers:', req.headers);

  res.json({
    success: true,
    weekly: {
      total: 42,
      scheduled: 28,
      completed: 10,
      noShow: 4,
      resolved: 14,
      respiratory: 3,
      iu: 2,
      percentage: 23.8,
      attendanceRate: 71.4,
    },
    monthly: {
      current: 178,
      previous: 165,
      scheduled: 112,
      completed: 45,
      noShow: 21,
      resolved: 66,
      attendanceRate: 68.2,
      change: 7.9,
      changeLabel: '+7.9%',
      label: 'Julio 2026',
      insuranceBreakdown: [
        { name: 'PARTICULAR', count: 95 },
        { name: 'OBRA SOCIAL A', count: 55 },
        { name: 'OBRA SOCIAL B', count: 28 },
      ],
      respiratory: 12,
      iu: 8,
      capacityMonthly: 260,
      occupancyRate: 68.5,
      freeCapacity: 82,
    },
    commercial: {
      consultations: 0,
      turnsGranted: 0,
      assistances: 0,
      continuityCount: 0,
      abandonmentCount: 0,
      continuityRate: 0,
      conversions: {
        consultationsToTurns: 0,
        turnsToAssistances: 0,
        assistancesToContinuity: 0,
      },
      hasRealData: false,
    },
    billingByCoverage: [],
    insights: [
      'La ocupación del consultorio es del 68.5%.',
      'Aún existe capacidad para aproximadamente 82 turnos más este mes.',
    ],
    annual: {
      patientCount: 234,
      appointmentCount: 892,
      completedCount: 612,
      noShowCount: 145,
    },
    monthlyTrend: [
      {
        monthKey: '2026-05',
        month: 'MAY 26',
        label: 'Mayo 2026',
        appointmentCount: 165,
        completedCount: 112,
        noShowCount: 28,
        scheduledCount: 25,
        resolvedCount: 140,
        attendanceRate: 80,
        insuranceBreakdown: [{ name: 'PARTICULAR', count: 110 }],
      },
      {
        monthKey: '2026-06',
        month: 'JUN 26',
        label: 'Junio 2026',
        appointmentCount: 172,
        completedCount: 118,
        noShowCount: 32,
        scheduledCount: 22,
        resolvedCount: 150,
        attendanceRate: 78.7,
        insuranceBreakdown: [{ name: 'PARTICULAR', count: 115 }],
      },
      {
        monthKey: '2026-07',
        month: 'JUL 26',
        label: 'Julio 2026',
        appointmentCount: 178,
        completedCount: 122,
        noShowCount: 35,
        scheduledCount: 21,
        resolvedCount: 157,
        attendanceRate: 77.7,
        insuranceBreakdown: [{ name: 'PARTICULAR', count: 120 }],
      },
    ],
    futureAgenda: {
      farthestDate: '2026-12-15T10:00:00.000Z',
      farthestLabel: 'Lunes 15 de Diciembre 2026',
      appointmentCount: 456,
      patientCount: 89,
      activePatients: { total: 89, new: 12, recurrent: 77 },
      coverageByMonth: [
        { monthKey: '2026-07', month: 'JUL 26', label: 'Julio 2026', appointmentCount: 45, patientCount: 18 },
        { monthKey: '2026-08', month: 'AGO 26', label: 'Agosto 2026', appointmentCount: 52, patientCount: 21 },
      ],
    },
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Mock server running on http://localhost:${PORT}`);
  console.log('Ready to serve /api/csrf-token, /api/auth/verify, /api/auth/refresh, /api/metrics');
});
