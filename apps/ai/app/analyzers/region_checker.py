"""Region-fit — GLOBAL rules engine.

Effective profile = baseline (International/ATS-safe) merged with the target country's
delta from packages/shared/data/regions.json. The checker flags ONLY deviations of the CV
from that target profile and stays silent otherwise — it never imposes one region's norms
on another. Unknown signals (None) are never flagged.
"""
import re

from ..data_loader import load
from ..models.requests import RegionSignals
from ..models.responses import RegionDeviation, RegionResponse

_DATA = load("regions")
_BASELINE = _DATA["baseline"]
_REGIONS = _DATA["regions"]


def _profile(target: str) -> dict:
    delta = _REGIONS.get(target.upper(), {})
    return {**_BASELINE, **delta}


def _derive_from_text(text: str) -> dict:
    low = text.lower()
    has_pd = bool(
        re.search(r"date of birth|d\.?o\.?b\.?|marital status|nationality", low)
        or re.search(r"\bborn\b.{0,20}\b(19|20)\d{2}\b", low)
    )
    has_gdpr = bool(re.search(r"\bgdpr\b|\brodo\b|processing of (my )?personal data|consent to the processing", low))
    has_refs = bool(re.search(r"\breferences?\b", low) and not re.search(r"references? available on request", low))
    return {"has_personal_data": has_pd, "has_gdpr_clause": has_gdpr, "has_references": has_refs}


def check_region(target: str, signals: RegionSignals, cv_text: str | None = None) -> RegionResponse:
    profile = _profile(target)
    label = profile.get("label", target.upper())

    merged: dict = _derive_from_text(cv_text) if cv_text else {}
    for key, value in signals.model_dump().items():
        if value is not None and value != []:
            merged[key] = value

    dev: list[RegionDeviation] = []

    def add(field: str, severity: str, message: str) -> None:
        dev.append(RegionDeviation(field=field, severity=severity, message=message))

    has_photo = merged.get("has_photo")
    if has_photo is True and profile["photo"] == "omit":
        add("photo", "high", f"Remove the photo — not expected in {label} and can invite bias.")
    elif has_photo is False and profile["photo"] == "expected":
        add("photo", "medium", f"Add a professional photo — expected in {label}.")

    has_pd = merged.get("has_personal_data")
    if has_pd is True and profile["personal_data"] == "omit":
        add("personal_data", "high",
            f"Remove date of birth / marital status / nationality — discouraged in {label}.")
    elif has_pd is False and profile["personal_data"] == "expected":
        add("personal_data", "medium", f"Add date of birth and nationality — standard in {label}.")

    page_count = merged.get("page_count")
    if isinstance(page_count, int) and page_count > profile["max_pages"]:
        add("length", "medium",
            f"{page_count} pages exceeds the ~{profile['max_pages']}-page norm for {label}.")

    if profile["gdpr_clause"] == "expected" and merged.get("has_gdpr_clause") is False:
        add("gdpr_clause", "medium",
            f"Add a data-processing (GDPR) consent clause — expected in {label}.")

    if profile["references_on_cv"] == "expected" and merged.get("has_references") is False:
        add("references", "medium",
            f"Include 2-3 references with contact details — expected in {label}.")

    return RegionResponse(target=target.upper(), profile_label=label, deviations=dev)
