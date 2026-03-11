export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Aletheia API',
    version: '2.0.0',
    description:
      'AI-powered LinkedIn outreach platform. Generates personalized connection requests, cold emails, and InMails with AI fingerprint removal and sanitization.',
    contact: {
      name: 'Aletheia Team',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current environment',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Extension', description: 'Chrome extension API endpoints' },
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Feedback', description: 'User feedback endpoints' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns service status. No authentication required.',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/extension/config': {
      get: {
        tags: ['Extension'],
        summary: 'Extension configuration',
        description:
          'Returns Supabase public credentials for the Chrome extension. CORS-validated.',
        responses: {
          '200': {
            description: 'Config returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    supabase_url: { type: 'string', example: 'https://xxx.supabase.co' },
                    supabase_anon_key: { type: 'string', example: 'eyJ...' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/extension/session': {
      get: {
        tags: ['Extension'],
        summary: 'Session bridge',
        description:
          'Validates web app session cookies and returns Bearer tokens for the Chrome extension.',
        parameters: [
          {
            name: 'X-Extension-Source',
            in: 'header',
            required: false,
            schema: { type: 'string', example: 'aletheia-extension' },
            description: 'Optional header to enable wildcard CORS origin',
          },
        ],
        responses: {
          '200': {
            description: 'Session tokens returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    access_token: { type: 'string' },
                    refresh_token: { type: 'string' },
                    expires_at: { type: 'number' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string', format: 'email' },
                        full_name: { type: 'string' },
                      },
                    },
                    supabase_url: { type: 'string' },
                    supabase_anon_key: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Not authenticated or session expired',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '403': {
            description: 'Origin not allowed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/extension/generate': {
      post: {
        tags: ['Extension'],
        summary: 'Generate outreach message',
        description:
          'Generates a personalized LinkedIn connection request, cold email, or InMail using Anthropic Claude. Rate-limited to 30 requests per user per 24 hours.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GenerateRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Message generated successfully',
            headers: {
              'X-RateLimit-Limit': {
                schema: { type: 'string' },
                description: 'Daily request limit (30)',
              },
              'X-RateLimit-Remaining': {
                schema: { type: 'string' },
                description: 'Remaining requests in window',
              },
              'X-RateLimit-Reset': {
                schema: { type: 'string' },
                description: 'Window reset timestamp (ms)',
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenerateResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string' },
                    details: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid Bearer token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '429': {
            description: 'Rate limit exceeded (30/day)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    message: { type: 'string' },
                    resetTime: { type: 'number' },
                  },
                },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      get: {
        tags: ['Extension'],
        summary: 'Generate endpoint health check',
        description: 'Authenticated health check to verify token validity and API connectivity.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Service healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    service: { type: 'string', example: 'Aletheia Extension API' },
                    version: { type: 'string', example: '2.0.0' },
                    endpoints: { type: 'object' },
                    status: { type: 'string', example: 'healthy' },
                    authenticated: { type: 'boolean' },
                    user: { type: 'string', format: 'email' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user info and usage',
        description:
          'Returns the authenticated user identity and daily usage stats. Supports Bearer token (extension) or cookie-based auth (web app).',
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        responses: {
          '200': {
            description: 'User info and usage returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    authenticated: { type: 'boolean', example: true },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string', format: 'email' },
                        full_name: { type: 'string' },
                      },
                    },
                    usage: {
                      type: 'object',
                      properties: {
                        count: { type: 'number', example: 12 },
                        limit: { type: 'number', example: 30 },
                        reset_time: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    authenticated: { type: 'boolean', example: false },
                  },
                },
              },
            },
          },
          '500': {
            description: 'Internal error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    authenticated: { type: 'boolean', example: false },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/feedback': {
      post: {
        tags: ['Feedback'],
        summary: 'Submit feedback',
        description:
          'Submit user feedback. Validated with Zod and protected by honeypot spam prevention. No authentication required.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FeedbackRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Feedback submitted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '500': {
            description: 'Failed to save',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase access token',
      },
      CookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'sb-access-token',
        description: 'Supabase session cookie (set by web app login)',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
        },
      },
      GenerateRequest: {
        type: 'object',
        required: ['profile', 'category'],
        properties: {
          profile: {
            type: 'object',
            required: ['name', 'profileUrl'],
            properties: {
              name: { type: 'string' },
              headline: { type: 'string', nullable: true },
              location: { type: 'string', nullable: true },
              about: { type: 'string', nullable: true },
              experiences: {
                type: 'array',
                nullable: true,
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    company: { type: 'string', nullable: true },
                  },
                },
              },
              recentPosts: { type: 'array', nullable: true, items: { type: 'string' } },
              skills: { type: 'array', nullable: true, items: { type: 'string' } },
              profileUrl: { type: 'string', format: 'uri' },
            },
          },
          resume: { type: 'string', nullable: true, default: '' },
          jd: { type: 'string', nullable: true, default: '' },
          category: {
            type: 'string',
            enum: ['linkedin_connection', 'cold_email', 'linkedin_inmail'],
          },
          intent: {
            type: 'string',
            enum: ['networking', 'referral', 'mentorship', 'job_inquiry'],
            nullable: true,
            default: 'networking',
          },
          acceptedExamples: {
            type: 'array',
            nullable: true,
            items: { type: 'string' },
            default: [],
          },
        },
      },
      GenerateResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          body: { type: 'string' },
          subject_line: { type: 'string', description: 'Present for cold_email and linkedin_inmail' },
          category: { type: 'string' },
          word_count: { type: 'number' },
          character_count: { type: 'number' },
          validation: {
            type: 'object',
            properties: {
              character_limit_passed: { type: 'boolean' },
              word_limit_passed: { type: 'boolean' },
              sanitization_applied: { type: 'boolean' },
              ai_patterns_detected: { type: 'boolean' },
              json_parsing_successful: { type: 'boolean' },
              truncated: { type: 'boolean' },
            },
          },
          usage: {
            type: 'object',
            properties: {
              input_tokens: { type: 'number' },
              output_tokens: { type: 'number' },
            },
          },
          processingTime: { type: 'number', description: 'Processing time in milliseconds' },
        },
      },
      FeedbackRequest: {
        type: 'object',
        required: ['name', 'email', 'message'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          email: { type: 'string', format: 'email', maxLength: 320 },
          message: { type: 'string', minLength: 10, maxLength: 5000 },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          honeypot: {
            type: 'string',
            maxLength: 0,
            description: 'Anti-spam field. Must be empty.',
          },
        },
      },
    },
  },
}
