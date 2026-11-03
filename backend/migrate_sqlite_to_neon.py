
from pathlib import Path

from sqlalchemy import MetaData, URL, create_engine, func, select, text

from database import Base, engine


SQLITE_DB_PATH = Path(__file__).resolve().parent / "hr_chatbot.db"

TABLE_ORDER = [
    "chat_sessions",
    "checklist_items",
    "chat_messages",
    "qa_logs",
    "employee_progress",
]


def migrate_database():
    if not SQLITE_DB_PATH.exists():
        raise FileNotFoundError(
            f"SQLite database not found: {SQLITE_DB_PATH}"
        )

    sqlite_engine = create_engine(
        URL.create(
            "sqlite",
            database=str(SQLITE_DB_PATH),
        )
    )

    try:
        source_metadata = MetaData()
        source_metadata.reflect(bind=sqlite_engine)

        for table_name in TABLE_ORDER:
            if table_name not in source_metadata.tables:
                raise RuntimeError(
                    f"Source table missing: {table_name}"
                )

            if table_name not in Base.metadata.tables:
                raise RuntimeError(
                    f"Target model missing: {table_name}"
                )

        source_data = {}

        with sqlite_engine.connect() as source_connection:
            for table_name in TABLE_ORDER:
                source_table = source_metadata.tables[table_name]
                target_table = Base.metadata.tables[table_name]

                source_columns = set(source_table.columns.keys())
                target_columns = set(target_table.columns.keys())

                if source_columns != target_columns:
                    raise RuntimeError(
                        f"Column mismatch in {table_name}. "
                        f"SQLite: {source_columns}, "
                        f"Neon: {target_columns}"
                    )

                result = source_connection.execute(
                    select(source_table)
                )

                source_data[table_name] = [
                    dict(row._mapping)
                    for row in result
                ]

        print("\nSQLite records to migrate:")

        for table_name in TABLE_ORDER:
            print(
                f"{table_name}: {len(source_data[table_name])}"
            )

        Base.metadata.create_all(bind=engine)

        with engine.begin() as target_connection:

            for table_name in TABLE_ORDER:
                target_table = Base.metadata.tables[table_name]

                count = target_connection.execute(
                    select(func.count()).select_from(target_table)
                ).scalar_one()

                if count != 0:
                    raise RuntimeError(
                        f"Migration stopped: Neon table "
                        f"{table_name} already contains {count} records. "
                        "No records were transferred."
                    )

            for table_name in TABLE_ORDER:
                records = source_data[table_name]

                if records:
                    target_table = Base.metadata.tables[table_name]

                    target_connection.execute(
                        target_table.insert(),
                        records,
                    )

            for table_name in TABLE_ORDER:
                target_connection.execute(
                    text(
                        f"""
                        SELECT setval(
                            pg_get_serial_sequence('{table_name}', 'id'),
                            COALESCE(
                                (SELECT MAX(id) FROM {table_name}),
                                1
                            ),
                            EXISTS (
                                SELECT 1 FROM {table_name}
                            )
                        )
                        """
                    )
                )

        print("\nMigration completed successfully!")

        print("\nNeon records after migration:")

        with engine.connect() as target_connection:
            for table_name in TABLE_ORDER:
                target_table = Base.metadata.tables[table_name]

                count = target_connection.execute(
                    select(func.count()).select_from(target_table)
                ).scalar_one()

                print(f"{table_name}: {count}")

        print("\nAll migration checks completed.")

    finally:
        sqlite_engine.dispose()


if __name__ == "__main__":
    migrate_database()
