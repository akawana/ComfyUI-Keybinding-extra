import os
import json
import traceback

print = lambda *a, **k: None  # Disable print statements for cleaner output

class FPFoldedPrompts:
    """FPFoldedPrompts node.

    All UI (text / tree / buttons) is implemented in JS.
    Python part:
    - when pf_json and pf_node_id are present, writes JSON to pf_<node_id>.json
    - builds the final text based on enabled lines and their areas.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "",
                    },
                ),
            },
            "optional": {
                # JSON of the tree (hidden widget, controlled by JS)
                "pf_json": (
                    "STRING",
                    {
                        "default": "",
                    },
                ),
                # node_id (hidden widget, JS writes node id here)
                "pf_node_id": (
                    "STRING",
                    {
                        "default": "",
                    },
                ),
                "before_text": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "",
                        "forceInput": True,
                    },
                ),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = "prompt/utils"
    OUTPUT_NODE = False

    def __init__(self):
        base_dir = os.path.dirname(__file__)
        self.data_dir = os.path.join(base_dir, "..", "pf_data")
        try:
            os.makedirs(self.data_dir, exist_ok=True)
            # print(f"[FPFoldedPrompts] Data dir: {self.data_dir}")
        except Exception as e:
            print(f"[FPFoldedPrompts] Failed to create data dir: {e}")
            traceback.print_exc()

    # @classmethod
    # def IS_CHANGED(cls, **kwargs):
    #     # Force recompute on any widget change
    #     return float("NaN")

    @staticmethod
    def _merge_before(before_text: str, main_text: str) -> str:
        """Merge optional before_text and main_text with a single newline between them."""
        before_text = before_text or ""
        main_text = main_text or ""
        if before_text and main_text:
            return before_text.rstrip("\n") + "\n" + main_text.lstrip("\n")
        return before_text or main_text

    def run(self, text: str, pf_json: str = "", pf_node_id: str = "", before_text: str = "", **kwargs):
        # print("[FPFoldedPrompts] run() called")

        # 1. Save pf_json to file if node_id and non-empty json are present
        if pf_json and pf_node_id:
            try:
                filename = os.path.join(self.data_dir, f"pf_{pf_node_id}.json")
                with open(filename, "w", encoding="utf-8") as f:
                    f.write(pf_json)
                # print(f"[FPFoldedPrompts] Saved JSON to: {filename}")
            except Exception as e:
                print(f"[FPFoldedPrompts] Failed to save JSON: {e}")
                traceback.print_exc()

        # 2. If pf_json is empty — just return the original text
        if not pf_json or not pf_json.strip():
            # print("[FPFoldedPrompts] pf_json is empty, returning raw text")
            merged = self._merge_before(before_text, text or "")
            return (merged,)

        # 3. Parse JSON and build the final text according to the rules
        try:
            tree = json.loads(pf_json)
            # print("[FPFoldedPrompts] Parsed pf_json successfully")
        except Exception as e:
            print(f"[FPFoldedPrompts] Failed to parse pf_json, returning raw text: {e}")
            traceback.print_exc()
            merged = self._merge_before(before_text, text or "")
            return (merged,)

        try:
            result_lines = []
            items = tree.get("items") or []
            # print(f"[FPFoldedPrompts] Root items: {len(items)}")

            def walk(items_list, parent_area="ALL"):
                """Walk through tree items and collect enabled lines.

                parent_area:
                    - "ALL"  -> use the element's own area (if not ALL)
                    - "ARn"  -> ignore areas of nested elements, always wrap in this tag
                """
                for item in items_list:
                    itype = item.get("type")
                    area = item.get("area", "ALL") or "ALL"

                    # If parent area is not ALL, it dominates
                    current_area = parent_area if parent_area != "ALL" else area

                    if itype == "folder":
                        children = item.get("children") or []
                        print(
                            f"[FPFoldedPrompts] Folder: {item.get('title', '')!r}, "
                            f"children={len(children)}, area={area}, parent_area={parent_area}"
                        )
                        walk(children, current_area)
                    elif itype == "line":
                        enabled = bool(item.get("enabled", True))
                        raw_line = item.get("text", "")
                        print(
                            f"[FPFoldedPrompts] Line: enabled={enabled}, "
                            f"area={area}, parent_area={parent_area}, text={raw_line!r}"
                        )
                        if not enabled:
                            continue

                        eff_area = current_area
                        if eff_area and eff_area != "ALL":
                            result_lines.append(f"<{eff_area}>{raw_line}</>")
                        else:
                            result_lines.append(raw_line)
                    else:
                        print(f"[FPFoldedPrompts] Unknown item type: {itype!r}")

            walk(items, parent_area="ALL")
            print(f"[FPFoldedPrompts] Result lines count: {len(result_lines)}")
            final_text = "\n".join(result_lines)
            print("[FPFoldedPrompts] final_text repr:", repr(final_text))
        except Exception as e:
            print(f"[FPFoldedPrompts] Error while building output text: {e}")
            traceback.print_exc()
            final_text = text or ""

        merged = self._merge_before(before_text, final_text)
        return (merged,)


NODE_CLASS_MAPPINGS = {
    "FPFoldedPrompts": FPFoldedPrompts,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "FPFoldedPrompts": "FP Folded Prompts",
}
