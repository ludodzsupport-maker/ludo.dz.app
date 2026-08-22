import { OmniRouteApiError, OmniRouteConfigError, validateOmniRouteConnection } from "./index";

try {
  const result = await validateOmniRouteConnection();

  console.info("OmniRoute validation succeeded", {
    baseUrl: result.baseUrl,
    modelCount: result.modelCount,
    sampleModelIds: result.sampleModelIds,
    chatCompletionId: result.chatCompletionId,
  });
} catch (error) {
  if (error instanceof OmniRouteConfigError) {
    console.error(`OmniRoute validation configuration error: ${error.message}`);
  } else if (error instanceof OmniRouteApiError) {
    console.error("OmniRoute validation request failed", {
      status: error.status,
      statusText: error.statusText,
      message: error.message,
    });
  } else if (error instanceof Error) {
    console.error(`OmniRoute validation failed: ${error.message}`);
  } else {
    console.error("OmniRoute validation failed with an unknown error.");
  }

  process.exitCode = 1;
}
