import re
import os
import json


class FPTextCleanAndSplitt:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "forceInput": True
                }),
            },
            "optional": {
                "before_text": ("STRING", {
                    "multiline": False,
                    "default": "",
                    "forceInput": True
                }),
                "after_text": ("STRING", {
                    "multiline": False,
                    "default": "",
                    "forceInput": True
                }),
            }
        }

    RETURN_TYPES = ("STRING", "LIST")
    RETURN_NAMES = ("cleaned_text", "ar_list")
    FUNCTION = "execute"
    CATEGORY = "prompt/utils"

    def execute(self, before_text=None, text="", after_text=None):
        # Build full text from inputs (None or missing = ignore)
        parts = []
        if before_text:
            parts.append(before_text.rstrip())
        if text:
            parts.append(text)
        if after_text:
            parts.append(after_text.lstrip())

        full_text = "\n".join(filter(None, parts))

        if not full_text.strip():
            return ("", [None] * 5)

        prefix = self.get_comment_prefix()
        lines = full_text.splitlines()

        cleaned_lines = []
        ar_contents = {f"AR{i}": [] for i in range(1, 6)}
        i = 0

        while i < len(lines):
            raw_line = lines[i]
            stripped = raw_line.lstrip()
            line = raw_line.strip()

            # Skip comment lines
            if prefix and stripped.startswith(prefix):
                i += 1
                continue

            # Detect <AR1> to <AR5>
            match = re.match(r"<AR([1-5])>(.*)$", line, re.IGNORECASE)
            if match:
                tag_num = int(match.group(1))
                tail = match.group(2)  # всё, что идёт после <ARn>

                block_lines = []

                # --- 1) Случай: всё в одной строке <AR1>... </>
                if "</>" in tail:
                    before, _sep, _after = tail.partition("</>")
                    before = before.strip()
                    if before:
                        block_lines.append(before)
                    content = "\n".join(block_lines).rstrip()
                    if content:
                        ar_contents[f"AR{tag_num}"].append(content)
                    i += 1
                    continue

                # --- 2) Случай: многострочный блок, ищем закрывающий тег в следующих строках
                i += 1
                while i < len(lines):
                    inner_raw = lines[i]
                    inner_stripped = inner_raw.lstrip()
                    inner_line = inner_raw.strip()

                    # сначала проверяем на закрывающий тег, чтобы не потерять его из-за prefix
                    if "</>" in inner_line:
                        before, _sep, _after = inner_raw.partition("</>")
                        before = before.strip()
                        if before:
                            block_lines.append(before)
                        i += 1
                        break

                    # потом уже фильтруем по prefix
                    if prefix and inner_stripped.startswith(prefix):
                        i += 1
                        continue

                    block_lines.append(inner_raw.rstrip("\n"))
                    i += 1

                content = "\n".join(block_lines).rstrip()
                if content:
                    ar_contents[f"AR{tag_num}"].append(content)
                continue

            # Keep only non-empty lines
            if line:
                cleaned_lines.append(raw_line.rstrip())
            i += 1

        cleaned_text = "\n".join(cleaned_lines)

        ar_list = []
        for n in range(1, 6):
            combined = "\n".join(ar_contents[f"AR{n}"]).strip()
            ar_list.append(combined if combined else None)

        return (cleaned_text, ar_list)

    def get_comment_prefix(self):
        try:
            settings_path = os.path.join(os.path.dirname(
                __file__), "..", "..", "..", "user", "settings.json")
            if os.path.exists(settings_path):
                with open(settings_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    val = data.get("keybinding_extra.comment_prefix")
                    if val and isinstance(val, str):
                        return val.strip()
        except:
            pass
        return "//"


NODE_CLASS_MAPPINGS = {
    "FPTextCleanAndSplitt": FPTextCleanAndSplitt
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "FPTextCleanAndSplitt": "FP Text Clean And Splitt"
}
