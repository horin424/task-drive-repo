import { BlockBlobClient } from "@azure/storage-blob";
import {
  getOutputUploadSasUrl,
  type OutputUploadSasUrlRequest,
} from "@/lib/azureApi";

export interface UploadOutputOptions
  extends Pick<OutputUploadSasUrlRequest, "sessionId" | "purpose" | "fileName" | "blobName"> {
  data: File | Blob | string;
  contentType?: string;
  onProgress?: (progress: { transferredBytes: number; totalBytes?: number }) => void;
}

const isBlobLike = (value: unknown): value is Blob =>
  typeof Blob !== "undefined" && value instanceof Blob;

const isFileLike = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

const resolveContentType = (
  data: File | Blob | string,
  explicit?: string
): string | undefined => {
  if (explicit) return explicit;
  if (isFileLike(data) || isBlobLike(data)) {
    return data.type || "application/octet-stream";
  }
  return "text/plain";
};

export const uploadToAzure = async (
  options: UploadOutputOptions
): Promise<{ url: string; blobName: string }> => {
  const { data, contentType } = options;

  const sasInfo = await getOutputUploadSasUrl({
    sessionId: options.sessionId,
    purpose: options.purpose,
    fileName: options.fileName,
    blobName: options.blobName,
  });

  const blobClient = new BlockBlobClient(sasInfo.sasUrl);
  const payload =
    typeof data === "string"
      ? new Blob([data], { type: resolveContentType(data, contentType) })
      : data;

  await blobClient.uploadData(payload, {
    blobHTTPHeaders: {
      blobContentType: resolveContentType(data, contentType),
    },
    onProgress: options.onProgress
      ? (ev) => {
          const size =
            isBlobLike(data) || isFileLike(data) ? data.size : undefined;
          options.onProgress?.({
            transferredBytes: ev.loadedBytes,
            totalBytes: size,
          });
        }
      : undefined,
  });

  return {
    url: blobClient.url,
    blobName: sasInfo.blobName,
  };
};
