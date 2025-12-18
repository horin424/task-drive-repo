import type { HttpRequest } from "@azure/functions";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const tenantId =
  process.env.AUTH_TENANT_ID ||
  process.env.NEXT_PUBLIC_TENANT ||
  process.env.AZURE_TENANT_ID ||
  "";
const explicitAuthority =
  process.env.AUTH_AUTHORITY || process.env.NEXT_PUBLIC_AUTHORITY || "";
const authorityHost =
  process.env.AUTH_AUTHORITY_HOST ||
  (explicitAuthority
    ? new URL(explicitAuthority).host
    : tenantId
    ? "login.microsoftonline.com"
    : "login.microsoftonline.com");

const authorityBase =
  explicitAuthority ||
  (tenantId
    ? `https://${authorityHost}/${tenantId}`
    : `https://${authorityHost}/common`);

const issuer =
  process.env.AUTH_ISSUER ||
  `${authorityBase.replace(/\/$/, "")}${
    authorityBase.endsWith("/v2.0") ? "" : "/v2.0"
  }`;

const jwksUri =
  process.env.AUTH_JWKS_URI ||
  `${authorityBase.replace(/\/$/, "")}/discovery/v2.0/keys`;

const rawAudience =
  process.env.AUTH_AUDIENCE ||
  process.env.API_APP_ID_URI ||
  (process.env.API_CLIENT_ID
    ? `api://${process.env.API_CLIENT_ID}`
    : process.env.NEXT_PUBLIC_API_CLIENT_ID
    ? `api://${process.env.NEXT_PUBLIC_API_CLIENT_ID}`
    : undefined);

if (!rawAudience) {
  throw new Error(
    "AUTH_AUDIENCE or API_CLIENT_ID must be configured for token validation."
  );
}

const expectedAudiences = rawAudience
  .split(",")
  .map((aud) => aud.trim())
  .filter(Boolean);

const requiredScopes =
  process.env.AUTH_REQUIRED_SCOPES?.split(",")
    .map((scope) => scope.trim())
    .filter(Boolean) || ["access_as_user"];

const jwks = createRemoteJWKSet(new URL(jwksUri));

export class AuthorizationError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export interface AuthenticatedUser {
  oid: string;
  tid?: string;
  subject: string;
  roles: string[];
  scopes: string[];
  upn?: string;
  name?: string;
}

const parseScopes = (payload: JWTPayload): string[] => {
  if (typeof payload.scp === "string") {
    return payload.scp.split(" ").filter(Boolean);
  }
  if (Array.isArray(payload.scp)) {
    return (payload.scp as string[]).filter(Boolean);
  }
  return [];
};

const parseRoles = (payload: JWTPayload): string[] => {
  if (Array.isArray(payload.roles)) {
    return (payload.roles as string[]).filter(Boolean);
  }
  return [];
};

export const authenticateRequest = async (
  request: HttpRequest
): Promise<AuthenticatedUser> => {
  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new AuthorizationError("Missing bearer token", 401);
  }

  const token = authHeader.slice(7).trim();
  let payload: JWTPayload;
  try {
    const verification = await jwtVerify(token, jwks, {
      issuer,
      audience: expectedAudiences,
      clockTolerance: 5,
    });
    payload = verification.payload;
  } catch (error) {
    throw new AuthorizationError("Invalid or expired access token", 401);
  }

  const oid = (payload.oid as string | undefined)?.trim();
  if (!oid) {
    throw new AuthorizationError("Access token missing oid claim", 403);
  }

  const scopes = parseScopes(payload);
  if (scopes.length > 0 && requiredScopes.length > 0) {
    const hasScope = requiredScopes.every((scope) => scopes.includes(scope));
    if (!hasScope) {
      throw new AuthorizationError("Insufficient scope", 403);
    }
  }

  const roles = parseRoles(payload);

  return {
    oid,
    tid: (payload.tid as string | undefined) ?? undefined,
    subject: payload.sub as string,
    roles,
    scopes,
    upn: (payload.preferred_username as string | undefined) ?? undefined,
    name: (payload.name as string | undefined) ?? undefined,
  };
};

export const userIsAdmin = (auth: AuthenticatedUser): boolean =>
  auth.roles.some((role) => role?.toLowerCase() === "admin");

