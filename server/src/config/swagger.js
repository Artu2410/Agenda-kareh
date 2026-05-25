import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Agenda Kareh API',
      version: '1.0.0',
      description: 'API for managing patient appointments, clinical histories, and medical billing',
      contact: {
        name: 'Kareh Support',
        email: 'support@kareh.com',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000/api',
        description: 'Development Server',
      },
      {
        url: 'https://api.kareh.com.ar/api',
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token for API authentication',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'authToken',
          description: 'Session cookie for authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['fail', 'error'],
            },
            message: {
              type: 'string',
            },
          },
          required: ['status', 'message'],
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            fullName: {
              type: 'string',
            },
            role: {
              type: 'string',
              enum: ['SUPER_USER', 'ADMIN', 'PROFESSIONAL'],
            },
            isActive: {
              type: 'boolean',
            },
          },
        },
        Appointment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            date: {
              type: 'string',
              format: 'date',
            },
            startTime: {
              type: 'string',
              format: 'time',
            },
            endTime: {
              type: 'string',
              format: 'time',
            },
            patientId: {
              type: 'string',
            },
            professionalId: {
              type: 'string',
            },
            status: {
              type: 'string',
              enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
      {
        cookieAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
