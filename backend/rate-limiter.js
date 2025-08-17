// Object to track requests for each tenant (key = tenant ID, value = { count, startTime })
const tenantRequests = {};

// Configuration constants
const REQUEST_LIMIT = 100;          // Max requests per tenant
const WINDOW_MS = 60 * 1000;        // Time window = 1 minute

function tenantRateLimiter(req, res, next) {
  // Get tenant ID from request headers
  const tenantId = req.headers["x-tenant-id"];

  // If no tenant ID is provided, reject the request
  if (!tenantId) {
    return res.status(400).json({ error: "Missing tenant ID" });
  }

  // Current time (used to check/reset request counts)
  const now = Date.now();

  // If this tenant has not made any requests in our tracking object yet
  if (!tenantRequests[tenantId]) {
    // Initialize their counter with 1 request and record the start time
    tenantRequests[tenantId] = { count: 1, startTime: now };

  } else {
    // Calculate time passed since the first request in the current window
    const elapsed = now - tenantRequests[tenantId].startTime;

    // If the time window has passed, reset their counter
    if (elapsed > WINDOW_MS) {
      tenantRequests[tenantId] = { count: 1, startTime: now };

    } else {
      // Otherwise, increment their request count
      tenantRequests[tenantId].count++;

      // If they’ve exceeded the request limit, block the request
      if (tenantRequests[tenantId].count > REQUEST_LIMIT) {
        return res.status(429).json({
          error: "Rate limit exceeded",
          limit: REQUEST_LIMIT,
          windowMs: WINDOW_MS
        });
      }
    }
  }

  // Clean up stale tenant records to prevent memory leaks
  // (removes tenants whose window has expired)
  for (const id in tenantRequests) {
    if (now - tenantRequests[id].startTime > WINDOW_MS) {
      delete tenantRequests[id];
    }
  }

  // Allow the request to continue to the next middleware/route
  next();
}

module.exports = tenantRateLimiter;