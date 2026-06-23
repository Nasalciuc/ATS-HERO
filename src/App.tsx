import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./store/AppContext";
import LandingPage from "./pages/LandingPage";
import BuilderPage from "./pages/BuilderPage";
import AnalyzePage from "./pages/AnalyzePage";
import ScorePage from "./pages/ScorePage";
import NotFoundPage from "./pages/NotFoundPage";

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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
