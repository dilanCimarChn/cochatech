import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

_supabase_client = None


def get_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")

    if not url or not key:
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(url, key)
        return _supabase_client
    except Exception as e:
        print(f"Supabase connection error: {e}")
        return None


def upsert_batch(table: str, records: list[dict], chunk_size: int = 500) -> bool:
    client = get_client()
    if not client or not records:
        return False

    try:
        for i in range(0, len(records), chunk_size):
            chunk = records[i : i + chunk_size]
            client.table(table).upsert(chunk).execute()
        return True
    except Exception as e:
        print(f"Error upserting to {table}: {e}")
        return False


def fetch_all(table: str) -> list[dict]:
    client = get_client()
    if not client:
        return []
    try:
        response = client.table(table).select("*").execute()
        return response.data or []
    except Exception as e:
        print(f"Error fetching from {table}: {e}")
        return []
