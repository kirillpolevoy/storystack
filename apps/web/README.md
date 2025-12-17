# StoryStack Web

Next.js web application for StoryStack - a centralized hub for asset and content management.

## Features

- **Authentication**: Email/password auth via Supabase
- **Asset Library**: Grid view with infinite scroll, search, and tag filtering
- **Upload**: Drag & drop multi-file upload with client-side thumbnail generation
- **Asset Management**: View details, edit tags, and delete assets
- **Stories**: Create and manage story sequences with drag/reorder
- **Campaigns**: Organize assets by campaigns (optional)

## Tech Stack

- **Next.js 14+** (App Router)
- **TypeScript**
- **Supabase** (Auth + Postgres + Storage)
- **TanStack Query** (data fetching & caching)
- **Tailwind CSS** + **shadcn/ui**
- **@supabase/ssr** (server-side auth)

## Setup

### Prerequisites

- Node.js 18+ and npm
- Supabase project with:
  - `assets` table
  - `stories` table
  - `story_assets` table
  - `campaigns` table
  - Storage bucket named `assets`

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

Create a `.env.local` file in the `apps/web` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Run database migration:

Execute the SQL in `ADD_THUMBNAIL_COLUMNS.sql` to add thumbnail columns to the assets table:

```sql
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS storage_path_preview TEXT,
ADD COLUMN IF NOT EXISTS storage_path_thumb TEXT;
```

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Vercel

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)

2. Import your project in [Vercel](https://vercel.com)

3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Deploy!

The app will be automatically deployed on every push to your main branch.

### Environment Variables

Make sure to set these in your Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Project Structure

```
apps/web/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth routes (login, signup)
│   └── (app)/             # Protected app routes
│       ├── library/       # Asset library
│       ├── campaigns/      # Campaigns
│       └── stories/       # Stories
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── auth/             # Auth components
│   ├── library/          # Library components
│   └── stories/          # Story components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities
│   └── supabase/         # Supabase clients
└── utils/                # Helper functions
```

## Key Features

### Asset Library

- Infinite scroll grid with virtualization
- Search by filename (parsed from storage_path)
- Filter by tags
- Upload with automatic thumbnail generation (preview + thumb)

### Asset Detail Panel

- Desktop: Right drawer (Sheet)
- Mobile: Full-screen modal (Dialog)
- View metadata, edit tags, delete asset

### Stories

- Create and manage story sequences
- Drag/reorder assets
- Add assets from library

### Upload Flow

1. Client-side image processing:
   - Generate preview (max 2000px)
   - Generate thumb (400px)
2. Upload all three versions to Supabase Storage
3. Insert asset record with paths
4. Optimistic UI update

## Database Schema

The app expects the following tables:

- `assets`: user_id, storage_path, storage_path_preview, storage_path_thumb, source, tags, etc.
- `stories`: user_id, name, description, cover_asset_id, etc.
- `story_assets`: story_id, asset_id, order_index
- `campaigns`: user_id, name

All queries filter by `user_id` to ensure user isolation (RLS policies should also enforce this).

## Development

### Running Locally

```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Notes

- Assets are filtered by `user_id` directly (not `campaign_id`) per v0 requirements
- Thumbnail columns (`storage_path_preview`, `storage_path_thumb`) are nullable for backward compatibility
- Filename is parsed from `storage_path` (no separate filename column)
- All RLS policies must allow users to access only their own data

