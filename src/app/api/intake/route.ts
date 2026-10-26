import { NextResponse } from "next/server";

/**
 * Multi-format intake: plain text, Markdown, DOCX and PDF are normalised into
 * one string so every check behaves identically regardless of source format.
 */
const TEXT_EXT = ["txt", "md", "markdown", "csv", "log"];

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 422 });
  }
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    let content = "";
    if (TEXT_EXT.includes(ext) || ext === "") {
      content = buf.toString("utf-8");
    } else if (ext === "docx") {
      const mammoth = (await import("mammoth")) as unknown as {
        extractRawText: (a: { buffer: Buffer }) => Promise<{ value: string }>;
      };
      const result = await mammoth.extractRawText({ buffer: buf });
      content = result.value;
    } else if (ext === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const result = await extractText(pdf, { mergePages: true });
      content = result.text ?? "";
    } else {
      return NextResponse.json(
        { error: `Unsupported file type ".${ext}". Use .txt, .md, .docx or .pdf.` },
        { status: 422 },
      );
    }

    content = content.replace(/\r\n/g, "\n").trim();
    if (!content) return NextResponse.json({ error: "No text could be extracted." }, { status: 422 });
    if (content.length > 200_000) {
      return NextResponse.json({ error: "Document is over 200k characters." }, { status: 422 });
    }
    return NextResponse.json({ content, chars: content.length, name: file.name });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not read "${file.name}": ${(err as Error).message}` },
      { status: 422 },
    );
  }
}
