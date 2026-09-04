import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const zipPath = path.join(process.cwd(), "public", "arjuna-sarthi-dist.zip");
    
    if (!fs.existsSync(zipPath)) {
      return NextResponse.json(
        { error: "Extension package not found on server" },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(zipPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="arjuna-sarthi-dist.zip"',
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to download extension package", details: err?.message },
      { status: 500 }
    );
  }
}
