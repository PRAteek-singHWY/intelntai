import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ToolTabs from "@/components/ToolTabs";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <Hero />
        <ToolTabs />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
}
