import { Link } from "react-router";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F5F5F3] dark:bg-[#181b19] text-[#181b19] dark:text-[#F5F5F3]">
      {/* Fixed header */}
      <header className="fixed inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <span className="font-mono text-xs font-normal uppercase tracking-[0.25em] text-[#F5F5F3]/80">
            Donatus Capital
          </span>
          <Link
            to="/investor"
            className="border border-[#F5F5F3]/30 bg-[#181b19]/30 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-[#F5F5F3]/90 backdrop-blur-sm transition-colors hover:border-[#F5F5F3]/60 hover:text-[#F5F5F3]"
          >
            Investor Login
          </Link>
        </div>
      </header>

      {/* Hero Section with Train/Red Rocks Image */}
      <section
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/jony-y-7IR2CV2zlWo-unsplash.jpg')" }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#181b19]/80 via-[#181b19]/70 to-[#181b19]/90 dark:from-[#181b19]/85 dark:via-[#181b19]/75 dark:to-[#181b19]/95"></div>

        {/* Hero Content */}
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center">
            <img
              src="/DC_clean.svg"
              alt="Donatus Capital"
              className="w-full max-w-xl lg:max-w-2xl mx-auto mb-12 drop-shadow-2xl"
            />
            <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl font-light tracking-wide text-[#F5F5F3] mb-6 leading-tight">
              Strategic Investments.
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl font-light text-[#F5F5F3]/90 tracking-wide max-w-3xl mx-auto">
              Navigating global markets to deliver exceptional returns.
            </p>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 z-10">
          <div className="w-6 h-10 border-2 border-[#F5F5F3]/50 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-[#F5F5F3]/70 rounded-full animate-bounce"></div>
          </div>
        </div>
      </section>

      {/* Our Approach Section */}
      <section className="py-24 md:py-32 px-6 bg-[#F5F5F3] dark:bg-[#181b19]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-mono text-sm md:text-base font-normal tracking-[0.2em] uppercase mb-8 opacity-70">
            Our Approach
          </h2>
          <p className="font-serif text-2xl md:text-3xl lg:text-4xl font-light leading-relaxed opacity-90">
            Donatus Capital is a London-based investment fund focused on
            delivering sustainable long-term returns through strategic capital
            allocation and active portfolio management.
          </p>
        </div>
      </section>

      {/* Vision Section with Cliff Image */}
      <section
        className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/roberto-shumski-iA2Z1U98svg-unsplash.jpg')",
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#181b19]/90 via-[#181b19]/70 to-[#181b19]/60 dark:from-[#181b19]/95 dark:via-[#181b19]/80 dark:to-[#181b19]/70"></div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 w-full">
          <div className="max-w-2xl mx-auto lg:mx-0 text-center lg:text-left">
            <div className="text-[#F5F5F3]">
              <h3 className="font-mono text-sm md:text-base font-normal tracking-[0.2em] uppercase mb-6 opacity-90">
                Investment Philosophy
              </h3>
              <p className="font-serif text-xl md:text-2xl lg:text-3xl font-light leading-relaxed">
                Our approach combines rigorous fundamental analysis with a deep
                understanding of market dynamics to identify compelling
                investment opportunities across global markets.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Box - Bridging the Two Sections */}
      <div className="relative z-20 -mt-32 mb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="backdrop-blur-md bg-[#F5F5F3]/90 dark:bg-[#181b19]/90 border-2 border-[#181b19]/20 dark:border-[#F5F5F3]/20 rounded-none p-12 md:p-16 shadow-2xl">
            <p className="font-serif text-2xl md:text-3xl lg:text-4xl font-light italic leading-relaxed text-center">
              Rigorous fundamental analysis combined with deep market insights
            </p>
          </div>
        </div>
      </div>

      {/* Discovery Section with Cave/Ocean Image */}
      <section
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/venti-views-_JwjoWbXt7c-unsplash.jpg')",
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#181b19]/95 via-[#181b19]/60 to-[#181b19]/80 dark:from-[#181b19]/98 dark:via-[#181b19]/70 dark:to-[#181b19]/85"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16 text-[#F5F5F3]">
            <div className="text-center">
              <h4 className="font-mono text-sm font-normal tracking-[0.2em] uppercase mb-4 opacity-90">
                The Journey
              </h4>
              <p className="text-lg font-light leading-relaxed opacity-95">
                Every investment begins with a journey of discovery, moving
                forward with purpose and determination.
              </p>
            </div>
            <div className="text-center">
              <h4 className="font-mono text-sm font-normal tracking-[0.2em] uppercase mb-4 opacity-90">
                The Vision
              </h4>
              <p className="text-lg font-light leading-relaxed opacity-95">
                We seek elevated perspectives to identify opportunities others
                may overlook in the vast landscape.
              </p>
            </div>
            <div className="text-center">
              <h4 className="font-mono text-sm font-normal tracking-[0.2em] uppercase mb-4 opacity-90">
                The Discovery
              </h4>
              <p className="text-lg font-light leading-relaxed opacity-95">
                Through careful analysis, we uncover pathways to sustainable
                value and long-term growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 text-center bg-[#F5F5F3] dark:bg-[#181b19] border-t border-[#181b19]/10 dark:border-[#F5F5F3]/10">
        <p className="font-mono text-sm tracking-wider opacity-50">
          Donatus Capital | London
        </p>
        <p className="font-mono text-sm tracking-wider opacity-50">Don't contact us.</p>
        <p className="mt-4">
          <Link
            to="/investor"
            className="font-mono text-xs uppercase tracking-[0.2em] opacity-40 transition-opacity hover:opacity-80"
          >
            Investor Login
          </Link>
        </p>
      </footer>
    </div>
  );
}
