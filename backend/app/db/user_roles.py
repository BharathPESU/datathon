import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def get_user_role_by_email(email: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM public.user_roles WHERE LOWER(email) = LOWER(%s);", (email,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row

def list_pending_role_requests():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM public.user_roles WHERE status = 'pending' ORDER BY requested_at DESC;")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

def list_all_user_roles():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM public.user_roles ORDER BY requested_at DESC;")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

def request_user_role(email: str, role: str, employee_id: int = None):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO public.user_roles (email, role, status, employee_id, created_by)
        VALUES (LOWER(%s), %s, 'pending', %s, 'user_request')
        ON CONFLICT (email) DO UPDATE 
        SET role = EXCLUDED.role, status = 'pending', employee_id = EXCLUDED.employee_id, requested_at = CURRENT_TIMESTAMP
        RETURNING *;
    """, (email, role, employee_id))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return row

def add_approved_user(email: str, role: str, employee_id: int = None):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO public.user_roles (email, role, status, employee_id, approved_at, created_by)
        VALUES (LOWER(%s), %s, 'approved', %s, CURRENT_TIMESTAMP, 'admin_add')
        ON CONFLICT (email) DO UPDATE 
        SET role = EXCLUDED.role, status = 'approved', employee_id = EXCLUDED.employee_id, approved_at = CURRENT_TIMESTAMP
        RETURNING *;
    """, (email, role, employee_id))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return row

def approve_user_request(email: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE public.user_roles 
        SET status = 'approved', approved_at = CURRENT_TIMESTAMP
        WHERE LOWER(email) = LOWER(%s)
        RETURNING *;
    """, (email,))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return row

def reject_user_request(email: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE public.user_roles 
        SET status = 'rejected'
        WHERE LOWER(email) = LOWER(%s)
        RETURNING *;
    """, (email,))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return row
