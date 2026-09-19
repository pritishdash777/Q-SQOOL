"""List tables in the configured database without changing its schema.

Run from the repository root: backend/.venv/bin/python backend/check_db.py
"""
from sqlalchemy import inspect
from app.database import engine


def main():
    print("Tables:")
    for table in inspect(engine).get_table_names():
        print("-", table)


if __name__ == "__main__":
    main()
