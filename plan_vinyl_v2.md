# Implementation Plan: Vinyl Widget Layout Fix & Bandcamp Integration

The user wants to fix the "Vinyl of the Week" widget layout to be horizontal (artwork on left, text on right) as per the mockup, and add a feature to search/extract album data from Bandcamp.

## User Objective
1. **Fix Layout**: Restore the horizontal side-by-side layout (Artwork Left, Text Right, Actions Bottom/Right).
2. **Bandcamp Integration**: Add a search/fetch feature in the edit mode to populate data from Bandcamp.

## Proposed Changes

### 1. CSS Refinitive (Layout Fix)
- Update `.vinyl-display` (or the container) to use `flex-direction: row`.
- Ensure the artwork container and info container have proper flex-basis/width.
- Fix button positioning to match the mockup (Bottom row).
- Ensure vertical centering of the entire content within the card.

### 2. HTML/JS Refinements (Bandcamp Feature)
- **Edit UI**: Add a "Search on Bandcamp" field or "Import from Bandcamp URL" field.
- **Logic**:
    - Since client-side scraping is blocked by CORS, I will implement a "Magic Import" feature where the user can paste a Bandcamp URL.
    - I will add a helper function in `app.js` that uses a public CORS proxy (like `corsproxy.io`) or similar to fetch the Bandcamp page metadata.
    - Extract: Album Title, Artist, Large Cover URL, and potentially the first track for the Spotify link equivalent (or just the Bandcamp URL itself).
- **Fallback**: If CORS proxy fails, provide a manual entry guidance.

### 3. Polish
- Ensure the "Deep Listen" overlay still works and matches the new layout aesthetics.
- Verify all transitions are smooth (<160ms).

## Verification Plan
1. **Visual Check**: Use browser subagent to verify the horizontal layout.
2. **Feature Check**: Attempt to import a known Bandcamp URL (e.g., Chihei Hatakeyama) and see if fields populate.
3. **Responsive Check**: Ensure it doesn't break on narrower views.
