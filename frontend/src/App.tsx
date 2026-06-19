import { AboutPage } from "@/components/AboutPage";
import { AppLayout } from "@/components/AppLayout";
import { TripDashboard } from "@/components/TripDashboard";
import { useAppRouter } from "@/lib/router";

function App() {
  const { page, navigate } = useAppRouter();

  return (
    <AppLayout page={page} onNavigate={navigate}>
      {page === "about" ? <AboutPage /> : <TripDashboard />}
    </AppLayout>
  );
}

export default App;
