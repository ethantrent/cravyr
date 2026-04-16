import { z } from 'zod';

export const SwipeBodySchema = z.object({
  restaurant_id: z.uuid(),
  direction: z.enum(['left', 'right', 'superlike']),
});
export type SwipeBody = z.infer<typeof SwipeBodySchema>;

export const SaveBodySchema = z.object({
  restaurant_id: z.uuid(),
  interaction_type: z.enum(['right', 'superlike']).optional().default('right'),
});
export type SaveBody = z.infer<typeof SaveBodySchema>;

export const RegisterPushTokenSchema = z.object({
  expo_push_token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});
export type RegisterPushTokenBody = z.infer<typeof RegisterPushTokenSchema>;

export const LatLngQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export type LatLngQuery = z.infer<typeof LatLngQuerySchema>;

export const UuidParamSchema = z.object({
  id: z.uuid(),
});
export type UuidParam = z.infer<typeof UuidParamSchema>;

export const PreferencesBodySchema = z.object({
  cuisines: z.array(z.string()).default([]),
  price_range: z.array(z.enum(['1', '2', '3', '4']).transform(Number) as unknown as z.ZodType<1 | 2 | 3 | 4>).default([]),
  max_distance_km: z.enum(['1', '5', '15']).transform(Number) as unknown as z.ZodType<1 | 5 | 15>,
});
export type PreferencesBody = z.infer<typeof PreferencesBodySchema>;

export const PhotoResolveQuerySchema = z.object({
  name: z.string().min(1).refine((v) => v.startsWith('places/'), {
    error: 'Photo name must start with "places/"',
  }),
  maxWidth: z.coerce.number().int().min(1).max(4800).optional().default(600),
});
export type PhotoResolveQuery = z.infer<typeof PhotoResolveQuerySchema>;
