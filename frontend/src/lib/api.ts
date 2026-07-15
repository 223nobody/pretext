import type {
  ApiResponse,
  ArxivArticle,
  TextExtractResult,
  UploadResult,
  UrlArticle,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code = "REQUEST_FAILED",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError("Server returned an unreadable response", "INVALID_RESPONSE", response.status);
  }
  if (!response.ok || !payload.success || !payload.data) {
    throw new ApiClientError(
      payload.error?.message ?? "Request failed",
      payload.error?.code ?? "REQUEST_FAILED",
      response.status,
    );
  }
  return payload.data;
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(input, init);
    return await readResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    throw new ApiClientError("Could not reach the Pretext Reader API", "NETWORK_ERROR");
  }
}

export async function uploadFile(file: File, maxChars = 500_000): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("options", JSON.stringify({ max_chars: maxChars }));

  return request<UploadResult>(`${API_URL}/file/upload`, {
    method: "POST",
    body: form,
  });
}

export async function extractText(text: string, maxChars = 500_000): Promise<TextExtractResult> {
  return request<TextExtractResult>(`${API_URL}/text/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, max_chars: maxChars }),
  });
}

export async function getArxiv(id: string): Promise<ArxivArticle> {
  return request<ArxivArticle>(`${API_URL}/arxiv/${encodeURIComponent(id)}`);
}

export async function fetchUrl(url: string): Promise<UrlArticle> {
  return request<UrlArticle>(`${API_URL}/url/fetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}
