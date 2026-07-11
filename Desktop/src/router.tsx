import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import AppShell from '@/App';

// Pages are lazy-loaded from '@/pages'. Minimal stub pages are provided under
// src/pages/ so the app compiles even before the UI agent fleshes them out.
const Home = lazy(() => import('@/pages/Home'));
const Library = lazy(() => import('@/pages/Library'));
const Search = lazy(() => import('@/pages/Search'));
const Album = lazy(() => import('@/pages/Album'));
const Artist = lazy(() => import('@/pages/Artist'));
const Playlist = lazy(() => import('@/pages/Playlist'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'library', element: <Library /> },
      { path: 'search', element: <Search /> },
      { path: 'album', element: <Album /> },
      { path: 'album/:id', element: <Album /> },
      { path: 'artist', element: <Artist /> },
      { path: 'artist/:id', element: <Artist /> },
      { path: 'playlist', element: <Playlist /> },
      { path: 'playlist/:id', element: <Playlist /> },
    ],
  },
]);
