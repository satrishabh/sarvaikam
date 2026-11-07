import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import AdminPage from './pages/AdminPage';
import HomePage from './pages/HomePage';
import InterviewPrepPage from './pages/InterviewPrepPage';
import LessonPage from './pages/LessonPage';
import LoginPage from './pages/LoginPage';
import SkillsPage from './pages/SkillsPage';
import TopicPage from './pages/TopicPage';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/UsersPage';
import { can } from './api';
import { useState } from 'react';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-[15px] transition-colors ${isActive ? 'bg-track font-medium text-ink' : 'text-muted hover:text-ink'}`;

export default function App() {
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  return (
    <div className="flex min-h-screen flex-col">
      {/* The only translucent surface: chrome defers to content. */}
      <header className="sticky top-0 z-20 border-b border-line/80 bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-3">Skip to content</a>
        <nav aria-label="Main navigation" className="mx-auto flex min-h-16 max-w-[1080px] flex-wrap items-center gap-1 px-5 py-2">
          <Link to="/" className="mr-2 flex shrink-0 items-center gap-2.5 rounded-lg sm:mr-4">
            <img src="/logo-mark.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="hidden font-display text-[19px] font-semibold tracking-tight sm:inline">Sarvaikam</span>
          </Link>
          <NavLink to="/" end className={navClass}>Explore</NavLink>
          <NavLink to="/interview-prep" className={navClass}><span className="sm:hidden">Prep</span><span className="hidden sm:inline">Interview prep</span></NavLink>
          <NavLink to="/skills" className={navClass}><span className="sm:hidden">Skills</span><span className="hidden sm:inline">Skill map</span></NavLink>
          {can(user, 'content.manage') && <NavLink to="/admin" end className={navClass}>Content</NavLink>}
          {can(user, 'candidates.view') && <NavLink to="/admin/users" className={navClass}>People</NavLink>}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <NavLink to="/profile" className={navClass}>Profile</NavLink>
                <button className="btn-quiet" onClick={() => { void logout().catch((cause: Error) => setLogoutError(cause.message)); }}>Sign out</button>
              </>
            ) : (
              <Link to="/login" className="btn">Sign in</Link>
            )}
          </div>
        </nav>
      </header>
      {logoutError && <p role="alert" className="mx-auto px-5 pt-4 text-danger">{logoutError}</p>}
      <main id="main-content" className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-12 sm:py-16">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/interview-prep" element={<InterviewPrepPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/topics/:topicSlug" element={<TopicPage />} />
          <Route path="/topics/:topicSlug/:lessonSlug" element={<LessonPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="*" element={
            <div className="py-24 text-center">
              <h1 className="text-4xl font-semibold">This page doesn't exist</h1>
              <Link to="/" className="link mt-4 inline-block">Go to Explore</Link>
            </div>
          } />
        </Routes>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1080px] items-center gap-3 px-5 py-8 text-[14px] text-muted">
          <img src="/logo-mark.png" alt="" className="h-5 w-5 rounded" />
          Sarvaikam. Learn one step at a time.
        </div>
      </footer>
    </div>
  );
}
