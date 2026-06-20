import { AboutPage } from "@/components/AboutPage";
import { AppLayout } from "@/components/AppLayout";
import { DeveloperPage } from "@/components/DeveloperPage";
import { TripDashboard } from "@/components/TripDashboard";
import { WelcomeModal } from "@/components/WelcomeModal";
import { useAppRouter } from "@/lib/router";

function App() {
  const { page, navigate } = useAppRouter();

  return (
    <AppLayout page={page} onNavigate={navigate}>
      {page === "about" && <AboutPage />}
      {page === "developer" && <DeveloperPage />}
      {page === "home" && <TripDashboard />}
      <WelcomeModal onReadOverview={() => navigate("about")} />
    </AppLayout>
  );
}

export default App;
