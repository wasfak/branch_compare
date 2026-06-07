"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UploadResult = { file: string; branch: string; rows: number; replaced: number };

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) =>
      /\.html?$/i.test(f.name)
    );
    if (files.length === 0) {
      setError("Please choose .htm or .html files");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const uploaded: UploadResult[] = [];

      for (const file of files) {
        const text = await file.text();
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "X-File-Name": encodeURIComponent(file.name),
          },
          body: text,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Upload failed for ${file.name}`);
        }

        uploaded.push(await res.json());
      }

      setResults((prev) => [...uploaded, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
          Upload branch reports
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop or select the .htm/.html sales report files exported from each branch.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card/50 px-6 py-14 text-center transition-colors",
          isDragging && "border-primary bg-primary/5"
        )}
      >
        <p className="font-medium text-gray-800 dark:text-gray-200">
          {isUploading ? "Uploading..." : "Drag & drop files here, or click to browse"}
        </p>
        <p className="text-sm text-muted-foreground">Accepts multiple .htm / .html files at once</p>
        <input
          ref={inputRef}
          type="file"
          accept=".htm,.html"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" disabled={isUploading} className="mt-2">
          Choose files
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {results.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/50 text-left">
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Branch</th>
                <th className="px-3 py-2 font-medium">Rows imported</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{r.file}</td>
                  <td className="px-3 py-2">{r.branch || "—"}</td>
                  <td className="px-3 py-2">{r.rows.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {r.replaced > 0 ? (
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        Updated · replaced {r.replaced.toLocaleString()}
                      </span>
                    ) : (
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        New
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
