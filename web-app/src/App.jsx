import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { RequireAdmin, RequireAuth } from './components/ProtectedRoute';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

import SubjectsPage from './pages/student/SubjectsPage';
import SubscribePage from './pages/student/SubscribePage';
import ExamSetupPage from './pages/student/ExamSetupPage';
import ExamPage from './pages/student/ExamPage';
import ResultPage from './pages/student/ResultPage';
import HistoryPage from './pages/student/HistoryPage';
import LeaderboardPage from './pages/student/LeaderboardPage';
import AccountPage from './pages/student/AccountPage';

import OverviewPage from './pages/admin/OverviewPage';
import PaymentsPage from './pages/admin/PaymentsPage';
import StudentsPage from './pages/admin/StudentsPage';
import QuestionsPage from './pages/admin/QuestionsPage';
import SubjectsAdminPage from './pages/admin/SubjectsAdminPage';
import StatsPage from './pages/admin/StatsPage';

export default function App() {
  return (
    <Routes>
      {/* ---------- عام ---------- */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* ---------- الاختبار (بملء الشاشة، خارج الـ Layout) ---------- */}
      <Route
        path="/exam/:attemptId"
        element={
          <RequireAuth>
            <ExamPage />
          </RequireAuth>
        }
      />

      {/* ---------- الطالب ---------- */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <Layout variant="student" />
          </RequireAuth>
        }
      >
        <Route index element={<SubjectsPage />} />
        <Route path="subscribe/:subjectId" element={<SubscribePage />} />
        <Route path="exam-setup/:subjectId" element={<ExamSetupPage />} />
        <Route path="result/:attemptId" element={<ResultPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>

      {/* ---------- الإدارة ---------- */}
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <Layout variant="admin" />
          </RequireAdmin>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="questions" element={<QuestionsPage />} />
        <Route path="questions/:subjectId" element={<QuestionsPage />} />
        <Route path="subjects" element={<SubjectsAdminPage />} />
        <Route path="stats" element={<StatsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
