import { API_BASE_URL } from "@/src/config";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const authHeader = req.headers.get("authorization");

    const backendUrl = `${API_BASE_URL}store-session-recording`;

    const backendRes = await fetch(backendUrl, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "User-Agent": "PostmanRuntime/7.39.0",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: formData,
    });

    const contentType = backendRes.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
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
      { success: false, message: error?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
