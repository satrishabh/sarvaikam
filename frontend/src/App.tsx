import { Link, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import AdminPage from './pages/AdminPage';
import HomePage from './pages/HomePage';
import LessonPage from './pages/LessonPage';
import LoginPage from './pages/LoginPage';
import TopicPage from './pages/TopicPage';

export default function App() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link to="/" className="text-xl font-bold text-indigo-400">Sarvaikam</Link>
          <span className="hidden text-sm text-slate-400 sm:inline">Trending tech, step by step</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {user?.role === 'ADMIN' && <Link to="/admin" className="btn-ghost">Admin</Link>}
            {user ? (
              <>
                <span className="text-slate-300">Hi, {user.name}</span>
                <button className="btn-ghost" onClick={logout}>Logout</button>
              </>
            ) : (
              <Link to="/login" className="btn">Login</Link>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/topics/:topicSlug" element={<TopicPage />} />
          <Route path="/topics/:topicSlug/:lessonSlug" element={<LessonPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}
