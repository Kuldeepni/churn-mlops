"""Print the list of documented Makefile targets.

``make help`` is the only place where the Makefile is documented; this helper
keeps the output identical on Windows and Linux (no ``grep``/``awk`` required).
"""

from __future__ import annotations

import re
from pathlib import Path

TARGET_RE = re.compile(r"^([A-Za-z0-9_.-]+):(?!=)(.*)$")


def main() -> None:
    """Print all targets that carry a ``##`` documentation comment."""
    makefile = Path(__file__).resolve().parents[1] / "Makefile"
    lines = makefile.read_text(encoding="utf-8").splitlines()

    entries: list[tuple[str, str]] = []
    for line in lines:
        match = TARGET_RE.match(line)
        if not match:
            continue
        target, rest = match.group(1), match.group(2)
        doc = re.search(r"##\s*(.+)$", rest)
        if doc:
            entries.append((target, doc.group(1).strip()))

    width = max((len(name) for name, _ in entries), default=10)
    print("churn-mlops - available targets")
    print("")
    for name, doc in entries:
        print(f"  {name.ljust(width)}  {doc}")
    print("")
    print("Tip: run `make <target>` (the description above is also available via `make help`).")


if __name__ == "__main__":
    main()
