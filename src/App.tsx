import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./store/AppContext";
import LandingPage from "./pages/LandingPage";
import BuilderPage from "./pages/BuilderPage";
import AnalyzePage from "./pages/AnalyzePage";
import ScorePage from "./pages/ScorePage";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app/create" element={<BuilderPage />} />
          <Route path="/app/improve" element={<AnalyzePage mode="improve" />} />
          <Route path="/app/jobfit" element={<AnalyzePage mode="jobfit" />} />
          <Route path="/app/score" element={<ScorePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
