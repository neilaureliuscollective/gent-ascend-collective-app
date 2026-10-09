import { z } from 'zod';
export type Connection = {
  permissions: string[];
  id: string;
  person_id: string;
  company_id: string;
  status: 'pending' | 'active' | 'refreshing' | 'reconnect' | 'disconnected';
  remote_subject: string | null;
  provider_id: string | null;
  provider_name: string | null;
  timezone: string | null;
  grant_id: string | null;
  grant_expires_at: string | null;
  created_at: string;
  updated_at: string;
};
export const windowSchema = z
  .object({
    date: z.iso.date(),
    days: z.number().int().min(1).max(7),
    page: z.number().int().min(0).max(100).default(0),
  })
  .strict();
export const scheduleSchema = z
  .object({
    version: z.literal(1),
    source: z.literal('Legacy Reserve'),
    fetchedAt: z.iso.datetime(),
    providerId: z.string().min(1).max(80),
    timezone: z.string().min(1).max(100),
    date: z.iso.date(),
    days: z.number().int().min(1).max(7),
    page: z.number().int().min(0).max(100),
    hasMore: z.boolean(),
    appointments: z
      .array(
        z
          .object({
            id: z.string().max(200),
            starts_at: z.iso.datetime(),
            ends_at: z.iso.datetime(),
            status: z.string().max(30),
            service: z.string().max(200),
            location: z.string().max(200),
            timezone: z.string().max(100),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
export type Schedule = z.infer<typeof scheduleSchema>;
export const identitySchema = z
  .object({
    grantId: z.uuid(),
    subject: z.uuid(),
    providerId: z.string().min(1).max(80),
    providerName: z.string().max(100),
    timezone: z.string().max(100),
    expiresAt: z.iso.datetime({ offset: true }),
    permissions: z
      .array(z.enum(['bookings.read', 'website.read', 'website.propose']))
      .min(1)
      .max(3),
  })
  .strict();
export const tokensSchema = z.object({
  access_token: z.string().min(10).max(12000),
  refresh_token: z.string().min(10).max(4000),
  expires_in: z.number().int().positive().max(86400),
  token_type: z.string().refine((v) => v.toLowerCase() === 'bearer'),
});
export const credentialSchema = z
  .object({
    access: z.string().min(10).max(12000),
    refresh: z.string().min(10).max(4000),
    expires: z.number(),
    link: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();
export const askSchema = z
  .object({
    connectionId: z.uuid(),
    conversationId: z.uuid(),
    requestId: z.uuid(),
    text: z.string().trim().min(1).max(3000),
    window: windowSchema,
    consent: z.literal(true),
  })
  .strict();
