import { GoogleAuth } from "google-auth-library";

export function createGoogleAuth(scopes: string[]): GoogleAuth {
  return new GoogleAuth({ scopes });
}
