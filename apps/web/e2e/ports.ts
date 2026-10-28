// Where the end-to-end tests run their app and servers (playwright.config.ts starts them).

/** The app, as `vite preview` serves its production build. */
export const APP_PORT = 4173;
/** The relay server, the group's server in every test. */
export const SERVER_PORT = 8787;
/** A command post replicating the test server (ADR-0018). */
export const POST_PORT = 8788;

/** The test server's address, as the app's build is pointed at it. */
export const SERVER_URL = `http://localhost:${String(SERVER_PORT)}`;
