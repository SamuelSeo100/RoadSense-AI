#!/usr/bin/env python3
"""
Exports the copyright-deposit PDFs of Routly's source code from a frozen git tag
(Indian copyright registration, Form XIV, computer programme: first 10 and last
10 pages of source code, nothing blocked out).

    python tools/copyright/export_deposit.py --repo ../routly-v1.0 --tag v1.0 \
        --out ~/routly-copyright

Run it against a clean worktree checked out at the tag. File contents are read
from the tag itself (`git show <tag>:<path>`), never from a working tree.

Outputs (in --out):
  routly-v1.0-source-full.pdf          every selected file
  routly-v1.0-copyright-deposit.pdf    pages 1-10 + last 10 of the full PDF
                                       (the full PDF itself if under 20 pages)
  deposit-manifest.md                  files, page ranges, exclusions, SHA-256

Needs: reportlab, pypdf (pip install reportlab pypdf) and macOS: fonts are
system fonts (Menlo + symbol fallbacks) and colour emoji are rendered by
CoreText through `swift`. Change FONT_* / EMOJI_SWIFT on other systems.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field

from pypdf import PdfReader, PdfWriter
from reportlab import rl_config
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

TITLE = "Routly — Multi-Modal Route Planner"
PDF_TITLE = "Routly — Multi-Modal Route Planner, Version 1.0 — Source code"
PDF_AUTHOR = "Dhanesh Naikare, Tejas Mahajan, Sakshi Ghogare"
VERSION = "1.0"

FULL_NAME = "routly-v1.0-source-full.pdf"
DEPOSIT_NAME = "routly-v1.0-copyright-deposit.pdf"
MANIFEST_NAME = "deposit-manifest.md"
DEPOSIT_EDGE = 10  # pages from each end

# ---------------------------------------------------------------- selection

# Printed first, in this order.
FIRST = [
    "src/services/transit/injection.ts",
    "src/services/transit/network.ts",
    "src/services/scoring.ts",
    "src/services/ranking.ts",
    "src/services/fares.ts",
    "src/services/transit/metro.ts",
    "src/services/transit/suburban.ts",
    "src/services/transit/buildMetro.ts",
    "src/services/transit/time.ts",
    "src/services/transit/types.ts",
    "src/services/google/googleRoutingService.ts",
    "app/_layout.tsx",
]
# Printed last, in this order. Everything else goes between, in path order.
LAST = [
    "src/navigation/geo.ts",
    "src/navigation/tripTrack.ts",
    "src/navigation/steps.ts",
    "src/navigation/engine.ts",
]

CODE_DIRS = ("app/", "src/", "scripts/", "supabase/functions/")
CODE_EXTS = (".ts", ".tsx", ".js", ".jsx")

# Explicit exclusions: path (or prefix ending in "/") -> reason.
EXCLUDE = {
    "src/services/mock/mockData.ts": "Sample data for the mock services, not program logic",
    "data/transit/pune_metro_fares_long.csv": "Third-party data: Maha-Metro fare matrix",
    "data/transit/pune_metro_stations.csv": "Third-party data: Maha-Metro station list (fare-matrix input)",
    "data/transit/metro.json": "Third-party data: built from the Maha-Metro fare matrix and station list",
    "data/transit/suburban_rail.json": "Third-party data: Pune–Lonavala suburban timetable",
    "eas.json": "Build/credentials configuration",
    ".env.example": "Environment / credentials template",
    "app.config.ts": "Expo app configuration (reads build secrets from the environment)",
    "scripts/probe-transit.py": "One-off API probe script (Python), not part of the program",
    "scripts/test-parse-trip.mts": "Test script for the parse-trip edge function",
    "routly-internal-screens/": "Design hand-off package (specs, reference screens, tokens)",
    "design/": "Design mockups and screenshots",
    "assets/": "Images, icons and logos",
    "docs/": "Documentation",
}


def exclusion_reason(path: str) -> str | None:
    """Reason a tracked file is left out, or None if it is printed."""
    for key, reason in EXCLUDE.items():
        if path == key or (key.endswith("/") and path.startswith(key)):
            return reason
    parts = path.split("/")
    if any(p in ("__tests__", "__fixtures__", "__manual__") for p in parts):
        return "Tests, test fixtures or manual test harness"
    if path.endswith(".d.ts"):
        return "Type-declaration stub"
    name = parts[-1]
    if name in ("package.json",):
        return "Package manifest"
    if name.endswith(".lock") or name in ("package-lock.json", "bun.lock", "yarn.lock"):
        return "Lockfile"
    if name.startswith(".env") or name in ("google-services.json",) or name.endswith((".keystore", ".jks", ".p12", ".p8")):
        return "Credentials"
    if name.startswith(".") or name in (
        "app.json", "babel.config.js", "metro.config.js", "eslint.config.js",
        "tailwind.config.js", "tsconfig.json",
    ):
        return "Configuration boilerplate"
    if path.startswith("supabase/migrations/") and path.endswith(".sql"):
        return None
    if path.startswith(CODE_DIRS) and path.endswith(CODE_EXTS):
        return None
    if name.endswith(".md") or name == "LICENSE":
        return "Documentation"
    if name.endswith(".css"):
        return "Stylesheet"
    if name.endswith((".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp", ".ttf", ".otf")):
        return "Image / font asset"
    return "Not first-party program source"


def select_files(tracked: list[str]) -> tuple[list[str], list[tuple[str, str]]]:
    selected = [p for p in tracked if exclusion_reason(p) is None]
    excluded = [(p, exclusion_reason(p) or "") for p in tracked if exclusion_reason(p) is not None]
    missing = [p for p in FIRST + LAST if p not in selected]
    if missing:
        sys.exit(f"Ordered files not in the selection: {missing}")
    middle = sorted(p for p in selected if p not in FIRST and p not in LAST)
    return FIRST + middle + LAST, excluded


# ---------------------------------------------------------------- layout

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm
FONT_SIZE = 9
LEADING = 9.7  # 75 lines in the 25.7 cm text block
GUTTER_CHARS = 5  # "1234 "

FONT_REGULAR = ("Mono", "/System/Library/Fonts/Menlo.ttc", 0)
FONT_BOLD = ("Mono-Bold", "/System/Library/Fonts/Menlo.ttc", 1)
# Tried in order for characters the monospace font lacks (₹, ⓘ, …).
FONT_FALLBACKS = [
    ("Sym1", "/System/Library/Fonts/Geneva.ttf", 0),
    ("Sym2", "/System/Library/Fonts/Apple Symbols.ttf", 0),
    ("Sym3", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf", 0),
]
# Colour emoji have no outline glyphs in any system font, so they are drawn as
# small images rendered by CoreText (the only place the PDF is not text).
EMOJI = "EMOJI"
EMOJI_RENDER_SIZE = 128
EMOJI_SWIFT = r"""
import CoreText; import CoreGraphics; import ImageIO; import Foundation; import UniformTypeIdentifiers
let args = CommandLine.arguments; let out = args[1]
let font = CTFontCreateWithName("AppleColorEmoji" as CFString, CGFloat(Double(args[2])!), nil)
for (i, s) in args.dropFirst(3).enumerated() {
  let attr = NSAttributedString(string: s, attributes: [kCTFontAttributeName as NSAttributedString.Key: font])
  let line = CTLineCreateWithAttributedString(attr)
  var asc: CGFloat = 0, desc: CGFloat = 0, lead: CGFloat = 0
  let w = CGFloat(CTLineGetTypographicBounds(line, &asc, &desc, &lead))
  let ctx = CGContext(data: nil, width: Int(ceil(w)), height: Int(ceil(asc + desc)), bitsPerComponent: 8,
                      bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.textPosition = CGPoint(x: 0, y: desc); CTLineDraw(line, ctx)
  let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: "\(out)/\(i).png") as CFURL,
                                             UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, ctx.makeImage()!, nil); CGImageDestinationFinalize(dest)
  print(w, asc + desc, desc)
}
"""


def is_emoji_part(ch: str) -> bool:
    cp = ord(ch)
    return 0x1F000 <= cp <= 0x1FFFF or cp in (0xFE0F, 0x200D) or 0x1F1E6 <= cp <= 0x1F1FF


def units(text: str) -> list[str]:
    """Characters, with each run of emoji code points (flag pairs, VS16,
    ZWJ sequences) kept together as one unit."""
    out: list[str] = []
    for ch in text:
        if out and is_emoji_part(ch) and is_emoji_part(out[-1][-1]) and ord(out[-1][0]) >= 0x1F000:
            out[-1] += ch
        else:
            out.append(ch)
    return out


@dataclass
class Emoji:
    image: ImageReader
    width: float  # in em
    height: float
    descent: float


@dataclass
class Fonts:
    regular: str
    bold: str
    fallbacks: list[tuple[str, set[int]]] = field(default_factory=list)
    mono_cmap: set[int] = field(default_factory=set)
    missing: set[str] = field(default_factory=set)
    emoji: dict[str, Emoji] = field(default_factory=dict)

    def font_for(self, unit: str) -> str:
        if unit in self.emoji:
            return EMOJI
        cp = ord(unit[0])
        if cp in self.mono_cmap:
            return self.regular
        for name, cmap in self.fallbacks:
            if cp in cmap:
                return name
        self.missing.add(unit)
        return self.regular


def render_emoji(fonts: Fonts, texts: list[str], tmp: str) -> None:
    clusters = sorted({u for t in texts for u in units(t) if ord(u[0]) >= 0x1F000})
    if not clusters:
        return
    script = os.path.join(tmp, "emoji.swift")
    with open(script, "w") as f:
        f.write(EMOJI_SWIFT)
    out = subprocess.check_output(["swift", script, tmp, str(EMOJI_RENDER_SIZE), *clusters], text=True)
    for i, (u, line) in enumerate(zip(clusters, out.strip().split("\n"))):
        w, h, d = (float(v) / EMOJI_RENDER_SIZE for v in line.split())
        with open(os.path.join(tmp, f"{i}.png"), "rb") as f:
            # From bytes, so the PDF resource name depends on content, not the temp path.
            fonts.emoji[u] = Emoji(ImageReader(io.BytesIO(f.read())), w, h, d)


def register_fonts() -> Fonts:
    def reg(name: str, path: str, idx: int) -> TTFont | None:
        if not os.path.exists(path):
            return None
        try:
            f = TTFont(name, path, subfontIndex=idx)
        except Exception:
            return None
        pdfmetrics.registerFont(f)
        return f

    mono = reg(*FONT_REGULAR)
    bold = reg(*FONT_BOLD)
    if mono is None or bold is None:
        sys.exit(f"Monospace font not found: {FONT_REGULAR[1]}")
    fonts = Fonts(FONT_REGULAR[0], FONT_BOLD[0], mono_cmap=set(mono.face.charToGlyph))
    for spec in FONT_FALLBACKS:
        f = reg(*spec)
        if f is not None:
            fonts.fallbacks.append((spec[0], set(f.face.charToGlyph)))
    return fonts


def runs(text: str, fonts: Fonts) -> list[tuple[str, str]]:
    """Split text into (font, chunk) runs; each emoji cluster is its own run."""
    out: list[tuple[str, str]] = []
    for u in units(text):
        f = fonts.font_for(u)
        if out and out[-1][0] == f and f != EMOJI:
            out[-1] = (f, out[-1][1] + u)
        else:
            out.append((f, u))
    return out


def run_width(font: str, s: str, size: float, fonts: Fonts) -> float:
    if font == EMOJI:
        return fonts.emoji[s].width * size
    return pdfmetrics.stringWidth(s, font, size)


def text_width(text: str, fonts: Fonts) -> float:
    return sum(run_width(f, s, FONT_SIZE, fonts) for f, s in runs(text, fonts))


def wrap(line: str, width: float, fonts: Fonts) -> list[str]:
    """Hard-wrap by measured width, so nothing is cut off; never drops a char."""
    if line == "":
        return [""]
    pieces, cur, cur_w = [], "", 0.0
    for u in units(line):
        w = text_width(u, fonts)
        if cur and cur_w + w > width:
            pieces.append(cur)
            cur, cur_w = "", 0.0
        cur += u
        cur_w += w
    pieces.append(cur)
    return pieces


@dataclass
class Row:
    kind: str  # "title" | "code" | "blank"
    text: str = ""
    lineno: int | None = None
    path: str = ""


def layout(files: list[tuple[str, str]], fonts: Fonts) -> tuple[list[list[Row]], dict[str, tuple[int, int]]]:
    rows_per_page = int((PAGE_H - 2 * MARGIN) // LEADING)
    char_w = pdfmetrics.stringWidth("0", fonts.regular, FONT_SIZE)
    code_w = PAGE_W - 2 * MARGIN - GUTTER_CHARS * char_w

    pages: list[list[Row]] = [[]]
    ranges: dict[str, tuple[int, int]] = {}

    def room() -> int:
        return rows_per_page - len(pages[-1])

    def put(row: Row) -> None:
        if room() == 0:
            pages.append([])
        pages[-1].append(row)

    for path, content in files:
        lines = content.expandtabs(4).split("\n")
        if lines and lines[-1] == "":
            lines.pop()
        if pages[-1]:
            # A spacer, then keep the title with at least one code row.
            if room() < 3:
                pages.append([])
            else:
                put(Row("blank"))
        put(Row("title", path, path=path))
        start = len(pages)
        for n, line in enumerate(lines, 1):
            for i, piece in enumerate(wrap(line, code_w, fonts)):
                put(Row("code", piece, n if i == 0 else None, path))
        ranges[path] = (start, len(pages))
    return pages, ranges


def draw_full(pages: list[list[Row]], fonts: Fonts, header: str, out_path: str) -> None:
    rl_config.invariant = 1  # stable IDs/dates: same input, same bytes
    c = canvas.Canvas(out_path, pagesize=A4, pageCompression=1)
    c.setTitle(PDF_TITLE)
    c.setAuthor(PDF_AUTHOR)
    c.setSubject(f"Source code, version {VERSION}")
    c.setCreator("tools/copyright/export_deposit.py")
    char_w = pdfmetrics.stringWidth("0", fonts.regular, FONT_SIZE)
    total = len(pages)
    top = PAGE_H - MARGIN - FONT_SIZE

    def draw_runs(x: float, y: float, text: str, size: float = FONT_SIZE) -> None:
        for f, s in runs(text, fonts):
            if f == EMOJI:
                e = fonts.emoji[s]
                c.drawImage(e.image, x, y - e.descent * size, e.width * size, e.height * size, mask="auto")
            else:
                c.setFont(f, size)
                c.drawString(x, y, s)
            x += run_width(f, s, size, fonts)

    for i, page in enumerate(pages, 1):
        # Header and footer sit in the margins.
        c.setFillGray(0.35)
        hy = PAGE_H - MARGIN + 0.55 * cm
        draw_runs(MARGIN, hy, header, 8)
        c.setLineWidth(0.4)
        c.line(MARGIN, hy - 0.2 * cm, PAGE_W - MARGIN, hy - 0.2 * cm)
        c.setFont(fonts.regular, 8)
        c.drawCentredString(PAGE_W / 2, MARGIN - 0.9 * cm, f"Page {i} of {total}")

        y = top
        for row in page:
            if row.kind == "title":
                c.setFillGray(0)
                c.setFont(fonts.bold, FONT_SIZE)
                c.drawString(MARGIN, y, row.text)
            elif row.kind == "code":
                if row.lineno is not None:
                    c.setFillGray(0.5)
                    c.setFont(fonts.regular, FONT_SIZE)
                    c.drawRightString(MARGIN + (GUTTER_CHARS - 1) * char_w, y, str(row.lineno))
                c.setFillGray(0)
                draw_runs(MARGIN + GUTTER_CHARS * char_w, y, row.text)
            y -= LEADING
        c.showPage()
    c.save()


def write_deposit(full_path: str, out_path: str) -> list[int]:
    reader = PdfReader(full_path)
    n = len(reader.pages)
    if n < 2 * DEPOSIT_EDGE:
        keep = list(range(1, n + 1))
    else:
        keep = list(range(1, DEPOSIT_EDGE + 1)) + list(range(n - DEPOSIT_EDGE + 1, n + 1))
    writer = PdfWriter()
    for p in keep:
        writer.add_page(reader.pages[p - 1])
    writer.add_metadata({
        "/Title": PDF_TITLE,
        "/Author": PDF_AUTHOR,
        "/Subject": f"Source code, version {VERSION} — copyright deposit (first and last {DEPOSIT_EDGE} pages)",
        "/Creator": "tools/copyright/export_deposit.py",
    })
    buf = io.BytesIO()
    writer.write(buf)
    with open(out_path, "wb") as f:
        f.write(buf.getvalue())
    return keep


# ---------------------------------------------------------------- manifest

def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def files_on_page(pages: list[list[Row]], p: int) -> tuple[str, str]:
    paths = [r.path for r in pages[p - 1] if r.path]
    return paths[0], paths[-1]


def write_manifest(out_dir: str, *, tag: str, commit: str, commit_date: str, order: list[str],
                   line_counts: dict[str, int], excluded: list[tuple[str, str]],
                   pages: list[list[Row]], ranges: dict[str, tuple[int, int]], keep: list[int]) -> str:
    full = os.path.join(out_dir, FULL_NAME)
    dep = os.path.join(out_dir, DEPOSIT_NAME)
    total = len(pages)
    keep_set = set(keep)
    dep_index = {p: i for i, p in enumerate(keep, 1)}
    fares_start = ranges["src/services/fares.ts"][0]

    L = []
    L.append(f"# Copyright deposit manifest — {TITLE}, version {VERSION}\n")
    L.append("| | |\n|---|---|")
    L.append(f"| Tag | `{tag}` |")
    L.append(f"| Commit | `{commit}` |")
    L.append(f"| Commit date | {commit_date} |")
    L.append(f"| Generated | {dt.datetime.now().astimezone().strftime('%Y-%m-%d %H:%M %Z')} |")
    L.append(f"| Files printed | {len(order)} ({sum(line_counts.values()):,} lines) |")
    L.append(f"| Full PDF | {total} pages |")
    L.append(f"| Deposit PDF | {len(keep)} pages (full PDF pages {', '.join(_ranges(keep))}) |")
    L.append(f"| Layout | A4 portrait, Menlo 9 pt, 2 cm margins, {int((PAGE_H - 2 * MARGIN) // LEADING)} lines/page, long lines wrapped |")
    L.append("")
    L.append("## Files and SHA-256\n")
    L.append("| File | Size | SHA-256 |\n|---|---|---|")
    for p in (full, dep):
        L.append(f"| `{os.path.basename(p)}` | {os.path.getsize(p):,} bytes | `{sha256(p)}` |")
    L.append("")
    L.append("## Deposit boundary pages\n")
    L.append("| Deposit page | Full PDF page | First file on page | Last file on page |\n|---|---|---|---|")
    for d in (1, 10, 11, 20):
        if d <= len(keep):
            fp = keep[d - 1]
            a, b = files_on_page(pages, fp)
            L.append(f"| {d} | {fp} | `{a}` | `{b}` |")
    where = "page 10 (inside the first 10 pages)" if fares_start <= DEPOSIT_EDGE else f"page {fares_start} (outside the first 10 pages)"
    L.append(f"\n`src/services/fares.ts` starts on full PDF {where}.\n")
    L.append("## Printed files, in order\n")
    L.append("| # | File | Lines | Full PDF pages | In deposit |\n|---|---|---|---|---|")
    for i, path in enumerate(order, 1):
        a, b = ranges[path]
        inside = [p for p in range(a, b + 1) if p in keep_set]
        if not inside:
            mark = ""
        elif len(inside) == b - a + 1:
            mark = "yes — deposit p" + "–".join(dict.fromkeys(str(dep_index[p]) for p in (inside[0], inside[-1])))
        else:
            mark = "partly — deposit p" + "–".join(dict.fromkeys(str(dep_index[p]) for p in (inside[0], inside[-1])))
        pr = f"{a}" if a == b else f"{a}–{b}"
        L.append(f"| {i} | `{path}` | {line_counts[path]} | {pr} | {mark} |")
    L.append("")
    L.append("## Excluded files\n")
    L.append("| File | Reason |\n|---|---|")
    for path, reason in excluded:
        L.append(f"| `{path}` | {reason} |")
    L.append("")
    path = os.path.join(out_dir, MANIFEST_NAME)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L))
    return path


def _ranges(nums: list[int]) -> list[str]:
    out, start = [], nums[0]
    for a, b in zip(nums, nums[1:] + [None]):
        if b != a + 1:
            out.append(f"{start}–{a}" if start != a else str(a))
            start = b
    return out


# ---------------------------------------------------------------- main

def git(repo: str, *args: str) -> str:
    return subprocess.check_output(["git", "-C", repo, *args], text=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", default=".", help="worktree checked out at the tag")
    ap.add_argument("--tag", default="v1.0")
    ap.add_argument("--out", default="~/routly-copyright")
    args = ap.parse_args()
    repo, out_dir = os.path.abspath(args.repo), os.path.expanduser(args.out)

    commit = git(repo, "rev-parse", f"{args.tag}^{{commit}}").strip()
    if git(repo, "rev-parse", "HEAD").strip() != commit:
        sys.exit(f"{repo} is not checked out at {args.tag} ({commit[:7]})")
    if git(repo, "status", "--porcelain").strip():
        sys.exit(f"{repo} has uncommitted changes")
    commit_date = git(repo, "show", "-s", "--format=%cI", commit).strip()
    short = commit[:7]

    tracked = git(repo, "ls-tree", "-r", "--name-only", commit).split("\n")
    tracked = [p for p in tracked if p]
    order, excluded = select_files(tracked)
    contents = [(p, git(repo, "show", f"{commit}:{p}")) for p in order]
    line_counts = {p: len(c.rstrip("\n").split("\n")) for p, c in contents}

    fonts = register_fonts()
    with tempfile.TemporaryDirectory() as tmp:
        render_emoji(fonts, [c for _, c in contents], tmp)
        pages, ranges = layout(contents, fonts)
        if fonts.missing:
            sys.exit("No font has a glyph for: " + " ".join(f"U+{ord(c[0]):04X}" for c in sorted(fonts.missing)))

        os.makedirs(out_dir, exist_ok=True)
        full = os.path.join(out_dir, FULL_NAME)
        header = f"{TITLE} — Source code v{VERSION} — commit {short}"
        draw_full(pages, fonts, header, full)
    keep = write_deposit(full, os.path.join(out_dir, DEPOSIT_NAME))
    manifest = write_manifest(out_dir, tag=args.tag, commit=commit, commit_date=commit_date, order=order,
                              line_counts=line_counts, excluded=excluded, pages=pages,
                              ranges=ranges, keep=keep)

    print(f"{len(order)} files, {len(pages)} pages -> {full}")
    print(f"deposit pages {', '.join(_ranges(keep))} -> {os.path.join(out_dir, DEPOSIT_NAME)}")
    print(f"manifest -> {manifest}")


if __name__ == "__main__":
    main()
