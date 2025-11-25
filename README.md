# Keybinding Extra

A minimal ComfyUI extension that adds several quality-of-life tools:

- Injects handy keyboard shortcuts into the ComfyUI frontend  
- Adds a utility node **Text Cleaner & Splitter** (v1.02) for text preprocessing

In ComfyUI Settings you can enable/disable shortcuts and customize their behavior.  
The utility node can clean text, remove comments, and extract regional prompt tags.

---

## Features (v1.04)

This extension now provides **3 keyboard shortcuts** and **1 utility node**:

1. **Toggle line comment — `Ctrl + /`**
2. **Delete line — `Ctrl + Shift + L`**
3. **Move tag (word) under cursor down and comment it — `Ctrl + Shift + /`**
4. Node: **Text Cleaner & Splitter node** (in utils/primitive category)

---

## Keyboard Shortcuts

### 1. Toggle line comment — `Ctrl + /`

Works in all ComfyUI text editors/areas:

- Ace  
- CodeMirror  
- Plain textarea inputs  

**Behavior**
- Press `Ctrl + /` to comment/uncomment the current line or selected lines.
- By default it uses `// ` (with a space).
- If a line already starts with `//` or `// `, the shortcut removes it.

---

### Configurable comment prefix

In **ComfyUI → Settings → Keybinding Extra** you can set any prefix you want, for example:

- `//`
- `#`
- `--`
- `;`

There is also an enable/disable toggle for the comment shortcut.

---

### 2. Delete line — `Ctrl + Shift + L`

Works in the same editors/areas:

- Ace  
- CodeMirror  
- Plain textarea inputs  

**Behavior**
- Press `Ctrl + Shift + L` to delete the current line.
- If multiple lines are selected, deletes all selected lines.
- Deletion supports editor undo (`Ctrl + Z`) where possible.

---

### 3. Move & Comment word(tag) or selection — `Ctrl + Shift + /`

Works in the same editors/areas:

- Ace  
- CodeMirror  
- Plain textarea inputs  

**Behavior**
- Press `Ctrl + Shift + /` to cut the word under the cursor (or all selected words).
- Removes the word(s) from anywhere in the line.
- Inserts them on the next new line.
- Comments the moved word(s) on new line using the comment prefix set in the extension settings.
- Supports editor undo (`Ctrl + Z`) (I know about whole text selection).

---

# Text Cleaner & Splitter *(new in v1.02)*

A new node added in **category:** `utils/primitive`  
**Node name:** `Text Cleaner & Splitter`

This node performs two major tasks:

---

## 1. Text Cleaning (comment removal)

The node removes all comment lines from the input text.  
The **comment symbol is configurable** in ComfyUI Settings (same setting used for CTRL+/).

Output is provided on:

- **cleaned_text**

---

## 2. Regional Prompt Tag Extraction

The node supports **5 regional prompt tags**, written in uppercase:

```html
<AR1></>
<AR2></>
<AR3></>
<AR4></>
<AR5></>
```

Each tag can contain multiple lines of text.  
Comments inside the tag body are also removed.

The extracted content is returned as a **fixed-length List** on output:

- **ar_list**

### Properties of `ar_list`:

- Always has **exactly 5 elements**
- Order corresponds to AR1 → AR5
- Missing or empty regions return **null**
- If tags repeat, their contents are **concatenated**
- Closing tag is always strictly `</>`  
- Newlines inside tags are preserved

### Example

Input text:

```html
<AR1> Bla1 bla1 bla1 bla1 bla1 </> 
<AR3> Bla3 bla3 bla3 // Bla3 commented </> 
<AR3> Another bla3 bla3 </>

Output:

[
    "Bla1 bla1 bla1\nbla1 bla1",
    null,
    "Bla3 bla3 bla3\nAnother bla3 bla3",
    null,
    null
]
```
<img src="preview1.jpg" width="100%"/>

## Installation

You can install this extension in two ways:

### 1. Through ComfyUI Manager (recommended)

Open **ComfyUI Manager → Install**,  
then simply search for **Keybinding** in the search bar.  
Select the extension and click **Install**.

### 2. Manual installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/akawana/ComfyUI-Keybinding-extra.git

