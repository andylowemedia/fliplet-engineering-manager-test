// Mock API to simulate fetching missing email data
async function fetchUserData(id) {
  // Simulate network latency with a small delay
  await new Promise(res => setTimeout(res, 10));
  return { email: `user${id}@email.com` };
}

/**
 * Process users:
 * - Enrich missing emails from an API (in parallel, with concurrency control)
 * - Deduplicate by email address (case-insensitive)
 * - Preserve original input order
 *
 * @param {Array} users       - Array of user objects
 * @param {number} concurrency - How many API requests to run in parallel
 * @returns {Promise<Array>}  - Deduplicated & enriched users
 */
async function processUsers(users, concurrency = 50) {
  // Set to track emails we've already kept (for deduplication)
  // Membership checks and inserts are O(1) operations
  const seenEmails = new Set();

  // Pre-allocate the output array to match the input size
  // This preserves the original order by placing users in the same index
  const results = new Array(users.length);

  // Shared counter that workers use to claim the next index to process
  let index = 0;

  /**
   * Worker function:
   * - Repeatedly claims the next user index
   * - Enriches missing email
   * - Checks for duplicate email
   * - Adds to results if unique
   */
  async function worker() {
    while (true) {
      // Claim the next index (atomic in single-threaded JS event loop)
      const i = index++;
      if (i >= users.length) break; // No more work

      let user = users[i];

      // If this user is missing an email, call the enrichment API
      if (!user.email) {
        try {
          const enriched = await fetchUserData(user.id);
          user.email = enriched.email;
        } catch (err) {
          console.error(`Failed to enrich user ${user.id}:`, err);
          continue; // Skip this user if we can't get an email
        }
      }

      // Deduplicate by lowercased email (case-insensitive match)
      // NOTE: This will treat ALICE@email.com and alice@email.com as the same
      const emailKey = user.email.toLowerCase();

      // Check if we've seen this email before
      if (!seenEmails.has(emailKey)) {
        // Mark this email as seen
        seenEmails.add(emailKey);
        // Place the user in the results array at the same index as input
        results[i] = user;
      }
      // If we *have* seen the email, do nothing (duplicate is skipped)
    }
  }

  // Create an array of worker promises
  // Each worker will process users until the shared counter is exhausted
  const workers = Array.from({ length: concurrency }, () => worker());

  // Wait for all workers to finish
  await Promise.all(workers);

  // Remove undefined slots from skipped duplicates and return
  return results.filter(Boolean);
}
