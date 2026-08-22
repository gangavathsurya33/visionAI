import os
import ssl
from pathlib import Path
import re
from dotenv import load_dotenv
from sqlalchemy import text, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(
    BASE_DIR / ".env",
    override=False,
)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is missing from backend/.env"
    )


# ============================================================
# SQLALCHEMY BASE
# ============================================================

class Base(DeclarativeBase):
    pass


# ============================================================
# AIVEN MYSQL SSL
# ============================================================

CA_FILE = BASE_DIR / "ca.pem"

if not CA_FILE.exists():
    raise RuntimeError(
        f"Aiven CA certificate not found: {CA_FILE}"
    )

ssl_context = ssl.create_default_context(
    cafile=str(CA_FILE)
)


# ============================================================
# DATABASE URL
# ============================================================
#
# Keep the original MySQL URL.
# We deliberately use the synchronous PyMySQL driver because
# your direct PyMySQL connection has already been proven to work.
#
# mysql+aiomysql://...
#        ↓
# mysql+pymysql://...
#
# ============================================================

import re

DATABASE_URL = re.sub(
    r"^mysql(\+\w+)?://",
    "mysql+pymysql://",
    DATABASE_URL,
)


# ============================================================
# DATABASE ENGINE
# ============================================================

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={
        "ssl": ssl_context,
        "connect_timeout": 10,
    },
)


# ============================================================
# DATABASE SESSION
# ============================================================

SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    expire_on_commit=False,
)


def get_db():
    db = SessionLocal()

    try:
        yield db

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# ============================================================
# INITIALIZE DATABASE
# ============================================================

def init_db():

    marker_file = BASE_DIR / ".db_initialized"

    # If the database schema has already been initialized,
    # don't repeat all the schema checks on every restart.
    #
    # We still perform a cheap connectivity check so that
    # the backend does not falsely report that the database
    # is available.
    if marker_file.exists():

        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return

    # Import every model so SQLAlchemy knows about
    # every table before create_all() runs.
    from models import (
        User,
        DocumentChatSession,
        DocumentChatMessage,
    )

    with engine.begin() as connection:

        # ----------------------------------------------------
        # CREATE TABLES
        # ----------------------------------------------------

        Base.metadata.create_all(
            bind=connection
        )

        # ----------------------------------------------------
        # CHECK users.name
        # ----------------------------------------------------

        result = connection.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'users'
                  AND COLUMN_NAME = 'name'
                """
            )
        )

        if not result.scalar():

            connection.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN name VARCHAR(255) NULL
                    AFTER id
                    """
                )
            )

        # ----------------------------------------------------
        # CHECK oauth_provider
        # ----------------------------------------------------

        result = connection.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'users'
                  AND COLUMN_NAME = 'oauth_provider'
                """
            )
        )

        if not result.scalar():

            connection.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN oauth_provider VARCHAR(50) NULL
                    AFTER password_hash
                    """
                )
            )

        # ----------------------------------------------------
        # CHECK oauth_provider_id
        # ----------------------------------------------------

        result = connection.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'users'
                  AND COLUMN_NAME = 'oauth_provider_id'
                """
            )
        )

        if not result.scalar():

            connection.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN oauth_provider_id VARCHAR(255) NULL
                    AFTER oauth_provider
                    """
                )
            )

        # ----------------------------------------------------
        # ALLOW NULL PASSWORD FOR OAUTH ACCOUNTS
        # ----------------------------------------------------

        connection.execute(
            text(
                """
                ALTER TABLE users
                MODIFY COLUMN password_hash VARCHAR(255) NULL
                """
            )
        )

    # --------------------------------------------------------
    # DATABASE INITIALIZATION COMPLETE
    # --------------------------------------------------------

    marker_file.write_text(
        "Database schema initialized successfully.",
        encoding="utf-8",
    )