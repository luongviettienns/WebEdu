"""AKit Lifecycle Hooks runner for Google Antigravity, Claude Code, and Codex."""
from __future__ import annotations

import json
import re
import sys

DANGEROUS_PATTERNS = re.compile(
    r"(?:rm\s+-rf\s+/|git\s+push\s+--force|DROP\s+DATABASE|TRUNCATE\s+TABLE|(?:^|[\\/\s=\"'])\.env(?:\.[A-Za-z0-9_.-]+)?(?:$|[\\/\s=\"']))",
    re.IGNORECASE,
)


def handle_pre_tool_use() -> None:
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
        tc = data.get("toolCall") if isinstance(data.get("toolCall"), dict) else data
        args = tc.get("args") or tc.get("tool_input") or data.get("tool_input") or {}
        text = json.dumps(args)
        if DANGEROUS_PATTERNS.search(text):
            print(
                json.dumps(
                    {
                        "decision": "deny",
                        "reason": "AKit hook blocked destructive command or secret file (.env) access.",
                    }
                )
            )
        else:
            print(
                json.dumps(
                    {
                        "decision": "allow",
                        "reason": "Passed AKit PreToolUse safety gate.",
                    }
                )
            )
    except Exception as e:
        print(
            json.dumps(
                {
                    "decision": "deny",
                    "reason": f"AKit hook fail-closed error: {e}",
                }
            )
        )


def handle_post_tool_use() -> None:
    print(
        json.dumps(
            {
                "decision": "allow",
                "reason": "AKit PostToolUse reminder: run relevant unit/integration tests and typecheck after editing source files.",
            }
        )
    )


def handle_stop() -> None:
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
        if data.get("require_evidence_failed") is True:
            print(
                json.dumps(
                    {
                        "decision": "continue",
                        "reason": "AKit Stop gate: verification evidence incomplete.",
                    }
                )
            )
        else:
            print(
                json.dumps(
                    {
                        "decision": "allow",
                        "reason": "AKit reminder: attach real command evidence before claiming completion.",
                    }
                )
            )
    except Exception:
        print(json.dumps({"decision": "allow", "reason": "AKit Stop hook fallback."}))


def main() -> None:
    try:
        action = sys.argv[1] if len(sys.argv) > 1 else "pre"
        if action == "pre":
            handle_pre_tool_use()
        elif action == "post":
            handle_post_tool_use()
        elif action == "stop":
            handle_stop()
        else:
            print(json.dumps({"decision": "allow"}))
    except Exception as e:
        print(json.dumps({"decision": "allow", "reason": f"Fallback: {e}"}))
    sys.exit(0)


if __name__ == "__main__":
    main()
