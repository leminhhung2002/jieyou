import Navbar from '../components/Navbar.jsx';
import Hero from '../sections/Hero.jsx';
import Partners from '../sections/Partners.jsx';
import Services from '../sections/Services.jsx';
import HowItWorks from '../sections/HowItWorks.jsx';
import Pricing from '../sections/Pricing.jsx';
import DownloadApp from '../components/DownloadApp.jsx';
import Faq from '../components/Faq.jsx';
import News from '../components/News.jsx';
import SignupBanner from '../components/SignupBanner.jsx';
import Footer from '../components/Footer.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

// Figma: Landing page (112:10422)
export default function HomePage() {
  useDocumentTitle('JIEYOU – Mọi dịch vụ doanh nghiệp, một tài khoản');
  return (
    <div className="page">
      <Navbar />
      <main>
        <Hero />
        <Partners />
        <Services />
        <HowItWorks />
        <Pricing />
        <DownloadApp />
        <Faq />
        <News />
        <SignupBanner />
      </main>
      <Footer />
    </div>
  );
}
