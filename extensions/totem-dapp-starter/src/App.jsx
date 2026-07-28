/**
 * App — root component.
 *
 * TotemProvider wraps the entire tree so every component shares one
 * connection state. This is required by the v4.1 React pattern:
 * multiple providers create isolated states and break the UI.
 */
import { TotemProvider, useTotem } from './totem-context.jsx';
import { NavBar } from './components/NavBar.jsx';
import { LandingPage } from './components/LandingPage.jsx';
import { Dashboard } from './components/Dashboard.jsx';

function AppContent() {
  const { verified } = useTotem();
  return (
    <>
      <NavBar />
      {verified ? <Dashboard /> : <LandingPage />}
    </>
  );
}

export default function App() {
  return (
    <TotemProvider>
      <AppContent />
    </TotemProvider>
  );
}
