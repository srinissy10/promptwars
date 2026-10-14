from __future__ import annotations

import unittest

from backend.docchat.services.documents import Page, _prepare_pdf_pages, chunk_pages


class ChunkingTests(unittest.TestCase):
    def test_chunks_preserve_page_and_overlap(self):
        text = " ".join(f"word{index}" for index in range(95))
        chunks = chunk_pages([Page(7, text, "Policy")], max_words=40, overlap_words=8)
        self.assertEqual(len(chunks), 3)
        self.assertTrue(all(item["page_start"] == 7 for item in chunks))
        self.assertIn("word32", chunks[0]["content"])
        self.assertIn("word32", chunks[1]["content"])
        self.assertEqual(chunks[0]["section_title"], "Policy")

    def test_chinese_text_is_split_without_spaces(self):
        text = "企业文档管理系统需要提供可靠的来源引用和长期对话能力。" * 8
        chunks = chunk_pages([Page(1, text)], max_words=30, overlap_words=5)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(item["content"] for item in chunks))

    def test_pdf_page_cleanup_removes_repeated_header_and_page_number(self):
        pages = _prepare_pdf_pages(
            [
                "Design Document\n1 Project background\nReadable content\n1",
                "Design Document\n2 Architecture\nMore content\n2",
                "Design Document\n3 Security\nControls\n3",
            ]
        )
        self.assertEqual(pages[0].section_title, "1 Project background")
        self.assertNotIn("Design Document", pages[0].content)
        self.assertFalse(pages[0].content.endswith("\n1"))


if __name__ == "__main__":
    unittest.main()
