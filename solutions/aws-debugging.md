# AWS Debugging Task
## Problem
Error during Postgres upgrade.

## Resolution Plan
### Likely Causes
- **Unsupported extension version** — `some_extension v1.3` may not exist in Aurora PG14’s supported set.
- **Extension upgrade not performed on PG13** — you usually must `ALTER EXTENSION ... UPDATE` before a major version upgrade.
- **`shared_preload_libraries` mismatch** — PG14 cannot load an extension library that isn’t built for that version.
- **Extension in multiple DBs (including `template1`)** — upgrade fails if *any* DB has an incompatible extension.
- **AWS support changed** — some extensions exist in PG13 but are missing in PG14.

---

### Step-by-Step Debugging

#### 1. Inspect Installed Extensions (on PG13)
Check what’s installed in every DB (don’t forget `template1`):

```sql
SELECT current_database() AS db,
       extname,
       extversion
FROM pg_extension
ORDER BY 1, 2;
```

See available extension versions:

```sql
SELECT *
FROM pg_available_extension_versions
WHERE name = 'some_extension'
ORDER BY version;
```

---

#### 2. Verify PG14 Support
On a **test Aurora PG14 cluster** (or AWS docs):

```sql
SELECT *
FROM pg_available_extension_versions
WHERE name = 'some_extension'
ORDER BY version;
```

Compare output between PG13 and PG14.

---

#### 3. Fix on PG13 Before Upgrade
If PG14 requires a newer version:

```sql
-- upgrade step-by-step
ALTER EXTENSION some_extension UPDATE;

-- or target a specific version
ALTER EXTENSION some_extension UPDATE TO '1.4';
```

If extension is **not supported on PG14**:
- Inventory dependent objects:
  ```sql
  \dx+ some_extension
  ```
- Dump/backup relevant schema objects.
- Drop extension:
  ```sql
  DROP EXTENSION some_extension CASCADE;
  ```
- Recreate what you need post-upgrade (or use an alternative).

---

#### 4. Clean Up Parameter Groups
If your parameter group loads the extension:

```sql
-- In PG14 parameter group:
shared_preload_libraries = ''
```

Reboot the PG14 cluster after editing.  
Only re-add supported extensions later.

---

#### 5. Test the Upgrade (Minimal Downtime Approach)

Use **Aurora Blue/Green Deployments**:
1. Create **green environment** from PG13 (blue).
2. Apply **engine upgrade to PG14** to green.
3. Attach a **PG14 parameter group** with only supported preload libs.
4. Validate extensions on green:
   ```sql
   SELECT extname, extversion FROM pg_extension;
   ```
5. Run application smoke tests.
6. **Switchover** — DNS endpoints are swapped; downtime typically < 1 minute.

---

#### 6. Rollback Plan
- Blue environment is preserved.
- If issues arise, switch back to blue.

---

### Quick Reference Commands

List extensions:
```sql
\dx
```

List extensions with details:
```sql
\dx+ some_extension
```

Upgrade extension:
```sql
ALTER EXTENSION some_extension UPDATE;
```

Drop extension:
```sql
DROP EXTENSION some_extension CASCADE;
```

Check available versions:
```sql
SELECT * FROM pg_available_extension_versions WHERE name = 'some_extension';
```

---

### Summary
- Aurora PG upgrade failed because `some_extension v1.3` is not supported on PG14.
- Fix by upgrading/removing extensions **before upgrading the engine**.
- Use **Blue/Green Deployments** or logical replication for minimal downtime.
- Always validate extensions on a **test PG14 cluster** before production cutover.  
