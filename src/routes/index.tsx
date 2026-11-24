import { createFileRoute } from "@tanstack/react-router";
import { FloorlineApp } from "@/components/floorline-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <FloorlineApp />;
}
