class FPTextAreaPlus:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "before_text": ("STRING", {
                    "multiline": False,
                    "default": "",
                    "forceInput": True
                }),
                "text": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "placeholder": "Main text..."
                }),
                "after_text": ("STRING", {
                    "multiline": False,
                    "default": "",
                    "forceInput": True
                }),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "execute"
    CATEGORY = "utils/primitive"
    OUTPUT_NODE = False

    def execute(self, before_text=None, text="", after_text=None):
        parts = []

        # Keep all text exactly as the user entered it, only joining with newlines
        if before_text is not None and before_text != "":
            parts.append(str(before_text))
        if text is not None and text != "":
            parts.append(str(text))
        if after_text is not None and after_text != "":
            parts.append(str(after_text))

        full_text = "\n\n".join(parts)
        return (full_text,)


NODE_CLASS_MAPPINGS = {
    "FPTextAreaPlus": FPTextAreaPlus
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "FPTextAreaPlus": "FP Text Area Plus"
}
