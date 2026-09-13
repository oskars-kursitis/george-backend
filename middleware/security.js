/**
 * The old build put an unauthenticated, un-throttled, `cors()`-wide-open image
 * generation endpoint on a public URL. Anyone who read the base URL out of the
 * APK could spend the OpenAI balance. These two middlewares are the minimum.
 */

/** Shared-secret header check. Set GEORGE_API_KEY in the environment. */
function requireApiKey(req, res, next) {
  const expected = process.env.GEORGE_API_KEY;

  // No key configured: allow, but make the hole visible rather than silent.
  if (!expected) {
    if (!requireApiKey._warned) {
      console.warn('[security] GEORGE_API_KEY is not set — endpoints are UNAUTHENTICATED.');
      requireApiKey._warned = true;
    }
    return next();
  }

  const presented = req.get('x-george-key');
  if (presented !== expected) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  return next();
}

/**
 * Fixed-window in-memory limiter. Good enough for one dyno and a prototype;
 * move to Redis the moment there is more than one instance.
 */
function rateLimit({ windowMs = 60_000, max = 20, name = 'default' } = {}) {
  const hits = new Map();

  return function limiter(req, res, next) {
    const now = Date.now();
    const key = `${name}:${req.get('x-george-key') || req.ip}`;
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: `Too many requests. Try again in ${retryAfter}s.`,
      });
    }

    // Opportunistic cleanup so the map cannot grow without bound.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return next();
  };
}

module.exports = { requireApiKey, rateLimit };
