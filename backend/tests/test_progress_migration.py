from sqlalchemy import text, inspect
from sqlmodel import create_engine
from app import database


def test_additive_lesson_migration_preserves_existing_rows(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with engine.begin() as connection:
        connection.execute(text("""CREATE TABLE learningprogress (
            id INTEGER PRIMARY KEY, user_id TEXT, module_id TEXT,
            progress INTEGER, completed BOOLEAN, quiz_score INTEGER, updated_at DATETIME
        )"""))
        connection.execute(text("INSERT INTO learningprogress (id, user_id, module_id, progress, completed) VALUES (1, 'A', 'qubits', 100, 1)"))
    monkeypatch.setattr(database, "engine", engine)
    database.create_db_and_tables()
    database.create_db_and_tables()  # Startup can run again safely.
    with engine.connect() as connection:
        assert "completed_lessons" in {column["name"] for column in inspect(connection).get_columns("learningprogress")}
        row = connection.execute(text("SELECT module_id, progress, completed, completed_lessons FROM learningprogress")).one()
        assert tuple(row) == ("qubits", 100, 1, "[]")
