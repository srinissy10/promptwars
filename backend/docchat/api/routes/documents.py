from __future__ import annotations

import mimetypes
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse

from ...runtime import AppContext
from ..dependencies import current_user, get_context
from ..helpers import require_document, safe_document

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("")
def list_documents(
    search: str = Query(default="", max_length=120),
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> list[dict[str, Any]]:
    return [safe_document(item) for item in context.database.list_documents(user["id"], search)]


@router.post("", status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    filename = Path(file.filename or "document").name
    extension = Path(filename).suffix.lower()
    upload_settings = context.config.section("uploads")
    allowed = {str(item).lower() for item in upload_settings.get("allowed_extensions", [])}
    if extension not in allowed:
        raise HTTPException(status_code=415, detail=f"Allowed file types: {', '.join(sorted(allowed))}")
    max_bytes = int(upload_settings.get("max_file_mb", 50)) * 1024 * 1024
    storage_path = context.uploads_path / f"{uuid.uuid4()}{extension}"
    size = 0
    try:
        with storage_path.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(status_code=413, detail="The file is larger than the configured limit")
                output.write(chunk)
    except Exception:
        storage_path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()
    mime_type = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    document = context.database.create_document(
        user_id=user["id"],
        filename=filename,
        storage_path=str(storage_path),
        extension=extension,
        mime_type=mime_type,
        size_bytes=size,
    )
    background_tasks.add_task(
        context.ingestion.ingest,
        document["id"],
        user["id"],
        storage_path,
        extension,
    )
    return safe_document(document)


@router.get("/{document_id}")
def get_document(
    document_id: str,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    return safe_document(require_document(context, document_id, user["id"]))


@router.post("/{document_id}/replace")
async def replace_document(
    document_id: str,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    document = require_document(context, document_id, user["id"])
    filename = Path(file.filename or "document").name
    extension = Path(filename).suffix.lower()
    upload_settings = context.config.section("uploads")
    allowed = {str(item).lower() for item in upload_settings.get("allowed_extensions", [])}
    if extension not in allowed:
        raise HTTPException(status_code=415, detail=f"Allowed file types: {', '.join(sorted(allowed))}")
    max_bytes = int(upload_settings.get("max_file_mb", 50)) * 1024 * 1024
    temp_storage_path = context.uploads_path / f"{uuid.uuid4()}{extension}"
    size = 0
    try:
        with temp_storage_path.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(status_code=413, detail="The file is larger than the configured limit")
                output.write(chunk)
    except Exception:
        temp_storage_path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    mime_type = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    try:
        updated = context.ingestion.replace_document(
            document_id=document_id,
            user_id=user["id"],
            file_path=temp_storage_path,
            filename=filename,
            extension=extension,
            mime_type=mime_type,
            size_bytes=size,
        )
        return safe_document(updated)
    except Exception as exc:
        temp_storage_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Failed to replace document: {exc}") from exc


@router.get("/{document_id}/versions")
def list_versions(
    document_id: str,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> list[dict[str, Any]]:
    require_document(context, document_id, user["id"])
    return context.database.list_document_versions(document_id, user["id"])


@router.post("/{document_id}/summarize")
def summarize_document(
    document_id: str,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    document = require_document(context, document_id, user["id"])
    if document["status"] != "ready":
        raise HTTPException(status_code=409, detail="Document is not ready for summarization")
    chunks = context.database.get_chunks(document_id, user["id"])
    return context.intelligence.summarize(
        document_id=document_id,
        filename=document["filename"],
        chunks=chunks,
    )


@router.post("/{document_id}/compress")
def compress_document(
    document_id: str,
    replace_original: bool = Query(default=False),
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    document = require_document(context, document_id, user["id"])
    if document["extension"] != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF documents can be compressed")

    source_path = Path(document["storage_path"])
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Underlying document file not found")

    from ..services.intelligence import compress_pdf
    compressed_path = context.uploads_path / f"compressed_{document_id}_{uuid.uuid4().hex[:8]}.pdf"
    try:
        metrics = compress_pdf(source_path, compressed_path)
        if replace_original and metrics["reduction_bytes"] > 0:
            source_path.unlink(missing_ok=True)
            compressed_path.replace(source_path)
            context.database.update_document(document_id, size_bytes=metrics["output_size_bytes"])
            metrics["replaced_original"] = True
        else:
            metrics["replaced_original"] = False

        metrics["document_id"] = document_id
        metrics["filename"] = document["filename"]
        return metrics
    except Exception as exc:
        compressed_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"PDF compression failed: {exc}") from exc


@router.post("/{document_id}/extract-checklist")
def extract_checklist(
    document_id: str,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    document = require_document(context, document_id, user["id"])
    if document["status"] != "ready":
        raise HTTPException(status_code=409, detail="Document is not ready for checklist extraction")
    chunks = context.database.get_chunks(document_id, user["id"])
    return context.intelligence.extract_checklist(
        document_id=document_id,
        filename=document["filename"],
        chunks=chunks,
    )


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> FileResponse:
    document = require_document(context, document_id, user["id"])
    path = Path(document["storage_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Document file not found on disk")
    return FileResponse(
        path=path,
        filename=document["filename"],
        media_type=document["mime_type"],
        headers={"Content-Disposition": f'attachment; filename="{document["filename"]}"'},
    )


@router.get("/{document_id}/preview")
def preview_document(
    document_id: str,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    document = require_document(context, document_id, user["id"])
    chunks = context.database.get_chunks(document_id, user["id"])
    pages: list[dict[str, Any]] = []
    seen_pages: set[int] = set()
    for chunk in chunks:
        page_num = chunk["page_start"]
        if page_num not in seen_pages:
            seen_pages.add(page_num)
            pages.append({
                "page_number": page_num,
                "section_title": chunk.get("section_title") or f"Page {page_num}",
                "snippet": chunk["content"][:300],
            })
    return {
        "document_id": document_id,
        "filename": document["filename"],
        "extension": document["extension"],
        "page_count": document["page_count"],
        "chunk_count": document["chunk_count"],
        "current_version": document.get("current_version", 1),
        "size_bytes": document["size_bytes"],
        "preview_pages": pages[:10],
        "file_url": f"/api/documents/{document_id}/file",
    }


@router.get("/{document_id}/file")
def view_document_file(
    document_id: str,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> FileResponse:
    document = require_document(context, document_id, user["id"])
    path = Path(document["storage_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Document file not found on disk")
    return FileResponse(
        path=path,
        media_type=document["mime_type"],
        headers={"Content-Disposition": f'inline; filename="{document["filename"]}"'},
    )


@router.post("/{document_id}/reindex", status_code=202)
def reindex_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> dict[str, Any]:
    document = require_document(context, document_id, user["id"])
    context.database.update_document(document_id, status="processing", error_message=None)
    background_tasks.add_task(
        context.ingestion.ingest,
        document_id,
        user["id"],
        Path(document["storage_path"]),
        document["extension"],
    )
    return {"id": document_id, "status": "processing"}


@router.delete("/{document_id}", status_code=204, response_class=Response)
def delete_document(
    document_id: str,
    user: dict[str, Any] = Depends(current_user),
    context: AppContext = Depends(get_context),
) -> Response:
    document = require_document(context, document_id, user["id"])
    if context.database.delete_document(document_id, user["id"]):
        Path(document["storage_path"]).unlink(missing_ok=True)
    return Response(status_code=204)
