"""Load local configuration without overriding variables supplied by the host."""
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ENV = Path(__file__).resolve().parent.parent / ".env"


def load_project_env():
    load_dotenv(PROJECT_ENV, override=False)
