"""Build the client-facing QAOA RQP Pro V9.2 user manual."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = ROOT / "Version 9" / "docs"
ASSET_DIR = DOCS_DIR / "manual_assets"
OUTPUT_DOCX = DOCS_DIR / "QAOA_RQP_Pro_V9_2_Client_User_Manual.docx"
LOGO = ROOT / "assets" / "qubit-lab-light-blue-transparent.png"
WHITE_LOGO = ROOT / "assets" / "qubit-lab-logo-white.png"
CHART_DIR = ROOT / "Version 3" / "parametric_assets_only_input_small_charts"


COLORS = {
    "navy": "0B1220",
    "navy_2": "111827",
    "slate": "1E293B",
    "cyan": "22D3EE",
    "cyan_dark": "0891B2",
    "amber": "F59E0B",
    "green": "10B981",
    "muted": "94A3B8",
    "white": "F8FAFC",
    "ink": "0F172A",
}


def rgb(hex_value: str) -> tuple[int, int, int]:
    hex_value = hex_value.strip("#")
    return tuple(int(hex_value[i : i + 2], 16) for i in (0, 2, 4))


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def rounded_rectangle(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def paste_logo(img: Image.Image, path: Path, xy: tuple[int, int], max_width: int) -> None:
    if not path.exists():
        return
    logo = Image.open(path).convert("RGBA")
    scale = max_width / max(1, logo.width)
    logo = logo.resize((int(logo.width * scale), int(logo.height * scale)))
    img.alpha_composite(logo, xy)


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, xy, width: int, font_obj, fill, line_spacing=8):
    x, y = xy
    words = text.split()
    lines: list[str] = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=font_obj) <= width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    for line in lines:
        draw.text((x, y), line, font=font_obj, fill=fill)
        y += font_obj.size + line_spacing
    return y


def create_cover_image() -> Path:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    path = ASSET_DIR / "cover_rqp_manual.png"
    img = Image.new("RGBA", (1600, 900), rgb(COLORS["navy"]) + (255,))
    draw = ImageDraw.Draw(img)
    for i in range(900):
        shade = int(16 + i * 0.035)
        draw.line((0, i, 1600, i), fill=(8, 18, 34 + min(shade, 40), 255))
    for x in range(-200, 1600, 140):
        draw.line((x, 900, x + 700, 0), fill=(20, 184, 166, 22), width=2)
    for y in range(140, 840, 110):
        draw.line((0, y, 1600, y - 170), fill=(34, 211, 238, 16), width=2)
    paste_logo(img, LOGO, (90, 75), 280)
    draw.text((95, 300), "QAOA RQP Pro V9.2", font=font(74, True), fill=rgb(COLORS["white"]))
    draw.text((100, 390), "Rapid Quantum Prototyping for Portfolio Optimization", font=font(39, True), fill=rgb(COLORS["cyan"]))
    draw_wrapped(
        draw,
        "A client-facing manual for preparing Excel inputs, running classical and QAOA workflows, interpreting diagnostics, and exporting reproducible quantum-circuit notebooks.",
        (102, 470),
        980,
        font(30),
        rgb("DDEBFF"),
        10,
    )
    chips = ["Excel to QUBO", "Classical baseline", "QAOA simulation", "Second opinion", "Circuit exports"]
    x = 102
    for chip in chips:
        w = int(draw.textlength(chip, font=font(24, True))) + 46
        rounded_rectangle(draw, (x, 710, x + w, 770), 24, rgb("082F49") + (255,), outline=rgb(COLORS["cyan"]))
        draw.text((x + 23, 728), chip, font=font(24, True), fill=rgb("CFFAFE"))
        x += w + 18
    draw.text((102, 828), "qubit-lab.ch | Client User Manual", font=font(24), fill=rgb(COLORS["muted"]))
    img.convert("RGB").save(path, quality=95)
    return path


def create_workflow_image() -> Path:
    path = ASSET_DIR / "workflow_overview.png"
    img = Image.new("RGB", (1600, 700), rgb("F8FAFC"))
    draw = ImageDraw.Draw(img)
    draw.text((70, 55), "End-to-end workflow", font=font(48, True), fill=rgb(COLORS["ink"]))
    steps = [
        ("1", "Prepare Excel", "Assets, settings, covariance, budgets, fixed and variable blocks."),
        ("2", "Inspect workbook", "Validate inputs and estimate runtime before committing a run."),
        ("3", "Run optimization", "Classical baseline plus selected QAOA simulator and worker profile."),
        ("4", "Review outputs", "Portfolio metrics, charts, candidates, logs, diagnostics, and exports."),
        ("5", "Export package", "Save JSON or generate Qiskit, PennyLane, and Cirq notebook files."),
    ]
    x = 70
    y = 170
    card_w = 275
    for idx, title, desc in steps:
        rounded_rectangle(draw, (x, y, x + card_w, y + 330), 24, (255, 255, 255), outline=rgb("CBD5E1"), width=2)
        rounded_rectangle(draw, (x + 22, y + 22, x + 82, y + 82), 18, rgb(COLORS["cyan"]) + (255,))
        draw.text((x + 43, y + 36), idx, font=font(30, True), fill=rgb("083344"), anchor="mm")
        draw.text((x + 22, y + 112), title, font=font(29, True), fill=rgb(COLORS["ink"]))
        draw_wrapped(draw, desc, (x + 22, y + 165), card_w - 44, font(22), rgb("475569"), 8)
        if idx != "5":
            draw.line((x + card_w + 8, y + 165, x + card_w + 48, y + 165), fill=rgb(COLORS["cyan_dark"]), width=5)
            draw.polygon([(x + card_w + 48, y + 165), (x + card_w + 28, y + 154), (x + card_w + 28, y + 176)], fill=rgb(COLORS["cyan_dark"]))
        x += card_w + 55
    img.save(path, quality=95)
    return path


def draw_panel(draw, box, title, lines, accent="22D3EE"):
    rounded_rectangle(draw, box, 22, rgb("0F172A") + (255,), outline=rgb("334155"), width=2)
    x1, y1, x2, _ = box
    draw.text((x1 + 26, y1 + 22), title, font=font(24, True), fill=rgb(accent))
    y = y1 + 70
    for label, value in lines:
        draw.text((x1 + 26, y), label, font=font(18, True), fill=rgb("CBD5E1"))
        draw.text((x1 + 168, y), value, font=font(18), fill=rgb("F8FAFC"))
        y += 38


def create_interface_image() -> Path:
    path = ASSET_DIR / "interface_overview.png"
    img = Image.new("RGBA", (1600, 980), rgb(COLORS["navy"]) + (255,))
    draw = ImageDraw.Draw(img)
    draw.text((70, 50), "Tool interface overview", font=font(48, True), fill=rgb(COLORS["white"]))
    draw.text((70, 110), "The working screen is organized as a practical cockpit: input, settings, progress, outputs.", font=font(26), fill=rgb("CFFAFE"))
    draw_panel(
        draw,
        (70, 190, 450, 610),
        "1. Access and workbook",
        [
            ("License", "public demo or API key"),
            ("Workbook", ".xlsx upload"),
            ("Inspect", "pre-run validation"),
            ("Warnings", "cost, budget, sheets"),
            ("Summary", "qubits, QUBO, settings"),
        ],
        "22D3EE",
    )
    draw_panel(
        draw,
        (500, 190, 930, 610),
        "2. Optimization settings",
        [
            ("Mode", "classical / QAOA"),
            ("2nd opinion", "Qiskit simulation"),
            ("Worker", "small / medium / large"),
            ("Layers", "QAOA depth p"),
            ("Seed", "reproducibility aid"),
        ],
        "F59E0B",
    )
    draw_panel(
        draw,
        (980, 190, 1530, 610),
        "3. Results and diagnostics",
        [
            ("Metrics", "return, volatility, Sharpe-like"),
            ("Candidates", "top probability / top QUBO"),
            ("Charts", "solver, QUBO, history"),
            ("Logs", "live backend progress"),
            ("Exports", "JSON, notebooks, Python"),
        ],
        "10B981",
    )
    rounded_rectangle(draw, (70, 680, 1530, 875), 26, rgb("111827") + (255,), outline=rgb("334155"), width=2)
    draw.text((100, 715), "Live execution bar", font=font(25, True), fill=rgb(COLORS["cyan"]))
    rounded_rectangle(draw, (100, 770, 1460, 825), 20, rgb("020617") + (255,), outline=rgb("1E293B"), width=2)
    rounded_rectangle(draw, (106, 776, 106 + 940, 819), 18, rgb(COLORS["cyan"]) + (255,))
    draw.text((1120, 783), "phase: optimization | ETA range | worker telemetry", font=font(22), fill=rgb("D1FAE5"))
    img.convert("RGB").save(path, quality=95)
    return path


def create_outputs_image() -> Path:
    path = ASSET_DIR / "outputs_dashboard.png"
    img = Image.new("RGB", (1600, 980), rgb("F8FAFC"))
    draw = ImageDraw.Draw(img)
    draw.text((70, 45), "Example results dashboard", font=font(48, True), fill=rgb(COLORS["ink"]))
    draw.text((70, 105), "Client outputs combine portfolio analytics, candidate lists, quantum diagnostics, and reproducibility exports.", font=font(25), fill=rgb("475569"))
    chart_paths = [
        CHART_DIR / "solver_comparison.png",
        CHART_DIR / "qubo_breakdown.png",
        CHART_DIR / "qaoa_history.png",
        CHART_DIR / "risk_return_sharpe_ratio.png",
    ]
    positions = [(70, 175), (835, 175), (70, 560), (835, 560)]
    labels = ["Solver comparison", "QUBO breakdown", "QAOA optimization history", "Risk-return view"]
    for chart_path, pos, label in zip(chart_paths, positions, labels):
        x, y = pos
        rounded_rectangle(draw, (x, y, x + 690, y + 330), 18, (255, 255, 255), outline=rgb("CBD5E1"), width=2)
        draw.text((x + 22, y + 18), label, font=font(24, True), fill=rgb(COLORS["ink"]))
        if chart_path.exists():
            chart = Image.open(chart_path).convert("RGB")
            chart.thumbnail((640, 250))
            img.paste(chart, (x + 25, y + 65))
        else:
            draw.text((x + 28, y + 90), "Chart generated after run", font=font(22), fill=rgb("64748B"))
    img.save(path, quality=95)
    return path


def create_exports_image() -> Path:
    path = ASSET_DIR / "exports_panel.png"
    img = Image.new("RGB", (1600, 820), rgb(COLORS["navy"]))
    draw = ImageDraw.Draw(img)
    draw.text((70, 50), "Review files and code exports", font=font(48, True), fill=rgb(COLORS["white"]))
    draw_wrapped(
        draw,
        "Completed results can be saved as review JSON and reloaded later. The same embedded optimization package can generate executable Qiskit, PennyLane, and Cirq files without rerunning the optimizer.",
        (70, 118),
        1320,
        font(26),
        rgb("DDEBFF"),
        9,
    )
    rounded_rectangle(draw, (85, 250, 560, 685), 24, rgb("0F172A") + (255,), outline=rgb("334155"), width=2)
    draw.text((115, 285), "Review File", font=font(30, True), fill=rgb(COLORS["cyan"]))
    buttons = ["Save Review File", "Download Raw JSON Data", "Load Review / Raw JSON File"]
    y = 350
    for button in buttons:
        rounded_rectangle(draw, (120, y, 525, y + 58), 14, rgb("155E75") + (255,), outline=rgb("22D3EE"))
        draw.text((145, y + 16), button, font=font(22, True), fill=rgb("ECFEFF"))
        y += 82
    rounded_rectangle(draw, (640, 250, 1515, 685), 24, rgb("0F172A") + (255,), outline=rgb("334155"), width=2)
    draw.text((670, 285), "Code Exports", font=font(30, True), fill=rgb(COLORS["amber"]))
    exports = [
        ("Qiskit Notebook", ".ipynb with circuit, statevector readout, optional IBM cell"),
        ("Qiskit Python", ".py file for reproducible technical review"),
        ("PennyLane Notebook", ".ipynb, Python 3.11+ kernel recommended"),
        ("Cirq Notebook", ".ipynb for alternative simulator review"),
    ]
    y = 350
    for name, desc in exports:
        draw.text((675, y), name, font=font(23, True), fill=rgb("F8FAFC"))
        draw.text((930, y), desc, font=font(21), fill=rgb("CBD5E1"))
        y += 70
    img.save(path, quality=95)
    return path


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_text_color(cell, color: str, bold: bool = False) -> None:
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.font.color.rgb = RGBColor.from_string(color)
            run.font.bold = bold


def add_hyperlink(paragraph, text: str, url: str):
    part = paragraph.part
    r_id = part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), r_id)
    new_run = OxmlElement("w:r")
    r_pr = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), COLORS["cyan_dark"])
    r_pr.append(color)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    r_pr.append(underline)
    new_run.append(r_pr)
    text_el = OxmlElement("w:t")
    text_el.text = text
    new_run.append(text_el)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def set_document_styles(doc: Document) -> None:
    normal = doc.styles["Normal"]
    normal.font.name = "Aptos"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(COLORS["ink"])
    for style_name, size, color in [
        ("Title", 30, COLORS["navy"]),
        ("Heading 1", 20, COLORS["navy"]),
        ("Heading 2", 15, COLORS["cyan_dark"]),
        ("Heading 3", 12, COLORS["slate"]),
    ]:
        style = doc.styles[style_name]
        style.font.name = "Aptos Display"
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor.from_string(color)
        style.font.bold = True


def add_top_rule(paragraph, text: str, color: str = COLORS["cyan_dark"]) -> None:
    run = paragraph.add_run(text)
    run.font.bold = True
    run.font.color.rgb = RGBColor.from_string(color)


def add_callout(doc: Document, title: str, body: str, fill: str = "ECFEFF") -> None:
    table = doc.add_table(rows=1, cols=1)
    cell = table.cell(0, 0)
    set_cell_shading(cell, fill)
    p = cell.paragraphs[0]
    r = p.add_run(title)
    r.bold = True
    r.font.color.rgb = RGBColor.from_string(COLORS["navy"])
    p.add_run(f"\n{body}")
    doc.add_paragraph()


def add_table(doc: Document, headers: list[str], rows: list[list[str]], widths: list[float] | None = None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, header in enumerate(headers):
        hdr[i].text = header
        set_cell_shading(hdr[i], COLORS["navy"])
        set_cell_text_color(hdr[i], "FFFFFF", bold=True)
        if widths:
            hdr[i].width = Cm(widths[i])
    for row in rows:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            cells[i].text = value
            if widths:
                cells[i].width = Cm(widths[i])
    doc.add_paragraph()
    return table


def add_bullets(doc: Document, items: list[str]) -> None:
    for item in items:
        doc.add_paragraph(item, style="List Bullet")


def add_numbered(doc: Document, items: list[str]) -> None:
    for item in items:
        doc.add_paragraph(item, style="List Number")


def build_doc() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    cover = create_cover_image()
    workflow = create_workflow_image()
    interface = create_interface_image()
    outputs = create_outputs_image()
    exports = create_exports_image()

    doc = Document()
    set_document_styles(doc)
    section = doc.sections[0]
    section.top_margin = Cm(1.5)
    section.bottom_margin = Cm(1.5)
    section.left_margin = Cm(1.7)
    section.right_margin = Cm(1.7)
    section.header.paragraphs[0].text = "QAOA RQP Pro V9.2 | qubit-lab.ch"
    section.footer.paragraphs[0].text = "Client User Manual | Generated May 2026"

    doc.add_picture(str(cover), width=Inches(7.3))
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.add_run("Client User Manual").bold = True
    subtitle = doc.add_paragraph("Inputs, methods, outputs, interpretation, and reproducible exports")
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph()
    add_callout(
        doc,
        "Positioning",
        "QAOA RQP Pro is a rapid prototyping environment for turning portfolio-optimization workbooks into classical baselines, QUBO formulations, QAOA simulations, diagnostics, and portable quantum-circuit exports.",
        "E0F2FE",
    )

    doc.add_page_break()
    doc.add_heading("Contents", level=1)
    contents = [
        "1. qubit-lab.ch and the RQP mission",
        "2. What the tool does",
        "3. Quick start",
        "4. Inputs and workbook format",
        "5. Optimization settings",
        "6. Methods used",
        "7. Outputs and interpretation",
        "8. Review files and code exports",
        "9. Access levels and limits",
        "10. Good practice and troubleshooting",
        "Appendix: field reference and glossary",
    ]
    add_bullets(doc, contents)

    doc.add_heading("1. qubit-lab.ch and the RQP mission", level=1)
    p = doc.add_paragraph()
    p.add_run("qubit-lab.ch").bold = True
    p.add_run(
        " is focused on making quantum computing understandable, relevant, and actionable for business leaders, finance professionals, technology stakeholders, managers, quants, and technically curious practitioners. Its practical mission is to connect technical foundations with real questions in business, finance, and selected adjacent domains."
    )
    doc.add_paragraph(
        "The Rapid Quantum Prototyping (RQP) tool follows that same principle: it translates a familiar Excel-based portfolio use case into a transparent optimization pipeline, then exposes the classical and quantum results in a form that can be inspected, challenged, and reused."
    )
    add_callout(
        doc,
        "Straight talk, not black-box quantum.",
        "The tool is designed to make the full chain visible: workbook assumptions, QUBO construction, solver settings, progress logs, portfolio metrics, charts, candidate tables, and executable circuit exports.",
        "ECFEFF",
    )
    doc.add_paragraph("Sources used for positioning: ")
    p = doc.add_paragraph()
    add_hyperlink(p, "qubit-lab.ch homepage", "https://qubit-lab.ch/")
    p.add_run(" | ")
    add_hyperlink(p, "About qubit-lab.ch", "https://qubit-lab.ch/about")
    p.add_run(" | ")
    add_hyperlink(p, "Quantum Finance / RQP tool", "https://qubit-lab.ch/finance")

    doc.add_heading("2. What the tool does", level=1)
    doc.add_paragraph(
        "QAOA RQP Pro V9.2 is a client-facing optimization cockpit for finance-style portfolio experiments. Users upload a structured Excel workbook, select optimization settings, and run a backend job that evaluates a classical baseline and, when selected, QAOA simulation paths."
    )
    add_bullets(
        doc,
        [
            "Builds a QUBO / Ising representation from portfolio inputs, costs, expected returns, covariance, budget, and optional exact subtype budgets.",
            "Separates fixed holdings from variable decision blocks: fixed positions are always included, while variable blocks become binary decisions and therefore qubits.",
            "Runs a classical baseline and optional QAOA simulations with live progress, logs, memory telemetry, and backend ETA.",
            "Provides second-opinion comparison through Qiskit simulation when selected and permitted by the license level.",
            "Exports completed results as review JSON and executable Qiskit, PennyLane, and Cirq artifacts for technical review and reproducibility.",
        ],
    )
    doc.add_picture(str(workflow), width=Inches(7.3))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_heading("3. Quick start", level=1)
    add_numbered(
        doc,
        [
            "Open the RQP tool from the qubit-lab.ch finance page or the provided private V9.2 route.",
            "Check access with a license key, or continue with the public demo limits where available.",
            "Download a demo workbook or upload your own workbook in the supported Excel format.",
            "Inspect the workbook to validate required sheets, count qubits, read settings, and estimate runtime.",
            "Select mode, worker profile, response level, QAOA settings, and optional second-opinion comparison.",
            "Submit the run and monitor progress, backend logs, memory telemetry, ETA, and result availability.",
            "Review metrics, charts, candidate tables, solver comparison, QUBO breakdown, and portfolio contents.",
            "Save a review file, download raw JSON, or generate code exports for external quantum-framework review.",
        ],
    )
    doc.add_picture(str(interface), width=Inches(7.3))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_heading("4. Inputs and workbook format", level=1)
    doc.add_paragraph(
        "The primary input is an Excel workbook. Version 9 keeps the Version 8 workbook pattern and adds optional exact subtype budget constraints. The required input sheets are:"
    )
    add_table(
        doc,
        ["Sheet", "Purpose", "Important fields"],
        [
            ["Settings", "Global optimization and portfolio settings.", "Budget, lambda penalties, risk-free rate, QAOA defaults, random seed, additional type constraints."],
            ["Assets", "Fixed and variable portfolio blocks.", "Ticker, Decision Role, Indicative Market Cost USD, Expected Return Proxy, Annual Volatility, optional Type A-E Size columns."],
            ["AnnualizedCovariance", "Risk model used to compute portfolio variance.", "Annualized covariance matrix across all referenced tickers."],
        ],
        [3.4, 6.0, 7.0],
    )
    doc.add_heading("Asset rows", level=2)
    add_bullets(
        doc,
        [
            "Decision Role = fixed: the holding is always part of the portfolio. It contributes cost, return, risk, budget exposure, QUBO constants, and type-budget exposure but does not consume a qubit.",
            "Decision Role = variable: the row becomes a binary decision variable. Each variable row consumes one qubit in the QAOA formulation.",
            "Indicative Market Cost USD is the Version 9 cost column used by both classical and QAOA paths. Legacy Approx Cost USD can be mapped for compatibility, but the indicative column takes priority when both are present.",
            "Expected Return Proxy and Annual Volatility must be numeric for selectable options.",
        ],
    )
    doc.add_heading("Optional subtype budget targets", level=2)
    doc.add_paragraph(
        "Version 9 supports up to five exact subtype budget targets. These are useful for portfolio dimensions such as sector, region, asset class, sustainability bucket, liquidity bucket, or internal risk category."
    )
    add_table(
        doc,
        ["Workbook element", "Meaning"],
        [
            ["Additional Type Constraints", "Integer from 0 to 5. Missing is treated as 0."],
            ["Type A Size ... Type E Size", "Stable numeric asset columns in the Assets sheet. Missing size cells are treated as 0."],
            ["Type X Name", "User-facing label, such as Bond, Equity, Region A, or High Liquidity."],
            ["Type X Budget", "Target exposure for that subtype."],
            ["Type X Budget Penalty", "Penalty weight applied to deviations from the subtype target."],
        ],
        [5.0, 11.0],
    )

    doc.add_heading("5. Optimization settings", level=1)
    add_table(
        doc,
        ["Input", "What it controls", "User guidance"],
        [
            ["Mode", "Classical only, QAOA Lightning simulation, or QAOA Tensor simulation.", "Start with classical_only for input validation; use QAOA for quantum prototyping."],
            ["2nd opinion / comparison", "Internal only, Qiskit simulation, or IBM hardware option later.", "Use Qiskit simulation to compare an independent circuit reconstruction against the internal quantum result."],
            ["Response level", "Amount of returned reporting detail.", "Use full for review and documentation; compact for quick status checks."],
            ["Worker profile", "Backend CPU/RAM profile.", "Use the smallest profile that fits the problem; larger profiles are license-gated."],
            ["Layers", "QAOA depth p.", "Higher values can improve expressiveness but increase runtime and tuning complexity."],
            ["Iterations", "Optimizer iterations per restart.", "Increase for deeper searches; keep modest for demos."],
            ["Restarts", "Number of independent optimizer starts.", "Useful when avoiding local minima."],
            ["QAOA shots", "Number of readout samples when sampling is active.", "Exact mode is used for small exact-probability simulations where available."],
            ["Budget lambda", "Penalty for missing the total budget target.", "Higher values enforce budget more strongly."],
            ["Risk lambda", "Penalty weight for variance/risk in the objective.", "Higher values favor lower-risk portfolios."],
            ["Risk-free rate", "Reference rate for Sharpe-like metrics.", "Set consistently with the expected-return horizon."],
            ["Random seed", "Optional reproducibility aid.", "Use the same seed for comparable runs; exact equality can still depend on runtime environment."],
        ],
        [3.8, 5.5, 7.0],
    )

    doc.add_heading("6. Methods used", level=1)
    doc.add_heading("Portfolio objective", level=2)
    doc.add_paragraph(
        "The tool formulates a binary portfolio-selection problem. Variable asset blocks are encoded as x_i in {0,1}. Fixed positions are included in the portfolio and influence offsets, budget usage, covariance terms, and subtype budgets."
    )
    doc.add_paragraph(
        "The objective combines return, variance/risk, total budget normalization, and optional exact subtype budget penalties. These subtype targets use the current normalized target form. The resulting QUBO is converted into an Ising form suitable for QAOA circuit construction."
    )
    add_callout(
        doc,
        "Why QUBO matters",
        "QUBO is the bridge between the business problem and the quantum circuit. It makes each candidate portfolio a bitstring and assigns it an objective value that can be searched, compared, and reported.",
        "FEF3C7",
    )
    doc.add_heading("Classical baseline", level=2)
    doc.add_paragraph(
        "The classical path evaluates candidate portfolios under the same objective and constraints. It provides a practical benchmark and helps detect whether a quantum-style run is behaving plausibly."
    )
    doc.add_heading("QAOA simulation", level=2)
    doc.add_paragraph(
        "The QAOA path initializes a superposition over candidate bitstrings, alternates cost and mixer layers using optimized angle parameters, and reads out a probability distribution over candidate portfolios. The tool reports both top-probability and top-QUBO candidates."
    )
    doc.add_heading("Second opinion comparison", level=2)
    doc.add_paragraph(
        "When selected and allowed by the license, a Qiskit reconstruction can be used as a second-opinion comparison. This is intended for technical confidence, explainability, and cross-framework validation. IBM hardware execution is reserved as a later controlled option."
    )

    doc.add_heading("7. Outputs and interpretation", level=1)
    doc.add_picture(str(outputs), width=Inches(7.3))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_table(
        doc,
        ["Output", "Meaning", "How to use it"],
        [
            ["Portfolio metric cards", "Classical, quantum, and second-opinion return, volatility, Sharpe-like ratio, invested amount, and budget gap.", "Use for high-level comparison and executive review."],
            ["Portfolio contents", "Selected fixed and variable positions.", "Validate that the final selection makes business sense."],
            ["Top candidates", "Top portfolios by readout probability and by reconstructed QUBO objective.", "Compare what the quantum readout preferred against what the objective ranks best."],
            ["Solver comparison", "Side-by-side metric bars for classical, quantum, and second-opinion results.", "Look for alignment or informative divergence."],
            ["QUBO breakdown", "Return, risk, budget, and subtype penalty components.", "Explain why one candidate scored better or worse."],
            ["Optimization history", "Objective path across iterations and restarts.", "Assess convergence and whether settings may need adjustment."],
            ["Backend logs", "Timestamped live status from validation, QUBO construction, optimization, result processing, and finalization.", "Useful for operational review and support."],
            ["Memory telemetry", "Runtime memory observations.", "Useful when choosing worker profile for larger runs."],
        ],
        [4.0, 6.2, 6.0],
    )
    doc.add_heading("Reading the metrics", level=2)
    add_bullets(
        doc,
        [
            "Return is computed from the expected-return proxy and selected portfolio weights.",
            "Volatility is computed from the annualized covariance matrix and selected weights.",
            "Sharpe-like ratio is the excess-return-to-volatility style indicator used for comparison, not a guarantee of investment quality.",
            "Budget-normalized metrics include the effect of uninvested cash or budget gap under the configured risk-free rate.",
            "QUBO value is an optimization objective value. Lower QUBO is generally better within the reconstructed objective, but business interpretation should use the metric cards and portfolio contents as well.",
        ],
    )

    doc.add_heading("8. Review files and code exports", level=1)
    doc.add_picture(str(exports), width=Inches(7.3))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph(
        "The review and raw JSON files are designed for reproducibility. They include not only visible results but also the code-export package needed to regenerate notebook and Python artifacts later."
    )
    add_table(
        doc,
        ["Export", "Format", "Purpose"],
        [
            ["Review file", "JSON", "Reload the visual result in the frontend without rerunning the backend."],
            ["Raw JSON data", "JSON", "Technical review, audit trail, downstream processing, or support."],
            ["Qiskit notebook", "ipynb", "Rebuild circuit, simulate statevector, inspect candidates, optional IBM Runtime cell."],
            ["Qiskit Python", "py", "Script-style reproducibility for code review or CI-style checks."],
            ["PennyLane notebook", "ipynb", "Cross-framework reconstruction and probability readout; Python 3.11+ kernel recommended."],
            ["Cirq notebook", "ipynb", "Alternative circuit framework and simulator comparison."],
        ],
        [4.2, 3.0, 9.2],
    )

    doc.add_heading("9. Access levels and limits", level=1)
    doc.add_paragraph(
        "Access is policy-controlled. Exact limits can evolve, but the current V9.2 structure follows these broad tiers:"
    )
    add_table(
        doc,
        ["Level", "Typical availability", "Practical meaning"],
        [
            ["Public Demo", "No key, small QAOA demos.", "Good for orientation and basic review."],
            ["Qualified Demo", "Keyed demo with larger workbook support.", "Good for guided client trials."],
            ["Tester", "More QAOA settings, tensor simulation, code exports.", "Good for technical evaluation and reproducibility checks."],
            ["Internal Power / Ultra", "Higher internal limits.", "Used for controlled larger experiments and advanced testing."],
        ],
        [4.0, 5.0, 7.0],
    )
    add_callout(
        doc,
        "Client note",
        "If a button or mode is disabled, it usually means the current key level does not allow that feature, the result is not yet completed, or the loaded review file does not contain the required code-export package.",
        "E0F2FE",
    )

    doc.add_heading("10. Good practice and troubleshooting", level=1)
    add_table(
        doc,
        ["Situation", "Recommended action"],
        [
            ["Workbook does not inspect", "Check required sheets, headers, numeric fields, missing covariance tickers, and active type-budget columns."],
            ["Runtime estimate is too high", "Reduce qubits, QAOA layers, iterations, restarts, or use a more appropriate worker profile/key."],
            ["Quantum result differs from classical result", "Compare top-probability and top-QUBO tables, increase iterations/restarts, review penalties, and use second-opinion simulation."],
            ["PennyLane notebook import error", "Use a Python 3.11+ Jupyter kernel and rerun the first install cell."],
            ["Qiskit notebook package missing", "Run the first install cell with `%pip`, then restart or rerun the kernel if needed."],
            ["Code export buttons disabled", "Complete a QAOA run or load a result JSON containing the code-export package; ensure the key level allows the target export."],
            ["Long-running job", "Use live logs, progress, and ETA; cancel only if the job is no longer needed."],
        ],
        [5.5, 10.5],
    )
    doc.add_heading("Recommended interpretation discipline", level=2)
    add_bullets(
        doc,
        [
            "Treat QAOA results as rapid prototypes and diagnostic evidence, not as automatic investment decisions.",
            "Always compare against the classical baseline and inspect the portfolio contents.",
            "Use subtype budget targets and penalty settings deliberately; overly strong or weak penalties can dominate the objective.",
            "Save review files for any run that may be discussed with clients or technical reviewers.",
            "Use generated notebooks to make circuit assumptions transparent and executable outside the web interface.",
        ],
    )

    doc.add_heading("Appendix A: Field reference", level=1)
    add_table(
        doc,
        ["Frontend field", "Expected input", "Notes"],
        [
            ["License key", "Text", "Optional for public demo; required for keyed tiers and code exports."],
            ["Excel file", ".xlsx", "Use demo workbook as template for required sheets and headers."],
            ["Mode", "Dropdown", "Available options depend on key level."],
            ["2nd opinion / comparison", "Dropdown", "Qiskit simulation currently available for tester level and above."],
            ["Worker profile", "Dropdown", "Small, medium, large; availability depends on key level."],
            ["Response level", "compact / standard / full", "Full is best for client review and documentation."],
            ["Layers", "Integer", "QAOA depth p."],
            ["Iterations", "Integer", "Optimizer iteration budget."],
            ["Restarts", "Integer", "Independent optimizer starts."],
            ["QAOA shots", "Integer or exact", "Exact shown when exact probability mode is active."],
            ["Budget lambda", "Numeric", "Budget penalty strength."],
            ["Risk lambda", "Numeric", "Variance/risk penalty strength."],
            ["Risk-free rate", "Numeric", "Used in Sharpe-like and budget-normalized metrics."],
            ["Random seed", "Integer 0 to 4,294,967,295", "Optional reproducibility aid."],
        ],
        [4.6, 4.6, 7.0],
    )

    doc.add_heading("Appendix B: Glossary", level=1)
    add_table(
        doc,
        ["Term", "Plain-language meaning"],
        [
            ["QUBO", "Quadratic unconstrained binary optimization; the bitstring objective optimized by the tool."],
            ["Ising model", "Equivalent quantum-friendly representation of the QUBO objective."],
            ["QAOA", "Quantum Approximate Optimization Algorithm, a variational quantum approach for combinatorial optimization."],
            ["Bitstring", "A string of 0/1 decisions representing selected variable assets."],
            ["Fixed asset", "Always included in the portfolio; does not consume a qubit."],
            ["Variable asset", "Selectable candidate block; consumes one qubit."],
            ["Second opinion", "Independent Qiskit-based reconstruction/simulation used for comparison."],
            ["Review file", "Saved JSON snapshot that restores a completed result view."],
            ["Code export package", "Self-contained data embedded in result JSON for regenerating executable notebooks/scripts."],
        ],
        [4.0, 12.0],
    )

    doc.add_heading("Disclaimer", level=1)
    doc.add_paragraph(
        "This manual describes a rapid prototyping and education tool. Outputs are intended for technical review, experimentation, and structured discussion. They are not financial advice and should not be used as sole basis for investment, risk, or production technology decisions."
    )

    doc.save(OUTPUT_DOCX)


if __name__ == "__main__":
    build_doc()
