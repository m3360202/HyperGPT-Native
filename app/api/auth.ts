import { NextRequest } from "next/server";
import { getServerSideConfig } from "../config/server";
import md5 from "spark-md5";
import { ACCESS_CODE_PREFIX, ModelProvider } from "../constant";
import { SignJWT } from "jose";

function getIP(req: NextRequest) {
  let ip = req.ip ?? req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? "";
  }

  return ip;
}

function parseApiKey(bearToken: string) {
  const token = bearToken.trim().replaceAll("Bearer ", "").trim();
  const isApiKey = !token.startsWith(ACCESS_CODE_PREFIX);

  return {
    accessCode: isApiKey ? "" : token.slice(ACCESS_CODE_PREFIX.length),
    apiKey: isApiKey ? token : "",
  };
}

export function auth(req: NextRequest, modelProvider: ModelProvider) {
  const authToken = req.headers.get("Authorization") ?? "";

  // check if it is openai api key or user token
  const { accessCode, apiKey } = parseApiKey(authToken);

  const hashedCode = md5.hash(accessCode ?? "").trim();

  const serverConfig = getServerSideConfig();
  console.log("[Auth] allowed hashed codes: ", [...serverConfig.codes]);
  console.log("[Auth] got access code:", accessCode);
  console.log("[Auth] hashed access code:", hashedCode);
  console.log("[User IP] ", getIP(req));
  console.log("[Time] ", new Date().toLocaleString());

  if (serverConfig.needCode && !serverConfig.codes.has(hashedCode) && !apiKey) {
    return {
      error: true,
      msg: !accessCode ? "empty access code" : "wrong access code",
    };
  }

  if (serverConfig.hideUserApiKey && !!apiKey) {
    return {
      error: true,
      msg: "you are not allowed to access with your own api key",
    };
  }

  // if user does not provide an api key, inject system api key
  if (!apiKey) {
    const serverConfig = getServerSideConfig();

    const systemApiKey =
      modelProvider === ModelProvider.GeminiPro
        ? serverConfig.googleApiKey
        : serverConfig.isAzure
        ? serverConfig.azureApiKey
        : serverConfig.apiKey;
    if (systemApiKey) {
      console.log("[Auth] use system api key");
      req.headers.set("Authorization", `Bearer ${systemApiKey}`);
    } else {
      console.log("[Auth] admin did not provide an api key");
    }
  } else {
    console.log("[Auth] use user api key");
  }

  return {
    error: false,
  };
}

export async function chatglmAuth(
  req: NextRequest,
  modelProvider: ModelProvider,
) {
  async function generateToken(
    apikey: string,
    expSeconds: number,
  ): Promise<string> {
    let [id, secret] = apikey.split(".");
    if (!id || !secret) {
      throw new Error("invalid apikey");
    }

    const payload = {
      api_key: id,
      exp: Math.round(Date.now() / 1000) + expSeconds,
      timestamp: Math.round(Date.now() / 1000),
    };

    // const secretJWK = await parseJwk({ kty: 'oct', k: secret, alg: 'HS256' }, 'HS256')
    const secretJWK = new TextEncoder().encode(secret);

    return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256", sign_type: "SIGN" })
      .sign(secretJWK);
  }

  const authToken = req.headers.get("Authorization") ?? "";

  console.log("[Auth] got chatglmAuth token: ", authToken);

  if (!authToken) {
    const token = await generateToken(
      "7eedf0ddd26280db27b9a3aeabd67b39.Sa8px3qwwa3GDYWd",
      3600,
    );
    req.headers.set("Authorization", token);
  }

  return {
    error: false,
  };
}
