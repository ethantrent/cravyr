import type { Request, Response, NextFunction } from 'express';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Structural type so we do not depend on importing `zod` types from a different copy than `@cravyr/shared`.
 * Zod 4 issue shapes use `PropertyKey[]` paths — we only read `path` and `message` at runtime.
 */
type ParseableSchema = {
  safeParse: (data: unknown) => unknown;
};

/**
 * Express 5 made req.query a read-only getter, so we can no longer overwrite it.
 * Validated/coerced data is stored in res.locals.validated for route handlers.
 * For body/params (still writable), we also update req[target] for backward compat.
 */
export function validate(schema: ParseableSchema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]) as {
      success: boolean;
      data?: unknown;
      error?: { issues: Array<{ path: PropertyKey[]; message: string }> };
    };
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        issues: (result.error?.issues ?? []).map((i) => ({
          path: i.path.map(String).join('.'),
          message: i.message,
        })),
      });
      return;
    }
    // Store validated data where route handlers can access it
    res.locals.validated = result.data;
    // For body/params, also update req[target] for backward compat
    if (target !== 'query') {
      (req as Record<string, unknown>)[target] = result.data;
    }
    next();
  };
}
