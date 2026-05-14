"""PDF report export for completed QAOA RQP results."""

from __future__ import annotations

import base64
import datetime as dt
import io
from dataclasses import dataclass
from typing import Any, Iterable, Mapping

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.schemas import ApiError


LEGAL_URL = "https://qubit-lab.ch/legal"
REPORT_SCHEMA_REVIEW = "qaoa-rqp-review-snapshot"
REPORT_SCHEMA_RAW = "qaoa-rqp-v9-raw-json-data"
PAGE_WIDTH, PAGE_HEIGHT = A4
LEFT_RIGHT_MARGIN = 12 * mm
TOP_BOTTOM_MARGIN = 10 * mm
PAGE_CONTENT_WIDTH = PAGE_WIDTH - (2 * LEFT_RIGHT_MARGIN)
GRID_GAP = 6 * mm
HALF_WIDTH = (PAGE_CONTENT_WIDTH - GRID_GAP) / 2
THIRD_WIDTH = (PAGE_CONTENT_WIDTH - (2 * GRID_GAP)) / 3
COLOR_BG = colors.HexColor("#F8FAFC")
COLOR_BORDER = colors.HexColor("#CBD5E1")
COLOR_GRID = colors.HexColor("#E2E8F0")
COLOR_TEXT = colors.HexColor("#0F172A")
COLOR_SUBTEXT = colors.HexColor("#475569")
COLOR_DARK = colors.HexColor("#0F172A")
COLOR_ROW_ALT = colors.HexColor("#F8FAFC")
COLOR_SECOND = colors.HexColor("#8A5A00")
EXPORT_MODE_INTERNAL_ONLY = "internal_only"
EXPORT_MODE_IBM_EXTERNAL_RUN = "ibm_external_run"
CHART_TITLES = [
    ("risk_return_sharpe", "Risk / Return / Sharpe ratio"),
    ("risk_return_qubo", "Risk / Return / QUBO"),
    ("qubo_breakdown_classical", "QUBO Breakdown - Classical"),
    ("qubo_breakdown", "QUBO Breakdown - Classical"),
    ("qubo_breakdown_quantum", "QUBO Breakdown - Quantum"),
    ("qubo_breakdown_second_opinion", "QUBO Breakdown - Quantum 2nd opinion"),
    ("optimization_history", "Optimization History"),
    ("circuit_overview", "Circuit Overview"),
    ("solver_comparison", "Solver Comparison"),
]


@dataclass(frozen=True)
class RenderedPdfReport:
    filename: str
    content_type: str
    content: bytes


def render_pdf_report(payload: Mapping[str, Any]) -> RenderedPdfReport:
    context = _extract_report_context(payload)
    result = context["result"]
    if not isinstance(result, Mapping) or str(result.get("status") or "").lower() != "completed":
        raise ApiError(
            400,
            "pdf_report_requires_completed_result",
            "A completed optimization result is required for PDF report export.",
        )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=LEFT_RIGHT_MARGIN,
        rightMargin=LEFT_RIGHT_MARGIN,
        topMargin=TOP_BOTTOM_MARGIN,
        bottomMargin=TOP_BOTTOM_MARGIN,
        title="QAOA Rapid Quantum Prototyping Report",
        author="qubit-lab.ch",
    )
    story = _build_story(context)
    doc.build(story, onFirstPage=_draw_page_frame, onLaterPages=_draw_page_frame)
    filename = _report_filename(context)
    return RenderedPdfReport(
        filename=filename,
        content_type="application/pdf",
        content=buffer.getvalue(),
    )


def _build_story(context: dict[str, Any]) -> list[Any]:
    styles = _styles()
    result = dict(context["result"] or {})
    reporting = dict(result.get("reporting") or {})
    summary = dict(reporting.get("summary") or {})
    diagnostics = dict(result.get("diagnostics") or {})
    inspect_result = dict(context.get("inspect_result") or {})
    inspect_diagnostics = dict(inspect_result.get("diagnostics") or {})
    portfolio_metrics = dict(result.get("portfolio_metrics") or {})
    components = dict(result.get("components") or {})
    circuit = dict(reporting.get("circuit") or diagnostics.get("circuit") or {})
    ibm = dict(circuit.get("ibm") or {})
    second_opinion = dict(reporting.get("second_opinion") or {})
    second_opinion_summary = dict(summary.get("quantum_second_opinion_summary") or second_opinion.get("summary") or {})
    classical_summary = dict(summary.get("classical_result_summary") or {})
    quantum_summary = dict(summary.get("quantum_result_summary") or {})
    export_mode = str(summary.get("export_mode") or diagnostics.get("export_mode") or "").strip()
    second_opinion_mode_chosen = export_mode not in {"", EXPORT_MODE_INTERNAL_ONLY}
    is_ibm_hardware_second_opinion = export_mode == EXPORT_MODE_IBM_EXTERNAL_RUN
    second_opinion_panel_suffix = ""
    second_label = second_opinion.get("source_label") or second_opinion_summary.get("source") or summary.get("second_opinion_label") or second_opinion.get("label")
    if second_opinion_mode_chosen and second_label not in (None, "", "n/a"):
        second_opinion_panel_suffix = f" - {_text(second_label)}"
    portfolio_contents = _unique_portfolio_rows(reporting.get("portfolio_contents") or result.get("selected_blocks") or [])
    quantum_portfolio_contents = _build_portfolio_from_bitstring(
        portfolio_contents,
        quantum_summary.get("best_bitstring"),
    )
    second_opinion_portfolio_contents = _unique_portfolio_rows(second_opinion.get("portfolio_contents") or [])
    fallback_second_opinion_contents = _build_portfolio_from_bitstring(
        portfolio_contents,
        second_opinion_summary.get("best_bitstring"),
    )
    second_opinion_best_qubo = list(second_opinion.get("best_qubo") or [])
    second_opinion_samples = list(second_opinion.get("samples") or [])
    classical_candidates = list(reporting.get("classical_candidates") or result.get("top_candidates") or [])
    quantum_samples = list(reporting.get("quantum_samples") or [])
    qaoa_best_qubo = list(reporting.get("qaoa_best_qubo") or [])
    solver_comparison = list(reporting.get("solver_comparison") or [])
    displayed_solver_comparison = _displayed_solver_comparison(
        solver_comparison,
        second_opinion_mode_chosen=second_opinion_mode_chosen,
        second_opinion_summary=second_opinion_summary,
    )
    active_diagnostics = diagnostics or inspect_diagnostics
    reporting_summary = summary
    story: list[Any] = []

    story.extend(
        [
            Paragraph("QAOA Rapid Quantum Prototyping", styles["Title"]),
            Paragraph("Optimization Overview and Result Report", styles["Subtitle"]),
            Paragraph(
                (
                    "Generated by qubit-lab.ch from a completed optimization result. "
                    f"Legal terms: {LEGAL_URL}"
                ),
                styles["Small"],
            ),
            Spacer(1, 5),
            _flowable_grid(
                [
                    _panel(
                        "Run overview",
                        [_kv_table(
                            [
                                ("Workbook", context.get("original_filename")),
                                ("Run ID", result.get("run_id")),
                                ("Generated", _timestamp_now()),
                                ("Status", result.get("status")),
                                ("Model version", result.get("model_version")),
                            ],
                            styles=styles,
                        )],
                        width=HALF_WIDTH,
                    ),
                    _panel(
                        "Execution settings",
                        [_kv_table(
                            [
                                ("Mode", result.get("mode")),
                                ("Solver", result.get("solver")),
                                ("Worker profile", result.get("worker_profile_label")),
                                ("Export mode", reporting_summary.get("export_mode_label") or reporting_summary.get("export_mode")),
                                ("Response level", _nested(active_diagnostics, "effective_settings", "response_level") or active_diagnostics.get("response_level")),
                            ],
                            styles=styles,
                        )],
                        width=HALF_WIDTH,
                    ),
                ],
                widths=[HALF_WIDTH, HALF_WIDTH],
            ),
            Spacer(1, 5),
            HRFlowable(color=colors.HexColor("#284061"), thickness=0.6),
            Spacer(1, 6),
            Paragraph("Executive Summary", styles["Section"]),
            _flowable_grid(
                [
                    _panel(
                        "Problem size",
                        [_kv_table(
                            [
                                ("Decision variables", reporting_summary.get("decision_variables")),
                                ("QAOA layers", reporting_summary.get("qaoa_p")),
                                ("Additional type constraints", active_diagnostics.get("additional_type_constraints_count") or inspect_diagnostics.get("additional_type_constraints_count")),
                                ("QUBO shape", active_diagnostics.get("qubo_shape")),
                                ("QUBO nonzero entries", active_diagnostics.get("qubo_nonzero_entries")),
                            ],
                            styles=styles,
                        )],
                        width=HALF_WIDTH,
                    ),
                    _panel(
                        "Candidates and sampling",
                        [_kv_table(
                            [
                                ("Classical candidates", reporting_summary.get("classical_candidate_count")),
                                ("QAOA candidates", reporting_summary.get("qaoa_candidate_count")),
                                ("QAOA status", reporting_summary.get("qaoa_status")),
                                ("Shots mode", active_diagnostics.get("shots_mode")),
                                ("QAOA shots", active_diagnostics.get("qaoa_shots_display") or active_diagnostics.get("qaoa_shots")),
                            ],
                            styles=styles,
                        )],
                        width=HALF_WIDTH,
                    ),
                    _panel(
                        "Runtime",
                        [_kv_table(
                            [
                                ("Actual runtime", _seconds_text(active_diagnostics.get("actual_runtime_sec"))),
                                ("Raw estimate", _seconds_text(active_diagnostics.get("raw_estimated_runtime_sec"))),
                                ("Calibrated estimate", _seconds_text(active_diagnostics.get("estimated_runtime_sec"))),
                                ("ETA range", _eta_range_text(active_diagnostics.get("eta_seconds_low"), active_diagnostics.get("eta_seconds_high"))),
                                ("Peak memory", _memory_text(active_diagnostics.get("peak_memory_used_gib"))),
                            ],
                            styles=styles,
                        )],
                        width=HALF_WIDTH,
                    ),
                ],
                widths=[HALF_WIDTH, HALF_WIDTH],
            ),
            Spacer(1, 8),
        ]
    )

    summary_cards = [classical_summary, quantum_summary, second_opinion_summary]
    available_cards = [card for card in summary_cards if card]
    if available_cards:
        story.append(Paragraph("Result Summaries", styles["Section"]))
        story.append(
            _flowable_grid(
                [_candidate_summary_block(card, styles, width=HALF_WIDTH) for card in available_cards],
                widths=[HALF_WIDTH, HALF_WIDTH],
            )
        )

    story.extend(
        [
            Spacer(1, 8),
            Paragraph("Portfolio Metrics", styles["Section"]),
            _flowable_grid(
                [
                    _panel("Classical Portfolio Metrics", [_kv_table(_classical_metric_rows(classical_summary, portfolio_metrics), styles=styles)], width=HALF_WIDTH),
                    _panel("Quantum Portfolio Metrics", [_quantum_metric_content(quantum_summary, styles)], width=HALF_WIDTH, accent="amber"),
                    *(
                        [
                            _panel(
                                f"Quantum Portfolio Metrics (2nd opinion){second_opinion_panel_suffix}",
                                [_quantum_metric_content(second_opinion_summary, styles, reason=second_opinion.get("reason"))],
                                width=HALF_WIDTH,
                                accent="second",
                            )
                        ]
                        if second_opinion_mode_chosen
                        else []
                    ),
                ],
                widths=[HALF_WIDTH, HALF_WIDTH],
            ),
            Spacer(1, 6),
            Paragraph("Objective / QUBO Breakdown", styles["Section"]),
            _flowable_grid(
                [
                    _panel("Classical Objective / QUBO Breakdown", [_kv_table(_classical_breakdown_rows(classical_summary, components, reporting_summary), styles=styles)], width=HALF_WIDTH),
                    _panel("Quantum Objective / QUBO Breakdown", [_quantum_breakdown_content(quantum_summary, styles)], width=HALF_WIDTH, accent="amber"),
                    *(
                        [
                            _panel(
                                f"Quantum Objective / QUBO Breakdown (2nd opinion){second_opinion_panel_suffix}",
                                [_quantum_breakdown_content(second_opinion_summary, styles, reason=second_opinion.get("reason"))],
                                width=HALF_WIDTH,
                                accent="second",
                            )
                        ]
                        if second_opinion_mode_chosen
                        else []
                    ),
                ],
                widths=[HALF_WIDTH, HALF_WIDTH],
            ),
        ]
    )

    charts = dict(reporting.get("charts") or {})
    chart_panels = _chart_panels(charts, styles)
    if chart_panels:
        story.extend([Spacer(1, 8), Paragraph("Plots", styles["Section"]), _flowable_grid(chart_panels, widths=[HALF_WIDTH, HALF_WIDTH])])

    story.extend([Spacer(1, 8), Paragraph("Portfolio Contents", styles["Section"])])
    if portfolio_contents:
        story.extend(
            [
                Paragraph("Classical Portfolio Contents", styles["Subsection"]),
                _portfolio_table(portfolio_contents, styles),
                Spacer(1, 5),
            ]
        )
    if quantum_portfolio_contents:
        story.extend(
            [
                Paragraph("Quantum Portfolio Contents", styles["Subsection"]),
                _portfolio_table(quantum_portfolio_contents, styles),
                Spacer(1, 5),
            ]
        )
    else:
        story.extend([Paragraph("Quantum Portfolio Contents", styles["Subsection"]), Paragraph("No quantum portfolio contents are available for the selected quantum candidate.", styles["Body"]), Spacer(1, 5)])
    if second_opinion_mode_chosen:
        second_rows = second_opinion_portfolio_contents or fallback_second_opinion_contents
        story.append(Paragraph(f"Quantum Portfolio Contents (2nd opinion){second_opinion_panel_suffix}", styles["Subsection"]))
        if second_rows:
            story.extend([_portfolio_table(second_rows, styles), Spacer(1, 5)])
        else:
            story.extend([Paragraph(_text(second_opinion.get("reason") or "No 2nd opinion portfolio contents are available for this result."), styles["Body"]), Spacer(1, 5)])

    story.extend([Paragraph("Candidate Tables", styles["Section"])])
    story.extend(_candidate_section_flowables(
        classical_candidates,
        qaoa_best_qubo,
        quantum_samples,
        second_opinion_mode_chosen=second_opinion_mode_chosen,
        is_ibm_hardware_second_opinion=is_ibm_hardware_second_opinion,
        second_opinion_best_qubo=second_opinion_best_qubo,
        second_opinion_samples=second_opinion_samples,
        second_opinion_reason=second_opinion.get("reason"),
        second_opinion_panel_suffix=second_opinion_panel_suffix,
        styles=styles,
    ))

    if displayed_solver_comparison:
        story.extend(
            [
                Paragraph("Solver Comparison", styles["Section"]),
                _candidate_table(displayed_solver_comparison, styles, show_probability=False, show_count=False),
                Spacer(1, 6),
            ]
        )

    diagnostics_panels = [
        _panel("Runtime and service", [_kv_table(_runtime_diagnostic_rows(active_diagnostics, result), styles=styles)], width=HALF_WIDTH),
        _panel("Worker and memory", [_kv_table(_worker_diagnostic_rows(active_diagnostics, result), styles=styles)], width=HALF_WIDTH),
        _panel("QAOA and QUBO", [_kv_table(_qubo_diagnostic_rows(active_diagnostics, reporting_summary), styles=styles)], width=HALF_WIDTH),
        _panel("Modes and settings", [_kv_table(_mode_diagnostic_rows(active_diagnostics, reporting_summary), styles=styles)], width=HALF_WIDTH),
    ]
    export_rows = _export_diagnostic_rows(active_diagnostics)
    if export_rows:
        diagnostics_panels.append(_panel("Export diagnostics", [_kv_table(export_rows, styles=styles)], width=HALF_WIDTH))
    type_constraint_rows = _type_constraint_rows(active_diagnostics, inspect_diagnostics)
    if type_constraint_rows:
        diagnostics_panels.append(_panel("Type-budget diagnostics", [_kv_table(type_constraint_rows, styles=styles)], width=HALF_WIDTH))
    if diagnostics_panels:
        story.extend([PageBreak(), Paragraph("Diagnostics", styles["Section"]), _flowable_grid(diagnostics_panels, widths=[HALF_WIDTH, HALF_WIDTH])])

    circuit_panels = []
    if circuit:
        circuit_panels.append(
            _panel(
                "Circuit Overview",
                [_kv_table(_circuit_rows(circuit), styles=styles)],
                width=HALF_WIDTH,
            )
        )
    if ibm:
        circuit_panels.extend(_ibm_panels(ibm, styles))
    if circuit_panels:
        story.extend([Spacer(1, 6), Paragraph("Circuit and Hardware", styles["Section"]), _flowable_grid(circuit_panels, widths=[HALF_WIDTH, HALF_WIDTH])])

    log_story = _log_story(context, styles)
    if log_story:
        story.extend([PageBreak(), Paragraph("Recent Logs", styles["Section"]), *log_story])

    return story


def _extract_report_context(payload: Mapping[str, Any]) -> dict[str, Any]:
    source = dict(payload or {})
    schema = str(source.get("schema") or "").strip()
    if schema == REPORT_SCHEMA_REVIEW:
        return {
            "original_filename": source.get("original_filename"),
            "result": source.get("result"),
            "inspect_result": source.get("inspect_result"),
            "license": source.get("license"),
            "backend_job_logs": source.get("backend_job_logs") or [],
            "client_logs": source.get("client_logs") or [],
        }
    if schema == REPORT_SCHEMA_RAW:
        return {
            "original_filename": source.get("original_filename"),
            "result": source.get("result"),
            "inspect_result": source.get("inspect_result"),
            "license": None,
            "backend_job_logs": [],
            "client_logs": [],
        }
    if isinstance(source.get("result"), Mapping):
        return {
            "original_filename": source.get("original_filename"),
            "result": source.get("result"),
            "inspect_result": source.get("inspect_result"),
            "license": source.get("license"),
            "backend_job_logs": source.get("backend_job_logs") or [],
            "client_logs": source.get("client_logs") or [],
        }
    return {
        "original_filename": source.get("filename") or source.get("original_filename"),
        "result": source,
        "inspect_result": None,
        "license": None,
        "backend_job_logs": [],
        "client_logs": [],
    }


def _report_filename(context: Mapping[str, Any]) -> str:
    result = dict(context.get("result") or {})
    workbook = str(
        context.get("original_filename")
        or result.get("filename")
        or "no-workbook"
    )
    mode = str(result.get("mode") or "result")
    stem = _safe_file_stem(workbook)
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"qaoa-rqp-v9-report_{stem}_{mode}_{timestamp}.pdf"


def _safe_file_stem(value: str) -> str:
    stem = str(value or "no-workbook")
    if "." in stem:
        stem = stem.rsplit(".", 1)[0]
    safe = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in stem).strip("._-")
    return safe[:80] or "no-workbook"


def _styles() -> dict[str, ParagraphStyle]:
    sample = getSampleStyleSheet()
    return {
        "Title": ParagraphStyle(
            "QAOATitle",
            parent=sample["Title"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=19,
            textColor=COLOR_TEXT,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "Subtitle": ParagraphStyle(
            "QAOASubtitle",
            parent=sample["Heading2"],
            fontName="Helvetica",
            fontSize=10,
            leading=12,
            textColor=colors.HexColor("#334155"),
            spaceAfter=6,
            keepWithNext=True,
        ),
        "Section": ParagraphStyle(
            "QAOASection",
            parent=sample["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11.4,
            leading=13.4,
            textColor=COLOR_TEXT,
            spaceBefore=3,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "Subsection": ParagraphStyle(
            "QAOASubsection",
            parent=sample["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=8.2,
            leading=9.8,
            textColor=colors.HexColor("#1E293B"),
            spaceBefore=2,
            spaceAfter=3,
            keepWithNext=True,
        ),
        "Body": ParagraphStyle(
            "QAOABody",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=7.2,
            leading=8.8,
            textColor=COLOR_TEXT,
        ),
        "Small": ParagraphStyle(
            "QAOASmall",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=6.4,
            leading=7.8,
            textColor=COLOR_SUBTEXT,
        ),
        "Table": ParagraphStyle(
            "QAOATable",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=5.7,
            leading=6.9,
            textColor=colors.black,
        ),
        "TableHeader": ParagraphStyle(
            "QAOATableHeader",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=5.9,
            leading=7.1,
            textColor=colors.white,
        ),
        "Tiny": ParagraphStyle(
            "QAOATiny",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=5.2,
            leading=6.2,
            textColor=COLOR_SUBTEXT,
        ),
    }


def _candidate_summary_block(card: Mapping[str, Any], styles: dict[str, ParagraphStyle], *, width: float) -> Table:
    title = _text(card.get("title") or "Result Summary")
    status = _text(card.get("status"))
    return _panel(
        title,
        [
            Paragraph(status, styles["Small"]),
            Spacer(1, 2),
            _kv_table(
                [
                    ("Source", card.get("source")),
                    ("Solver", card.get("solver")),
                    ("Bitstring", card.get("best_bitstring")),
                    ("QUBO", card.get("qubo_value")),
                    ("Return", card.get("portfolio_return")),
                    ("Volatility", card.get("portfolio_vol")),
                    ("Sharpe ratio", card.get("sharpe_like")),
                    ("Selected amount", card.get("selected_usd")),
                    ("Budget gap", card.get("budget_gap")),
                    ("Probability", card.get("probability")),
                ],
                styles=styles,
            ),
        ],
        width=width,
    )


def _panel(title: str, flowables: list[Any], *, width: float, accent: str | None = None) -> Table:
    heading_style = _styles()["Subsection"]
    title_color = "#0F172A"
    if accent == "second":
        title_color = "#8A5A00"
    elif accent == "amber":
        title_color = "#92400E"
    heading = Paragraph(
        f'<font color="{title_color}"><b>{_text(title)}</b></font>',
        heading_style,
    )
    cell_content: list[Any] = [heading] + flowables
    table = Table([[cell_content]], colWidths=[width])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG),
                ("BOX", (0, 0), (-1, -1), 0.55, COLOR_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def _kv_table(rows: Iterable[tuple[str, Any]], *, styles: dict[str, ParagraphStyle]) -> Table:
    materialized: list[list[Any]] = []
    for label, value in rows:
        materialized.append(
            [
                Paragraph(f"<b>{_text(label)}</b>", styles["Small"]),
                Paragraph(_text(value), styles["Body"]),
            ]
        )
    table = Table(materialized, colWidths=[32 * mm, None])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, COLOR_ROW_ALT]),
                ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, COLOR_GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 2.6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6),
            ]
        )
    )
    return table


def _flowable_grid(items: list[Any], *, widths: list[float]) -> Table:
    cols = len(widths)
    rows: list[list[Any]] = []
    for start in range(0, len(items), cols):
        row = items[start : start + cols]
        while len(row) < cols:
            row.append(Spacer(1, 1))
        rows.append(row)
    table = Table(rows, colWidths=widths)
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def _portfolio_table(rows: list[Mapping[str, Any]], styles: dict[str, ParagraphStyle]) -> LongTable:
    headers = [
        "Ticker",
        "Company",
        "Role",
        "Option",
        "Indicative Market Cost",
        "Shares",
        "Decision ID",
        "Bit Index",
    ]
    data: list[list[Any]] = [
        [Paragraph(label, styles["TableHeader"]) for label in headers]
    ]
    for row in rows:
        data.append(
            [
                Paragraph(_text(row.get("Ticker")), styles["Table"]),
                Paragraph(_text(row.get("Company")), styles["Table"]),
                Paragraph(_text(row.get("decision_role")), styles["Table"]),
                Paragraph(_text(row.get("Option Label")), styles["Table"]),
                Paragraph(_text(_portfolio_cost(row)), styles["Table"]),
                Paragraph(_text(row.get("Shares")), styles["Table"]),
                Paragraph(_text(row.get("decision_id")), styles["Tiny"]),
                Paragraph(_bit_index_label(row), styles["Tiny"]),
            ]
        )
    widths = _scaled_widths([18 * mm, 44 * mm, 17 * mm, 26 * mm, 27 * mm, 12 * mm, 35 * mm, 13 * mm], PAGE_CONTENT_WIDTH)
    return _styled_long_table(data, widths)


def _candidate_table(
    rows: list[Mapping[str, Any]],
    styles: dict[str, ParagraphStyle],
    *,
    show_probability: bool = False,
    show_count: bool = False,
) -> LongTable:
    type_ids = _type_ids_from_rows(rows)
    headers = ["Rank", "Source", "Bitstring"]
    widths = [10 * mm, 18 * mm, 28 * mm]
    if show_probability:
        headers.append("Probability")
        widths.append(15 * mm)
    if show_count:
        headers.append("Hits")
        widths.append(11 * mm)
    headers.extend(["QUBO", "Selected amount", "Budget gap"])
    widths.extend([16 * mm, 18 * mm, 16 * mm])
    for type_id in type_ids:
        headers.append(f"{type_id.replace('type_', 'Type ').upper()} achieved")
        widths.append(20 * mm)
    for type_id in type_ids:
        headers.append(f"{type_id.replace('type_', 'Type ').upper()} deviation")
        widths.append(20 * mm)
    headers.extend(["Return", "Volatility", "Sharpe ratio"])
    widths.extend([14 * mm, 14 * mm, 14 * mm])

    data: list[list[Any]] = [[Paragraph(label, styles["TableHeader"]) for label in headers]]
    for idx, row in enumerate(rows):
        cells = [
            Paragraph(_text(row.get("rank") or idx + 1), styles["Table"]),
            Paragraph(_candidate_source(row), styles["Tiny"]),
            Paragraph(_text(row.get("bitstring")), styles["Table"]),
        ]
        if show_probability:
            cells.append(Paragraph(_text(row.get("probability")), styles["Table"]))
        if show_count:
            cells.append(Paragraph(_text(row.get("count")), styles["Table"]))
        cells.extend(
            [
                Paragraph(_text(row.get("qubo_value") if row.get("qubo_value") is not None else row.get("qubo_reconstructed")), styles["Table"]),
                Paragraph(_text(row.get("selected_usd")), styles["Table"]),
                Paragraph(_text(row.get("budget_gap")), styles["Table"]),
            ]
        )
        for type_id in type_ids:
            cells.append(
                Paragraph(
                    f"{_text(row.get(f'{type_id}_name') or row.get(f'{type_id}_label') or type_id)}<br/>{_text(row.get(f'{type_id}_achieved'))}",
                    styles["Tiny"],
                )
            )
        for type_id in type_ids:
            cells.append(
                Paragraph(
                    f"{_text(row.get(f'{type_id}_deviation'))}<br/>{_text(row.get(f'{type_id}_relative_deviation'))}",
                    styles["Tiny"],
                )
            )
        cells.extend(
            [
                Paragraph(_text(row.get("portfolio_return")), styles["Table"]),
                Paragraph(_text(row.get("portfolio_vol")), styles["Table"]),
                Paragraph(_text(row.get("sharpe_like")), styles["Table"]),
            ]
        )
        data.append(cells)
    return _styled_long_table(data, _scaled_widths(widths, PAGE_CONTENT_WIDTH))


def _styled_long_table(data: list[list[Any]], widths: list[float]) -> LongTable:
    table = LongTable(data, colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_ROW_ALT]),
                ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 2.3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.3),
            ]
        )
    )
    return table


def _scaled_widths(widths: list[float], max_total: float) -> list[float]:
    total = sum(widths)
    if total <= max_total:
        return widths
    scale = max_total / total
    return [width * scale for width in widths]


def _chart_panels(charts: Mapping[str, Any], styles: dict[str, ParagraphStyle]) -> list[Any]:
    items: list[Any] = []
    seen: set[str] = set()
    for key, title in CHART_TITLES:
        if key in seen:
            continue
        value = charts.get(key)
        if not (isinstance(value, str) and value.startswith("data:image/")):
            continue
        seen.add(key)
        items.append(
            _panel(
                title,
                [_chart_image(value, max_width=HALF_WIDTH - 12 * mm, max_height=62 * mm)],
                width=HALF_WIDTH,
            )
        )
    for key, value in charts.items():
        if key in {item[0] for item in CHART_TITLES}:
            continue
        if isinstance(value, str) and value.startswith("data:image/"):
            items.append(
                _panel(
                    key.replace("_", " ").title(),
                    [_chart_image(value, max_width=HALF_WIDTH - 12 * mm, max_height=62 * mm)],
                    width=HALF_WIDTH,
                )
            )
    return items


def _chart_image(data_url: str, *, max_width: float, max_height: float) -> Image:
    binary = _decode_data_url(data_url)
    width_px, height_px = PILImage.open(io.BytesIO(binary)).size
    width = float(width_px)
    height = float(height_px)
    scale = min(max_width / width, max_height / height, 1.0)
    flowable = Image(io.BytesIO(binary))
    flowable.drawWidth = width * scale
    flowable.drawHeight = height * scale
    return flowable


def _decode_data_url(value: str) -> bytes:
    if "," not in value:
        raise ApiError(400, "pdf_report_chart_invalid", "Embedded chart image is invalid.")
    _prefix, encoded = value.split(",", 1)
    return base64.b64decode(encoded)


def _log_story(context: Mapping[str, Any], styles: dict[str, ParagraphStyle]) -> list[Any]:
    backend_logs = list(context.get("backend_job_logs") or [])
    client_logs = list(context.get("client_logs") or [])
    story: list[Any] = []
    if backend_logs:
        story.extend(
            [
                Paragraph("Backend Optimization Log", styles["Subsection"]),
                _single_column_log_table(backend_logs[-30:], styles),
                Spacer(1, 6),
            ]
        )
    if client_logs:
        story.extend(
            [
                Paragraph("Client Log", styles["Subsection"]),
                _single_column_log_table(client_logs[-30:], styles),
            ]
        )
    return story


def _single_column_log_table(rows: list[str], styles: dict[str, ParagraphStyle]) -> LongTable:
    data = [[Paragraph("Log entry", styles["TableHeader"])]]
    for row in rows:
        data.append([Paragraph(_text(row), styles["Table"])])
    return _styled_long_table(data, [PAGE_CONTENT_WIDTH])


def _nested(value: Mapping[str, Any], *keys: str) -> Any:
    current: Any = value
    for key in keys:
        if not isinstance(current, Mapping):
            return None
        current = current.get(key)
    return current


def _fmt_int(value: Any) -> str:
    try:
        if value is None or value == "":
            return "n/a"
        return f"{int(value):,}"
    except Exception:
        return _text(value)


def _timestamp_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def _text(value: Any) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, float):
        if abs(value) >= 1000:
            return f"{value:,.3f}".rstrip("0").rstrip(".")
        return f"{value:.6g}"
    if isinstance(value, (list, tuple)):
        return ", ".join(_text(item) for item in value)
    if isinstance(value, dict):
        return ", ".join(f"{key}: {_text(val)}" for key, val in value.items())
    return str(value)


def _draw_page_frame(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(COLOR_SUBTEXT)
    footer = f"QAOA RQP report | qubit-lab.ch | page {doc.page}"
    canvas.drawRightString(PAGE_WIDTH - LEFT_RIGHT_MARGIN, 6 * mm, footer)
    canvas.restoreState()


def _classical_metric_rows(classical_summary: Mapping[str, Any], portfolio_metrics: Mapping[str, Any]) -> list[tuple[str, Any]]:
    return [
        ("Cash weight", classical_summary.get("cash_weight") if classical_summary.get("cash_weight") is not None else portfolio_metrics.get("cash_weight")),
        ("Fixed amount", portfolio_metrics.get("fixed_usd")),
        ("Variable selected amount", portfolio_metrics.get("variable_selected_usd")),
        ("Max position amount", portfolio_metrics.get("max_position_usd")),
        ("Portfolio return", classical_summary.get("portfolio_return") if classical_summary.get("portfolio_return") is not None else portfolio_metrics.get("portfolio_return")),
        ("Portfolio volatility", classical_summary.get("portfolio_vol") if classical_summary.get("portfolio_vol") is not None else portfolio_metrics.get("portfolio_vol")),
        ("Sharpe ratio", classical_summary.get("sharpe_like") if classical_summary.get("sharpe_like") is not None else portfolio_metrics.get("sharpe_like")),
        ("Budget-normalized return", portfolio_metrics.get("portfolio_return_budget_normalized")),
        ("Budget-normalized volatility", portfolio_metrics.get("portfolio_vol_budget_normalized")),
        ("Budget-normalized Sharpe ratio", portfolio_metrics.get("sharpe_like_budget_normalized")),
    ]


def _quantum_metric_content(summary: Mapping[str, Any], styles: dict[str, ParagraphStyle], reason: Any = None) -> Any:
    if not _quantum_available(summary):
        return Paragraph(_text(reason or summary.get("status") or "Quantum portfolio metrics are not available for this result."), styles["Body"])
    return _kv_table(
        [
            ("Cash weight", summary.get("cash_weight")),
            ("Selected amount", summary.get("selected_usd")),
            ("Budget gap", summary.get("budget_gap")),
            ("Portfolio return", summary.get("portfolio_return")),
            ("Portfolio volatility", summary.get("portfolio_vol")),
            ("Sharpe ratio", summary.get("sharpe_like")),
            ("Probability", summary.get("probability")),
        ],
        styles=styles,
    )


def _classical_breakdown_rows(classical_summary: Mapping[str, Any], components: Mapping[str, Any], reporting_summary: Mapping[str, Any]) -> list[tuple[str, Any]]:
    return [
        ("Return term", classical_summary.get("return_term") if classical_summary.get("return_term") is not None else components.get("return_term")),
        ("Risk term", classical_summary.get("risk_term") if classical_summary.get("risk_term") is not None else components.get("risk_term")),
        ("Budget term", classical_summary.get("budget_term") if classical_summary.get("budget_term") is not None else components.get("budget_term")),
        (
            "Type-budget term",
            classical_summary.get("type_budget_term")
            if classical_summary.get("type_budget_term") is not None
            else classical_summary.get("additional_type_budget_penalty")
            if classical_summary.get("additional_type_budget_penalty") is not None
            else components.get("type_budget_term")
            if components.get("type_budget_term") is not None
            else components.get("additional_type_budget_penalty"),
        ),
        ("QUBO reconstructed", components.get("qubo_reconstructed")),
        ("Budget lambda", reporting_summary.get("budget_lambda")),
        ("Risk lambda", reporting_summary.get("risk_lambda")),
        ("Risk-free rate", reporting_summary.get("risk_free_rate")),
    ]


def _quantum_breakdown_content(summary: Mapping[str, Any], styles: dict[str, ParagraphStyle], reason: Any = None) -> Any:
    if not _quantum_available(summary):
        return Paragraph(_text(reason or summary.get("status") or "Quantum QUBO breakdown metrics are not available for this result."), styles["Body"])
    return _kv_table(
        [
            ("Return term", summary.get("return_term")),
            ("Risk term", summary.get("risk_term")),
            ("Budget term", summary.get("budget_term")),
            ("Type-budget term", summary.get("type_budget_term") if summary.get("type_budget_term") is not None else summary.get("additional_type_budget_penalty")),
            ("QUBO value", summary.get("qubo_value")),
            ("Probability", summary.get("probability")),
        ],
        styles=styles,
    )


def _candidate_section_flowables(
    classical_candidates: list[Mapping[str, Any]],
    qaoa_best_qubo: list[Mapping[str, Any]],
    quantum_samples: list[Mapping[str, Any]],
    *,
    second_opinion_mode_chosen: bool,
    is_ibm_hardware_second_opinion: bool,
    second_opinion_best_qubo: list[Mapping[str, Any]],
    second_opinion_samples: list[Mapping[str, Any]],
    second_opinion_reason: Any,
    second_opinion_panel_suffix: str,
    styles: dict[str, ParagraphStyle],
) -> list[Any]:
    story: list[Any] = []
    story.extend(
        [
            Paragraph("Top Classical Candidates", styles["Subsection"]),
            _candidate_table(classical_candidates, styles) if classical_candidates else Paragraph("No classical candidates are available in this result payload.", styles["Body"]),
            Spacer(1, 5),
            Paragraph("Top Quantum Candidates", styles["Subsection"]),
            _candidate_table(qaoa_best_qubo if qaoa_best_qubo else quantum_samples, styles, show_probability=True) if (qaoa_best_qubo or quantum_samples) else Paragraph("No QAOA samples are available in the current response.", styles["Body"]),
            Spacer(1, 5),
        ]
    )
    if second_opinion_mode_chosen and not is_ibm_hardware_second_opinion:
        story.append(Paragraph(f"Top Quantum Candidates (2nd opinion){second_opinion_panel_suffix}", styles["Subsection"]))
        if second_opinion_best_qubo or second_opinion_samples:
            story.append(_candidate_table(second_opinion_best_qubo if second_opinion_best_qubo else second_opinion_samples, styles, show_probability=True))
        else:
            story.append(Paragraph(_text(second_opinion_reason or "No 2nd opinion candidates are available for this result."), styles["Body"]))
        story.append(Spacer(1, 5))
    if second_opinion_mode_chosen and is_ibm_hardware_second_opinion:
        story.append(Paragraph(f"Top Quantum Candidates by QUBO (2nd opinion){second_opinion_panel_suffix}", styles["Subsection"]))
        if second_opinion_best_qubo:
            story.append(_candidate_table(second_opinion_best_qubo, styles, show_probability=True))
        else:
            story.append(Paragraph(_text(second_opinion_reason or "No IBM hardware QUBO-ranked candidates are available for this result."), styles["Body"]))
        story.append(Spacer(1, 5))
        story.append(Paragraph(f"Top Quantum Samples by Probability / Hits (2nd opinion){second_opinion_panel_suffix}", styles["Subsection"]))
        if second_opinion_samples:
            story.append(_candidate_table(second_opinion_samples, styles, show_probability=True, show_count=True))
        else:
            story.append(Paragraph(_text(second_opinion_reason or "No IBM hardware hit-ranked samples are available for this result."), styles["Body"]))
        story.append(Spacer(1, 5))
    return story


def _runtime_diagnostic_rows(diagnostics: Mapping[str, Any], result: Mapping[str, Any]) -> list[tuple[str, Any]]:
    return [
        ("Actual runtime", _seconds_text(diagnostics.get("actual_runtime_sec"))),
        ("Raw estimate", _seconds_text(diagnostics.get("raw_estimated_runtime_sec"))),
        ("Calibrated estimate", _seconds_text(diagnostics.get("estimated_runtime_sec"))),
        ("ETA range", _eta_range_text(diagnostics.get("eta_seconds_low"), diagnostics.get("eta_seconds_high"))),
        ("Runtime ratio", diagnostics.get("runtime_ratio")),
        ("Service", diagnostics.get("service")),
        ("Run ID", result.get("run_id")),
        ("Model version", result.get("model_version")),
    ]


def _worker_diagnostic_rows(diagnostics: Mapping[str, Any], result: Mapping[str, Any]) -> list[tuple[str, Any]]:
    return [
        ("Worker profile", result.get("worker_profile_label")),
        ("Configured CPU", diagnostics.get("configured_cpu")),
        ("Configured memory (GiB)", diagnostics.get("configured_memory_gib")),
        ("Peak memory usage", _memory_text(diagnostics.get("peak_memory_used_gib"))),
        ("Usage level", diagnostics.get("usage_level")),
        ("Runtime inputs", diagnostics.get("runtime_inputs")),
        ("Effective random seed", diagnostics.get("effective_random_seed")),
        ("Workbook warnings", diagnostics.get("workbook_warning_count")),
    ]


def _qubo_diagnostic_rows(diagnostics: Mapping[str, Any], reporting_summary: Mapping[str, Any]) -> list[tuple[str, Any]]:
    return [
        ("QUBO shape", diagnostics.get("qubo_shape")),
        ("QUBO nonzero entries", diagnostics.get("qubo_nonzero_entries")),
        ("Additional type constraints", diagnostics.get("additional_type_constraints_count")),
        ("Classical candidates", reporting_summary.get("classical_candidate_count") if reporting_summary.get("classical_candidate_count") is not None else diagnostics.get("classical_candidate_count")),
        ("QAOA candidates", reporting_summary.get("qaoa_candidate_count")),
        ("QAOA p", reporting_summary.get("qaoa_p")),
        ("QAOA status", reporting_summary.get("qaoa_status")),
        ("Shots mode", diagnostics.get("shots_mode")),
        ("QAOA shots", diagnostics.get("qaoa_shots_display") if diagnostics.get("qaoa_shots_display") is not None else diagnostics.get("qaoa_shots")),
    ]


def _mode_diagnostic_rows(diagnostics: Mapping[str, Any], reporting_summary: Mapping[str, Any]) -> list[tuple[str, Any]]:
    effective_settings = diagnostics.get("effective_settings")
    if not isinstance(effective_settings, Mapping):
        effective_settings = {}
    return [
        ("Requested run mode", diagnostics.get("requested_run_mode")),
        ("Effective run mode", diagnostics.get("run_mode")),
        ("Simulation backend", diagnostics.get("simulation_backend")),
        ("Legacy mode alias", diagnostics.get("legacy_run_mode_alias")),
        ("Hardware replay", diagnostics.get("hardware_replay")),
        ("Export mode", reporting_summary.get("export_mode_label") if reporting_summary.get("export_mode_label") is not None else reporting_summary.get("export_mode")),
        ("Response level", effective_settings.get("response_level") if effective_settings else diagnostics.get("response_level")),
    ]


def _export_diagnostic_rows(diagnostics: Mapping[str, Any]) -> list[tuple[str, Any]]:
    rows = [
        ("Classical export", f"requested {_text(diagnostics.get('classical_export_requested_rows'))}, exported {_text(diagnostics.get('classical_export_actual_rows'))}"),
        ("Classical cap applied", diagnostics.get("classical_export_cap_applied")),
        ("Classical cap reason", diagnostics.get("classical_export_cap_reason")),
        ("QAOA export", f"requested {_text(diagnostics.get('qaoa_export_requested_rows'))}, exported {_text(diagnostics.get('qaoa_export_actual_rows'))}"),
        ("QAOA cap applied", diagnostics.get("qaoa_export_cap_applied")),
        ("QAOA cap reason", diagnostics.get("qaoa_export_cap_reason")),
        ("QAOA exact states", f"state space {_text(diagnostics.get('qaoa_exact_state_space'))}, evaluated {_text(diagnostics.get('qaoa_exact_states_evaluated'))}, exported {_text(diagnostics.get('qaoa_exact_states_exported'))}"),
    ]
    return [row for row in rows if any(value not in (None, "", "n/a") for value in row[1:])]


def _type_constraint_rows(diagnostics: Mapping[str, Any], inspect_diagnostics: Mapping[str, Any]) -> list[tuple[str, Any]]:
    constraints = diagnostics.get("additional_type_constraints") or inspect_diagnostics.get("additional_type_constraints")
    if not isinstance(constraints, list) or not constraints:
        return []
    rows: list[tuple[str, Any]] = []
    for idx, row in enumerate(constraints, start=1):
        if not isinstance(row, Mapping):
            continue
        rows.append((f"Constraint {idx}", ", ".join(f"{key}: {_text(val)}" for key, val in row.items())))
    return rows


def _circuit_rows(circuit: Mapping[str, Any]) -> list[tuple[str, Any]]:
    return [
        ("Metric source", circuit.get("metric_source")),
        ("Qubits", circuit.get("n_qubits")),
        ("Total gates", circuit.get("total_gates")),
        ("2Q gates", circuit.get("two_qubit_gates")),
        ("Sequential 2Q depth", circuit.get("sequential_2q_depth")),
        ("Estimated depth", circuit.get("estimated_circuit_depth")),
        ("Preview transpiled depth", circuit.get("preview_transpiled_depth")),
        ("Preview transpiled gates", circuit.get("preview_transpiled_total_gates")),
        ("Preview transpiled 2Q", circuit.get("preview_transpiled_two_qubit_gates")),
        ("Preview transpiled seq. 2Q", circuit.get("preview_transpiled_sequential_2q_depth")),
        ("Reason", circuit.get("reason")),
        ("Preview fallback reason", circuit.get("preview_fallback_reason")),
    ]


def _ibm_panels(ibm: Mapping[str, Any], styles: dict[str, ParagraphStyle]) -> list[Any]:
    panels = [
        _panel(
            "IBM / Qiskit Diagnostics",
            [_kv_table(
                [
                    ("Available", ibm.get("available")),
                    ("2nd opinion", ibm.get("export_mode_label") if ibm.get("export_mode_label") is not None else ibm.get("export_mode")),
                    ("Provider", ibm.get("provider")),
                    ("Instance", ibm.get("instance")),
                    ("Backend", ibm.get("backend_name") if ibm.get("backend_name") is not None else _nested(ibm, "backend_details", "name")),
                    ("IBM job ID", ibm.get("job_id")),
                    ("SDK", ibm.get("sdk")),
                    ("Simulation", ibm.get("dry_run")),
                    ("Hardware submission", ibm.get("hardware_submission")),
                    ("Hardware gate mode", ibm.get("fractional_mode_label") if ibm.get("fractional_mode_label") is not None else ("Prefer fractional gates" if ibm.get("fractional_gates_enabled") else "Standard basis")),
                    ("Circuit construction", ibm.get("construction_mode_label") if ibm.get("construction_mode_label") is not None else ("Parallelized construction" if ibm.get("parallelized_construction_enabled") else "Current / standard construction")),
                    ("Parse status", ibm.get("parse_status")),
                ],
                styles=styles,
            )],
            width=HALF_WIDTH,
            accent="second",
        ),
        _panel(
            "IBM Circuit and Timing",
            [_kv_table(
                [
                    ("Qiskit version", ibm.get("qiskit_version")),
                    ("Runtime version", ibm.get("qiskit_ibm_runtime_version")),
                    ("Qubits", ibm.get("n_qubits")),
                    ("Layers", ibm.get("layers")),
                    ("Classical bits", ibm.get("classical_bits")),
                    ("Hardware shots", ibm.get("shots") if ibm.get("shots") is not None else ibm.get("ibm_hardware_shots")),
                    ("Pre-transpile depth", _nested(ibm, "pretranspile", "depth")),
                    ("Pre-transpile gates", _nested(ibm, "pretranspile", "total_gates")),
                    ("Pre-transpile 2Q", _nested(ibm, "pretranspile", "two_qubit_gates")),
                    ("Post-transpile depth", _nested(ibm, "posttranspile", "depth") if _nested(ibm, "posttranspile", "depth") is not None else ibm.get("transpiled_depth")),
                    ("Post-transpile gates", _nested(ibm, "posttranspile", "total_gates") if _nested(ibm, "posttranspile", "total_gates") is not None else ibm.get("transpiled_total_gates")),
                    ("Post-transpile 2Q", _nested(ibm, "posttranspile", "two_qubit_gates") if _nested(ibm, "posttranspile", "two_qubit_gates") is not None else ibm.get("transpiled_two_qubit_gates")),
                    ("Post-transpile seq. 2Q", _nested(ibm, "posttranspile", "sequential_2q_depth") if _nested(ibm, "posttranspile", "sequential_2q_depth") is not None else ibm.get("transpiled_sequential_2q_depth")),
                    ("Queue wait", _seconds_text(_nested(ibm, "timing", "queue_wait_seconds"))),
                    ("Execution", _seconds_text(_nested(ibm, "timing", "execution_seconds"))),
                    ("Total time", _seconds_text(_nested(ibm, "timing", "total_seconds"))),
                    ("Comparability note", ibm.get("comparability_note")),
                ],
                styles=styles,
            )],
            width=HALF_WIDTH,
            accent="second",
        ),
    ]
    preview_comparison = ibm.get("preview_comparison")
    if isinstance(preview_comparison, Mapping):
        rows: list[tuple[str, Any]] = []
        seq_depth = preview_comparison.get("sequential_2q_depth")
        if isinstance(seq_depth, Mapping):
            for key, value in seq_depth.items():
                rows.append((f"Seq. 2Q depth - {key}", value))
        construction_mode = preview_comparison.get("construction_mode")
        if isinstance(construction_mode, Mapping):
            construction_seq = construction_mode.get("sequential_2q_depth")
            if isinstance(construction_seq, Mapping):
                for key, value in construction_seq.items():
                    rows.append((f"Construction seq. 2Q - {key}", value))
        if rows:
            panels.append(_panel("Preview comparison", [_kv_table(rows, styles=styles)], width=HALF_WIDTH, accent="second"))
    return panels


def _seconds_text(value: Any) -> str:
    if value in (None, "", "n/a"):
        return "n/a"
    try:
        return f"{float(value):.3f} sec"
    except Exception:
        return _text(value)


def _eta_range_text(low: Any, high: Any) -> str:
    if low in (None, "") and high in (None, ""):
        return "n/a"
    return f"{_text(low)} - {_text(high)} sec"


def _memory_text(value: Any) -> str:
    if value in (None, "", "n/a"):
        return "n/a"
    try:
        return f"{float(value):.2f} GiB"
    except Exception:
        return _text(value)


def _unique_portfolio_rows(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for raw in rows:
        row = dict(raw)
        key = "|".join(
            _text(row.get(field))
            for field in (
                "decision_id",
                "Ticker",
                "Company",
                "decision_role",
                "Option Label",
                "Indicative Market Cost USD",
                "Approx Cost USD",
                "Shares",
                "variable_bit_index",
            )
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def _build_portfolio_from_bitstring(rows: list[Mapping[str, Any]], bitstring_value: Any) -> list[dict[str, Any]]:
    bitstring = str(bitstring_value or "").strip()
    if not bitstring:
        return []
    selected: list[dict[str, Any]] = []
    for raw in _unique_portfolio_rows(rows):
        row = dict(raw)
        role = str(row.get("decision_role") or "").lower()
        if role == "fixed":
            selected.append(row)
            continue
        bit_index = _variable_bit_index(row)
        if bit_index is None:
            continue
        if 0 <= bit_index < len(bitstring) and bitstring[bit_index] == "1":
            selected.append(row)
    return selected


def _portfolio_cost(row: Mapping[str, Any]) -> Any:
    return row.get("Indicative Market Cost USD") if row.get("Indicative Market Cost USD") is not None else row.get("Approx Cost USD")


def _variable_bit_index(row: Mapping[str, Any]) -> int | None:
    value = row.get("variable_bit_index")
    try:
        if value is None or value == "":
            return None
        return int(value)
    except Exception:
        return None


def _bit_index_label(row: Mapping[str, Any]) -> str:
    role = str(row.get("decision_role") or "").lower()
    if role == "fixed":
        return "fixed"
    return _text(row.get("variable_bit_index"))


def _type_ids_from_rows(rows: Iterable[Mapping[str, Any]]) -> list[str]:
    ids: set[str] = set()
    for row in rows:
        for key in row.keys():
            if key.startswith("type_"):
                ids.add(key.split("_", 2)[0] + "_" + key.split("_", 2)[1] if key.count("_") >= 2 else key)
    ordered = [f"type_{letter}" for letter in "abcde"]
    return [type_id for type_id in ordered if type_id in ids]


def _candidate_source(row: Mapping[str, Any]) -> str:
    return _text(row.get("source") if row.get("source") is not None else row.get("solver"))


def _displayed_solver_comparison(
    solver_comparison: list[Mapping[str, Any]],
    *,
    second_opinion_mode_chosen: bool,
    second_opinion_summary: Mapping[str, Any],
) -> list[dict[str, Any]]:
    rows = [dict(row) for row in solver_comparison]
    if not second_opinion_mode_chosen or not _quantum_available(second_opinion_summary):
        return rows
    already_included = any("2nd opinion" in _candidate_source(row).lower() for row in rows)
    if already_included:
        return rows
    rows.append(
        {
            "solver": "Quantum / QAOA (2nd opinion)",
            "bitstring": second_opinion_summary.get("best_bitstring"),
            "qubo_value": second_opinion_summary.get("qubo_value"),
            "selected_usd": second_opinion_summary.get("selected_usd"),
            "budget_gap": second_opinion_summary.get("budget_gap"),
            "portfolio_return": second_opinion_summary.get("portfolio_return"),
            "portfolio_vol": second_opinion_summary.get("portfolio_vol"),
            "sharpe_like": second_opinion_summary.get("sharpe_like"),
            "probability": second_opinion_summary.get("probability"),
        }
    )
    return rows


def _quantum_available(summary: Mapping[str, Any]) -> bool:
    return bool(summary.get("available"))
