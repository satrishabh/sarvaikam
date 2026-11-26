#!/usr/bin/env python3
"""Writes src/main/resources/seed-history/lesson-hashes.json from git history.

For every committed version of the seed/*.json files, records the SHA-256 of each lesson's title and body
(SeedLoader.seedHash: title + "\\n\\n" + body). On startup, a lesson seeded before V10 whose stored text matches
one of these hashes is known to be untouched by editors, so a rewritten seed may replace it.

Run from services/content-service after committing seed changes you want recorded, before rewriting them again:
    python scripts/seed-history.py
"""
import hashlib
import json
import pathlib
import subprocess

SEED_DIR = "src/main/resources/seed"
OUT = pathlib.Path("src/main/resources/seed-history/lesson-hashes.json")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True, encoding="utf-8").stdout


def lessons(document):
    categories = document if isinstance(document, list) else document.get("categories", [document])
    for category in categories:
        for topic in category.get("topics", []):
            for lesson in topic.get("lessons", []):
                if "title" in lesson and "content" in lesson:
                    yield f'{topic["slug"]}/{lesson["slug"]}', lesson["title"], lesson["content"]


def main() -> None:
    hashes: dict[str, set[str]] = {}
    for commit in git("log", "--format=%H", "--", SEED_DIR).split():
        for path in git("ls-tree", "-r", "--name-only", commit, "--", f"{SEED_DIR}/").split():
            if not path.endswith(".json"):
                continue
            try:
                document = json.loads(git("show", f"{commit}:./{path}"))
            except json.JSONDecodeError:
                continue
            for key, title, body in lessons(document):
                digest = hashlib.sha256(f"{title}\n\n{body}".encode("utf-8")).hexdigest()
                hashes.setdefault(key, set()).add(digest)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({k: sorted(v) for k, v in sorted(hashes.items())}, indent=1) + "\n", encoding="utf-8")
    print(f"{OUT}: {len(hashes)} lessons, {sum(len(v) for v in hashes.values())} versions")


if __name__ == "__main__":
    main()
