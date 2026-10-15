import type { RequestHandler } from 'express';
import type { z } from 'zod';

type ParsedRequest<T extends z.ZodType> = { body: unknown; params: Record<string, string>; query: Record<string, string> };

export const validate = (schema: z.ZodType): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
  if (!result.success) return next(result.error);
  const data = result.data as unknown as { body: unknown; params: unknown; query: unknown };
  req.body = data.body;
  req.params = data.params as Record<string, string>;
  req.query = data.query as Record<string, string>;
  next();
};
