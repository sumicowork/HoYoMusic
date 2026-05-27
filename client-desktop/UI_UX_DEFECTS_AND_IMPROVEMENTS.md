# HoYoMusic Desktop Windows Client - UI/UX Refactor Log
## HoYoPlayerBar.xaml Improvements
1. **Track Details Flyout**: Converted inline buttons into a primary Row and an elegant "More" MenuFlyout, removing horizontal clutter.
2. **Queue Flyout**: Implemented a Header/Search section, simplified ItemTemplate with MenuFlyout operations (up, down, remove), and aligned large actions (reverse, shuffle, clear) into a clean Footer grid.
3. **Enhancement Flyout**: Categorized into isolated SubtleGlassCards (EQ, Crossfade, Visualizer).
## HoYoMainContent.xaml Improvements
1. **Playlists Section**: completely scrapped the overlapping horizontal stack layout. Designed a modern two-pane UI.
   - Left Pane: My Playlists list, Search, Inline Add Button.
   - Right Pane: Name/Description editor, actions MenuFlyout, Track count/search, and customized track list view with inline actions.
2. **Library Section**: Discarded massive raw horizontal inputs. Built a clean Advanced Form Panel containing filters for 'Year', 'Duration' and 'Sorting'. Updated ListView cards to match discovery aesthetics.
All fixes natively written in XAML without automated scripts. Project compiles perfectly.
