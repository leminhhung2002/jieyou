import Navbar from '../Navbar.jsx';
import SignupBanner from '../SignupBanner.jsx';
import Footer from '../Footer.jsx';
import ServiceHero from './ServiceHero.jsx';

/**
 * Khung chung của mọi trang dịch vụ: NAV + hero + (các section riêng) + Banner + Footer.
 */
export default function ServiceShell({ service, hero, children }) {
  return (
    <div className="page" style={{ background: 'var(--color-black)' }}>
      <Navbar />
      <main>
        <ServiceHero serviceName={service.name} {...hero} />
        {children}
        <SignupBanner />
      </main>
      <Footer />
    </div>
  );
}
