import { Routes, Route } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { Navigation } from "./components/Navigation";
import { LandingPage } from "./components/LandingPage";
import { Dashboard } from "./components/Dashboard";
import { GroupPage } from "./components/GroupPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 text-white">
      <Navigation />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Routes>
            <Route path="/" element={
              <>
                <SignedIn>
                  <Dashboard />
                </SignedIn>
                <SignedOut>
                  <LandingPage />
                </SignedOut>
              </>
            } />
            <Route path="/group/:id" element={
              <ProtectedRoute>
                <GroupPage />
              </ProtectedRoute>
            } />
            <Route path="/sign-in/*" element={<RedirectToSignIn />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;