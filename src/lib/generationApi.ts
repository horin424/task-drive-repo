import { azureConfig } from "@/azure-config";
import { callAzureApi } from "@/lib/azureApi";

interface GenerateContentsResponse {
  success: boolean;
  message?: string;
  sessionId?: string;
  error?: unknown;
}

export const generateContents = async (
  transcript: string,
  sessionId: string,
  processingTypes: string[],
  taskFileKey?: string,
  informationFileKey?: string
): Promise<GenerateContentsResponse> => {
  console.log("generateContents called with:", { sessionId, processingTypes }); // <--- DEBUG LOG

  if (
    !transcript ||
    !sessionId ||
    !processingTypes ||
    processingTypes.length === 0
  ) {
    console.error("Missing parameters in generateContents");
    return {
      success: false,
      message: "必須パラメータが不足しています。",
      error: "Missing parameters",
      sessionId,
    };
  }

  try {
    // Ensure the endpoint path is correct. It usually lacks /api prefix in config if baseUrl has it.
    // If your function is named 'generate-process-all', the route in index.ts is 'generate/process-all'
    const endpoint =
      azureConfig.functions.endpoints.processGeneration ||
      "/generate/process-all";

    const result = await callAzureApi(endpoint, {
      method: "POST",
      body: JSON.stringify({
        transcript,
        sessionId,
        processingTypes,
        taskFileKey,
        informationFileKey,
      }),
    });

    console.log("Generation API Success:", result); // <--- DEBUG LOG
    return {
      success: true,
      message: "Generation request accepted.",
      sessionId,
    };
  } catch (error) {
    console.error("Generation API Error:", error); // <--- DEBUG LOG
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Generation request failed.",
      error,
      sessionId,
    };
  }
};
