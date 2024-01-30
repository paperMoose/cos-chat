import { ThemeToggle } from "@/app/components/layout/theme-toggle";
import { Github, Settings } from "lucide-react";
import dynamic from "next/dynamic";
import { useNavigate } from "react-router-dom";
import { GITHUB_URL, Path } from "../../constant";
import Locale from "../../locales";
import { Button } from "../ui/button";
import { useSidebarContext } from "@/app/components/home";
import { useTheme } from "next-themes";

const BotList = dynamic(async () => (await import("../bot/bot-list")).default, {
  loading: () => null,
});

export function SideBar(props: { className?: string }) {
  const navigate = useNavigate();
  const { setShowSidebar } = useSidebarContext();
  const { theme } = useTheme();
  const logoSrc = theme === "light" ? "/black_logo.png" : "/white_logo.png";

  return (
    <div className="h-full relative group border-r w-full md:w-[300px]">
      <div className="w-full h-full p-5 flex flex-col gap-5">
        <div className="flex flex-col flex-1">
          <div className="mb-5 flex items-center justify-between gap-5">
            <div>
              {" "}
              <a href={process.env.NEXT_PUBLIC_WEBAPP_URL}>
                <img src={logoSrc} alt="Image" />
              </a>
              <div>
                <div className="text-sm text-muted-foreground">
                  {Locale.Welcome.SubTitle}
                </div>
              </div>
            </div>
            <ThemeToggle />
          </div>
          <BotList />
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => {
              navigate(Path.Settings);
              setShowSidebar(false);
            }}
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(GITHUB_URL, "_blank")}
          >
            <Github className="mr-2 h-4 w-4" />
            <span>{Locale.Home.Github}</span>
          </Button> */}
        </div>
      </div>
    </div>
  );
}
