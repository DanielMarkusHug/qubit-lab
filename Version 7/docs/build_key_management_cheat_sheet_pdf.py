#!/usr/bin/env python3
"""Build the QAOA RQP key-management cheat-sheet PDF from Markdown source.

This intentionally avoids external PDF/rendering libraries so the cheat sheet
can be regenerated in restricted local environments.
"""

from __future__ import annotations

import textwrap
from pathlib import Path


DOCS_DIR = Path(__file__).resolve().parent
SOURCE = DOCS_DIR / "qaoa_rqp_key_management_cheat_sheet_v2.md"
OUTPUT = DOCS_DIR / "qaoa_rqp_key_management_cheat_sheet_v2.pdf"

PAGE_WIDTH = 595
PAGE_HEIGHT = 842
LEFT = 42
TOP = 806
BOTTOM = 42


def main() -> int:
    lines = _layout_lines(SOURCE.read_text(encoding="utf-8"))
    pages = _paginate(lines)
    OUTPUT.write_bytes(_build_pdf(pages))
    print(f"Wrote {OUTPUT}")
    return 0


def _layout_lines(markdown: str) -> list[dict[str, str | int]]:
    items: list[dict[str, str | int]] = []
    in_code = False
    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()
        if line.startswith("```"):
            in_code = not in_code
            items.append({"text": "", "style": "body", "height": 7})
            continue
        if in_code:
            wrapped = textwrap.wrap(line, width=88, replace_whitespace=False, drop_whitespace=False) or [""]
            for wrapped_line in wrapped:
                items.append({"text": wrapped_line, "style": "code", "height": 9})
            continue
        if line.startswith("# "):
            items.append({"text": line[2:].strip(), "style": "h1", "height": 22})
            items.append({"text": "", "style": "body", "height": 6})
            continue
        if line.startswith("## "):
            items.append({"text": "", "style": "body", "height": 5})
            items.append({"text": line[3:].strip(), "style": "h2", "height": 15})
            continue
        if not line:
            items.append({"text": "", "style": "body", "height": 7})
            continue
        wrapped = textwrap.wrap(line, width=96, replace_whitespace=False) or [""]
        for wrapped_line in wrapped:
            items.append({"text": wrapped_line, "style": "body", "height": 11})
    return items


def _paginate(lines: list[dict[str, str | int]]) -> list[list[dict[str, str | int]]]:
    pages: list[list[dict[str, str | int]]] = []
    page: list[dict[str, str | int]] = []
    used = 0
    available = TOP - BOTTOM - 20
    for item in lines:
        height = int(item["height"])
        if page and used + height > available:
            pages.append(page)
            page = []
            used = 0
            if item["text"] == "":
                continue
        page.append(item)
        used += height
    if page:
        pages.append(page)
    return pages


def _build_pdf(pages: list[list[dict[str, str | int]]]) -> bytes:
    objects: list[bytes] = []

    def add_object(payload: str | bytes) -> int:
        if isinstance(payload, str):
            payload_bytes = payload.encode("latin-1")
        else:
            payload_bytes = payload
        objects.append(payload_bytes)
        return len(objects)

    catalog_id = add_object("<< /Type /Catalog /Pages 2 0 R >>")
    pages_id = add_object(b"")  # filled after page objects are known
    font_regular_id = add_object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    font_bold_id = add_object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    font_mono_id = add_object("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")

    page_ids: list[int] = []
    for page_no, page in enumerate(pages, start=1):
        stream = _page_stream(page, page_no, len(pages))
        stream_id = add_object(
            b"<< /Length "
            + str(len(stream)).encode("ascii")
            + b" >>\nstream\n"
            + stream
            + b"\nendstream"
        )
        page_id = add_object(
            "<< /Type /Page "
            "/Parent 2 0 R "
            f"/MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
            f"/Resources << /Font << /F1 {font_regular_id} 0 R /F2 {font_bold_id} 0 R /F3 {font_mono_id} 0 R >> >> "
            f"/Contents {stream_id} 0 R >>"
        )
        page_ids.append(page_id)

    objects[pages_id - 1] = (
        "<< /Type /Pages /Kids ["
        + " ".join(f"{page_id} 0 R" for page_id in page_ids)
        + f"] /Count {len(page_ids)} >>"
    ).encode("latin-1")

    payload = bytearray()
    payload.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for object_id, obj in enumerate(objects, start=1):
        offsets.append(len(payload))
        payload.extend(f"{object_id} 0 obj\n".encode("ascii"))
        payload.extend(obj)
        payload.extend(b"\nendobj\n")

    xref_offset = len(payload)
    payload.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    payload.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        payload.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    payload.extend(
        (
            "trailer\n"
            f"<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
            "startxref\n"
            f"{xref_offset}\n"
            "%%EOF\n"
        ).encode("ascii")
    )
    return bytes(payload)


def _page_stream(page: list[dict[str, str | int]], page_no: int, page_count: int) -> bytes:
    commands: list[str] = []
    y = TOP
    for item in page:
        text = str(item["text"])
        style = str(item["style"])
        height = int(item["height"])
        if text:
            if style == "h1":
                font = "F2"
                size = 17
            elif style == "h2":
                font = "F2"
                size = 11
            elif style == "code":
                font = "F3"
                size = 7
            else:
                font = "F1"
                size = 8
            commands.append(f"BT /{font} {size} Tf {LEFT} {y} Td ({_pdf_escape(text)}) Tj ET")
        y -= height

    footer = "QAOA RQP Key Management Cheat Sheet v2 - Version 7.0.16"
    commands.append(f"BT /F1 7 Tf {LEFT} 24 Td ({_pdf_escape(footer)}) Tj ET")
    commands.append(f"BT /F1 7 Tf 520 24 Td ({_pdf_escape(f'Page {page_no}/{page_count}')}) Tj ET")
    return "\n".join(commands).encode("latin-1")


def _pdf_escape(text: str) -> str:
    return text.encode("latin-1", errors="replace").decode("latin-1").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


if __name__ == "__main__":
    raise SystemExit(main())
