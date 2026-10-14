from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader, PdfWriter

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

from ..infrastructure.openai_client import OpenAIClient, OpenAIError


def extract_dates(text: str) -> list[str]:
    patterns = [
        r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b",
        r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b",
        r"\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b",
        r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b",
        r"\b(?:Fall|Spring|Summer|Winter)\s+\d{4}\b",
        r"\b(?:academic year|AY)\s+\d{4}[-–]\d{2,4}\b",
    ]
    found: list[str] = []
    seen: set[str] = set()
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            date_str = match.group(0).strip()
            norm = date_str.lower()
            if norm not in seen:
                seen.add(norm)
                found.append(date_str)
    return found


def extract_entities(text: str) -> list[str]:
    # Match capitalised entity candidates (2-4 words) or known institution/scholarship keywords
    pattern = r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b|\b[A-Z]{2,6}\b"
    matches = re.findall(pattern, text)
    counts: dict[str, int] = {}
    stopwords = {"The", "This", "That", "These", "Those", "All", "Any", "Each", "Every", "Please", "Note", "Page", "Section"}
    for candidate in matches:
        candidate = candidate.strip()
        if candidate in stopwords or len(candidate) < 3:
            continue
        counts[candidate] = counts.get(candidate, 0) + 1
    # Sort by frequency
    sorted_entities = sorted(counts.items(), key=lambda x: x[1], reverse=True)
    return [entity for entity, _ in sorted_entities[:10]]


class IntelligenceService:
    def __init__(self, openai_client: OpenAIClient):
        self.openai = openai_client

    def summarize(
        self,
        document_id: str,
        filename: str,
        chunks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if not chunks:
            return {
                "document_id": document_id,
                "filename": filename,
                "executive_summary": "Document contains no readable text content.",
                "key_points": [],
                "important_dates": [],
                "key_entities": [],
                "source_references": [],
                "provider": "empty",
            }

        combined_text = "\n\n".join(chunk["content"] for chunk in chunks[:15])

        if self.openai.configured:
            prompt = (
                "You are an AI document summarization engine. Analyze the provided document context and return a "
                "strictly valid JSON object with the following keys:\n"
                "- executive_summary: A concise 2-3 paragraph executive summary of the document.\n"
                "- key_points: A list of 4-6 primary bullet points.\n"
                "- important_dates: A list of explicitly mentioned deadlines, validity periods, or milestones.\n"
                "- key_entities: A list of key organizations, persons, institutions, or program names.\n\n"
                "Do not hallucinate or invent dates or entities not in the context.\n\n"
                f"DOCUMENT CONTEXT:\n{combined_text[:12000]}"
            )
            try:
                raw_response = self.openai._post(
                    "chat/completions",
                    {
                        "model": self.openai.chat_model,
                        "messages": [
                            {"role": "system", "content": "You are a professional document analyst that outputs only JSON."},
                            {"role": "user", "content": prompt},
                        ],
                        "response_format": {"type": "json_object"},
                    },
                )
                content = raw_response["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                source_refs = [
                    {"chunk_id": chunk["id"], "page_number": chunk["page_start"], "snippet": chunk["content"][:200]}
                    for chunk in chunks[:4]
                ]
                return {
                    "document_id": document_id,
                    "filename": filename,
                    "executive_summary": parsed.get("executive_summary", ""),
                    "key_points": parsed.get("key_points", []),
                    "important_dates": parsed.get("important_dates", []),
                    "key_entities": parsed.get("key_entities", []),
                    "source_references": source_refs,
                    "provider": "openai",
                }
            except (OpenAIError, json.JSONDecodeError, KeyError):
                # Graceful fallback to extractive
                pass

        # Extractive fallback
        return self._extractive_summary(document_id, filename, chunks)

    def _extractive_summary(
        self,
        document_id: str,
        filename: str,
        chunks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        full_text = " ".join(chunk["content"] for chunk in chunks)

        # Executive summary from first 1-2 chunks
        first_chunk = chunks[0]["content"] if chunks else ""
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", first_chunk) if len(s.strip()) > 20]
        exec_summary = " ".join(sentences[:3]) if sentences else first_chunk[:400]

        # Key points from each chunk's prominent sentences
        key_points: list[str] = []
        for chunk in chunks[:6]:
            for sentence in re.split(r"(?<=[.!?])\s+", chunk["content"]):
                sentence = sentence.strip()
                if 30 <= len(sentence) <= 200 and sentence not in key_points:
                    key_points.append(sentence)
                    break
            if len(key_points) >= 5:
                break

        dates = extract_dates(full_text)
        entities = extract_entities(full_text)

        source_refs = [
            {
                "chunk_id": chunk["id"],
                "page_number": chunk["page_start"],
                "section_title": chunk.get("section_title") or "",
                "snippet": chunk["content"][:200] + "…",
            }
            for chunk in chunks[:5]
        ]

        return {
            "document_id": document_id,
            "filename": filename,
            "executive_summary": exec_summary or f"Document summary for {filename}.",
            "key_points": key_points or ["Document processed with verified content passages."],
            "important_dates": dates,
            "key_entities": entities,
            "source_references": source_refs,
            "provider": "extractive-fallback",
        }

    def extract_checklist(
        self,
        document_id: str,
        filename: str,
        chunks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if not chunks:
            return {
                "document_id": document_id,
                "filename": filename,
                "title": f"Requirements Checklist: {filename}",
                "eligibility_criteria": [],
                "required_documents": [],
                "application_deadlines": [],
                "deliverables": [],
                "important_conditions": [],
                "source_references": [],
                "provider": "empty",
            }

        combined_text = "\n\n".join(
            f"[Page {c['page_start']}] {c['content']}" for c in chunks[:15]
        )

        if self.openai.configured:
            prompt = (
                "You are an expert scholarship and grant requirement extraction system. "
                "Examine the document context carefully and return a JSON object with EXACTLY the following structure:\n"
                "{\n"
                '  "title": "Scholarship/Application Checklist Title",\n'
                '  "eligibility_criteria": [{"criterion": "string description", "source_page": int}],\n'
                '  "required_documents": [{"document_name": "string", "mandatory": true, "source_page": int}],\n'
                '  "application_deadlines": [{"deadline_type": "string", "date_or_description": "string", "source_page": int}],\n'
                '  "deliverables": [{"deliverable": "string", "details": "string", "source_page": int}],\n'
                '  "important_conditions": ["condition string 1", "condition string 2"]\n'
                "}\n\n"
                "CRITICAL INSTRUCTIONS:\n"
                "- Never invent or hallucinate missing requirements or deadlines.\n"
                "- If no deadline is specified in the text, leave application_deadlines as an empty array.\n"
                "- Attach the true source_page number for each item based on the [Page X] tags.\n\n"
                f"DOCUMENT CONTEXT:\n{combined_text[:12000]}"
            )
            try:
                raw_response = self.openai._post(
                    "chat/completions",
                    {
                        "model": self.openai.chat_model,
                        "messages": [
                            {"role": "system", "content": "You are a precise document analyst that extracts requirements into JSON. Never fabricate details."},
                            {"role": "user", "content": prompt},
                        ],
                        "response_format": {"type": "json_object"},
                    },
                )
                content = raw_response["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                source_refs = [
                    {"page_number": c["page_start"], "chunk_id": c["id"], "snippet": c["content"][:180]}
                    for c in chunks[:5]
                ]
                return {
                    "document_id": document_id,
                    "filename": filename,
                    "title": parsed.get("title") or f"Requirements Checklist: {filename}",
                    "eligibility_criteria": parsed.get("eligibility_criteria", []),
                    "required_documents": parsed.get("required_documents", []),
                    "application_deadlines": parsed.get("application_deadlines", []),
                    "deliverables": parsed.get("deliverables", []),
                    "important_conditions": parsed.get("important_conditions", []),
                    "source_references": source_refs,
                    "provider": "openai",
                }
            except (OpenAIError, json.JSONDecodeError, KeyError):
                pass

        # Deterministic extractive fallback
        return self._extractive_checklist(document_id, filename, chunks)

    def _extractive_checklist(
        self,
        document_id: str,
        filename: str,
        chunks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        eligibility: list[dict[str, Any]] = []
        required_docs: list[dict[str, Any]] = []
        deadlines: list[dict[str, Any]] = []
        deliverables: list[dict[str, Any]] = []
        conditions: list[str] = []

        eligibility_keywords = ("eligib", "qualif", "must be", "minimum gpa", "enrolled", "applicant must", "citizenship", "prerequisite", "standing")
        doc_keywords = ("transcript", "recommendation", "reference", "resume", "curriculum vitae", "statement of purpose", "essay", "portfolio", "application form", "certificate", "proof of")
        deadline_keywords = ("deadline", "due date", "submit by", "closing date", "cutoff", "applications due")
        deliverable_keywords = ("deliverable", "final report", "presentation", "progress report", "post-award", "awardees must")
        condition_keywords = ("terms and conditions", "renewable", "maintain a gpa", "disqualification", "non-transferable", "subject to")

        for chunk in chunks:
            page = chunk["page_start"]
            lines = [line.strip() for line in chunk["content"].splitlines() if line.strip()]
            for line in lines:
                lower = line.lower()
                # Check deadlines
                if any(k in lower for k in deadline_keywords):
                    dates = extract_dates(line)
                    date_val = ", ".join(dates) if dates else line[:120]
                    if not any(d["date_or_description"] == date_val for d in deadlines):
                        deadlines.append({
                            "deadline_type": "Application Deadline",
                            "date_or_description": date_val,
                            "source_page": page,
                        })

                # Check required documents
                for kw in doc_keywords:
                    if kw in lower:
                        doc_name = line.strip(" -•*")
                        if len(doc_name) > 100:
                            doc_name = kw.title()
                        if not any(r["document_name"].lower() == doc_name.lower() for r in required_docs):
                            required_docs.append({
                                "document_name": doc_name,
                                "mandatory": "optional" not in lower,
                                "source_page": page,
                            })
                        break

                # Check eligibility
                if any(k in lower for k in eligibility_keywords):
                    clean_line = line.strip(" -•*")
                    if 15 <= len(clean_line) <= 200 and not any(e["criterion"] == clean_line for e in eligibility):
                        eligibility.append({
                            "criterion": clean_line,
                            "source_page": page,
                        })

                # Check deliverables
                if any(k in lower for k in deliverable_keywords):
                    clean_line = line.strip(" -•*")
                    if 15 <= len(clean_line) <= 200 and not any(d["deliverable"] == clean_line for d in deliverables):
                        deliverables.append({
                            "deliverable": clean_line,
                            "details": f"Page {page} requirement",
                            "source_page": page,
                        })

                # Check conditions
                if any(k in lower for k in condition_keywords):
                    clean_line = line.strip(" -•*")
                    if 15 <= len(clean_line) <= 200 and clean_line not in conditions:
                        conditions.append(clean_line)

        source_refs = [
            {"page_number": c["page_start"], "chunk_id": c["id"], "snippet": c["content"][:180]}
            for c in chunks[:5]
        ]

        return {
            "document_id": document_id,
            "filename": filename,
            "title": f"Requirements Checklist: {filename}",
            "eligibility_criteria": eligibility[:8],
            "required_documents": required_docs[:8],
            "application_deadlines": deadlines[:5],
            "deliverables": deliverables[:6],
            "important_conditions": conditions[:6],
            "source_references": source_refs,
            "provider": "extractive-fallback",
        }


def compress_pdf(
    source_path: Path,
    output_path: Path,
    optimize_images: bool = True,
) -> dict[str, Any]:
    if not source_path.exists():
        raise FileNotFoundError(f"Source file not found: {source_path}")

    original_size = source_path.stat().st_size
    reader = PdfReader(str(source_path))
    writer = PdfWriter()

    for page in reader.pages:
        page.compress_content_streams()
        writer.add_page(page)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as handle:
        writer.write(handle)

    # Verification: Ensure output is a valid, readable PDF with the same page count
    verify_reader = PdfReader(str(output_path))
    if len(verify_reader.pages) != len(reader.pages):
        raise ValueError("Compressed PDF page count mismatch verification failed")

    output_size = output_path.stat().st_size
    reduction_bytes = max(0, original_size - output_size)
    reduction_pct = round((reduction_bytes / original_size) * 100, 2) if output_size < original_size else 0.0

    return {
        "original_size_bytes": original_size,
        "output_size_bytes": output_size,
        "reduction_bytes": reduction_bytes,
        "reduction_percentage": reduction_pct,
        "verified": True,
        "page_count": len(verify_reader.pages),
    }
