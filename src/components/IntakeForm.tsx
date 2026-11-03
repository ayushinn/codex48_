"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { analysePixels } from "@/lib/engine/visual";
import { BRAND_PALETTE } from "@/lib/visual-config";

type ChannelOption = { key: string; name: string; maxChars: number | null; minWords: number | null };
type ImageMeta = {
  id: string;
  name: string;
  alt?: string;
  /** \"photo\" (default when absent) or \"logo\" — logos add variant + clear-space rules. */
  kind?: "photo" | "logo";
  palette?: string[];
  /** Mark-vs-background WCAG ratio for logos, tonal spread for photos; null when unmeasurable. */
  contrastRatio?: number | null;
  photoContrastRatio?: number | null;
  logoContrastRatio?: number | null;
  /** 0..1 share of sampled pixels off-palette. */
  offPaletteShare?: number;
  /** 0..1 clear space around the logo content box, fraction of logo height. */
  clearSpaceRatio?: number;
  /** Width in pixels. */
  width?: number;
  /** Height in pixels. */
  height?: number;
  /** Aspect ratio (width / height) when kind === \"logo\" .*/
  aspectRatio?: number;
};

const SAMPLE = `AURORA CALM is here!!! Meet the #1 miracle ritual your mornings have been begging for.

Our clinically proven formula guarantees results in 7 days - act now, limited time only! 94% of participants reported feeling more relaxed within 14 days.

![image](spring-ritual-hero.jpg)

[click here](https://aurorawellness.com/shop) to shop. Ships in 24 hours, anywhere in the world.

#AuroraCalm #wellness #morning #selfcare #mindfulness #ritual`;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function analyseImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not a supported image.`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} is over the 10 MB image limit.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name} could not be decoded. Try a valid PNG, JPEG, WebP or GIF image.`);
  }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) {
      throw new Error(`${file.name} has invalid or oversized dimensions.`);
    }
    const scale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Image analysis is unavailable in this browser.");
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    let hasVisiblePixels = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] >= 200) {
        hasVisiblePixels = true;
        break;
      }
    }
    if (!hasVisiblePixels) throw new Error(`${file.name} is fully transparent or has no visible pixels.`);
    const analysis = analysePixels(data, width, height, BRAND_PALETTE);
    return {
      palette: analysis.palette,
      photoContrastRatio: analysis.contrastRatio,
      logoContrastRatio: analysis.markContrastRatio,
      offPaletteShare: analysis.offPaletteShare,
      clearSpaceRatio: analysis.clearSpaceRatio,
      width: analysis.width,
      height: analysis.height,
      aspectRatio: analysis.aspectRatio,
    };
  } finally {
    bitmap.close();
  }
}

export function IntakeForm({ channels }: { channels: ChannelOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [channelKey, setChannelKey] = useState(channels[0]?.key ?? "social");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<ImageMeta[]>([]);
  const [imageKind, setImageKind] = useState<"photo" | "logo">("photo");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const channel = channels.find((c) => c.key === channelKey);
  const overLimit = channel?.maxChars ? content.length > channel.maxChars : false;

  async function uploadDocument(file: File) {
    setBusy("parse");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/intake", { method: "POST", body: form });
      const responseText = await res.text();
      let json: { content?: string; error?: string } = {};
      try {
        json = responseText ? JSON.parse(responseText) as typeof json : {};
      } catch {
        // Hosting platforms may return an HTML 413 page before the route runs.
      }
      if (!res.ok) throw new Error(json.error ?? `Upload failed (HTTP ${res.status}). Documents must be under 4 MB.`);
      if (!json.content) throw new Error("No text could be extracted from the selected document.");
      const extracted = json.content;
      setContent((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${extracted}` : extracted));
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return;
    setBusy("images");
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const metadata = await analyseImage(file);
        const id = crypto.randomUUID();
        setImages((prev) => [
          ...prev,
          { id, name: file.name, alt: "", kind: imageKind, ...metadata,
            contrastRatio: imageKind === "logo" ? metadata.logoContrastRatio : metadata.photoContrastRatio },
        ]);
        setContent((prev) => `${prev.trimEnd()}\n\n![](${file.name})`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
      if (imageRef.current) imageRef.current.value = "";
    }
  }

  async function submit() {
    setBusy("submit");
    setError(null);
    try {
      const finalContent = images.reduce(
        (acc, img) => ( (img.alt ?? "").trim() ? acc.replace(`![](${img.name})`, `![${(img.alt ?? "").trim()}](${img.name})`) : acc),
        content,
      );
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || finalContent.split("\n")[0].slice(0, 60) || "Untitled draft",
          channelKey,
          contentType: channel?.name ?? "Content",
          content: finalContent,
          images: images.map((i) => ({
            id: i.id,
            name: i.name,
            alt: i.alt,
            palette: i.palette,
            kind: i.kind,
            contrastRatio: i.contrastRatio,
            photoContrastRatio: i.photoContrastRatio,
            logoContrastRatio: i.logoContrastRatio,
            offPaletteShare: i.offPaletteShare,
            clearSpaceRatio: i.clearSpaceRatio,
            width: i.width,
            height: i.height,
            aspectRatio: i.aspectRatio,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create the review");
      router.push(`/reviews/${json.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-line bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Spring campaign - Instagram caption"
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Channel</span>
          <select
            value={channelKey}
            onChange={(e) => setChannelKey(e.target.value)}
            className="w-full rounded-md border border-line bg-white px-3 py-2"
          >
            {channels.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
                {c.maxChars ? ` · max ${c.maxChars} chars` : ""}
                {c.minWords ? ` · min ${c.minWords} words` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Content</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={14}
          placeholder={"Paste your draft here, or upload a file.\n\nMarkdown images (![alt](file.jpg)) and links ([text](url)) are checked too."}
          className="w-full rounded-md border border-line px-3 py-2 font-mono text-[13px] leading-relaxed"
        />
        <span className="mt-1 flex justify-between text-xs text-slate-500">
          <span>{content.length} characters</span>
          {channel?.maxChars && (
            <span className={overLimit ? "font-semibold text-red-600" : ""}>
              {channel.name} limit {channel.maxChars}
            </span>
          )}
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Image type
          <select value={imageKind} onChange={(e) => setImageKind(e.target.value as "photo" | "logo")} className="rounded-md border border-line bg-white px-2 py-2">
            <option value="photo">Photo / graphic</option>
            <option value="logo">Logo</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="rounded-md border border-line px-3 py-2 text-sm hover:border-slate-400 disabled:opacity-50"
        >
          {busy === "parse" ? "Reading file…" : "Upload .txt / .md / .docx / .pdf"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.markdown,.docx,.pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0])}
        />
        <button
          type="button"
          onClick={() => imageRef.current?.click()}
          disabled={busy !== null}
          className="rounded-md border border-line px-3 py-2 text-sm hover:border-slate-400 disabled:opacity-50"
        >
          {busy === "images" ? "Analysing image…" : "Attach image (brand and contrast checks)"}
        </button>
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => uploadImages(e.target.files)}
        />
        <button
          type="button"
          onClick={() => {
            setContent(SAMPLE);
            setTitle("Spring campaign - Instagram caption");
            setChannelKey("social");
          }}
          className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-slate-400"
        >
          Load a draft with planted violations
        </button>
      </div>

      {images.length > 0 && (
        <div className="space-y-3 rounded-md border border-line bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Attached images · analysed in your browser (palette {images[0]?.palette?.join(" ") ?? "not available"} · only
            metadata is stored)
          </p>
          {images.map((img) => (
            <div key={img.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-mono text-xs">{img.name}</span>
              <span className="rounded bg-white px-1.5 py-0.5 text-xs">
                contrast {typeof img.contrastRatio === "number" ? `${img.contrastRatio.toFixed(2)}:1` : "not measurable"}
              </span>
              <span className="flex gap-1">
                {img.palette && img.palette.length > 0 ? (
                  img.palette.map((c) => (
                    <span
                      key={c}
                      title={c}
                      className="inline-block h-4 w-4 rounded border border-line"
                      style={{ background: c }}
                    />
                  ))
                ) : null}
              </span>
              <input
                value={(img.alt ?? "")}
                onChange={(e) =>
                  setImages((prev) =>
                    prev.map((p) => (p.id === img.id ? { ...p, alt: e.target.value } : p)),
                  )
                }
                placeholder="Alt text (24+ characters, describe the image)"
                className="min-w-64 flex-1 rounded border border-line px-2 py-1 text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-line pt-4">
        <p className="text-xs text-slate-500">
          Running preflight is disclosed in-product. Nothing is published and nothing is changed
          without your accept.
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={busy !== null || content.trim().length === 0}
          className="rounded-md bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {busy === "submit" ? "Running preflight…" : "Run preflight →"}
        </button>
      </div>
    </div>
  );
}
