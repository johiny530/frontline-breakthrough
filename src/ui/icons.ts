// Inline SVG icons (currentColor), so the UI needs no icon font or emoji.
const svg = (body: string, vb = '0 0 24 24') =>
  `<svg class="icon" viewBox="${vb}" aria-hidden="true" fill="currentColor">${body}</svg>`;

export const ICONS = {
  skull: svg('<path d="M12 2C6.9 2 3 5.6 3 10.3c0 2.6 1.2 4.6 3 5.9V19a1 1 0 0 0 1 1h1.5v-2h1.5v2h4v-2h1.5v2H17a1 1 0 0 0 1-1v-2.8c1.8-1.3 3-3.3 3-5.9C21 5.6 17.1 2 12 2Zm-3.5 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm7 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/>'),
  star: svg('<path d="m12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9 5.9 20.4l1.5-6.8L2.2 9l6.9-.7Z"/>'),
  pause: svg('<rect x="6" y="4" width="4.5" height="16" rx="1"/><rect x="13.5" y="4" width="4.5" height="16" rx="1"/>'),
  soundOn: svg('<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  soundOff: svg('<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="m16 9 6 6m0-6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  lock: svg('<path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm2 0h6V7a3 3 0 0 0-6 0Z"/>'),
  chevron: svg('<path d="M3 4h7l5 8-5 8H3l5-8Z"/>', '0 0 18 24'),
  play: svg('<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5Z"/>'),
  retry: svg('<path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z"/>'),
  list: svg('<path d="M4 5h3v3H4Zm5 0h11v3H9Zm-5 5.5h3v3H4Zm5 0h11v3H9ZM4 16h3v3H4Zm5 0h11v3H9Z"/>'),
};
