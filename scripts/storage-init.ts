/**
 * Prepare the bucket: create it if missing (local MinIO) and allow browser uploads from APP_URL.
 *
 *   npm run storage:init
 *
 * Safe to run on every deploy.
 */
import "dotenv/config";
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import { s3 } from "@/lib/storage";

async function main() {
  const { S3_BUCKET, APP_URL } = env();
  const client = s3();

  try {
    await client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`Created bucket ${S3_BUCKET}`);
  }

  const origins = [new URL(APP_URL).origin];
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: S3_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: origins,
              AllowedMethods: ["POST", "PUT", "GET", "HEAD"],
              AllowedHeaders: ["*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      }),
    );
    console.log(`Bucket CORS allows ${origins.join(", ")}`);
  } catch (err) {
    // MinIO doesn't implement bucket CORS (it allows all origins by default).
    const name = (err as { name?: string }).name;
    if (name === "NotImplemented") console.log("Bucket CORS not supported by this store; skipping");
    else throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
