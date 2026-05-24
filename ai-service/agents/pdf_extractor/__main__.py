"""Entry point: `python -m agents.pdf_extractor --self-check`."""

import sys

from agents.pdf_extractor.agent import _self_check

if __name__ == "__main__":
    if "--self-check" in sys.argv:
        sys.exit(_self_check())
    print("Usage: python -m agents.pdf_extractor --self-check")
    sys.exit(2)
