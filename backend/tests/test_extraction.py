from __future__ import annotations

import pytest

from app.services.extraction_service import ExtractionService
from app.services.validation_service import FileValidationError


@pytest.mark.parametrize("extension", [".pdf", ".txt", ".md", ".docx", ".epub", ".html", ".htm", ".tex"])
def test_extractor_dispatch_covers_supported_extensions(extension: str) -> None:
    extractor = ExtractionService()._get_extractor(extension)

    assert callable(extractor)


def test_extractor_dispatch_rejects_unknown_extension() -> None:
    with pytest.raises(FileValidationError) as exc:
      ExtractionService()._get_extractor(".rtf")

    assert exc.value.code == "UNSUPPORTED_FORMAT"


@pytest.mark.asyncio
async def test_extract_txt(tmp_path) -> None:
    path = tmp_path / "note.txt"
    path.write_text("Hello\n\nReader", encoding="utf-8")

    data = await ExtractionService().extract(path, ".txt", "utf-8")

    assert data["text"] == "Hello\n\nReader"
    assert data["char_count"] == len("Hello\n\nReader")


@pytest.mark.asyncio
async def test_extract_markdown_title(tmp_path) -> None:
    path = tmp_path / "note.md"
    path.write_text("# Title\n\nSome **bold** text.", encoding="utf-8")

    data = await ExtractionService().extract(path, ".md", "utf-8")

    assert "Some" in data["text"]
    assert data["metadata"]["title"] == "Title"


@pytest.mark.asyncio
async def test_extract_obsidian_style_chinese_markdown_keeps_body(tmp_path) -> None:
    path = tmp_path / (
        "COLA- Towards Efficient Multi-Objective Reinforcement Learning "
        "with Conflict Objective Regularization in Latent Space.md"
    )
    markdown = """# 组会分享笔记：COLA

## 论文基本信息

| 项目 | 内容 |
| --- | --- |
| 论文标题 | COLA: Towards Efficient Multi-Objective Reinforcement Learning |
| 代码 | https://github.com/yeshenpy/COLA |

---

## 一、核心结论

这篇论文要解决的是：在多目标强化学习中，一个策略或一组策略需要覆盖不同偏好下的 Pareto 前沿。
作者提出 COLA，把问题拆成公共动力学知识共享和冲突偏好正则化两个核心矛盾。
"""
    path.write_text(markdown, encoding="utf-8")

    data = await ExtractionService().extract(path, ".md", "utf-8")

    assert data["metadata"]["title"] == "组会分享笔记：COLA"
    assert "论文基本信息" in data["text"]
    assert "一、核心结论" in data["text"]
    assert "公共动力学知识共享" in data["text"]
    assert data["char_count"] > len("组会分享笔记：COLA")
