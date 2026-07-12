import os
import logging
import tempfile
from io import BytesIO
from typing import List, Dict, Any
from datetime import datetime, timezone
from app.db.catalyst_db import get_db_app

logger = logging.getLogger(__name__)

# Fallback local directory for local testing/fallback mode
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

class FilestoreService:
    @staticmethod
    def get_or_create_kb_folder(app):
        """Finds or creates a 'KnowledgeBase' folder in Zoho Catalyst File Store."""
        try:
            folders = app.filestore().get_all_folders()
            for f in folders:
                folder_dict = f.to_dict()
                if folder_dict.get("folder_name") == "KnowledgeBase":
                    return f
        except Exception as e:
            logger.warning(f"Could not list folders: {e}. Trying to create folder directly.")
        
        try:
            return app.filestore().create_folder("KnowledgeBase")
        except Exception as e:
            logger.error(f"Failed to create 'KnowledgeBase' folder: {e}")
            raise e

    @staticmethod
    def upload_document(filename: str, content: bytes) -> Dict[str, Any]:
        """Uploads a document to Zoho File Store or falls back to local uploads folder."""
        # A. Save locally on disk as fallback/reference always
        local_path = os.path.join(UPLOAD_DIR, filename)
        with open(local_path, "wb") as f:
            f.write(content)
        
        # B. Try uploading to Zoho Catalyst File Store
        app = get_db_app()
        if app:
            try:
                folder = FilestoreService.get_or_create_kb_folder(app)
                
                # Write to a temp file to satisfy SDK's BufferedReader type requirement
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name
                
                try:
                    with open(tmp_path, "rb") as file_reader:
                        res = folder.upload_file(filename, file_reader)
                        logger.info(f"Successfully uploaded {filename} to Catalyst File Store. ID: {res.get('id')}")
                        return {
                            "file_id": str(res.get("id")),
                            "filename": filename,
                            "size_bytes": len(content),
                            "uploaded_at": datetime.now(timezone.utc).isoformat(),
                            "source": "catalyst_filestore"
                        }
                finally:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
            except Exception as e:
                logger.error(f"Catalyst File Store upload failed: {e}. Using local storage fallback.")

        # C. Fallback response
        return {
            "file_id": filename,
            "filename": filename,
            "size_bytes": len(content),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "source": "local_storage"
        }

    @staticmethod
    def list_documents() -> List[Dict[str, Any]]:
        """Lists all uploaded documents in File Store, falling back to local files."""
        app = get_db_app()
        if app:
            try:
                folder = FilestoreService.get_or_create_kb_folder(app)
                # Fetch files using REST client helper in folder
                resp = folder._requester.request(
                    method="GET",
                    path=f"/folder/{folder._id}/file",
                    user="user"
                )
                files_data = resp.response_json.get("data", [])
                
                result = []
                for f in files_data:
                    result.append({
                        "file_id": str(f.get("id")),
                        "filename": f.get("file_name"),
                        "size_bytes": f.get("file_size"),
                        "uploaded_at": f.get("created_time"),
                        "source": "catalyst_filestore"
                    })
                return result
            except Exception as e:
                logger.error(f"Catalyst File Store listing failed: {e}. Using local storage.")

        # Local storage fallback
        result = []
        for filename in os.listdir(UPLOAD_DIR):
            file_path = os.path.join(UPLOAD_DIR, filename)
            if os.path.isfile(file_path):
                stats = os.stat(file_path)
                result.append({
                    "file_id": filename,
                    "filename": filename,
                    "size_bytes": stats.st_size,
                    "uploaded_at": datetime.fromtimestamp(stats.st_mtime, timezone.utc).isoformat(),
                    "source": "local_storage"
                })
        return result

    @staticmethod
    def delete_document(file_id: str) -> bool:
        """Deletes a document from File Store or local storage."""
        deleted = False
        
        # 1. Delete from Zoho Catalyst File Store
        app = get_db_app()
        if app:
            try:
                folder = FilestoreService.get_or_create_kb_folder(app)
                # Check if file_id is numeric (Catalyst IDs are numbers)
                if file_id.isdigit():
                    folder.delete_file(int(file_id))
                    logger.info(f"Deleted file {file_id} from Catalyst File Store.")
                    deleted = True
            except Exception as e:
                logger.error(f"Catalyst File Store deletion failed: {e}")

        # 2. Delete local fallback file
        local_path = os.path.join(UPLOAD_DIR, file_id)
        if os.path.exists(local_path):
            os.remove(local_path)
            logger.info(f"Deleted local fallback file: {file_id}")
            deleted = True
        else:
            # Check if file_id is an ID but we have a matching local file by name
            # Let's search the list of documents
            for f in FilestoreService.list_documents():
                if f["file_id"] == file_id:
                    path = os.path.join(UPLOAD_DIR, f["filename"])
                    if os.path.exists(path):
                        os.remove(path)
                        deleted = True
                        break

        return deleted
