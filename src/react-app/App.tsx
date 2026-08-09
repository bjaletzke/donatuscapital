import { BrowserRouter, Route, Routes } from "react-router";
import { RequireSession, SessionProvider } from "@/lib/session";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import InvestorLogin from "@/pages/InvestorLogin";
import Projects from "@/pages/Projects";
import ProjectPage from "@/pages/ProjectPage";

function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/investor" element={<InvestorLogin />} />
          <Route
            path="/investor/projects"
            element={
              <RequireSession>
                <Projects />
              </RequireSession>
            }
          />
          <Route
            path="/investor/projects/:slug"
            element={
              <RequireSession>
                <ProjectPage />
              </RequireSession>
            }
          />
        </Routes>
        <Toaster />
      </SessionProvider>
    </BrowserRouter>
  );
}

export default App;
