"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ChannelOption = { key: string; name: string; maxChars: number | null; minWords: number | null };
type ImageMeta = { id: string; name: string; alt: string; palette: string[]; contrastRatio?: number };

const SAMPLE = `AURORA CALM is here!!! Meet the #1 miracle ritual your mornings have been begging for.

Our clinically proven formula guarantees results in 7 days - act now, limited time only! 94% of participants reported feeling more relaxed within 14 days.

![image](spring-ritual-hero.jpg)

[click here](https://aurorawellness.com/shop) to shop. Ships in 24 hours, anywhere in the world.

#AuroraCalm #wellness #morning #selfcare #mindfulness #ritual`;

function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * IMP-1 (Round 2 state): alt text is checked from the draft, and each attached
 * image is analysed in the browser for its dominant palette and the contrast
 * between its dominant light and dark tones. Only this metadata leaves the
 * browser - the image itself is never uploaded.
 */
async function analyseImage(file: File): Promise<{ palette: string[]; contrastRatio: number }> {
  const bitmap = await createImageBitmap(file);
  const width = Math.min(160, bitmap.width);
  const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * width));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  let lightSum = 0;
  let lightN = 0;
  let darkSum = 0;
  let darkN = 0;
  const total = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 200) continue;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n++;
    buckets.set(key, bucket);

    const lum = relativeLuminance(r, g, b);
    if (lum > 0.4) {
      lightSum += lum;
      lightN++;
    } else {
      darkSum += lum;
      darkN++;
    }
  }

  const palette = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((b) => {
      const r = Math.round(b.r / b.n);
      const g = Math.round(b.g / b.n);
      const bl = Math.round(b.b / b.n);
      return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    });

  const lightAvg = lightN > total * 0.02 ? lightSum / lightN : null;
  const darkAvg = darkN > total * 0.02 ? darkSum / darkN : null;
  const contrastRatio =
    lightAvg !== null && darkAvg !== null
      ? (Math.max(lightAvg, darkAvg) + 0.05) / (Math.min(lightAvg, darkAvg) + 0.05)
      : 10;

  void bitmap;
  return { palette, contrastRatio: Math.round(contrastRatio * 100) / 100 };
}

export function IntakeForm({ channels }: { channels: ChannelOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [channelKey, setChannelKey] = useState(channels[0]?.key ?? "social");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<ImageMeta[]>([]);
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setContent((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${json.content}` : json.content));
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
        const { palette, contrastRatio } = await analyseImage(file);
        const id = crypto.randomUUID();
        setImages((prev) => [
          ...prev,
          { id, name: file.name, alt: "", palette, contrastRatio },
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
        (acc, img) => (img.alt.trim() ? acc.replace(`![](${img.name})`, `![${img.alt.trim()}](${img.name})`) : acc),
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
            contrastRatio: i.contrastRatio,
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
          {busy === "images" ? "Analysing image…" : "Attach image (alt + contrast)"}
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
            Attached images · analysed in your browser (palette {images[0]?.palette.join(" ")} · only
            metadata is stored)
          </p>
          {images.map((img) => (
            <div key={img.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-mono text-xs">{img.name}</span>
              <span className="rounded bg-white px-1.5 py-0.5 text-xs">
                contrast {img.contrastRatio?.toFixed(2)}:1
              </span>
              <span className="flex gap-1">
                {img.palette.map((c) => (
                  <span
                    key={c}
                    title={c}
                    className="inline-block h-4 w-4 rounded border border-line"
                    style={{ background: c }}
                  />
                ))}
              </span>
              <input
                value={img.alt}
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
