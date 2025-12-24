# Project Evolution & Restructuring

## Evolution Trace

### Stage 1: Monolithic Early Dev
The project started as a standard Next.js app with local JSON file storage.

### Stage 2: Split Architecture (Legacy)
The app was briefly split into a separate **Frontend (Next.js)** and **Backend (Express.js)** to handle complex data parsing and Scryfall caching on port 3001.

### Stage 3: Modern Unified Architecture (Current)
The architecture was reunified into a single high-performance Next.js application. 

**Why the change?**
1. **Developer Experience**: One command (`./dev.sh`), one port (3000), one deployment.
2. **Supabase Integration**: Next.js API Routes provide the perfect serverless environment for Supabase Admin operations.
3. **Data Performance**: By leveraging PostgreSQL and server-side card caching via Supabase, the need for a persistent Express process was eliminated.

---

## 🏗️ Current Structure (`/frontend`)

### Backend API (`app/api/`)
- **`upload/`**: Handles multi-format card imports (CSV/TXT). Syncs with the global `card_cache`.
- **`decks/`**: Full CRUD for user decks. Includes metadata enrichment (like pulling commander art for backgrounds).
- **`collection/`**: High-speed retrieval of user card data.
- **`auto-build/`**: Complex logic to generate 100-card decks by matching collection data against competitive strategy patterns.

### Frontend Components
- **Unified Navigation**: A single `NavigationPill` component managing flow between Collection, Decks, and Builder.
- **TopBar**: Persistent user session management, profile access, and global navigation.
- **Deck Sidebar**: Real-time deck analysis, including Salt Meter and Export tools.

## 💾 Data Persistence
- **PostgreSQL**: Hosted on Supabase, storing user relationship data, saved decks, and collections.
- **Card Cache Table**: A massive indexed table storing all relevant Scryfall card data to prevent API rate-limiting and ensure instant search results.

## 🚀 Running the App
The unified `dev.sh` script handles everything:
```bash
./dev.sh
```
- Installs dependencies if missing.
- Starts the Next.js development server.
- Redirects logs to `frontend.log` for easy debugging.

## 🎯 Architectural Benefits
- **Zero Latency**: API routes and frontend live on the same origin.
- **Security**: Supabase service-role operations are kept strictly server-side in API routes.
- **Maintainability**: Types are shared across the entire stack within a single directory structure.
