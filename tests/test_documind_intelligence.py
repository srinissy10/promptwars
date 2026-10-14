from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from backend.docchat.api.routes.documents import download_document, preview_document
from backend.docchat.infrastructure.database import Database
from backend.docchat.infrastructure.openai_client import OpenAIClient
from backend.docchat.runtime import AppContext
from backend.docchat.services.documents import chunk_pages, parse_document
from backend.docchat.services.ingestion import IngestionService
from backend.docchat.services.intelligence import IntelligenceService, compress_pdf
from backend.docchat.services.rag import RagService
from tests.helpers import test_config


def create_synthetic_pdf(text: str, pages_count: int = 2) -> bytes:
    writer = PdfWriter()
    for _ in range(pages_count):
        writer.add_blank_page(width=612, height=792)
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue()


class DocuMindIntelligenceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.config = test_config(self.root)
        self.db = Database(self.root / "docchat.db")
        self.db.initialize()
        self.user = self.db.create_user("student@university.edu", "secretpass123")
        self.uploads_path = self.root / "uploads"
        self.uploads_path.mkdir(parents=True, exist_ok=True)
        self.openai = OpenAIClient(self.config)
        self.rag = RagService(self.config, self.openai)
        self.logger = self.config.root
        import logging
        self.ingestion = IngestionService(self.config, self.db, self.rag, self.openai, logging.getLogger("test"))
        self.intelligence = IntelligenceService(self.openai)
        self.context = AppContext(
            config=self.config,
            logger=logging.getLogger("test"),
            database=self.db,
            openai=self.openai,
            rag=self.rag,
            ingestion=self.ingestion,
            intelligence=self.intelligence,
            uploads_path=self.uploads_path,
            frontend_path=self.root / "frontend",
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_version_tracking_on_creation(self):
        source = self.uploads_path / "v1.txt"
        source.write_text("Document Version 1 content.", encoding="utf-8")
        doc = self.db.create_document(
            user_id=self.user["id"],
            filename="v1.txt",
            storage_path=str(source),
            extension=".txt",
            mime_type="text/plain",
            size_bytes=source.stat().st_size,
        )
        self.assertEqual(doc["current_version"], 1)
        versions = self.db.list_document_versions(doc["id"], self.user["id"])
        self.assertEqual(len(versions), 1)
        self.assertEqual(versions[0]["version_number"], 1)
        self.assertEqual(versions[0]["filename"], "v1.txt")

    def test_successful_replacement_and_version_increment(self):
        # Step 1: Ingest v1
        v1_path = self.uploads_path / "research_v1.txt"
        v1_path.write_text("Alpha Research: Baseline grant limit is 2,000 dollars.", encoding="utf-8")
        doc = self.db.create_document(
            user_id=self.user["id"],
            filename="research_v1.txt",
            storage_path=str(v1_path),
            extension=".txt",
            mime_type="text/plain",
            size_bytes=v1_path.stat().st_size,
        )
        self.ingestion.ingest(doc["id"], self.user["id"], v1_path, ".txt")

        # Verify v1 chunks
        chunks_v1 = self.db.get_chunks(doc["id"], self.user["id"])
        self.assertTrue(any("Alpha Research" in c["content"] for c in chunks_v1))

        # Step 2: Replace with v2
        v2_path = self.uploads_path / "research_v2.txt"
        v2_path.write_text("Beta Research: Revised grant limit is 8,000 dollars.", encoding="utf-8")
        updated = self.ingestion.replace_document(
            document_id=doc["id"],
            user_id=self.user["id"],
            file_path=v2_path,
            filename="research_v2.txt",
            extension=".txt",
            mime_type="text/plain",
            size_bytes=v2_path.stat().st_size,
        )

        self.assertEqual(updated["current_version"], 2)
        self.assertEqual(updated["filename"], "research_v2.txt")
        self.assertEqual(updated["status"], "ready")

        # Step 3: Verify versions history
        versions = self.db.list_document_versions(doc["id"], self.user["id"])
        self.assertEqual(len(versions), 2)
        self.assertEqual(versions[0]["version_number"], 2)
        self.assertEqual(versions[1]["version_number"], 1)

    def test_vector_index_synchronization_and_purging_superseded_chunks(self):
        # Ingest v1
        v1_path = self.uploads_path / "policy_v1.txt"
        v1_path.write_text("Original Policy: strictly requires three recommendation letters.", encoding="utf-8")
        doc = self.db.create_document(
            user_id=self.user["id"],
            filename="policy_v1.txt",
            storage_path=str(v1_path),
            extension=".txt",
            mime_type="text/plain",
            size_bytes=v1_path.stat().st_size,
        )
        self.ingestion.ingest(doc["id"], self.user["id"], v1_path, ".txt")

        # Replace with v2
        v2_path = self.uploads_path / "policy_v2.txt"
        v2_path.write_text("Updated Policy: only one recommendation letter is mandatory.", encoding="utf-8")
        self.ingestion.replace_document(
            document_id=doc["id"],
            user_id=self.user["id"],
            file_path=v2_path,
            filename="policy_v2.txt",
            extension=".txt",
            mime_type="text/plain",
            size_bytes=v2_path.stat().st_size,
        )

        # Chunks in index must reflect only v2
        active_chunks = self.db.get_chunks(doc["id"], self.user["id"])
        for chunk in active_chunks:
            self.assertNotIn("three recommendation letters", chunk["content"])
            self.assertIn("one recommendation letter", chunk["content"])

    def test_failed_replacement_preserves_previous_working_version(self):
        # Create working v1
        v1_path = self.uploads_path / "working.txt"
        v1_path.write_text("Working original document content.", encoding="utf-8")
        doc = self.db.create_document(
            user_id=self.user["id"],
            filename="working.txt",
            storage_path=str(v1_path),
            extension=".txt",
            mime_type="text/plain",
            size_bytes=v1_path.stat().st_size,
        )
        self.ingestion.ingest(doc["id"], self.user["id"], v1_path, ".txt")

        # Attempt to replace with an invalid corrupt PDF file
        bad_path = self.uploads_path / "corrupt.pdf"
        bad_path.write_bytes(b"NOT A VALID PDF HEADER AT ALL")

        with self.assertRaises(ValueError):
            self.ingestion.replace_document(
                document_id=doc["id"],
                user_id=self.user["id"],
                file_path=bad_path,
                filename="corrupt.pdf",
                extension=".pdf",
                mime_type="application/pdf",
                size_bytes=bad_path.stat().st_size,
            )

        # Verify original document is intact
        persisted = self.db.get_document(doc["id"], self.user["id"])
        self.assertEqual(persisted["current_version"], 1)
        self.assertEqual(persisted["status"], "ready")
        self.assertEqual(persisted["filename"], "working.txt")
        chunks = self.db.get_chunks(doc["id"], self.user["id"])
        self.assertEqual(len(chunks), 1)
        self.assertIn("Working original document", chunks[0]["content"])

    def test_document_summarization_fallback(self):
        chunks = [
            {
                "id": "c1",
                "page_start": 1,
                "page_end": 1,
                "section_title": "Overview",
                "content": (
                    "The Stanford Global Fellowship supports outstanding graduate students. "
                    "The award committee announced the application deadline for October 15, 2026. "
                    "Awardees receive full tuition and stipend support."
                ),
            },
            {
                "id": "c2",
                "page_start": 2,
                "page_end": 2,
                "section_title": "Obligations",
                "content": (
                    "Recipients must submit a progress report by May 30, 2027. "
                    "Scholars will participate in the annual leadership symposium."
                ),
            },
        ]
        result = self.intelligence.summarize("doc-123", "fellowship.pdf", chunks)
        self.assertIn("executive_summary", result)
        self.assertIn("key_points", result)
        self.assertIn("important_dates", result)
        self.assertIn("key_entities", result)
        self.assertIn("source_references", result)
        self.assertEqual(result["provider"], "extractive-fallback")
        self.assertTrue(len(result["key_points"]) > 0)
        # Verify date extracted
        dates_str = " ".join(result["important_dates"])
        self.assertTrue("October 15, 2026" in dates_str or "May 30, 2027" in dates_str)

    def test_scholarship_checklist_extraction(self):
        chunks = [
            {
                "id": "chk1",
                "page_start": 1,
                "page_end": 1,
                "section_title": "Eligibility and Requirements",
                "content": (
                    "Eligibility Criteria:\n"
                    "- Applicant must maintain a minimum GPA of 3.8\n"
                    "- Must be enrolled full-time in an accredited graduate degree program\n"
                    "Required Documents:\n"
                    "- Official Academic Transcript\n"
                    "- Two Letters of Recommendation\n"
                    "- Statement of Purpose\n"
                    "Application Deadline: November 30, 2026\n"
                    "Deliverables: Awardees must submit an annual research report.\n"
                    "Important Conditions: Renewable subject to maintaining good academic standing."
                ),
            }
        ]
        checklist = self.intelligence.extract_checklist("doc-scholar", "grant.pdf", chunks)
        self.assertIn("eligibility_criteria", checklist)
        self.assertIn("required_documents", checklist)
        self.assertIn("application_deadlines", checklist)
        self.assertIn("deliverables", checklist)
        self.assertIn("important_conditions", checklist)

        # Check required documents
        doc_names = [d["document_name"].lower() for d in checklist["required_documents"]]
        self.assertTrue(any("transcript" in name for name in doc_names))
        self.assertTrue(any("recommendation" in name for name in doc_names))

        # Check deadlines
        deadlines = checklist["application_deadlines"]
        self.assertTrue(len(deadlines) > 0)
        self.assertTrue(any("2026" in d["date_or_description"] for d in deadlines))

        # Check eligibility
        criteria = [c["criterion"] for c in checklist["eligibility_criteria"]]
        self.assertTrue(any("gpa" in c.lower() or "enrolled" in c.lower() for c in criteria))

    def test_pdf_compression_verification(self):
        pdf_bytes = create_synthetic_pdf("Sample test PDF content for compression test", pages_count=3)
        pdf_source = self.uploads_path / "sample.pdf"
        pdf_source.write_bytes(pdf_bytes)
        compressed_out = self.uploads_path / "compressed_sample.pdf"

        metrics = compress_pdf(pdf_source, compressed_out)
        self.assertTrue(metrics["verified"])
        self.assertEqual(metrics["page_count"], 3)
        self.assertTrue(compressed_out.exists())
        self.assertGreater(metrics["output_size_bytes"], 0)

        # Verify the generated PDF can be read cleanly by PdfReader
        verify_reader = PdfReader(str(compressed_out))
        self.assertEqual(len(verify_reader.pages), 3)

    def test_preview_and_download_endpoints(self):
        source = self.uploads_path / "test_preview.txt"
        source.write_text("Page 1 snippet text for preview testing.\nLine 2.", encoding="utf-8")
        doc = self.db.create_document(
            user_id=self.user["id"],
            filename="test_preview.txt",
            storage_path=str(source),
            extension=".txt",
            mime_type="text/plain",
            size_bytes=source.stat().st_size,
        )
        self.ingestion.ingest(doc["id"], self.user["id"], source, ".txt")

        # Test preview
        preview_data = preview_document(doc["id"], self.user, self.context)
        self.assertEqual(preview_data["document_id"], doc["id"])
        self.assertEqual(preview_data["filename"], "test_preview.txt")
        self.assertEqual(len(preview_data["preview_pages"]), 1)
        self.assertIn("Page 1 snippet text", preview_data["preview_pages"][0]["snippet"])

        # Test download
        response = download_document(doc["id"], self.user, self.context)
        self.assertEqual(response.filename, "test_preview.txt")
        self.assertEqual(response.media_type, "text/plain")


if __name__ == "__main__":
    unittest.main()
