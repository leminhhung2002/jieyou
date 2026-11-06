import { asset } from '../utils/format.js';
import styles from './Partners.module.css';

const LOGOS = [
  ['amazon-pay', 'Amazon Pay'], ['amex', 'Amex'], ['apple-pay', 'Apple Pay'], ['binance', 'Binance'],
  ['bitcoin', 'Bitcoin'], ['bitcoin-cash', 'Bitcoin Cash'], ['citadele', 'Citadele'], ['coinbase', 'Coinbase'],
  ['interac', 'Interac'], ['klarna', 'Klarna'], ['paypal', 'Paypal'], ['revolut', 'Revolut'],
  ['shopify', 'Shopify'], ['stripe', 'Stripe'], ['swift', 'Swift'], ['visa', 'Visa'], ['wise', 'Wise'],
];

// Figma: Frame 1171278232 (112:10488) – dải logo chạy ngang có mặt nạ mờ hai đầu
export default function Partners() {
  return (
    <section className={styles.section} aria-labelledby="partners-title">
      <h2 id="partners-title" className={styles.title}>
        Đối tác với
      </h2>
      <div className={styles.viewport}>
        {/* Nhân đôi danh sách để chạy vòng liền mạch; bản sao ẩn với trình đọc màn hình */}
        <div className={styles.track}>
          {[0, 1].map((copy) => (
            <ul key={copy} className={styles.row} aria-hidden={copy === 1 || undefined}>
              {LOGOS.map(([file, name]) => (
                <li key={file}>
                  <img src={asset(`partners/${file}.svg`)} width="106.667" height="80" alt={copy ? '' : name} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
