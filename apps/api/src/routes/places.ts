import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { autocompletePlaces, getPlaceLocation } from '../services/places';
import { z } from 'zod';
import { validate } from '../middleware/validate';

export const placesRouter = Router();

placesRouter.use(requireAuth);

const AutocompleteQuerySchema = z.object({
  q: z.string().min(1),
});

/**
 * GET /api/v1/places/autocomplete?q=New+York
 */
placesRouter.get('/autocomplete', validate(AutocompleteQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { q } = res.locals.validated as { q: string };
  try {
    const results = await autocompletePlaces(q);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const GeocodeQuerySchema = z.object({
  placeId: z.string().min(1),
});

/**
 * GET /api/v1/places/geocode?placeId=XYZ
 */
placesRouter.get('/geocode', validate(GeocodeQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { placeId } = res.locals.validated as { placeId: string };
  try {
    const location = await getPlaceLocation(placeId);
    res.json(location);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
