const ERROR_CODES = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  422: "UNPROCESSABLE_CONTENT",
  429: "RATE_LIMITED",
  500: "INTERNAL_SERVER_ERROR",
  502: "UPSTREAM_ERROR",
  503: "SERVICE_UNAVAILABLE"
};

export function withErrorStatus(data, status) {
  if (status < 400 || !data || typeof data !== "object" || Array.isArray(data)) return data;

  return { ...data, status, error_code: ERROR_CODES[status] || "REQUEST_FAILED" };
}
