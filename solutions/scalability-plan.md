# Scalability Plan for Image Processing
## Challenge
Handling 10M+ images per day.

## Solution
### High-level architecture
Core idea: Keep the heavy lifting in S3 + Lambda, fan out with Step Functions/SQS, and push everything through CloudFront so 90%+ of requests never touch your origin.
1. Ingress / Uploads (UGC or batch)
   - Clients request pre-signed S3 URLs (or POST policies) via a tiny API (API Gateway + Lambda).
   - Multipart upload to S3 (5–15 MB parts, per-part retries). This is resilient on poor networks.
   - Originals land in s3://images-originals/{tenant}/{date}/{uuid} with S3 Object Lock optional.
2. Processing pipeline (serverless, elastic)
   - S3 EventBridge rule → SQS (decoupling & retry) → Step Functions (Express) orchestrates:
     - Validate image (magic bytes, size, EXIF).
     - Metadata extraction (Lambda + exiftool/libvips; write to DynamoDB {imageId, width, height, mime, tenant, createdAt}).
     - Derivatives fan-out (Map state):
       - Generate the top N sizes (e.g., 256, 512, 1024, 1600) and formats (WebP/AVIF + JPEG fallback) using Lambda + Sharp/libvips (via Lambda Layer).
       - Store to s3://images-derivatives/{imageId}/{w}x{h}.{ext}.
   - For bulk backfills, use S3 Batch Operations to invoke the same Lambda on millions of keys without hot-looping Step Functions.
3. Delivery
   - CloudFront in front of images-derivatives (primary origin) with Origin Access Control (OAC) to lock down S3.
   - Origin Group failover to a replica bucket (S3 CRR) in a 2nd region.
   - Cache key & policies:
     - Vary on Accept (WebP/AVIF), Width, DPR, Save-Data (client hints).
     - Set Accept-CH: DPR, Width, Save-Data to enable hints on modern browsers.
     - Long max-age + stale-while-revalidate.
   - Lambda@Edge / CloudFront Functions:
     - URL normalization (e.g., /img/{id}?w=800&fmt=auto → deterministic object key).
     - Lightweight JWT check for private images (signed cookies/URLs).
   - If a requested variant doesn’t exist (rare): on-miss generate via an origin request Lambda that produces and writes the variant to S3, then returns it (warm cache on the way).
4. Observability & ops
   - CloudFront logs → S3 → Athena for hit ratio, top keys, and 5xx.
   - CloudWatch metrics/alarms for Lambda errors, SQS DLQ depth, Step Functions failures, CloudFront 5xx spikes.
   - AWS WAF for hotlinking & abuse; signed URLs where needed.

### Why this scales

- SQS + Step Functions lets you process thousands of images/second with backpressure and retries.
- Lambda concurrency scales automatically; use reserved concurrency per tenant to isolate noisy neighbors.
- CloudFront offloads the lion’s share of traffic (regional edge + tiered caching) so S3 reads and Lambda@Edge invocations stay modest even at 10M+/day.