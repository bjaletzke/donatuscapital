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
        <div className="relative z-10 px-6 max-w-5xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-12">
              <img
                src="/thinker.png"
                alt=""
                className="h-36 w-auto md:h-52 brightness-0 invert opacity-95 drop-shadow-2xl"
              />
              <h1 className="text-center text-[#F5F5F3] md:text-left">
                <span className="block font-serif text-4xl md:text-6xl lg:text-7xl font-light leading-tight tracking-wide">
                  Donatus Capital
                </span>
                <span className="mt-4 block font-mono text-xs md:text-base uppercase tracking-[0.42em] opacity-80">
                  Strategic Investments
                </span>
              </h1>
            </div>
            <p className="mt-12 text-center text-lg md:text-xl lg:text-2xl font-light text-[#F5F5F3]/90 tracking-wide max-w-3xl mx-auto">
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
              <p className="font-serif text-2xl md:text-3xl lg:text-4xl font-light italic leading-relaxed">
                Rigorous fundamental analysis, combined with deep market
                insight.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Discovery Band with Cave/Ocean Image */}
      <section
        className="relative min-h-[45vh] flex items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/venti-views-_JwjoWbXt7c-unsplash.jpg')",
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#181b19]/95 via-[#181b19]/70 to-[#181b19]/85 dark:from-[#181b19]/98 dark:via-[#181b19]/80 dark:to-[#181b19]/90"></div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 w-full text-center text-[#F5F5F3]">
          <p className="font-serif text-2xl md:text-3xl font-light italic leading-relaxed opacity-90 mb-10">
            For those who know where to look.
          </p>
          <Link
            to="/investor"
            className="inline-block border border-[#F5F5F3]/40 px-8 py-3 font-mono text-xs uppercase tracking-[0.3em] text-[#F5F5F3]/90 transition-colors hover:border-[#F5F5F3] hover:bg-[#F5F5F3]/10"
          >
            Investor Access
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 text-center bg-[#F5F5F3] dark:bg-[#181b19] border-t border-[#181b19]/10 dark:border-[#F5F5F3]/10">
        <p className="font-mono text-sm tracking-wider opacity-50">
          Donatus Capital | London
        </p>
        <p className="font-mono text-sm tracking-wider opacity-50">Don't contact us.</p>
      </footer>
    </div>
  );
}
