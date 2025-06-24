---
name: text-diff-comparison
description: A component that compares two text versions and highlights differences with color-coded indicators for added and deleted content, with built-in support for HTML formatting.
keywords: 
- text comparison
- diff
- text diff
- version comparison
- text highlighting
- html formatting
- inline changes
---

#### Text Diff Comparison

***Purpose:***
This component visually compares two versions of text, displaying the original text on the left and a combined view with both deletions and additions highlighted on the right. Deleted text appears with strikethrough in red, while added text is highlighted in green. The component automatically renders HTML formatting like bold text, italics, and underlines.

***Features:***
- Side-by-side comparison with original text on left and changes on right
- Inline change detection showing only the specific words or characters that changed
- Color-coded highlighting of differences (red with strikethrough for deletions, green for additions)
- Customizable column titles
- Different comparison modes (words, characters, lines)
- Optional line numbers display
- Customizable colors for added and deleted text
- Built-in support for HTML formatting tags (<strong>, <em>, <u>, etc.)
- Preserves original text formatting within highlighted changes

***Properties:***
- oldText: string - The original version of the text to compare. Supports HTML formatting tags.
- newText: string - The new version of the text to compare. Supports HTML formatting tags.
- oldVersionTitle: string - Custom title for the old version column
- newVersionTitle: string - Custom title for the new version column
- diffMode: 'words'|'chars'|'lines' - The level of detail for the comparison
- showLineNumbers: boolean - Whether to display line numbers alongside the text
- deletedTextColor: string - Custom color for highlighting deleted text
- addedTextColor: string - Custom color for highlighting added text

***Notes:***
- The component uses the 'diff' library to analyze text differences
- The left column shows the original text without highlighting
- The right column shows both deleted and added content with appropriate highlighting
- HTML formatting tags like <strong>, <em>, <u>, <br> are automatically rendered as formatted text
- Original text formatting is preserved within highlighted changes
- Line breaks in the original text are preserved and displayed correctly
- When line numbers are enabled, they appear at the beginning of each line
- The component shows precise inline changes rather than replacing entire paragraphs
- Example usage: Compare document versions, show changes in content, highlight text differences