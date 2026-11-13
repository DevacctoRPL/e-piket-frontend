# UI Rules

- Keep scrollbars hidden visually throughout the application, including vertical and horizontal scrollbars and their arrow buttons. Scrolling behavior must remain fully functional with touch, mouse wheel/trackpad, keyboard, and programmatic scrolling.
- Do not remove or weaken the global scrollbar-hiding rules in `src/styles/globals.css`, and do not add visible scrollbars to tables, dialogs, sheets, navigation, or page content. Only change this behavior when the user explicitly requests it.
- Preserve overflow handling and reachable content when hiding scrollbars. Do not replace scrolling with clipping or disable overflow merely to remove scrollbar visuals.
