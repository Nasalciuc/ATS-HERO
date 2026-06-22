import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Problem from "../components/Problem";
import Tool from "../components/Tool";
import Features from "../components/Features";
import Testimonials from "../components/Testimonials";
import Faq from "../components/Faq";
import Footer from "../components/Footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Tool />
        <Features />
        <Testimonials />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
