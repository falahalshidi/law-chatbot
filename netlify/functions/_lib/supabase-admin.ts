import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const DOCUMENTS_BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET || "law-documents";
const DEFAULT_BUCKET_FILE_SIZE_LIMIT = Number(process.env.SUPABASE_DOCUMENTS_FILE_SIZE_LIMIT || 50 * 1024 * 1024);

export function getAdminSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export async function ensureDocumentsBucket() {
  const supabase = getAdminSupabase();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`Failed to list storage buckets: ${listError.message}`);
  }

  const exists = (buckets || []).some((bucket) => bucket.name === DOCUMENTS_BUCKET);
  if (!exists) {
    let { error: createError } = await supabase.storage.createBucket(DOCUMENTS_BUCKET, {
      public: false,
      fileSizeLimit: DEFAULT_BUCKET_FILE_SIZE_LIMIT,
    });

    if (
      createError &&
      (createError.message.toLowerCase().includes("maximum allowed size") ||
        createError.message.toLowerCase().includes("file size"))
    ) {
      const retry = await supabase.storage.createBucket(DOCUMENTS_BUCKET, {
        public: false,
      });
      createError = retry.error;
    }

    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      throw new Error(`Failed to create documents bucket: ${createError.message}`);
    }
  }
}
