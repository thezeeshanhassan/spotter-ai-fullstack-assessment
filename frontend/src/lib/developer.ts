/** Edit this file to update the Developer page content. */
export const DEVELOPER = {
  name: "Zeeshan Hassan",
  role: "Full-stack developer",
  bio: "I built this ELD Trip Planner for the Spotter AI full-stack assessment. My focus was accurate FMCSA Hours-of-Service logic, a clear DOT-style daily log UI, and a production-ready deploy on AWS and Vercel.",
  email: "thezeeshanhassan@gmail.com",
  repo: "https://github.com/thezeeshanhassan/spotter-ai-fullstack-assessment",
  highlights: [
    "Pure Python HOS engine with unit tests for every federal rule",
    "Live city search, route map with animated playback, PDF log export",
    "Backend on AWS EC2 (Docker + Caddy HTTPS), frontend on Vercel",
  ],
  stack: ["Django", "DRF", "React", "TypeScript", "Leaflet", "OpenRouteService", "Docker"],
} as const;
