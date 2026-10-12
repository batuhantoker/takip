import { z } from '@hono/zod-openapi';

export const Candle = z
  .object({
    time: z.number().int().openapi({ description: 'Bar open, epoch seconds.' }),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number().openapi({ description: '0 where Yahoo has none.' }),
  })
  .openapi('Candle');
export type Candle = z.infer<typeof Candle>;

export const PriceHistory = z
  .object({
    symbol: z.string(),
    range: z.string(),
    interval: z.string().openapi({ description: 'The bar size the range is served at, such as 5m or 1d.' }),
    currency: z.string(),
    candles: z.array(Candle).openapi({ description: 'Oldest first; bars missing a price are left out.' }),
  })
  .openapi('PriceHistory');

export const PriceHistoryError = z
  .object({ error: z.string(), candles: z.array(Candle).openapi({ description: 'Always empty.' }) })
  .openapi('PriceHistoryError');
