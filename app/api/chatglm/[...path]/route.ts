import { NextRequest, NextResponse } from "next/server";
import { auth, chatglmAuth } from "../../auth";
import { prettyObject } from "@/app/utils/format";
import { ChatGLM, ModelProvider } from "@/app/constant";

import { SignJWT } from "jose";
import { requestChatGLM } from "../../common";

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

// async function handle(
//   req: NextRequest,
//   { params }: { params: { path: string[] } },
// ) {
//   console.log("[Google Route] params ", params);

//   if (req.method === "OPTIONS") {
//     return NextResponse.json({ body: "OK" }, { status: 200 });
//   }

//   const controller = new AbortController();

//   const serverConfig = getServerSideConfig();

//   let baseUrl = CHATGLM_BASE_URL;

//   if (!baseUrl.startsWith("http")) {
//     baseUrl = `https://${baseUrl}`;
//   }

//   if (baseUrl.endsWith("/")) {
//     baseUrl = baseUrl.slice(0, -1);
//   }

//   let path = `${req.nextUrl.pathname}`.replaceAll("/api/chatglm/", "");

//   console.log("[Proxy] ", path);
//   console.log("[Base Url]", baseUrl);

//   const timeoutId = setTimeout(
//     () => {
//       controller.abort();
//     },
//     10 * 60 * 1000,
//   );

//   const authResult = auth(req, ModelProvider.GeminiPro);
//   if (authResult.error) {
//     return NextResponse.json(authResult, {
//       status: 401,
//     });
//   }

//   const Authorization = req.headers.get("Authorization") ?? "";
//   const token = Authorization.trim().replaceAll("Bearer ", "").trim();

//   const key = token ? token : '7eedf0ddd26280db27b9a3aeabd67b39.Sa8px3qwwa3GDYWd'; // serverConfig.googleApiKey;

//   if (!key) {
//     return NextResponse.json(
//       {
//         error: true,
//         message: `missing CHATGLM_API_KEY in server env vars`,
//       },
//       {
//         status: 401,
//       },
//     );
//   }

//   const JWT = await generateToken(key, 3600);

//   const fetchUrl = `${baseUrl}/${path}`;
//   const fetchOptions: RequestInit = {
//     headers: {
//       "Content-Type": "application/json",
//       "Cache-Control": "no-store",
//       "Authorization": JWT,
//     },
//     method: req.method,
//     body: req.body,
//     // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
//     redirect: "manual",
//     // @ts-ignore
//     duplex: "half",
//     signal: controller.signal,
//   };

//   // console.log("[req.body]", req.body);

//   try {
//     const res = await fetch(fetchUrl, fetchOptions);
//     // to prevent browser prompt for credentials
//     const newHeaders = new Headers(res.headers);
//     newHeaders.delete("www-authenticate");
//     // to disable nginx buffering
//     newHeaders.set("X-Accel-Buffering", "no");

//     return new Response(res.body, {
//       status: res.status,
//       statusText: res.statusText,
//       headers: newHeaders,
//     });
//   } finally {
//     clearTimeout(timeoutId);
//   }
// }

const ALLOWD_PATH = new Set(Object.values(ChatGLM));

async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[ChatGLM Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  if (!ALLOWD_PATH.has(subpath)) {
    console.log("[ChatGLM Route] forbidden path ", subpath);
    return NextResponse.json(
      {
        error: true,
        msg: "you are not allowed to request " + subpath,
      },
      {
        status: 403,
      },
    );
  }

  const authResult = await chatglmAuth(req, ModelProvider.GPT);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  try {
    const response = await requestChatGLM(req);

    return response;
  } catch (e) {
    console.error("[ChatGLM] ", e);
    return NextResponse.json(prettyObject(e));
  }
}

export const GET = handle;
export const POST = handle;

export const runtime = "edge";
export const preferredRegion = [
  "arn1",
  "bom1",
  "cdg1",
  "cle1",
  "cpt1",
  "dub1",
  "fra1",
  "gru1",
  "hnd1",
  "iad1",
  "icn1",
  "kix1",
  "lhr1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
];
