import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Card } from "@goddonebianu/design-system/card";
import { Container } from "@goddonebianu/design-system/container";
import { Heading } from "@goddonebianu/design-system/heading";
import { Atom, BookOpen, Music } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ProjectEntry = {
  href: string;
  titleKey: "languages" | "music" | "sciences";
  descKey: "languagesDesc" | "musicDesc" | "sciencesDesc";
  icon: LucideIcon;
};

const PROJECTS: ProjectEntry[] = [
  {
    href: "https://lang.lernu.cc",
    titleKey: "languages",
    descKey: "languagesDesc",
    icon: BookOpen,
  },
  {
    href: "https://music.lernu.cc",
    titleKey: "music",
    descKey: "musicDesc",
    icon: Music,
  },
  {
    href: "https://sci.lernu.cc",
    titleKey: "sciences",
    descKey: "sciencesDesc",
    icon: Atom,
  },
];

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <div className="min-h-screen bg-background-secondary">
      <header className="border-b border-border bg-card shadow-sm">
        <Container size="2xl" padding="sm" className="flex h-14 items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{t("brand")}</span>
          <LanguageSwitcher />
        </Container>
      </header>

      <Container size="2xl" padding="sm" className="py-16">
        <div className="flex flex-col items-center gap-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <Heading level="h1" className="text-4xl">
              {t("title")}
            </Heading>
            <p className="max-w-2xl text-base text-muted-foreground">{t("subtitle")}</p>
          </div>

          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
            {PROJECTS.map(({ href, titleKey, descKey, icon: Icon }) => (
              <Card
                key={href}
                variant="default"
                padding="lg"
                className="group h-full hover:-translate-y-0.5 hover:shadow-primary"
              >
                <a href={href} className="flex h-full flex-col gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-primary-100 text-primary-600 transition-colors group-hover:bg-primary-200">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="flex flex-col gap-2">
                    <Heading level="h3">{t(titleKey)}</Heading>
                    <p className="text-sm text-muted-foreground">{t(descKey)}</p>
                  </div>
                </a>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
