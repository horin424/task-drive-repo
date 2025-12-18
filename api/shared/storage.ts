import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || process.env.AZURE_STORAGE_ACCOUNT || '';
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || process.env.AZURE_STORAGE_KEY || '';

const INPUT_CONTAINER = process.env.AZURE_STORAGE_INPUT_CONTAINER || 'transcripts';
const OUTPUT_CONTAINER = process.env.AZURE_STORAGE_OUTPUT_CONTAINER || 'outputs';
const METADATA_CONTAINER = process.env.AZURE_STORAGE_METADATA_CONTAINER || 'metadata';

let blobServiceClient: BlobServiceClient | null = null;

export const getBlobServiceClient = (): BlobServiceClient => {
  if (blobServiceClient) return blobServiceClient;
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);
  return blobServiceClient;
};

export const getContainerClient = (containerName: string) => {
  return getBlobServiceClient().getContainerClient(containerName);
};

export const ensureContainers = async () => {
  const names = [INPUT_CONTAINER, OUTPUT_CONTAINER, METADATA_CONTAINER];
  for (const name of names) {
    await getContainerClient(name).createIfNotExists();
  }
};

export const putJson = async (container: string, blobName: string, data: any) => {
  const client = getContainerClient(container).getBlockBlobClient(blobName);
  const body = Buffer.from(JSON.stringify(data), 'utf-8');
  await client.upload(body, body.length, { blobHTTPHeaders: { blobContentType: 'application/json' } });
};

export const getJson = async <T = any>(container: string, blobName: string): Promise<T | null> => {
  const client = getContainerClient(container).getBlockBlobClient(blobName);
  const exists = await client.exists();
  if (!exists) return null;
  const res = await client.download();
  const buf = await streamToBuffer(res.readableStreamBody!);
  return JSON.parse(buf.toString('utf-8')) as T;
};

export const containers = {
  input: INPUT_CONTAINER,
  output: OUTPUT_CONTAINER,
  metadata: METADATA_CONTAINER,
};

async function streamToBuffer(readable: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readable.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

const PATH_SEGMENT_REGEX = /^[a-zA-Z0-9-_]+$/;

export const sanitizeFileName = (fileName?: string): string => {
  const trimmed = (fileName || "upload").trim().toLowerCase();
  const replaced = trimmed
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  if (replaced.length === 0) {
    return `file-${Date.now()}`;
  }
  return replaced.slice(0, 120);
};

export const normalizePathSegment = (segment: string, label: string): string => {
  if (!segment || !PATH_SEGMENT_REGEX.test(segment)) {
    throw new Error(`${label} contains invalid characters.`);
  }
  return segment;
};

export const buildPrivateBlobPath = (
  oid: string,
  sessionId: string,
  fileName?: string
): string => {
  const safeOid = normalizePathSegment(oid, 'oid');
  const safeSessionId = normalizePathSegment(sessionId, 'sessionId');
  const safeFileName = sanitizeFileName(fileName);
  return `private/${safeOid}/${safeSessionId}/${safeFileName}`;
};
