#!/usr/bin/env python3
"""
Font subsetting → woff2. Shrinks full CJK fonts (e.g. an 11MB Dream/Source Han
Sans with 30k+ glyphs) down to only the glyphs you actually need.

Usage:
  python3 script/subset-font.py [fonts_dir] [options]
    fonts_dir        default: src/assets/fonts
    --gb2312         add the 6763 GB2312 常用字 (safe baseline for ANY Chinese)
    --no-scan        don't scan src/** for used chars (scan is on by default)
    --charset FILE   add every char in FILE (drop a CMS text dump / 常用字表 here)

Target charset = union of:
  printable ASCII + common CJK punctuation        (always)
  chars scanned from src/**                         (unless --no-scan)
  GB2312 6763                                       (--gb2312)
  chars in --charset FILE                           (optional)

Each <name>.{ttf,otf} in fonts_dir → <name>.woff2 (originals left untouched).
Picking the charset:
  - all copy lives in the repo  → scan alone (smallest output)
  - CMS / backend-fed copy      → add --gb2312 (or --charset a content dump)

Needs: fonttools + brotli (already required by the repo's tooling).
"""
import sys, os, re, glob, argparse
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Common fullwidth / CJK punctuation + ideographic space — always kept so a
# pure-scan subset never tofus on punctuation.
PUNCT = "，。、；：？！…—‐·“”‘’（）《》〈〉【】「」『』～％＃＆＊＠／＼｜　"


def scan_source_chars():
    chars = set()
    exts = ['astro', 'jsx', 'tsx', 'js', 'ts', 'md', 'mdx', 'json', 'html', 'vue', 'svelte']
    files = []
    for ext in exts:
        files += glob.glob(os.path.join(ROOT, 'src', '**', f'*.{ext}'), recursive=True)
    for fp in files:
        try:
            with open(fp, encoding='utf-8') as f:
                for ch in f.read():
                    if ord(ch) > 0x2000:  # ASCII/Latin handled separately below
                        chars.add(ch)
        except Exception:
            pass
    return chars


def gb2312_chars():
    # Decode every valid GB2312 two-byte sequence → the 6763 common simplified
    # hanzi (+ symbols). No external word-list file needed.
    chars = set()
    for hi in range(0xA1, 0xF8):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode('gb2312'))
            except Exception:
                pass
    return chars


def build_charset(args):
    chars = set(chr(c) for c in range(0x20, 0x7F))  # printable ASCII
    chars |= set(PUNCT)
    if not args.no_scan:
        chars |= scan_source_chars()
    if args.gb2312:
        chars |= gb2312_chars()
    if args.charset:
        with open(args.charset, encoding='utf-8') as f:
            chars |= set(f.read())
    for ws in '\n\r\t':
        chars.discard(ws)
    return chars


# OpenType layout tables — kerning / substitutions / mark attachment. Worth
# keeping for Latin (kerning), droppable for CJK body text. Some big Han fonts
# also ship a malformed GDEF VarStore that crashes the parser, so we retry
# without these on failure.
LAYOUT_TABLES = ('GSUB', 'GPOS', 'GDEF', 'BASE')


def subset_font(path, text, report, drop_layout=False):
    out = re.sub(r'\.(ttf|otf)$', '.woff2', path, flags=re.I)
    options = subset.Options()
    options.flavor = 'woff2'
    options.hinting = False          # drop hinting — meaningless on web, saves bytes
    options.desubroutinize = True    # flatten CFF subroutines (smaller after woff2)
    if drop_layout:
        options.drop_tables += list(LAYOUT_TABLES)
    font = subset.load_font(path, options)
    if drop_layout:
        for tag in LAYOUT_TABLES:
            if tag in font:
                del font[tag]  # lazy delete — never decompiles the broken table
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    subset.save_font(font, out, options)
    font.close()
    report.append((os.path.relpath(out, ROOT), os.path.getsize(path), os.path.getsize(out), drop_layout))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir', nargs='?', default='src/assets/fonts')
    ap.add_argument('--no-scan', action='store_true')
    ap.add_argument('--gb2312', action='store_true')
    ap.add_argument('--charset')
    args = ap.parse_args()

    fonts_dir = args.dir if os.path.isabs(args.dir) else os.path.join(ROOT, args.dir)
    fonts = sorted(
        glob.glob(os.path.join(fonts_dir, '**', '*.ttf'), recursive=True)
        + glob.glob(os.path.join(fonts_dir, '**', '*.otf'), recursive=True)
    )
    if not fonts:
        print(f"No .ttf/.otf found in {fonts_dir}")
        return

    chars = build_charset(args)
    text = ''.join(sorted(chars))
    print(f"Charset: {len(chars)} glyphs  "
          f"(scan={'off' if args.no_scan else 'on'}, gb2312={args.gb2312}, charset={args.charset or '-'})\n")

    report = []
    for fp in fonts:
        rel = os.path.relpath(fp, ROOT)
        print(f"▶ {rel}")
        try:
            subset_font(fp, text, report)
        except Exception as e:
            print(f"  ⚠ layout tables unparseable ({type(e).__name__}); retrying without GSUB/GPOS/GDEF")
            subset_font(fp, text, report, drop_layout=True)

    print("\n=== Result ===")
    for out, before, after, dropped in report:
        pct = 100 - after / before * 100 if before else 0
        note = '  [no layout]' if dropped else ''
        print(f"✓ {out}  {before/1e6:.1f}MB → {after/1e6:.2f}MB  ({pct:.0f}% smaller){note}")


if __name__ == '__main__':
    main()
