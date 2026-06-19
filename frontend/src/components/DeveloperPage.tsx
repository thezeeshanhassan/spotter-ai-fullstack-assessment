import { ExternalLink, Mail, User } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEVELOPER } from "@/lib/developer";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function DeveloperPage() {
  const { name, role, bio, email, repo, highlights, stack } = DEVELOPER;

  return (
    <div className="space-y-6 pb-12">
      <Card>
        <CardHeader>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-2xl font-bold text-primary"
              aria-hidden
            >
              {initials(name)}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <User className="h-6 w-6 text-accent" />
                {name}
              </CardTitle>
              <CardDescription className="mt-1 text-base">{role}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-relaxed text-muted-foreground">{bio}</p>

          <div className="flex flex-wrap gap-2">
            <LinkButton href={repo} icon={<ExternalLink className="h-4 w-4" />}>
              Source repo
            </LinkButton>
            <LinkButton href={`mailto:${email}`} icon={<Mail className="h-4 w-4" />}>
              Email
            </LinkButton>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What I focused on</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tech stack</CardTitle>
          <CardDescription>Used in this project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {stack.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground"
              >
                {tech}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Built for the Spotter AI full-stack assessment · June 2026
      </p>
    </div>
  );
}

function LinkButton({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
    >
      {icon}
      {children}
    </a>
  );
}
