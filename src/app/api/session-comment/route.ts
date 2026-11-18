import { API_BASE_URL } from "@/src/config";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const contentType = req.headers.get("content-type") || "";

    let body: any;
    if (contentType.includes("application/json")) {
      const json = await req.json();
      const formData = new FormData();
      Object.entries(json).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          formData.append(key, String(val));
        }
      });
      body = formData;
    } else {
      body = await req.formData();
    }

    const cleanBase = API_BASE_URL.replace(/\/+$/, "");
    const backendRes = await fetch(`${cleanBase}/session-comment`, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "User-Agent": "PostmanRuntime/7.39.0",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body,
    });

    const resContentType = backendRes.headers.get("content-type") || "";
    let data;

    if (resContentType.includes("application/json")) {
      data = await backendRes.json();
    } else {
      const text = await backendRes.text();
      return NextResponse.json(
        { success: false, message: text },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(data, { status: backendRes.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to submit comment" },
      { status: 500 }
    );
  }
}
