# TrackCode
[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/Enjay404/TrackCode)

Instant Spotify ISRC lookup for Instagram Stories & Notes. Find the hidden search code for over 100 million songs.

<p align="center">
  <em>A fast, mobile-first PWA to find the ISRC for any Spotify track. The UI is designed with an iOS-inspired "liquid glass" aesthetic, featuring a main search bar, a results list, and a detailed bottom sheet for track information and copy actions.</em>
</p>

## Features

-   **Instant ISRC Lookup**: Search for any song on Spotify by name, artist, or album.
-   **Link & URI Support**: Paste any Spotify track link (`open.spotify.com`, `spotify.link`), URI (`spotify:track:...`), or track ID to go directly to its details.
-   **One-Tap Copy**: Tap any track in the results to instantly copy its ISRC code, ready to be pasted into Instagram's music search.
-   **Track Details Sheet**: View detailed information including album art, artist, release year, and explicit status in a sleek, draggable bottom sheet.
-   **Recent History**: Automatically saves your recently copied tracks for quick access.
-   **Installable PWA**: Add TrackCode to your home screen for a fast, native app-like experience.
-   **Responsive Design**: Built for mobile but works great on any device.
-   **Offline Support**: Your recent history is available even when you're offline.

## How It Works

TrackCode uses the Spotify Web API to find track information. The backend is a simple Node.js/Express server that handles communication with Spotify.

1.  **Authentication**: The server authenticates with the Spotify API using the Client Credentials Flow and caches the access token for efficiency.
2.  **Search**: When you search for a song, the `/api/search` endpoint queries the Spotify API and returns a list of matching tracks.
3.  **Link Resolution**: When you paste a link, the `/api/track` endpoint intelligently resolves it. It can handle various formats, including shortened URLs (e.g., `spotify.link`), by following redirects on the server to find the final track ID.
4.  **Data Normalization**: The server processes the raw data from Spotify, normalizing it into a clean `TrackItem` format for the frontend to display.

## Tech Stack

-   **Frontend**: React, TypeScript, Vite, Tailwind CSS, Motion
-   **Backend**: Node.js, Express.js
-   **API**: Spotify Web API
-   **PWA**: `vite-plugin-pwa` for service worker and manifest generation.

## Local Development

To run TrackCode locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/enjay404/trackcode.git
    cd trackcode
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    -   Create a Spotify application on the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
    -   Copy the `.env.example` file to a new file named `.env`.
    -   Add your Spotify Client ID and Client Secret to the `.env` file:
        ```env
        SPOTIFY_CLIENT_ID="YOUR_SPOTIFY_CLIENT_ID"
        SPOTIFY_CLIENT_SECRET="YOUR_SPOTIFY_CLIENT_SECRET"
        ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

## Scripts

-   `npm run dev`: Starts the Vite development server with the Express backend.
-   `npm run build`: Builds the production-ready frontend assets.
-   `npm run start`: Starts the production Express server to serve static assets and the API.

## File Structure

```
.
├── server.ts         # Express.js backend server
├── vite.config.ts    # Vite configuration, including PWA setup
├── public/           # Static assets (icons, etc.)
└── src/
    ├── App.tsx       # Main React application component
    ├── components/   # Reusable UI components
    ├── hooks/        # Custom React hooks
    ├── types/        # TypeScript type definitions
    └── utils/        # Utility functions
```

---

Made with ❤️ by [@enjay404](https://instagram.com/enjay404)
